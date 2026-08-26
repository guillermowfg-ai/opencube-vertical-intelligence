# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import inspect

from app.investigator import opportunity_matcher
from app.investigator.capability_catalog import (
    CAPABILITIES,
    OPPORTUNITY_CAPABILITY_MAP,
    UnknownOpportunityCapabilityMappingError,
    get_capability_mapping,
)
from app.investigator.catalog import EVALUATED_OPPORTUNITY_IDS
from app.investigator.models import (
    MatchReasonCode,
    MatchStatus,
    OpportunityHypothesis,
    OpportunityMatch,
    OpportunityStatus,
    OpportunityType,
    Verification,
    VerificationExecutionStatus,
    VerificationOutcome,
)
from app.investigator.opportunity_matcher import (
    MATCH_REASONING,
    VerificationMatchState,
    build_match,
    classify_verification_state,
    reconcile,
    summarize_matches,
)

RUN_ID = "run-1"


def _hyp(
    hypothesis_id: str,
    status: OpportunityStatus,
    *,
    opportunity_id: str = "online_booking_friction",
    supporting: list[str] | None = None,
    contradicting: list[str] | None = None,
) -> OpportunityHypothesis:
    return OpportunityHypothesis(
        hypothesis_id=hypothesis_id,
        run_id=RUN_ID,
        business_id="b1",
        investigation_id="inv-1",
        opportunity_id=opportunity_id,
        opportunity_type=OpportunityType.CAPABILITY_GAP,
        statement="s",
        supporting_evidence_ids=supporting or [],
        contradicting_evidence_ids=contradicting or [],
        confidence=0.8,
        status=status,
    )


def _verification(
    verification_id: str,
    original_status: OpportunityStatus,
    *,
    hypothesis_id: str = "h1",
    execution_status: VerificationExecutionStatus = VerificationExecutionStatus.COMPLETED,
    outcome: VerificationOutcome | None = None,
    no_independent_source_found: bool = False,
    independent_evidence_ids: list[str] | None = None,
) -> Verification:
    return Verification(
        verification_id=verification_id,
        run_id=RUN_ID,
        business_id="b1",
        investigation_id="inv-1",
        hypothesis_id=hypothesis_id,
        opportunity_id="online_booking_friction",
        original_status=original_status,
        verification_target="t",
        execution_status=execution_status,
        outcome=outcome,
        no_independent_source_found=no_independent_source_found,
        independent_evidence_ids=independent_evidence_ids or [],
        created_at="t",
    )


# --- 18-cell reconciliation matrix -----------------------------------------

