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
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
)
from app.investigator.verification_selection import select_hypotheses_for_verification
from app.investigator.verification_target import build_verification_target

RUN_ID = "run-1"


def _hyp(
    hypothesis_id: str, status: OpportunityStatus, opportunity_id: str = "online_booking_friction"
) -> OpportunityHypothesis:
    return OpportunityHypothesis(
        hypothesis_id=hypothesis_id,
        run_id=RUN_ID,
        business_id=f"biz-{hypothesis_id}",
        investigation_id=f"inv-{hypothesis_id}",
        opportunity_id=opportunity_id,
        opportunity_type=OpportunityType.CAPABILITY_GAP,
        statement="s",
        confidence=0.5,
        status=status,
    )


def test_all_confirmed_included_regardless_of_definition_flag() -> None:
    # online_booking_friction.requires_independent_verification is False in
    # the catalog -- selection must not gate on that flag: the real accepted
    # run's one CONFIRMED hypothesis is on exactly this opportunity_id.
    confirmed = _hyp("h-confirmed", OpportunityStatus.CONFIRMED, "online_booking_friction")
    hypotheses = [confirmed] + [
        _hyp(f"h-c{i}", OpportunityStatus.CONTRADICTED) for i in range(10)
    ]
    selected = select_hypotheses_for_verification(hypotheses)
    assert confirmed.hypothesis_id in {h.hypothesis_id for h in selected}


def test_deterministic_bounded_sample_sizes() -> None:
    hypotheses = (
        [_hyp("h-confirmed-1", OpportunityStatus.CONFIRMED)]
        + [_hyp(f"h-contra-{i}", OpportunityStatus.CONTRADICTED) for i in range(10)]
        + [_hyp(f"h-insuff-{i}", OpportunityStatus.INSUFFICIENT_EVIDENCE) for i in range(10)]
    )
    selected = select_hypotheses_for_verification(hypotheses, sample_size=4)
    statuses = [h.status for h in selected]
    assert statuses.count(OpportunityStatus.CONFIRMED) == 1
    assert statuses.count(OpportunityStatus.CONTRADICTED) == 4
    assert statuses.count(OpportunityStatus.INSUFFICIENT_EVIDENCE) == 4
    assert len(selected) == 9


def test_selection_is_deterministic_same_input_same_output() -> None:
    hypotheses = [_hyp(f"h-contra-{i}", OpportunityStatus.CONTRADICTED) for i in range(10)]
    first = select_hypotheses_for_verification(hypotheses)
    second = select_hypotheses_for_verification(hypotheses)
    assert [h.hypothesis_id for h in first] == [h.hypothesis_id for h in second]


def test_selection_never_reorders_by_shuffled_input() -> None:
    hypotheses = [_hyp(f"h-contra-{i}", OpportunityStatus.CONTRADICTED) for i in range(10)]
    shuffled = list(reversed(hypotheses))
    assert [h.hypothesis_id for h in select_hypotheses_for_verification(hypotheses)] == [
        h.hypothesis_id for h in select_hypotheses_for_verification(shuffled)
    ]


# --- verification_target determinism / bounded scope ----------------------


def test_verification_target_is_deterministic() -> None:
    first = build_verification_target("online_booking_friction", OpportunityStatus.CONFIRMED)
    second = build_verification_target("online_booking_friction", OpportunityStatus.CONFIRMED)
    assert first == second


def test_verification_target_matches_bounded_observational_scope() -> None:
    target = build_verification_target("online_booking_friction", OpportunityStatus.CONFIRMED)
    assert target == (
        "The inspected public presence does not expose a visible direct "
        "online booking path."
    )
    # Must not overreach into unsupported commercial/behavioral claims.
    for overreach in ("revenue", "lose", "abandon", "customers", "conversion"):
        assert overreach not in target.lower()


# --- regression: verification_target is status-independent ----------------
#
# SUPPORTS/CONTRADICTS/INSUFFICIENT_EVIDENCE must always be evaluated
# against the SAME canonical proposition for a given opportunity_id --
# the original OpportunityStatus is context only and must never select a
# different (let alone polarity-flipped) target.

_CANONICAL_OPPORTUNITY_IDS = (
    "online_booking_friction",
    "after_hours_lead_intake",
    "lead_follow_up_effectiveness",
)


def test_target_is_identical_across_all_original_statuses() -> None:
    for opportunity_id in _CANONICAL_OPPORTUNITY_IDS:
        confirmed = build_verification_target(opportunity_id, OpportunityStatus.CONFIRMED)
        contradicted = build_verification_target(opportunity_id, OpportunityStatus.CONTRADICTED)
        insufficient = build_verification_target(
            opportunity_id, OpportunityStatus.INSUFFICIENT_EVIDENCE
        )
        assert confirmed == contradicted == insufficient, (
            f"verification_target for {opportunity_id!r} must not vary by original_status"
        )


def test_contradicted_target_is_not_a_polarity_flipped_opposite() -> None:
    # The historical bug: a CONTRADICTED-status target that negates the
    # CONFIRMED-status target for the same opportunity_id (e.g. "exposes"
    # vs "does not expose"). Assert the two share the same polarity marker.
    for opportunity_id in _CANONICAL_OPPORTUNITY_IDS:
        confirmed = build_verification_target(opportunity_id, OpportunityStatus.CONFIRMED)
        contradicted = build_verification_target(opportunity_id, OpportunityStatus.CONTRADICTED)
        confirmed_is_negative = "does not" in confirmed or "no " in confirmed or " no" in confirmed
        contradicted_is_negative = (
            "does not" in contradicted or "no " in contradicted or " no" in contradicted
        )
        assert confirmed_is_negative == contradicted_is_negative, (
            f"CONTRADICTED target for {opportunity_id!r} has flipped polarity "
            f"relative to CONFIRMED: {confirmed!r} vs {contradicted!r}"
        )
