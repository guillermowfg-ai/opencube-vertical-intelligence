"""Domain-object builders shared by the Production Execution V1 tests."""

from __future__ import annotations

from app.investigator.models import (
    Business,
    Investigation,
    InvestigationStatus,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
    Run,
    RunStatus,
    Verification,
    VerificationExecutionStatus,
    VerificationOutcome,
)

RUN_ID = "run-prod-1"
TS = "2026-08-26T00:00:00+00:00"


def make_run(**overrides) -> Run:
    base = {
        "run_id": RUN_ID,
        "created_at": TS,
        "started_at": TS,
        "status": RunStatus.QUEUED,
        "vertical": "Med Spa",
        "geography": "Miami-Dade County, Florida",
        "provider_capabilities": ["AI Voice Reception"],
    }
    base.update(overrides)
    return Run(**base)


def make_business(business_id: str, **overrides) -> Business:
    base = {
        "business_id": business_id,
        "display_name": f"Spa {business_id}",
        "formatted_address": "1 Main St, Miami, FL 33131, USA",
        "website_url": f"https://{business_id}.example.com",
        "place_id": business_id,
    }
    base.update(overrides)
    return Business(**base)


def make_investigation(
    business_id: str,
    status: InvestigationStatus = InvestigationStatus.IN_PROGRESS,
    run_id: str = RUN_ID,
) -> Investigation:
    return Investigation(
        investigation_id=f"{run_id}__{business_id}",
        run_id=run_id,
        business_id=business_id,
        created_at=TS,
        status=status,
    )


def make_hypothesis(
    hypothesis_id: str,
    business_id: str,
    *,
    opportunity_id: str = "online_booking_friction",
    status: OpportunityStatus = OpportunityStatus.CONFIRMED,
    run_id: str = RUN_ID,
) -> OpportunityHypothesis:
    return OpportunityHypothesis(
        hypothesis_id=hypothesis_id,
        run_id=run_id,
        business_id=business_id,
        investigation_id=f"{run_id}__{business_id}",
        opportunity_id=opportunity_id,
        opportunity_type=OpportunityType.PAIN,
        statement="Frozen catalog statement.",
        supporting_evidence_ids=[],
        contradicting_evidence_ids=[],
        confidence=0.8,
        status=status,
    )


def make_verification(
    verification_id: str,
    hypothesis: OpportunityHypothesis,
    *,
    execution_status: VerificationExecutionStatus = VerificationExecutionStatus.COMPLETED,
    outcome: VerificationOutcome | None = VerificationOutcome.SUPPORTS,
    created_at: str = TS,
) -> Verification:
    return Verification(
        verification_id=verification_id,
        run_id=hypothesis.run_id,
        business_id=hypothesis.business_id,
        investigation_id=hypothesis.investigation_id,
        hypothesis_id=hypothesis.hypothesis_id,
        opportunity_id=hypothesis.opportunity_id,
        original_status=hypothesis.status,
        verification_target="frozen target",
        execution_status=execution_status,
        outcome=outcome if execution_status == VerificationExecutionStatus.COMPLETED else None,
        created_at=created_at,
        completed_at=created_at,
    )


def seed_run_with_investigations(
    store,
    business_ids: list[str],
    *,
    status: InvestigationStatus = InvestigationStatus.IN_PROGRESS,
    run_status: RunStatus = RunStatus.INVESTIGATING,
    run_id: str = RUN_ID,
) -> Run:
    """Persist the post-SCOUT state: Run with the readiness barrier committed,
    canonical Businesses, and one deterministic Investigation per business."""
    run = make_run(
        run_id=run_id, status=run_status, businesses_total=len(business_ids)
    )
    store.save_run(run)
    for business_id in business_ids:
        store.save_business(make_business(business_id))
        store.save_investigation(
            make_investigation(business_id, status=status, run_id=run_id)
        )
    return run


class FakeDiscovery:
    """Structural stand-in for market_scout.DiscoveryResult."""

    def __init__(self, accepted: list[Business], *, raw_candidate_count: int = 37):
        self.queries = ["med spa in Brickell, Miami, FL"]
        self.raw_candidate_count = raw_candidate_count
        self.accepted = accepted
        self.rejected: list = []
        self.by_submarket = {"Brickell / Downtown Miami": accepted}
