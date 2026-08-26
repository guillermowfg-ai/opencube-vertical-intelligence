"""Finalization is scheduled exactly once, without a transaction or a lock.

Ten workers may observe "all Investigations terminal" at the same instant and
all ten may try to schedule finalization. Correctness comes from Cloud Tasks
enforcing name uniqueness on `finalize-{run_id}`, not from any Firestore
coordination — which is why nothing here needs to be atomic.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from orchestration_factories import (
    RUN_ID,
    make_investigation,
    make_run,
    seed_run_with_investigations,
)

from app.investigator import run_orchestrator
from app.investigator.models import InvestigationStatus

BUSINESS_IDS = [f"biz{i}" for i in range(10)]


def test_ten_racing_workers_schedule_finalization_once(store, tasks):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(
            pool.map(
                lambda _: run_orchestrator.maybe_enqueue_finalize(RUN_ID),
                range(10),
            )
        )

    assert sum(1 for created in results if created) == 1, "exactly one creator wins"
    assert tasks.names("finalize-") == [f"finalize-{RUN_ID}"]
    assert len(tasks.attempts) == 10, "every worker did attempt it"


def test_no_finalization_while_any_investigation_is_in_progress(store, tasks):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    store.save_investigation(
        make_investigation("biz3", status=InvestigationStatus.IN_PROGRESS)
    )

    assert run_orchestrator.maybe_enqueue_finalize(RUN_ID) is False
    assert tasks.tasks == {}


def test_no_finalization_before_every_investigation_exists(store, tasks):
    """The readiness barrier is businesses_total, not the number of documents
    that happen to have been written so far."""
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    del store.investigations[f"{RUN_ID}__biz9"]

    assert run_orchestrator.maybe_enqueue_finalize(RUN_ID) is False
    assert tasks.tasks == {}


def test_no_finalization_before_scout_commits_the_barrier(store, tasks):
    store.save_run(make_run())  # businesses_total is None

    assert run_orchestrator.maybe_enqueue_finalize(RUN_ID) is False
    assert tasks.tasks == {}


def test_a_failed_business_still_lets_the_run_finalize(store, tasks):
    """Nine completed plus one failed is a terminal investigation set: the run
    must proceed to Verification and Matching over what did succeed."""
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    store.save_investigation(
        make_investigation("biz7", status=InvestigationStatus.FAILED)
    )

    assert run_orchestrator.maybe_enqueue_finalize(RUN_ID) is True
    assert tasks.names("finalize-") == [f"finalize-{RUN_ID}"]


def test_finalize_enqueued_at_is_audit_metadata_only(store, tasks):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    run_orchestrator.maybe_enqueue_finalize(RUN_ID)
    assert store.get_run(RUN_ID)["finalize_enqueued_at"] is not None

    # Wiping the field does not re-open the gate: Cloud Tasks still holds the
    # name, so control flow never depended on the field in the first place.
    store.runs[RUN_ID]["finalize_enqueued_at"] = None
    assert run_orchestrator.maybe_enqueue_finalize(RUN_ID) is False
    assert len(tasks.names("finalize-")) == 1
