"""BUSINESS task: one investigation, isolated failure, cheap re-delivery."""

from __future__ import annotations

import pytest
from orchestration_factories import RUN_ID, seed_run_with_investigations

from app.investigator import investigator, run_orchestrator
from app.investigator.models import InvestigationStatus, RunStatus

BUSINESS_IDS = ["biz0", "biz1", "biz2"]


@pytest.fixture
def spy_investigation(monkeypatch: pytest.MonkeyPatch):
    calls: list[dict] = []

    def fake_run_investigation(run, business, definitions, *, investigation, persist):
        calls.append(
            {
                "run_id": run.run_id,
                "business_id": business.business_id,
                "investigation_id": investigation.investigation_id,
                "persist": persist,
                "definitions": [d.opportunity_id for d in definitions],
            }
        )
        investigation.status = InvestigationStatus.COMPLETED
        investigation.completed_at = "2026-08-26T00:05:00+00:00"
        from app.investigator import firestore_store

        firestore_store.save_investigation(investigation)
        return object()

    monkeypatch.setattr(investigator, "run_investigation", fake_run_investigation)
    return calls


def _invocation(business_id: str) -> tuple[str, str, str]:
    return RUN_ID, f"{RUN_ID}__{business_id}", business_id


def test_investigate_runs_the_accepted_investigator_once(
    store, tasks, spy_investigation
):
    seed_run_with_investigations(store, BUSINESS_IDS)

    result = run_orchestrator.investigate_step(*_invocation("biz0"))

    assert result["status"] == "ok"
    assert len(spy_investigation) == 1
    call = spy_investigation[0]
    assert call["investigation_id"] == f"{RUN_ID}__biz0"
    assert call["persist"] is True
    # The pre-created Investigation is passed through, so no duplicate record.
    assert len(store.investigations) == 3


def test_redelivery_of_a_completed_investigation_is_a_cheap_noop(
    store, tasks, spy_investigation
):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )

    result = run_orchestrator.investigate_step(*_invocation("biz0"))

    assert result == {"status": "noop", "reason": "investigation_terminal"}
    assert spy_investigation == [], "a re-delivery must not spend Gemini calls"


def test_redelivery_of_a_failed_investigation_is_a_cheap_noop(
    store, tasks, spy_investigation
):
    seed_run_with_investigations(store, BUSINESS_IDS, status=InvestigationStatus.FAILED)

    result = run_orchestrator.investigate_step(*_invocation("biz0"))

    assert result["status"] == "noop"
    assert spy_investigation == []


def test_terminal_run_guard_blocks_late_deliveries(store, tasks, spy_investigation):
    """A delivery arriving after the Run is already terminal must not start
    new analytical work."""
    seed_run_with_investigations(store, BUSINESS_IDS, run_status=RunStatus.COMPLETED)

    result = run_orchestrator.investigate_step(*_invocation("biz0"))

    assert result == {"status": "noop", "reason": "run_terminal"}
    assert spy_investigation == []
    assert tasks.tasks == {}, "no finalization is scheduled for a terminal Run"


def test_investigation_failure_is_isolated_to_its_own_business(
    store, tasks, monkeypatch
):
    def boom(*_args, **_kwargs):
        raise RuntimeError("website fetch exploded")

    monkeypatch.setattr(investigator, "run_investigation", boom)
    seed_run_with_investigations(store, BUSINESS_IDS)

    result = run_orchestrator.investigate_step(*_invocation("biz0"))

    assert result["status"] == "investigation_failed"
    assert "website fetch exploded" in result["reason"]

    failed = store.get_investigation(f"{RUN_ID}__biz0")
    assert failed["status"] == InvestigationStatus.FAILED.value
    assert failed["completed_at"] is not None

    for other in ("biz1", "biz2"):
        assert (
            store.get_investigation(f"{RUN_ID}__{other}")["status"]
            == InvestigationStatus.IN_PROGRESS.value
        )


def test_missing_investigation_document_is_permanent(store, tasks, spy_investigation):
    seed_run_with_investigations(store, BUSINESS_IDS)

    with pytest.raises(run_orchestrator.RunNotFound):
        run_orchestrator.investigate_step(RUN_ID, f"{RUN_ID}__ghost", "ghost")


def test_missing_business_document_fails_only_that_investigation(
    store, tasks, spy_investigation
):
    seed_run_with_investigations(store, BUSINESS_IDS)
    del store.businesses["biz0"]

    result = run_orchestrator.investigate_step(*_invocation("biz0"))

    assert result["status"] == "investigation_failed"
    assert spy_investigation == []
    assert (
        store.get_investigation(f"{RUN_ID}__biz0")["status"]
        == InvestigationStatus.FAILED.value
    )


def test_last_terminal_investigation_schedules_finalization_once(
    store, tasks, spy_investigation
):
    seed_run_with_investigations(store, BUSINESS_IDS)

    for business_id in BUSINESS_IDS:
        run_orchestrator.investigate_step(*_invocation(business_id))

    assert tasks.names("finalize-") == [f"finalize-{RUN_ID}"]
    assert store.get_run(RUN_ID)["finalize_enqueued_at"] is not None


def test_finalize_enqueue_transport_error_requests_a_retry(
    store, tasks, spy_investigation
):
    """The investigation is already terminal at that point, so the retry costs
    nothing analytically — but it must happen, or the run would strand."""
    seed_run_with_investigations(store, ["only"])
    tasks.raise_for_names = {f"finalize-{RUN_ID}"}

    with pytest.raises(run_orchestrator.TaskNotReady):
        run_orchestrator.investigate_step(RUN_ID, f"{RUN_ID}__only", "only")

    assert (
        store.get_investigation(f"{RUN_ID}__only")["status"]
        == InvestigationStatus.COMPLETED.value
    )

    tasks.raise_for_names = set()
    result = run_orchestrator.investigate_step(RUN_ID, f"{RUN_ID}__only", "only")

    assert result["status"] == "noop"
    assert len(spy_investigation) == 1, "the retry must not re-run the investigation"
    assert tasks.names("finalize-") == [f"finalize-{RUN_ID}"]
