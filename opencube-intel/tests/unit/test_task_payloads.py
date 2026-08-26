"""Internal task boundary: payload validation and the task-caller check."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import router

TASK_HEADERS = {"X-CloudTasks-TaskName": "scout-run-1"}

ROUTES_AND_VALID_PAYLOADS = [
    ("/tasks/scout", {"run_id": "r1"}),
    (
        "/tasks/investigate",
        {"run_id": "r1", "investigation_id": "r1__b1", "business_id": "b1"},
    ),
    ("/tasks/finalize", {"run_id": "r1"}),
]


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.mark.parametrize("route,payload", ROUTES_AND_VALID_PAYLOADS)
def test_task_routes_reject_a_missing_field(client, store, tasks, route, payload):
    incomplete = dict(payload)
    incomplete.pop(next(iter(incomplete)))
    assert client.post(route, json=incomplete, headers=TASK_HEADERS).status_code == 422


@pytest.mark.parametrize("route,payload", ROUTES_AND_VALID_PAYLOADS)
def test_task_routes_reject_a_wrong_type(client, store, tasks, route, payload):
    wrong = dict(payload, run_id={"not": "a string"})
    assert client.post(route, json=wrong, headers=TASK_HEADERS).status_code == 422


@pytest.mark.parametrize("route,payload", ROUTES_AND_VALID_PAYLOADS)
def test_task_routes_reject_an_extra_field(client, store, tasks, route, payload):
    extra = dict(payload, injected="surprise")
    assert client.post(route, json=extra, headers=TASK_HEADERS).status_code == 422


@pytest.mark.parametrize("route,payload", ROUTES_AND_VALID_PAYLOADS)
def test_task_routes_reject_a_caller_without_the_cloud_tasks_header(
    client, store, tasks, route, payload
):
    """Hygiene only -- the real boundary is Cloud Run IAM on a private
    service. This just makes a hand-rolled call obviously wrong."""
    assert client.post(route, json=payload).status_code == 403


@pytest.mark.parametrize("route,payload", ROUTES_AND_VALID_PAYLOADS)
def test_task_routes_answer_404_for_an_unknown_run(
    client, store, tasks, route, payload
):
    assert client.post(route, json=payload, headers=TASK_HEADERS).status_code == 404


def test_finalize_answers_503_when_the_run_is_not_ready(client, store, tasks):
    from orchestration_factories import RUN_ID, seed_run_with_investigations

    seed_run_with_investigations(store, ["biz0"])

    response = client.post(
        "/tasks/finalize", json={"run_id": RUN_ID}, headers=TASK_HEADERS
    )

    assert response.status_code == 503, "a not-ready finalize must be retried"