_MATRIX_TABLE = [
    (OpportunityStatus.CONFIRMED, VerificationMatchState.NONE, MatchStatus.MATCHED, MatchReasonCode.CONFIRMED_NO_VERIFICATION),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.SUPPORTS, MatchStatus.MATCHED, MatchReasonCode.CONFIRMED_INDEPENDENTLY_SUPPORTED),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.CONTRADICTS, MatchStatus.UNRESOLVED, MatchReasonCode.CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.INSUFFICIENT_EVIDENCE, MatchStatus.MATCHED, MatchReasonCode.CONFIRMED_VERIFICATION_INCONCLUSIVE),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.NO_INDEPENDENT_SOURCE, MatchStatus.MATCHED, MatchReasonCode.CONFIRMED_NO_INDEPENDENT_SOURCE),
    (OpportunityStatus.CONFIRMED, VerificationMatchState.FAILED, MatchStatus.MATCHED, MatchReasonCode.CONFIRMED_VERIFICATION_FAILED_TECHNICAL),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.NONE, MatchStatus.NOT_MATCHED, MatchReasonCode.CONTRADICTED_UNVERIFIED),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.SUPPORTS, MatchStatus.UNRESOLVED, MatchReasonCode.CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.CONTRADICTS, MatchStatus.NOT_MATCHED, MatchReasonCode.CONTRADICTED_INDEPENDENTLY_CONFIRMED),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.INSUFFICIENT_EVIDENCE, MatchStatus.NOT_MATCHED, MatchReasonCode.CONTRADICTED_VERIFICATION_INCONCLUSIVE),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.NO_INDEPENDENT_SOURCE, MatchStatus.NOT_MATCHED, MatchReasonCode.CONTRADICTED_NO_INDEPENDENT_SOURCE),
    (OpportunityStatus.CONTRADICTED, VerificationMatchState.FAILED, MatchStatus.NOT_MATCHED, MatchReasonCode.CONTRADICTED_VERIFICATION_FAILED_TECHNICAL),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.NONE, MatchStatus.NOT_MATCHED, MatchReasonCode.INSUFFICIENT_EVIDENCE_UNVERIFIED),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.SUPPORTS, MatchStatus.UNRESOLVED, MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.CONTRADICTS, MatchStatus.NOT_MATCHED, MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_CONTRADICTED),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.INSUFFICIENT_EVIDENCE, MatchStatus.NOT_MATCHED, MatchReasonCode.INSUFFICIENT_EVIDENCE_TWICE_INCONCLUSIVE),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.NO_INDEPENDENT_SOURCE, MatchStatus.NOT_MATCHED, MatchReasonCode.INSUFFICIENT_EVIDENCE_NO_INDEPENDENT_SOURCE),
    (OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.FAILED, MatchStatus.NOT_MATCHED, MatchReasonCode.INSUFFICIENT_EVIDENCE_VERIFICATION_FAILED_TECHNICAL),
]


def test_all_18_reconciliation_cells() -> None:
    assert len(_MATRIX_TABLE) == 18
    assert len({(row[0], row[1]) for row in _MATRIX_TABLE}) == 18  # no duplicate cells
    for original_status, verification_state, expected_status, expected_reason in _MATRIX_TABLE:
        match_status, reason_code = reconcile(original_status, verification_state)
        assert match_status == expected_status, (original_status, verification_state)
        assert reason_code == expected_reason, (original_status, verification_state)


def test_every_reason_code_has_a_reasoning_template() -> None:
    for reason_code in MatchReasonCode:
        assert reason_code in MATCH_REASONING
        assert MATCH_REASONING[reason_code].strip()


# --- Critical conflict invariants -------------------------------------------


def test_contradicted_plus_supports_is_never_matched() -> None:
    match_status, reason_code = reconcile(OpportunityStatus.CONTRADICTED, VerificationMatchState.SUPPORTS)
    assert match_status == MatchStatus.UNRESOLVED
    assert match_status != MatchStatus.MATCHED
    assert reason_code == MatchReasonCode.CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT


def test_confirmed_plus_contradicts_is_unresolved() -> None:
    match_status, reason_code = reconcile(OpportunityStatus.CONFIRMED, VerificationMatchState.CONTRADICTS)
    assert match_status == MatchStatus.UNRESOLVED
    assert reason_code == MatchReasonCode.CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT


def test_insufficient_evidence_plus_supports_is_unresolved_not_matched() -> None:
    match_status, reason_code = reconcile(
        OpportunityStatus.INSUFFICIENT_EVIDENCE, VerificationMatchState.SUPPORTS
    )
    assert match_status == MatchStatus.UNRESOLVED
    assert match_status != MatchStatus.MATCHED
    assert reason_code == MatchReasonCode.INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED


# --- Verification state classification --------------------------------------


def test_classify_no_verification_is_none() -> None:
    assert classify_verification_state(None) == VerificationMatchState.NONE


def test_classify_failed_execution() -> None:
    v = _verification("v1", OpportunityStatus.CONFIRMED, execution_status=VerificationExecutionStatus.FAILED)
    assert classify_verification_state(v) == VerificationMatchState.FAILED


def test_classify_no_independent_source() -> None:
    v = _verification("v1", OpportunityStatus.CONFIRMED, no_independent_source_found=True)
    assert classify_verification_state(v) == VerificationMatchState.NO_INDEPENDENT_SOURCE


