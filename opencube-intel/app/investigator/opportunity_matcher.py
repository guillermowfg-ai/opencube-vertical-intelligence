"""Opportunity Matcher V1 -- deterministic commercial-eligibility
reconciliation of an immutable OpportunityHypothesis with its (optional)
immutable Verification.

Zero Gemini calls. Zero Search grounding. Zero randomness. Same inputs ->
same output, exactly like app/investigator/verification_target.py.

    hypothesis
        |
    classify Verification (if any) into VerificationMatchState
        |
    frozen 18-cell reconciliation matrix -> (MatchStatus, MatchReasonCode)
        |
    deterministic capability taxonomy lookup
        |
    deterministic reasoning template lookup
        |
    OpportunityMatch

This module never calls firestore_store.save_hypothesis, save_verification,
save_evidence, save_investigation, save_business, or save_run -- it only
reads already-persisted OpportunityHypothesis/Verification objects passed in
by the caller and returns a new OpportunityMatch. Persistence is the
caller's responsibility (see scripts/run_opportunity_matcher.py).
"""

from __future__ import annotations

import collections
import datetime
import enum

from app.investigator.capability_catalog import get_capability_mapping
from app.investigator.models import (
    MatchReasonCode,
    MatchStatus,
    OpportunityHypothesis,
    OpportunityMatch,
    OpportunityStatus,
    Verification,
    VerificationExecutionStatus,
    VerificationOutcome,
)


class VerificationMatchState(enum.StrEnum):
    """The six mutually exclusive states a hypothesis's Verification can be
    in, derived only from already-persisted Verification fields -- never
    from a fresh check. NONE means no Verification record exists at all for
    this hypothesis_id (distinct from a Verification that ran and found
    nothing, which is NO_INDEPENDENT_SOURCE)."""

    NONE = "NONE"
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    NO_INDEPENDENT_SOURCE = "NO_INDEPENDENT_SOURCE"
    FAILED = "FAILED"


class UnexpectedVerificationStateError(ValueError):
    """Raised when a Verification record does not match any of the six
    known states. Fails closed rather than guessing."""


def classify_verification_state(verification: Verification | None) -> VerificationMatchState:
    """Pure classification -- no I/O, no Gemini, no randomness."""
    if verification is None:
        return VerificationMatchState.NONE

    if verification.execution_status == VerificationExecutionStatus.FAILED:
        return VerificationMatchState.FAILED

    if verification.execution_status == VerificationExecutionStatus.IN_PROGRESS:
        raise UnexpectedVerificationStateError(
            f"Verification {verification.verification_id} is still IN_PROGRESS; "
            "Matcher requires a terminal execution_status"
        )

    # execution_status == COMPLETED from here on.
    if verification.no_independent_source_found:
        return VerificationMatchState.NO_INDEPENDENT_SOURCE

    if verification.outcome == VerificationOutcome.SUPPORTS:
        return VerificationMatchState.SUPPORTS
    if verification.outcome == VerificationOutcome.CONTRADICTS:
        return VerificationMatchState.CONTRADICTS
    if verification.outcome == VerificationOutcome.INSUFFICIENT_EVIDENCE:
        return VerificationMatchState.INSUFFICIENT_EVIDENCE

    raise UnexpectedVerificationStateError(
        f"Verification {verification.verification_id} is COMPLETED with a source "
        "but carries no recognized outcome"
    )


