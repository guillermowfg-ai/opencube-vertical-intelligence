from app.investigator import batch_runner, firestore_store
from app.investigator.models import (
    Business,
    ContactRecommendation,
    Investigation,
    InvestigationResult,
    InvestigationStatus,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
    Run,
    RunStatus,
    UsageMetadata,
)

RUN_ID = "run-1"


def _run() -> Run:
    return Run(
        run_id=RUN_ID,
        created_at="2026-08-25T00:00:00Z",
        status=RunStatus.IN_PROGRESS,
        vertical="Med Spa",
        geography="Miami-Dade County, Florida",
    )


def _biz(business_id: str) -> Business:
    return Business(
        business_id=business_id,
        display_name=f"Business {business_id}",
        place_id=business_id,
        website_url="https://example.com",
    )


def _completed_result(investigation: Investigation, business: Business) -> InvestigationResult:
    return InvestigationResult(
        investigation=investigation.model_copy(
            update={"status": InvestigationStatus.COMPLETED, "completed_at": "2026-08-25T00:01:00Z"}
        ),
        business=business,
        hypotheses=[],
        evidence=[],
        usage=[],
        contact_recommendation=ContactRecommendation.DO_NOT_CONTACT,
        contact_reason="test",
    )


def _patch_firestore_noops(monkeypatch) -> None:
    monkeypatch.setattr(firestore_store, "save_run", lambda run: None)
    monkeypatch.setattr(firestore_store, "save_business", lambda business: None)
    monkeypatch.setattr(firestore_store, "save_investigation", lambda investigation: None)


def test_investigation_created_before_failable_work(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    def fake_save_investigation(investigation: Investigation) -> None:
        calls.append(("save_investigation", investigation.investigation_id))

    def fake_run_investigation(run, business, definitions, *, investigation=None, persist=True):
        calls.append(("run_investigation", investigation.investigation_id))
        return _completed_result(investigation, business)

    monkeypatch.setattr(firestore_store, "save_run", lambda run: None)
    monkeypatch.setattr(firestore_store, "save_business", lambda business: None)
    monkeypatch.setattr(firestore_store, "save_investigation", fake_save_investigation)
    monkeypatch.setattr(batch_runner, "run_investigation", fake_run_investigation)

    result = batch_runner.run_batch(_run(), [_biz("b1")], [], persist=True)

    assert [c[0] for c in calls] == ["save_investigation", "run_investigation"]
    assert calls[0][1] == calls[1][1]  # same investigation_id, no duplicate created
    assert result.outcomes[0].succeeded


def test_one_business_failure_does_not_abort_batch(monkeypatch) -> None:
    _patch_firestore_noops(monkeypatch)

    def flaky_run_investigation(run, business, definitions, *, investigation=None, persist=True):
        if business.business_id == "b1":
            raise RuntimeError("simulated downstream failure")
        return _completed_result(investigation, business)

    monkeypatch.setattr(batch_runner, "run_investigation", flaky_run_investigation)

    result = batch_runner.run_batch(_run(), [_biz("b1"), _biz("b2")], [], persist=True)

    assert len(result.outcomes) == 2
    assert result.outcomes[0].error is not None
    assert not result.outcomes[0].succeeded
    assert result.outcomes[1].succeeded
    # The failure is auditable, not silently dropped: b1 still has an
    # investigation_id even though the Investigator call raised.
    assert result.outcomes[0].investigation_id is not None
    assert result.run.status == RunStatus.FAILED
    assert result.run.completed_investigation_count == 1
    assert result.run.failed_investigation_count == 1


def test_investigation_creation_failure_is_recorded_and_business_not_lost(monkeypatch) -> None:
    monkeypatch.setattr(firestore_store, "save_run", lambda run: None)
    monkeypatch.setattr(firestore_store, "save_business", lambda business: None)

    def flaky_save_investigation(investigation: Investigation) -> None:
        raise RuntimeError("firestore write failed")

    monkeypatch.setattr(firestore_store, "save_investigation", flaky_save_investigation)
    invoked = []
    monkeypatch.setattr(
        batch_runner, "run_investigation", lambda *a, **k: invoked.append(1)
    )

    result = batch_runner.run_batch(_run(), [_biz("b1")], [], persist=True)

    assert len(result.outcomes) == 1
    assert result.outcomes[0].error is not None
    assert result.outcomes[0].investigation_id is None
    assert not invoked, "run_investigation must never run for a business whose Investigation failed to persist"
    assert result.run.status == RunStatus.FAILED


def test_summarize_batch_counts_statuses_and_usage(monkeypatch) -> None:
    inv1 = Investigation(
        investigation_id="i1",
        run_id=RUN_ID,
        business_id="b1",
        created_at="t",
        status=InvestigationStatus.COMPLETED,
    )
    hyp_confirmed = OpportunityHypothesis(
        hypothesis_id="h1",
        run_id=RUN_ID,
        business_id="b1",
        investigation_id="i1",
        opportunity_id="online_booking_friction",
        opportunity_type=OpportunityType.CAPABILITY_GAP,
        statement="s",
        confidence=0.9,
        status=OpportunityStatus.CONFIRMED,
    )
    result1 = InvestigationResult(
        investigation=inv1,
        business=_biz("b1"),
        hypotheses=[hyp_confirmed],
        evidence=[],
        usage=[
            UsageMetadata(
                investigation_id="i1",
                run_id=RUN_ID,
                model="gemini-3.6-flash",
                total_tokens=100,
                timestamp="t",
            )
        ],
        contact_recommendation=ContactRecommendation.HUMAN_REVIEW,
        contact_reason="x",
    )
    outcome1 = batch_runner.BusinessOutcome(
        business=_biz("b1"), investigation_id="i1", result=result1, error=None
    )
    outcome2 = batch_runner.BusinessOutcome(
        business=_biz("b2"), investigation_id=None, result=None, error="boom"
    )

    batch = batch_runner.BatchResult(run=_run(), outcomes=[outcome1, outcome2])
    summary = batch_runner.summarize_batch(batch)

    assert summary["investigated"] == 2
    assert summary["completed"] == 1
    assert summary["failed"] == 1
    assert summary["hypothesis_status_counts"]["CONFIRMED"] == 1
    assert summary["contact_recommendation_counts"]["HUMAN_REVIEW"] == 1
    assert summary["gemini_invocations"] == 1
    assert summary["total_tokens"] == 100
