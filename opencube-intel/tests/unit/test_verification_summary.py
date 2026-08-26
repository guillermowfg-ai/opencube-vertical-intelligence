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

from app.investigator.models import (
    Evidence,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
    SourceType,
    Verification,
    VerificationExecutionStatus,
    VerificationOutcome,
)
from app.investigator.verification_batch_runner import (
    VerificationAttempt,
    VerificationBatchResult,
    summarize_verification_batch,
)

RUN_ID = "run-1"


def _hyp(hypothesis_id: str, status: OpportunityStatus) -> OpportunityHypothesis:
    return OpportunityHypothesis(
        hypothesis_id=hypothesis_id,
        run_id=RUN_ID,
        business_id="b1",
        investigation_id="inv-1",
        opportunity_id="online_booking_friction",
        opportunity_type=OpportunityType.CAPABILITY_GAP,
        statement="s",
        confidence=0.8,
        status=status,
    )


def _verification(
    verification_id: str,
    original_status: OpportunityStatus,
    *,
    execution_status: VerificationExecutionStatus = VerificationExecutionStatus.COMPLETED,
    outcome: VerificationOutcome | None = None,
    no_independent_source_found: bool = False,
) -> Verification:
    return Verification(
        verification_id=verification_id,
        run_id=RUN_ID,
        business_id="b1",
        investigation_id="inv-1",
        hypothesis_id=f"h-{verification_id}",
        opportunity_id="online_booking_friction",
        original_status=original_status,
        verification_target="t",
        execution_status=execution_status,
        outcome=outcome,
        no_independent_source_found=no_independent_source_found,
        created_at="t",
    )


def _attempt(hyp_status: OpportunityStatus, verification: Verification | None, error: str | None = None):
    return VerificationAttempt(
        hypothesis=_hyp(f"h-{verification.verification_id if verification else 'x'}", hyp_status),
        verification=verification,
        error=error,
    )


def test_aggregate_execution_and_outcome_counts() -> None:
    attempts = [
        _attempt(
            OpportunityStatus.CONFIRMED,
            _verification("v1", OpportunityStatus.CONFIRMED, outcome=VerificationOutcome.SUPPORTS),
        ),
        _attempt(
            OpportunityStatus.CONTRADICTED,
            _verification("v2", OpportunityStatus.CONTRADICTED, outcome=VerificationOutcome.CONTRADICTS),
        ),
        _attempt(
            OpportunityStatus.INSUFFICIENT_EVIDENCE,
            _verification(
                "v3",
                OpportunityStatus.INSUFFICIENT_EVIDENCE,
                outcome=VerificationOutcome.INSUFFICIENT_EVIDENCE,
            ),
        ),
        _attempt(
            OpportunityStatus.CONTRADICTED,
            _verification("v4", OpportunityStatus.CONTRADICTED, no_independent_source_found=True),
        ),
        _attempt(
            OpportunityStatus.INSUFFICIENT_EVIDENCE,
            _verification(
                "v5", OpportunityStatus.INSUFFICIENT_EVIDENCE, execution_status=VerificationExecutionStatus.FAILED
            ),
        ),
        _attempt(OpportunityStatus.CONTRADICTED, None, error="unanticipated crash"),
    ]
    batch = VerificationBatchResult(run_id=RUN_ID, attempts=attempts)
    summary = summarize_verification_batch(batch)

    assert summary["scheduled"] == 6
    assert summary["completed"] == 4  # v1, v2, v3, v4 (v4 completed with no source)
    assert summary["failed"] == 2  # v5 (FAILED) + the unanticipated-crash attempt
    assert summary["no_independent_source"] == 1  # v4 only
    assert summary["outcome_counts"] == {
        "SUPPORTS": 1,
        "CONTRADICTS": 1,
        "INSUFFICIENT_EVIDENCE": 1,
    }


def test_agreement_matrix_never_conflates_categories() -> None:
    attempts = [
        _attempt(
            OpportunityStatus.CONFIRMED,
            _verification("v1", OpportunityStatus.CONFIRMED, outcome=VerificationOutcome.SUPPORTS),
        ),
        _attempt(
            OpportunityStatus.CONFIRMED,
            _verification("v2", OpportunityStatus.CONFIRMED, outcome=VerificationOutcome.CONTRADICTS),
        ),
        _attempt(
            OpportunityStatus.CONTRADICTED,
            _verification("v3", OpportunityStatus.CONTRADICTED, no_independent_source_found=True),
        ),
        _attempt(
            OpportunityStatus.INSUFFICIENT_EVIDENCE,
            _verification(
                "v4", OpportunityStatus.INSUFFICIENT_EVIDENCE, execution_status=VerificationExecutionStatus.FAILED
            ),
        ),
    ]
    batch = VerificationBatchResult(run_id=RUN_ID, attempts=attempts)
    matrix = summarize_verification_batch(batch)["agreement_matrix"]

    # Original CONFIRMED can disagree with an independent verification --
    # both rows must survive, not collapse into one "resolved" status.
    assert matrix["CONFIRMED"]["SUPPORTS"] == 1
    assert matrix["CONFIRMED"]["CONTRADICTS"] == 1
    assert matrix["CONTRADICTED"]["NO_INDEPENDENT_SOURCE"] == 1
    assert matrix["INSUFFICIENT_EVIDENCE"]["FAILED"] == 1
    # Categories never bleed into each other.
    assert matrix["CONTRADICTED"]["INSUFFICIENT_EVIDENCE"] == 0
    assert matrix["INSUFFICIENT_EVIDENCE"]["NO_INDEPENDENT_SOURCE"] == 0


# --- Correction 10: Evidence provenance / double-count protection ---------


def _evidence(evidence_id: str, collected_by: str) -> Evidence:
    return Evidence(
        evidence_id=evidence_id,
        run_id=RUN_ID,
        business_id="b1",
        investigation_id="inv-1",
        source_url=f"https://example.com/{evidence_id}",
        source_type=SourceType.WEBSITE,
        observation="o",
        retrieved_at="t",
        collected_by=collected_by,
    )


def test_verification_evidence_is_provenance_distinguishable_from_investigator_evidence() -> None:
    mixed_run_evidence = [
        _evidence("e1", "business_investigator_v1"),
        _evidence("e2", "business_investigator_v1"),
        _evidence("e3", "verification_loop_v1"),
    ]

    # An unfiltered run-level count includes both provenance classes --
    # this is expected, not a bug, but it must never be silently reported
    # as "original Investigator evidence" without the collected_by filter.
    assert len(mixed_run_evidence) == 3

    investigator_only = [e for e in mixed_run_evidence if e.collected_by == "business_investigator_v1"]
    verification_only = [e for e in mixed_run_evidence if e.collected_by == "verification_loop_v1"]

    assert len(investigator_only) == 2
    assert len(verification_only) == 1
    # The two provenance classes are disjoint -- no record double-counted.
    assert {e.evidence_id for e in investigator_only}.isdisjoint(
        {e.evidence_id for e in verification_only}
    )
