"""Cloud Tasks dispatch — the only place this project talks to Cloud Tasks.

One queue, three task types, distinguished by HTTP route rather than by a
discriminator inside the payload, so Cloud Run's router does the dispatch
and no handler needs a type switch.

Two properties matter more than anything else in this module:

  1. Every task name is DETERMINISTIC. Cloud Tasks enforces name uniqueness
     server-side, which is what makes `finalize-{run_id}` schedulable exactly
     once despite ten business workers racing to schedule it, and what makes
     SCOUT's business-task dispatch safely replayable.

  2. `AlreadyExists` is a SUCCESS signal, not an error. It means "the task
     this caller wanted to exist already exists" — which is precisely the
     post-condition the caller asked for. `enqueue` returns False in that
     case so a caller that wants to count fresh creations can, but no caller
     is required to care.

Configuration comes from the environment so nothing here is hardcoded to a
project: TASKS_QUEUE, TASKS_LOCATION, SERVICE_URL, TASK_INVOKER_SA and
GOOGLE_CLOUD_PROJECT.
"""

from __future__ import annotations

import functools
import json
import os
from typing import Any

from google.api_core import exceptions as gcp_exceptions
from google.cloud import tasks_v2
from google.protobuf import duration_pb2

SCOUT_ROUTE = "/tasks/scout"
INVESTIGATE_ROUTE = "/tasks/investigate"
FINALIZE_ROUTE = "/tasks/finalize"

# Frozen per-task dispatch deadlines (audit section L). SCOUT is five Places
# searches; BUSINESS is one investigation (3 Gemini calls + page fetches);
# FINALIZE runs the whole Verification batch sequentially and is by far the
# longest. Cloud Run's request timeout must be >= the largest of these.
SCOUT_DEADLINE_S = 300
INVESTIGATE_DEADLINE_S = 600
FINALIZE_DEADLINE_S = 1800


class TasksConfigurationError(RuntimeError):
    """A required Cloud Tasks environment variable is missing."""


def scout_task_name(run_id: str) -> str:
    return f"scout-{run_id}"


def business_task_name(run_id: str, business_id: str) -> str:
    return f"biz-{run_id}-{business_id}"


def finalize_task_name(run_id: str) -> str:
    return f"finalize-{run_id}"


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise TasksConfigurationError(f"Missing required environment variable: {name}")
    return value


@functools.cache
def get_client() -> tasks_v2.CloudTasksClient:
    return tasks_v2.CloudTasksClient()


def queue_path() -> str:
    return get_client().queue_path(
        _require("GOOGLE_CLOUD_PROJECT"),
        _require("TASKS_LOCATION"),
        _require("TASKS_QUEUE"),
    )


def enqueue(
    *,
    route: str,
    payload: dict[str, Any],
    name: str,
    dispatch_deadline_s: int,
) -> bool:
    """Create one deterministically named OIDC-authenticated HTTP task.

    Returns True if this call created the task, False if Cloud Tasks reported
    it already existed. Any other error propagates — callers decide whether a
    given task type's dispatch failure is fatal or retryable.
    """
    service_url = _require("SERVICE_URL").rstrip("/")
    invoker_sa = _require("TASK_INVOKER_SA")

    deadline = duration_pb2.Duration()
    deadline.seconds = dispatch_deadline_s

    task = tasks_v2.Task(
        name=f"{queue_path()}/tasks/{name}",
        dispatch_deadline=deadline,
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=f"{service_url}{route}",
            headers={"Content-Type": "application/json"},
            body=json.dumps(payload).encode("utf-8"),
            oidc_token=tasks_v2.OidcToken(
                service_account_email=invoker_sa,
                audience=service_url,
            ),
        ),
    )

    try:
        get_client().create_task(parent=queue_path(), task=task)
    except gcp_exceptions.AlreadyExists:
        # Deterministic naming did its job: the task the caller wanted
        # already exists. This is the duplicate-suppression mechanism
        # working, not a failure.
        return False
    return True


def enqueue_scout(run_id: str) -> bool:
    return enqueue(
        route=SCOUT_ROUTE,
        payload={"run_id": run_id},
        name=scout_task_name(run_id),
        dispatch_deadline_s=SCOUT_DEADLINE_S,
    )


def enqueue_investigate(run_id: str, investigation_id: str, business_id: str) -> bool:
    return enqueue(
        route=INVESTIGATE_ROUTE,
        payload={
            "run_id": run_id,
            "investigation_id": investigation_id,
            "business_id": business_id,
        },
        name=business_task_name(run_id, business_id),
        dispatch_deadline_s=INVESTIGATE_DEADLINE_S,
    )


def enqueue_finalize(run_id: str) -> bool:
    return enqueue(
        route=FINALIZE_ROUTE,
        payload={"run_id": run_id},
        name=finalize_task_name(run_id),
        dispatch_deadline_s=FINALIZE_DEADLINE_S,
    )
