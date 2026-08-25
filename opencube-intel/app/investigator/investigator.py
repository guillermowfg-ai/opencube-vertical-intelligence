"""Business Investigator orchestration — one complete investigation.

Epistemic flow (implementation prompt section 0):
    REAL BUSINESS -> REAL PUBLIC SOURCES -> FACTUAL EVIDENCE
        -> BOUNDED OPPORTUNITY HYPOTHESIS
        -> SUPPORT / CONTRADICTION / INSUFFICIENT EVIDENCE
        -> PERSISTED AUDITABLE RESULT

This module contains no HTTP calls of its own — it composes places_client /
public_web_fetcher (retrieval), gemini_reasoner (inference), validation
(deterministic assembly), and firestore_store (persistence).
"""

from __future__ import annotations

import datetime
import uuid

from app.investigator import (
    firestore_store,
    gemini_reasoner,
    public_web_fetcher,
    validation,
)
from app.investigator.models import (
    Business,
    ContactRecommendation,
    Evidence,
    Investigation,
    InvestigationResult,
    InvestigationStatus,
    OpportunityDefinition,
    OpportunityHypothesis,
    OpportunityStatus,
    Run,
    UsageMetadata,
)

COLLECTED_BY = "business_investigator_v1"


def _now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def decide_contact_recommendation(
    hypotheses: list[OpportunityHypothesis],
) -> tuple[ContactRecommendation, str]:
    """Lightweight, deterministic DO_NOT_CONTACT gate (DECISIONS.md #7).

    - Any CONFIRMED, evidence-backed opportunity -> human review required.
    - All evaluated hypotheses CONTRADICTED or INSUFFICIENT_EVIDENCE ->
      DO_NOT_CONTACT.
    - Anything else (e.g. no hypotheses evaluated, or an UNVERIFIED state)
      defaults to human review — never silently contacts anyone.
    """
    if not hypotheses:
        return ContactRecommendation.HUMAN_REVIEW, "No hypotheses were evaluated."

    if any(h.status == OpportunityStatus.CONFIRMED for h in hypotheses):
        confirmed = [h.opportunity_id for h in hypotheses if h.status == OpportunityStatus.CONFIRMED]
        return (
            ContactRecommendation.HUMAN_REVIEW,
            f"Evidence-backed opportunity confirmed: {', '.join(confirmed)}. "
            "Requires human review before any outreach.",
        )

    if all(
        h.status in (OpportunityStatus.CONTRADICTED, OpportunityStatus.INSUFFICIENT_EVIDENCE)
        for h in hypotheses
    ):
        return (
            ContactRecommendation.DO_NOT_CONTACT,
            "All evaluated hypotheses were CONTRADICTED or INSUFFICIENT_EVIDENCE; "
            "no evidence-backed opportunity exists.",
        )

    return (
        ContactRecommendation.HUMAN_REVIEW,
        "Hypotheses are in a mixed/unverified state; defaulting to human review.",
    )


def run_investigation(
    run: Run,
    business: Business,
    definitions: list[OpportunityDefinition],
    *,
    persist: bool = True,
) -> InvestigationResult:
    investigation = Investigation(
        investigation_id=str(uuid.uuid4()),
        run_id=run.run_id,
        business_id=business.business_id,
        created_at=_now(),
        status=InvestigationStatus.IN_PROGRESS,
    )

    if persist:
        firestore_store.save_run(run)
        firestore_store.save_business(business)
        firestore_store.save_investigation(investigation)

    sources = public_web_fetcher.fetch_business_sources(business.website_url or "")

    all_evidence: list[Evidence] = []
    all_hypotheses: list[OpportunityHypothesis] = []
    all_usage: list[UsageMetadata] = []

    for definition in definitions:
        call_result = gemini_reasoner.evaluate_hypothesis(business, definition, sources)

        usage = UsageMetadata(
            investigation_id=investigation.investigation_id,
            model=call_result.model,
            prompt_tokens=call_result.prompt_tokens,
            output_tokens=call_result.output_tokens,
            thought_tokens=call_result.thought_tokens,
            total_tokens=call_result.total_tokens,
            timestamp=call_result.timestamp,
            invocation_id=call_result.invocation_id,
        )
        all_usage.append(usage)
        if persist:
            firestore_store.save_usage_metadata(
                usage, doc_id=f"{investigation.investigation_id}:{definition.opportunity_id}"
            )

        if call_result.evaluation is None:
            # Bounded retries in gemini_reasoner were exhausted. Fail safe:
            # do not persist malformed state as a hypothesis for this definition.
            continue

        try:
            evidence_records = validation.assign_evidence_records(
                call_result.evaluation,
                sources,
                run_id=run.run_id,
                business_id=business.business_id,
                investigation_id=investigation.investigation_id,
                collected_by=COLLECTED_BY,
            )
            hypothesis = validation.build_hypothesis(
                call_result.evaluation,
                evidence_records,
                definition,
                run_id=run.run_id,
                business_id=business.business_id,
                investigation_id=investigation.investigation_id,
            )
        except (validation.AssemblyError, ValueError):
            # Reference integrity failed deterministic validation. Skip this
            # definition's hypothesis rather than persist malformed state.
            continue

        all_evidence.extend(evidence_records)
        all_hypotheses.append(hypothesis)

        if persist:
            for e in evidence_records:
                firestore_store.save_evidence(e)
            firestore_store.save_hypothesis(hypothesis)

    investigation.completed_at = _now()
    investigation.status = InvestigationStatus.COMPLETED
    investigation.source_count = len(sources)
    investigation.evidence_count = len(all_evidence)
    if persist:
        firestore_store.save_investigation(investigation)

    contact_recommendation, contact_reason = decide_contact_recommendation(all_hypotheses)

    result = InvestigationResult(
        investigation=investigation,
        business=business,
        hypotheses=all_hypotheses,
        evidence=all_evidence,
        usage=all_usage,
        contact_recommendation=contact_recommendation,
        contact_reason=contact_reason,
    )
    return result