def test_classify_outcomes() -> None:
    supports = _verification("v1", OpportunityStatus.CONFIRMED, outcome=VerificationOutcome.SUPPORTS)
    contradicts = _verification("v2", OpportunityStatus.CONFIRMED, outcome=VerificationOutcome.CONTRADICTS)
    insufficient = _verification("v3", OpportunityStatus.CONFIRMED, outcome=VerificationOutcome.INSUFFICIENT_EVIDENCE)
    assert classify_verification_state(supports) == VerificationMatchState.SUPPORTS
    assert classify_verification_state(contradicts) == VerificationMatchState.CONTRADICTS
    assert classify_verification_state(insufficient) == VerificationMatchState.INSUFFICIENT_EVIDENCE


# --- Capability mapping ------------------------------------------------------


def test_all_evaluated_opportunities_have_deterministic_capability_mapping() -> None:
    for opportunity_id in EVALUATED_OPPORTUNITY_IDS:
        primary, supporting = get_capability_mapping(opportunity_id)
        assert primary in CAPABILITIES
        for capability_id in supporting:
            assert capability_id in CAPABILITIES


def test_crm_and_pbx_never_mapped_to_evaluated_opportunities() -> None:
    for opportunity_id in EVALUATED_OPPORTUNITY_IDS:
        primary, supporting = OPPORTUNITY_CAPABILITY_MAP[opportunity_id]
        assert primary != "crm"
        assert primary != "cloud_pbx_business_telephony"
        assert "crm" not in supporting
        assert "cloud_pbx_business_telephony" not in supporting


def test_unknown_opportunity_id_fails_closed() -> None:
    try:
        get_capability_mapping("not_a_real_opportunity_id")
        assert False, "expected UnknownOpportunityCapabilityMappingError"
    except UnknownOpportunityCapabilityMappingError:
        pass


# --- No confidence -----------------------------------------------------------


def test_opportunity_match_has_no_confidence_field() -> None:
    assert "confidence" not in OpportunityMatch.model_fields


# --- build_match / idempotency / cardinality --------------------------------


def test_match_id_equals_hypothesis_id() -> None:
    hyp = _hyp("h1", OpportunityStatus.CONFIRMED)
    match = build_match(hyp, None)
    assert match.match_id == hyp.hypothesis_id


def test_rerun_produces_identical_match_id_set() -> None:
    hypotheses = [
        _hyp("h1", OpportunityStatus.CONFIRMED),
        _hyp("h2", OpportunityStatus.CONTRADICTED),
        _hyp("h3", OpportunityStatus.INSUFFICIENT_EVIDENCE),
    ]
    first_run = {build_match(h, None).match_id for h in hypotheses}
    second_run = {build_match(h, None).match_id for h in hypotheses}
    assert first_run == second_run
    assert len(first_run) == 3


def test_n_hypotheses_produce_n_matches_across_all_statuses_and_verification_presence() -> None:
    hypotheses = [
        _hyp("h1", OpportunityStatus.CONFIRMED),
        _hyp("h2", OpportunityStatus.CONTRADICTED),
        _hyp("h3", OpportunityStatus.INSUFFICIENT_EVIDENCE),
        _hyp("h4", OpportunityStatus.CONTRADICTED),
    ]
    verifications = {
        "h2": _verification("v2", OpportunityStatus.CONTRADICTED, hypothesis_id="h2", outcome=VerificationOutcome.SUPPORTS),
    }
    matches = [build_match(h, verifications.get(h.hypothesis_id)) for h in hypotheses]
    assert len(matches) == len(hypotheses)
    assert {m.match_id for m in matches} == {h.hypothesis_id for h in hypotheses}

    by_id = {m.hypothesis_id: m for m in matches}
    assert by_id["h1"].match_status == MatchStatus.MATCHED
    assert by_id["h2"].match_status == MatchStatus.UNRESOLVED  # CONTRADICTED + SUPPORTS
    assert by_id["h3"].match_status == MatchStatus.NOT_MATCHED
    assert by_id["h4"].match_status == MatchStatus.NOT_MATCHED  # CONTRADICTED, no Verification