# --- Frozen 18-cell reconciliation matrix ----------------------------------
# (OpportunityStatus, VerificationMatchState) -> (MatchStatus, MatchReasonCode)
# Do not alter after real-data results are seen (DECISIONS.md's Opportunity
# Matcher V1 entry). CONTRADICTED + SUPPORTS = UNRESOLVED, never MATCHED, is
# the critical invariant this table encodes.
_RECONCILIATION_MATRIX: dict[
    tuple[OpportunityStatus, VerificationMatchState], tuple[MatchStatus, MatchReasonCode]
] = {
    (OpportunityStatus.CONFIRMED, VerificationMatchState.NONE): (
        MatchStatus.MATCHED,
        MatchReasonCode.CONFIRMED_NO_VERIFICATION,
    ),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.SUPPORTS): (
        MatchStatus.MATCHED,
        MatchReasonCode.CONFIRMED_INDEPENDENTLY_SUPPORTED,
    ),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.CONTRADICTS): (
        MatchStatus.UNRESOLVED,
        MatchReasonCode.CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT,
    ),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.INSUFFICIENT_EVIDENCE): (
        MatchStatus.MATCHED,
        MatchReasonCode.CONFIRMED_VERIFICATION_INCONCLUSIVE,
    ),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.NO_INDEPENDENT_SOURCE): (
        MatchStatus.MATCHED,
        MatchReasonCode.CONFIRMED_NO_INDEPENDENT_SOURCE,
    ),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.FAILED): (
        MatchStatus.MATCHED,
        MatchReasonCode.CONFIRMED_VERIFICATION_FAILED_TECHNICAL,
    ),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.NONE): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.CONTRADICTED_UNVERIFIED,
    ),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.SUPPORTS): (
        MatchStatus.UNRESOLVED,
        MatchReasonCode.CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT,
    ),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.CONTRADICTS): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.CONTRADICTED_INDEPENDENTLY_CONFIRMED,
    ),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.INSUFFICIENT_EVIDENCE): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.CONTRADICTED_VERIFICATION_INCONCLUSIVE,
    ),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.NO_INDEPENDENT_SOURCE): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.CONTRADICTED_NO_INDEPENDENT_SOURCE,
    ),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.FAILED): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.CONTRADICTED_VERIFICATION_FAILED_TECHNICAL,
    ),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.NONE): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.INSUFFICIENT_EVIDENCE_UNVERIFIED,
    ),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.SUPPORTS): (
        MatchStatus.UNRESOLVED,
        MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED,
    ),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.CONTRADICTS): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_CONTRADICTED,
    ),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.INSUFFICIENT_EVIDENCE): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.INSUFFICIENT_EVIDENCE_TWICE_INCONCLUSIVE,
    ),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.NO_INDEPENDENT_SOURCE): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.INSUFFICIENT_EVIDENCE_NO_INDEPENDENT_SOURCE,
    ),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.FAILED): (
        MatchStatus.NOT_MATCHED,
        MatchReasonCode.INSUFFICIENT_EVIDENCE_VERIFICATION_FAILED_TECHNICAL,
    ),
}


class UnreconciledCellError(ValueError):
    """Raised if (original_status, verification_state) has no matrix entry.
    OpportunityStatus.UNVERIFIED is deliberately absent from the matrix --
    it is a pre-persistence transient state, never found on a persisted
    OpportunityHypothesis (see models.py's OpportunityHypothesis.status)."""


def reconcile(
    original_status: OpportunityStatus, verification_state: VerificationMatchState
) -> tuple[MatchStatus, MatchReasonCode]:
    """The frozen 18-cell matrix lookup. Pure function."""
    key = (original_status, verification_state)
    if key not in _RECONCILIATION_MATRIX:
        raise UnreconciledCellError(f"No reconciliation entry for {key!r}")
    return _RECONCILIATION_MATRIX[key]


# --- Deterministic reasoning templates -------------------------------------
MATCH_REASONING: dict[MatchReasonCode, str] = {
    MatchReasonCode.CONFIRMED_NO_VERIFICATION: (
        "The original investigation confirmed the opportunity, and no independent "
        "verification record is available; the match remains eligible based on the "
        "original evidence."
    ),
    MatchReasonCode.CONFIRMED_INDEPENDENTLY_SUPPORTED: (
        "The original investigation confirmed the opportunity, and independent "
        "verification also supports the same canonical claim."
    ),
    MatchReasonCode.CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT: (
        "The original investigation confirmed the opportunity, but independent "
        "verification contradicts the same canonical claim; the evidence conflicts "
        "and the match remains unresolved."
    ),
    MatchReasonCode.CONFIRMED_VERIFICATION_INCONCLUSIVE: (
        "The original investigation confirmed the opportunity; independent "
        "verification obtained evidence but could not resolve the same canonical "
        "claim, so the original evidence remains sufficient for matching."
    ),
    MatchReasonCode.CONFIRMED_NO_INDEPENDENT_SOURCE: (
        "The original investigation confirmed the opportunity; no valid independent "
        "source was found, so no additional epistemic signal changes the original "
        "match eligibility."
    ),
    MatchReasonCode.CONFIRMED_VERIFICATION_FAILED_TECHNICAL: (
        "The original investigation confirmed the opportunity; independent "
        "verification failed technically and therefore adds no epistemic evidence "
        "that changes the original match eligibility."
    ),
    MatchReasonCode.CONTRADICTED_UNVERIFIED: (
        "The original investigation contradicted the opportunity, and no independent "
        "verification record is available; the opportunity remains not matched."
    ),
    MatchReasonCode.CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT: (
        "The original investigation contradicted the opportunity, while independent "
        "verification supports the canonical claim; the evidence conflicts and the "
        "match remains unresolved."
    ),
    MatchReasonCode.CONTRADICTED_INDEPENDENTLY_CONFIRMED: (
        "The original investigation contradicted the opportunity, and independent "
        "verification also contradicts the same canonical claim, reinforcing the "
        "rejection."
    ),
    MatchReasonCode.CONTRADICTED_VERIFICATION_INCONCLUSIVE: (
        "The original investigation contradicted the opportunity; independent "
        "verification was inconclusive and does not overturn the rejection."
    ),
    MatchReasonCode.CONTRADICTED_NO_INDEPENDENT_SOURCE: (
        "The original investigation contradicted the opportunity; no valid "
        "independent source was found, so no additional evidence overturns the "
        "rejection."
    ),
    MatchReasonCode.CONTRADICTED_VERIFICATION_FAILED_TECHNICAL: (
        "The original investigation contradicted the opportunity; independent "
        "verification failed technically and adds no epistemic evidence that "
        "overturns the rejection."
    ),
    MatchReasonCode.INSUFFICIENT_EVIDENCE_UNVERIFIED: (
        "The original investigation had insufficient evidence, and no independent "
        "verification record is available; the opportunity remains not matched."
    ),
    MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED: (
        "The original investigation had insufficient evidence, while independent "
        "verification supports the canonical claim; V1 does not automatically "
        "upgrade this uncertainty to a commercial match, so the result remains "
        "unresolved."
    ),
    MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_CONTRADICTED: (
        "The original investigation had insufficient evidence, and independent "
        "verification contradicts the canonical claim; there is no defensible "
        "match."
    ),
    MatchReasonCode.INSUFFICIENT_EVIDENCE_TWICE_INCONCLUSIVE: (
        "The original investigation and independent verification are both "
        "inconclusive; there is no defensible match."
    ),
    MatchReasonCode.INSUFFICIENT_EVIDENCE_NO_INDEPENDENT_SOURCE: (
        "The original investigation had insufficient evidence, and no valid "
        "independent source was found; there is no defensible match."
    ),
    MatchReasonCode.INSUFFICIENT_EVIDENCE_VERIFICATION_FAILED_TECHNICAL: (
        "The original investigation had insufficient evidence; independent "
        "verification failed technically and adds no epistemic evidence sufficient "
        "to create a match."
    ),
}


