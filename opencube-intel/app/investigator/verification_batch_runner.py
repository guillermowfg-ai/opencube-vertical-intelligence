"""Verification Loop V1 orchestration -- one independent-verification
attempt per selected hypothesis.

Mirrors batch_runner.py's failure-isolation discipline: one Verification's
technical failure never aborts the others, and the original
OpportunityHypothesis is never read for mutation, only for context --
nothing in this module ever calls firestore_store.save_hypothesis.

Sequential, no Cloud Tasks -- a thin, disposable loop, same tier as the
accepted Business Investigator batch runner.
"""

from __future__ import annotations

import dataclasses
import datetime
import uuid
from urllib.parse import urlparse

from app.investigator import (
    firestore_store,
    public_web_fetcher,
    validation,
    verification_discovery,
    verification_reasoner,
)
from app.investigator.models import (
    Business,
    OpportunityDefinition,
    OpportunityHypothesis,
    OpportunityStatus,
    RejectedSourceCandidate,
    UsageMetadata,
    Verification,
    VerificationExecutionStatus,
    VerificationOutcome,
)
from app.investigator.validation import AssemblyError
from app.investigator.verification_target import build_verification_target

COLLECTED_BY = "verification_loop_v1"
_MAX_CANDIDATES_ATTEMPTED = 3
_MAX_INDEPENDENT_SOURCES = 2


def _now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def _business_domain(business: Business) -> str:
    return urlparse(business.website_url or "").netloc.lower().removeprefix("www.")


def _original_source_urls(hypothesis: OpportunityHypothesis) -> set[str]:
    """A hypothesis may reference multiple original Evidence records --
    collect all of their source_urls, not just one (implementation prompt
    section 7 / Correction 3)."""
    referenced_ids = set(hypothesis.supporting_evidence_ids) | set(
        hypothesis.contradicting_evidence_ids
    )
    urls: set[str] = set()
    for evidence_id in referenced_ids:
        doc = firestore_store.get_evidence(evidence_id)
        if doc is not None and doc.get("source_url"):
            urls.add(doc["source_url"])
    return urls


@dataclasses.dataclass
class VerificationAttempt:
    hypothesis: OpportunityHypothesis
    verification: Verification | None
    error: str | None

    @property
    def succeeded(self) -> bool:
        return self.error is None and self.verification is not None


@dataclasses.dataclass
class VerificationBatchResult:
    run_id: str
    attempts: list[VerificationAttempt]


def _persist_usage(
    *,
    phase: str,
    verification_id: str,
    run_id: str,
    investigation_id: str,
    model: str,
    prompt_tokens: int | None,
    output_tokens: int | None,
    thought_tokens: int | None,
    total_tokens: int | None,
    timestamp: str,
    invocation_id: str | None,
    persist: bool,
) -> None:
    if not persist:
        return
    usage = UsageMetadata(
        investigation_id=investigation_id,
        run_id=run_id,
        model=model,
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
        thought_tokens=thought_tokens,
        total_tokens=total_tokens,
        timestamp=timestamp,
        invocation_id=invocation_id,
        phase=phase,
        verification_id=verification_id,
    )
    firestore_store.save_usage_metadata(usage, doc_id=f"{verification_id}:{phase}")


