"""FINALIZE task: Verification suppression, Matcher coverage, terminal Run."""

from __future__ import annotations

import pytest
from orchestration_factories import (
    RUN_ID,
    make_hypothesis,
    make_investigation,
    make_verification,
    seed_run_with_investigations,
)

from app.investigator import run_orchestrator, verification_batch_runner
from app.investigator.models import (
    InvestigationStatus,
    OpportunityStatus,
    RunStatus,
    VerificationExecutionStatus,
)

BUSINESS_IDS = ["biz0", "biz1"]


@pytest.fixture
def spy_verification(monkeypatch: pytest.MonkeyPatch):
    """Record which hypotheses were actually sent for verification, and
    persist a COMPLETED Verification for each, as the real batch runner would."""
    batches: list[list[str]] = []

    def fake_batch(run_id, businesses_by_id, definitions_by_id, hypotheses, *, persist):
        from app.investigator import firestore_store

        batches.append([h.hypothesis_id for h in hypotheses])
        for i, hypothesis in enumerate(hypotheses):
            firestore_store.save_verification(
                make_verification(
                    f"v-fresh-{hypothesis.hypothesis_id}-{i}",
                    hypothesis,
                    created_at="2026-08-26T09:00:00+00:00",
                )
            )
        return object()

    monkeypatch.setattr(
        verification_batch_runner, "run_verification_batch", fake_batch
    )
    return batches


def _seed_completed_run(store, *, hypothesis_statuses=None):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    statuses = hypothesis_statuses or [
        OpportunityStatus.CONFIRMED,
        OpportunityStatus.CONTRADICTED,
        OpportunityStatus.INSUFFICIENT_EVIDENCE,
    ]
    hypotheses = []
    for i, status in enumerate(statuses):
        hypothesis = make_hypothesis(f"h{i}", BUSINESS_IDS[i % 2], status=status)
        store.save_hypothesis(hypothesis)
        hypotheses.append(hypothesis)
    return hypotheses


def test_finalize_before_investigations_are_terminal_asks_for_retry(
    store, tasks, spy_verification
):
    seed_run_with_investigations(store, BUSINESS_IDS)

    with pytest.raises(run_orchestrator.TaskNotReady):
        run_orchestrator.finalize_step(RUN_ID)

    assert spy_verification == []


def test_finalize_before_every_investigation_exists_asks_for_retry(
    store, tasks, spy_verification
):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    del store.investigations[f"{RUN_ID}__biz1"]

    with pytest.raises(run_orchestrator.TaskNotReady):
        run_orchestrator.finalize_step(RUN_ID)


def test_finalize_on_a_terminal_run_is_a_noop(store, tasks, spy_verification):
    _seed_completed_run(store)
    store.runs[RUN_ID]["status"] = RunStatus.COMPLETED.value

    result = run_orchestrator.finalize_step(RUN_ID)

    assert result == {"status": "noop", "reason": "run_terminal"}
    assert spy_verification == [], "a terminal run must spend zero Gemini calls"
    assert store.matches == {}


def test_finalize_runs_verification_then_matches_every_hypothesis(
    store, tasks, spy_verification
):
    hypotheses = _seed_completed_run(store)

    result = run_orchestrator.finalize_step(RUN_ID)

    assert result["status"] == "ok"
    assert len(spy_verification) == 1
    # One Match per hypothesis — verified or not, MATCHED or not.
    assert sorted(store.matches) == sorted(h.hypothesis_id for h in hypotheses)
    assert result["matches_written"] == len(hypotheses)
    assert all(
        store.matches[h.hypothesis_id]["match_id"] == h.hypothesis_id
        for h in hypotheses
    )


def test_completed_verification_is_never_re_run(store, tasks, spy_verification):
    hypotheses = _seed_completed_run(store)
    store.save_verification(make_verification("v-old", hypotheses[0]))

    run_orchestrator.finalize_step(RUN_ID)

    assert hypotheses[0].hypothesis_id not in spy_verification[0]


def test_failed_verification_is_never_re_run(store, tasks, spy_verification):
    """A technically FAILED Verification is already a terminal analytical
    state the Matcher handles; re-running it would buy the same conclusion for
    two more Gemini calls."""
    hypotheses = _seed_completed_run(store)
    store.save_verification(
        make_verification(
            "v-failed",
            hypotheses[0],
            execution_status=VerificationExecutionStatus.FAILED,
            outcome=None,
        )
    )

    run_orchestrator.finalize_step(RUN_ID)

    assert hypotheses[0].hypothesis_id not in spy_verification[0]


def test_in_progress_verification_orphan_is_re_run_and_superseded(
    store, tasks, spy_verification
):
    hypotheses = _seed_completed_run(store)
    orphan = make_verification(
        "v-orphan",
        hypotheses[0],
        execution_status=VerificationExecutionStatus.IN_PROGRESS,
        outcome=None,
        created_at="2026-08-26T01:00:00+00:00",
    )
    store.save_verification(orphan)

    run_orchestrator.finalize_step(RUN_ID)

    assert hypotheses[0].hypothesis_id in spy_verification[0]
    # The orphan is preserved, never mutated or deleted...
    assert "v-orphan" in store.verifications
    # ...and the newer record is the one the Match cites.
    assert store.matches[hypotheses[0].hypothesis_id]["verification_id"] != "v-orphan"


def test_finalize_retry_writes_no_duplicate_matches(store, tasks, spy_verification):
    hypotheses = _seed_completed_run(store)
    run_orchestrator.finalize_step(RUN_ID)
    first = dict(store.matches)

    # Re-open the run the way a retry after a crashed finalize would find it.
    store.runs[RUN_ID]["status"] = RunStatus.FINALIZING.value
    store.runs[RUN_ID]["completed_at"] = None
    run_orchestrator.finalize_step(RUN_ID)

    assert sorted(store.matches) == sorted(first)
    assert len(store.matches) == len(hypotheses)
    assert len(spy_verification) == 1, "no hypothesis is verified twice"


def test_run_completes_when_no_investigation_failed(store, tasks, spy_verification):
    _seed_completed_run(store)

    result = run_orchestrator.finalize_step(RUN_ID)

    run = store.get_run(RUN_ID)
    assert result["run_status"] == RunStatus.COMPLETED.value
    assert run["status"] == RunStatus.COMPLETED.value
    assert run["completed_at"] is not None
    assert run["investigation_count"] == 2
    assert run["completed_investigation_count"] == 2
    assert run["failed_investigation_count"] == 0


def test_run_is_failed_when_a_business_failed_but_results_are_still_produced(
    store, tasks, spy_verification
):
    """The frozen finalize_run rule is preserved: any failed Investigation
    means the Run is not a fully successful run. The useful output is still
    produced and still visible through the counts."""
    hypotheses = _seed_completed_run(store)
    store.save_investigation(
        make_investigation("biz1", status=InvestigationStatus.FAILED)
    )

    result = run_orchestrator.finalize_step(RUN_ID)

    run = store.get_run(RUN_ID)
    assert result["run_status"] == RunStatus.FAILED.value
    assert run["status"] == RunStatus.FAILED.value
    assert run["completed_investigation_count"] == 1
    assert run["failed_investigation_count"] == 1
    assert len(store.matches) == len(hypotheses), "partial results are still written"
