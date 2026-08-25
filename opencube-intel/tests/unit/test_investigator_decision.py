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

from app.investigator.investigator import decide_contact_recommendation
from app.investigator.models import (
    ContactRecommendation,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
)

RUN_ID = "run-1"
BUSINESS_ID = "biz-1"
INVESTIGATION_ID = "inv-1"


def _hyp(status: OpportunityStatus, opportunity_id: str = "opp") -> OpportunityHypothesis:
    return OpportunityHypothesis(
        hypothesis_id=f"h-{opportunity_id}-{status.value}",
        run_id=RUN_ID,
        business_id=BUSINESS_ID,
        investigation_id=INVESTIGATION_ID,
        opportunity_id=opportunity_id,
        opportunity_type=OpportunityType.CAPABILITY_GAP,
        statement="test",
        confidence=0.5,
        status=status,
    )


def test_no_hypotheses_defaults_to_human_review() -> None:
    recommendation, _ = decide_contact_recommendation([])
    assert recommendation == ContactRecommendation.HUMAN_REVIEW


def test_all_contradicted_or_insufficient_means_do_not_contact() -> None:
    hyps = [
        _hyp(OpportunityStatus.CONTRADICTED, "a"),
        _hyp(OpportunityStatus.INSUFFICIENT_EVIDENCE, "b"),
    ]
    recommendation, reason = decide_contact_recommendation(hyps)
    assert recommendation == ContactRecommendation.DO_NOT_CONTACT
    assert "CONTRADICTED" in reason or "INSUFFICIENT_EVIDENCE" in reason


def test_any_confirmed_means_human_review() -> None:
    hyps = [
        _hyp(OpportunityStatus.CONTRADICTED, "a"),
        _hyp(OpportunityStatus.CONFIRMED, "b"),
    ]
    recommendation, reason = decide_contact_recommendation(hyps)
    assert recommendation == ContactRecommendation.HUMAN_REVIEW
    assert "b" in reason


def test_confirmed_never_becomes_do_not_contact() -> None:
    hyps = [_hyp(OpportunityStatus.CONFIRMED, "a")]
    recommendation, _ = decide_contact_recommendation(hyps)
    assert recommendation != ContactRecommendation.DO_NOT_CONTACT