def run_one_verification(
    run_id: str,
    business: Business,
    definition: OpportunityDefinition,
    hypothesis: OpportunityHypothesis,
    *,
    persist: bool = True,
) -> Verification:
    """Run exactly one Verification attempt. Raises only on truly
    unanticipated errors -- every anticipated failure mode (discovery
    failure, zero independent sources, reasoning failure, malformed
    citation) is captured as a terminal Verification state and returned,
    never raised, so the caller's per-item try/except is a pure safety net.
    """
    verification_id = str(uuid.uuid4())
    created_at = _now()
    verification_target = build_verification_target(hypothesis.opportunity_id, hypothesis.status)
    original_source_urls = _original_source_urls(hypothesis)
    business_domain = _business_domain(business)

    verification = Verification(
        verification_id=verification_id,
        run_id=run_id,
        business_id=business.business_id,
        investigation_id=hypothesis.investigation_id,
        hypothesis_id=hypothesis.hypothesis_id,
        opportunity_id=hypothesis.opportunity_id,
        original_status=hypothesis.status,
        verification_target=verification_target,
        execution_status=VerificationExecutionStatus.IN_PROGRESS,
        created_at=created_at,
    )
    if persist:
        firestore_store.save_verification(verification)

    # --- Call 1: discovery -------------------------------------------------
    discovery = verification_discovery.discover_independent_candidates(
        business, hypothesis, definition, verification_target
    )
    _persist_usage(
        phase="verification_discovery",
        verification_id=verification_id,
        run_id=run_id,
        investigation_id=hypothesis.investigation_id,
        model=discovery.model,
        prompt_tokens=discovery.prompt_tokens,
        output_tokens=discovery.output_tokens,
        thought_tokens=discovery.thought_tokens,
        total_tokens=discovery.total_tokens,
        timestamp=discovery.timestamp,
        invocation_id=discovery.invocation_id,
        persist=persist,
    )

    verification = verification.model_copy(
        update={
            "requested_search_query": discovery.requested_search_query,
            "executed_search_queries": discovery.executed_search_queries,
            "candidate_source_urls": [c.uri for c in discovery.candidates],
        }
    )

    if discovery.raw_error is not None:
        verification = verification.model_copy(
            update={
                "execution_status": VerificationExecutionStatus.FAILED,
                "failure_reason": discovery.raw_error[:500],
                "completed_at": _now(),
            }
        )
        if persist:
            firestore_store.save_verification(verification)
        return verification

    # --- resolve/filter/fetch: max 3 candidates attempted, max 2 sources ---
    accepted_sources = []
    rejected: list[RejectedSourceCandidate] = []
    for candidate in discovery.candidates[:_MAX_CANDIDATES_ATTEMPTED]:
        result = public_web_fetcher.resolve_and_fetch_independent_source(
            candidate.uri,
            business_domain=business_domain,
            original_source_urls=original_source_urls,
        )
        if result.source is not None:
            accepted_sources.append(result.source)
            if len(accepted_sources) >= _MAX_INDEPENDENT_SOURCES:
                break
        else:
            rejected.append(RejectedSourceCandidate(url=candidate.uri, reason=result.rejected_reason or "unknown"))

    verification = verification.model_copy(
        update={
            "rejected_sources": rejected,
            "independent_sources_fetched": len(accepted_sources),
        }
    )

    if not accepted_sources:
        verification = verification.model_copy(
            update={
                "execution_status": VerificationExecutionStatus.COMPLETED,
                "outcome": None,
                "no_independent_source_found": True,
                "completed_at": _now(),
            }
        )
        if persist:
            firestore_store.save_verification(verification)
        return verification

    # --- Call 2: verification reasoning (only reached with >=1 source) ----
    call2 = verification_reasoner.evaluate_verification(
        business, hypothesis, definition, verification_target, accepted_sources
    )
    _persist_usage(
        phase="verification_reasoning",
        verification_id=verification_id,
        run_id=run_id,
        investigation_id=hypothesis.investigation_id,
        model=call2.model,
        prompt_tokens=call2.prompt_tokens,
        output_tokens=call2.output_tokens,
        thought_tokens=call2.thought_tokens,
        total_tokens=call2.total_tokens,
        timestamp=call2.timestamp,
        invocation_id=call2.invocation_id,
        persist=persist,
    )

    if call2.evaluation is None:
        verification = verification.model_copy(
            update={
                "execution_status": VerificationExecutionStatus.FAILED,
                "failure_reason": (call2.raw_error or "verification reasoning failed")[:500],
                "completed_at": _now(),
            }
        )
        if persist:
            firestore_store.save_verification(verification)
        return verification

    try:
        evidence_records = validation.assign_verification_evidence_records(
            call2.evaluation,
            accepted_sources,
            run_id=run_id,
            business_id=business.business_id,
            investigation_id=hypothesis.investigation_id,
            collected_by=COLLECTED_BY,
        )
    except AssemblyError as exc:
        verification = verification.model_copy(
            update={
                "execution_status": VerificationExecutionStatus.FAILED,
                "failure_reason": str(exc)[:500],
                "completed_at": _now(),
            }
        )
        if persist:
            firestore_store.save_verification(verification)
        return verification

    if persist:
        for evidence in evidence_records:
            firestore_store.save_evidence(evidence)

    verification = verification.model_copy(
        update={
            "independent_evidence_ids": [e.evidence_id for e in evidence_records],
            "outcome": call2.evaluation.outcome,
            "confidence": call2.evaluation.confidence,
            "reasoning": call2.evaluation.reasoning,
            "execution_status": VerificationExecutionStatus.COMPLETED,
            "completed_at": _now(),
        }
    )
    if persist:
        firestore_store.save_verification(verification)
    return verification