def build_match(
    hypothesis: OpportunityHypothesis, verification: Verification | None
) -> OpportunityMatch:
    """Build exactly one OpportunityMatch for one OpportunityHypothesis.

    Pure function -- no Firestore reads/writes, no Gemini, no randomness.
    `verification` must already be the caller's resolved choice (e.g. the
    latest by created_at if more than one Verification exists for this
    hypothesis_id) -- this function does not disambiguate.
    """
    verification_state = classify_verification_state(verification)
    match_status, reason_code = reconcile(hypothesis.status, verification_state)
    primary_capability_id, supporting_capability_ids = get_capability_mapping(
        hypothesis.opportunity_id
    )

    source_hypothesis_evidence_ids = sorted(
        set(hypothesis.supporting_evidence_ids) | set(hypothesis.contradicting_evidence_ids)
    )
    source_verification_evidence_ids = (
        list(verification.independent_evidence_ids) if verification is not None else []
    )

    return OpportunityMatch(
        match_id=hypothesis.hypothesis_id,
        run_id=hypothesis.run_id,
        business_id=hypothesis.business_id,
        investigation_id=hypothesis.investigation_id,
        hypothesis_id=hypothesis.hypothesis_id,
        verification_id=verification.verification_id if verification is not None else None,
        opportunity_id=hypothesis.opportunity_id,
        original_status=hypothesis.status,
        verification_execution_status=(
            verification.execution_status if verification is not None else None
        ),
        verification_outcome=verification.outcome if verification is not None else None,
        no_independent_source_found=(
            verification.no_independent_source_found if verification is not None else None
        ),
        match_status=match_status,
        reason_code=reason_code,
        reasoning=MATCH_REASONING[reason_code],
        primary_capability_id=primary_capability_id,
        supporting_capability_ids=list(supporting_capability_ids),
        source_hypothesis_evidence_ids=source_hypothesis_evidence_ids,
        source_verification_evidence_ids=source_verification_evidence_ids,
        created_at=_now(),
    )


def _now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def summarize_matches(matches: list[OpportunityMatch]) -> dict:
    """Deterministic aggregate summary only -- no ranking, no narrative, no
    cross-business strategy (that is Vertical Strategist's job, not this
    one's)."""
    total = len(matches)
    status_counts = {status.value: 0 for status in MatchStatus}
    reason_code_counts: dict[str, int] = collections.defaultdict(int)
    opportunity_id_counts: dict[str, int] = collections.defaultdict(int)
    primary_capability_counts_matched: dict[str, int] = collections.defaultdict(int)
    verification_coverage = 0

    for match in matches:
        status_counts[match.match_status.value] += 1
        reason_code_counts[match.reason_code.value] += 1
        opportunity_id_counts[match.opportunity_id] += 1
        if match.verification_id is not None:
            verification_coverage += 1
        if match.match_status == MatchStatus.MATCHED and match.primary_capability_id is not None:
            primary_capability_counts_matched[match.primary_capability_id] += 1

    return {
        "total_evaluated": total,
        "match_status_counts": status_counts,
        "reason_code_counts": dict(reason_code_counts),
        "opportunity_id_counts": dict(opportunity_id_counts),
        "verification_coverage": verification_coverage,
        "primary_capability_counts_matched": dict(primary_capability_counts_matched),
    }