# --- Evidence provenance ------------------------------------------------------


def test_evidence_ids_stay_in_separate_fields_not_merged() -> None:
    hyp = _hyp("h1", OpportunityStatus.CONFIRMED, supporting=["e1", "e2"], contradicting=["e3"])
    verification = _verification(
        "v1", OpportunityStatus.CONFIRMED, hypothesis_id="h1",
        outcome=VerificationOutcome.SUPPORTS, independent_evidence_ids=["e4", "e5"],
    )
    match = build_match(hyp, verification)
    assert set(match.source_hypothesis_evidence_ids) == {"e1", "e2", "e3"}
    assert set(match.source_verification_evidence_ids) == {"e4", "e5"}
    # Provenance stays disjoint -- no field merges the two lists.
    assert set(match.source_hypothesis_evidence_ids).isdisjoint(match.source_verification_evidence_ids)


def test_no_verification_yields_empty_verification_evidence_ids() -> None:
    hyp = _hyp("h1", OpportunityStatus.CONFIRMED, supporting=["e1"])
    match = build_match(hyp, None)
    assert match.source_hypothesis_evidence_ids == ["e1"]
    assert match.source_verification_evidence_ids == []
    assert match.verification_id is None
    assert match.verification_execution_status is None
    assert match.verification_outcome is None
    assert match.no_independent_source_found is None


# --- Capability taxonomy populated regardless of match_status ---------------


def test_capability_populated_even_when_not_matched() -> None:
    hyp = _hyp("h1", OpportunityStatus.CONTRADICTED)
    match = build_match(hyp, None)
    assert match.match_status == MatchStatus.NOT_MATCHED
    assert match.primary_capability_id == "ai_appointment_booking_assistance"


# --- Immutability: Matcher never touches other collections' save paths -----


def test_matcher_module_never_calls_mutating_firestore_helpers() -> None:
    # The module must not import firestore_store at all -- the strongest
    # possible guarantee that it cannot call any save_* helper, mutating or
    # not. Persistence is the caller's job (scripts/run_opportunity_matcher.py).
    assert "firestore_store" not in opportunity_matcher.__dict__
    source = inspect.getsource(opportunity_matcher)
    assert "import firestore_store" not in source
    assert "from app.investigator import firestore_store" not in source
    for forbidden_call in (
        "save_hypothesis(",
        "save_verification(",
        "save_evidence(",
        "save_investigation(",
        "save_business(",
        "save_run(",
    ):
        assert forbidden_call not in source, f"opportunity_matcher.py must never call {forbidden_call}"


# --- Summary -------------------------------------------------------------


def test_summarize_matches_is_deterministic_and_excludes_strategist_scope() -> None:
    hypotheses = [
        _hyp("h1", OpportunityStatus.CONFIRMED),
        _hyp("h2", OpportunityStatus.CONTRADICTED),
        _hyp("h3", OpportunityStatus.INSUFFICIENT_EVIDENCE),
    ]
    matches = [build_match(h, None) for h in hypotheses]
    summary = summarize_matches(matches)

    assert summary["total_evaluated"] == 3
    assert summary["match_status_counts"]["MATCHED"] == 1
    assert summary["match_status_counts"]["NOT_MATCHED"] == 2
    assert summary["match_status_counts"]["UNRESOLVED"] == 0
    assert summary["verification_coverage"] == 0
    assert set(summary["primary_capability_counts_matched"]) <= {"ai_appointment_booking_assistance"}
    # No Strategist-scope keys leak into the summary.
    for forbidden_key in ("ranking", "priority", "strategy", "narrative", "recommendation"):
        assert forbidden_key not in summary