def run_verification_batch(
    run_id: str,
    businesses_by_id: dict[str, Business],
    definitions_by_id: dict[str, OpportunityDefinition],
    hypotheses: list[OpportunityHypothesis],
    *,
    persist: bool = True,
) -> VerificationBatchResult:
    """Invoke run_one_verification once per selected hypothesis. One
    hypothesis's unanticipated failure never aborts the others."""
    attempts: list[VerificationAttempt] = []

    for hypothesis in hypotheses:
        try:
            business = businesses_by_id[hypothesis.business_id]
            definition = definitions_by_id[hypothesis.opportunity_id]
            verification = run_one_verification(
                run_id, business, definition, hypothesis, persist=persist
            )
            attempts.append(
                VerificationAttempt(hypothesis=hypothesis, verification=verification, error=None)
            )
        except Exception as exc:  # one hypothesis's failure must not abort the batch
            attempts.append(
                VerificationAttempt(hypothesis=hypothesis, verification=None, error=str(exc)[:500])
            )
            continue

    return VerificationBatchResult(run_id=run_id, attempts=attempts)


_AGREEMENT_COLUMNS = ("SUPPORTS", "CONTRADICTS", "INSUFFICIENT_EVIDENCE", "NO_INDEPENDENT_SOURCE", "FAILED")


def summarize_verification_batch(batch: VerificationBatchResult) -> dict:
    """Deterministic aggregate summary + agreement matrix. Intelligence
    reporting only -- no outreach, no lead scoring, no commercial gating
    (implementation prompt section 22 / section 11 of the audit).

    scheduled/completed/failed/no_independent_source are kept as separate
    counts -- a technical FAILED is never counted as no_independent_source,
    and no_independent_source is never counted as an epistemic outcome.
    """
    scheduled = len(batch.attempts)
    completed = sum(
        1
        for a in batch.attempts
        if a.verification is not None
        and a.verification.execution_status == VerificationExecutionStatus.COMPLETED
    )
    failed = sum(
        1
        for a in batch.attempts
        if a.verification is None
        or a.verification.execution_status == VerificationExecutionStatus.FAILED
    )
    no_independent_source = sum(
        1 for a in batch.attempts if a.verification is not None and a.verification.no_independent_source_found
    )

    outcome_counts = {outcome.value: 0 for outcome in VerificationOutcome}
    for attempt in batch.attempts:
        if attempt.verification is not None and attempt.verification.outcome is not None:
            outcome_counts[attempt.verification.outcome.value] += 1

    agreement_matrix: dict[str, dict[str, int]] = {
        status.value: dict.fromkeys(_AGREEMENT_COLUMNS, 0) for status in OpportunityStatus
    }
    for attempt in batch.attempts:
        original = attempt.hypothesis.status.value
        verification = attempt.verification
        if verification is None or verification.execution_status == VerificationExecutionStatus.FAILED:
            agreement_matrix[original]["FAILED"] += 1
        elif verification.no_independent_source_found:
            agreement_matrix[original]["NO_INDEPENDENT_SOURCE"] += 1
        elif verification.outcome is not None:
            agreement_matrix[original][verification.outcome.value] += 1

    return {
        "scheduled": scheduled,
        "completed": completed,
        "failed": failed,
        "no_independent_source": no_independent_source,
        "outcome_counts": outcome_counts,
        "agreement_matrix": agreement_matrix,
    }
