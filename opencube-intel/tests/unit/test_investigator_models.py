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

import pytest
from pydantic import ValidationError

from app.investigator.models import (
    Business,
    ContactRecommendation,
    Evidence,
    Investigation,
    InvestigationResult,
    InvestigationStatus,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
    Run,
    RunStatus,
    SourceType,
    UsageMetadata,
)

RUN_ID = "run-1"
BUSINESS_ID = "biz-1"
INVESTIGATION_ID = "inv-1"


def _run() -> Run:
    return Run(
        run_id=RUN_ID,
        created_at="2026-08-25T00:00:00Z",
        status=RunStatus.COMPLETED,
        vertical="Med Spa",
        geography="Miami / South Florida",
        provider_capabilities=["AI Appointment / Booking Assistance"],
    )


def _business() -> Business:
    return Business(
        business_id=BUSINESS_ID,
        display_name="Test Med Spa",
        formatted_address="123 Main St, Miami, FL",
        website_url="https://example.com",
        place_id="places/abc",
    )


def _investigation() -> Investigation:
    return Investigation(
        investigation_id=INVESTIGATION_ID,
        run_id=RUN_ID,
        business_id=BUSINESS_ID,
        created_at="2026-08-25T00:00:00Z",
        completed_at="2026-08-25T00:01:00Z",
        status=InvestigationStatus.COMPLETED,
        source_count=1,
        evidence_count=1,
    )


def _evidence(evidence_id: str = "ev-1") -> Evidence:
    return Evidence(
        evidence_id=evidence_id,
        run_id=RUN_ID,
        business_id=BUSINESS_ID,
        investigation_id=INVESTIGATION_ID,
        source_url="https://example.com",
        source_type=SourceType.WEBSITE,
        observation="The homepage displays a 'Book Now' button.",
        retrieved_at="2026-08-25T00:00:30Z",
        collected_by="test",
    )


def test_business_has_no_run_id_field() -> None:
    assert "run_id" not in Business.model_fields


def test_evidence_rejects_empty_observation() -> None:
    with pytest.raises(ValidationError):
        Evidence(
            evidence_id="ev-1",
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
            source_url="https://example.com",
            source_type=SourceType.WEBSITE,
            observation="   ",
            retrieved_at="2026-08-25T00:00:30Z",
            collected_by="test",
        )


def test_evidence_rejects_empty_source_url() -> None:
    with pytest.raises(ValidationError):
        Evidence(
            evidence_id="ev-1",
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
            source_url="",
            source_type=SourceType.WEBSITE,
            observation="Something factual.",
            retrieved_at="2026-08-25T00:00:30Z",
            collected_by="test",
        )


@pytest.mark.parametrize("status", list(OpportunityStatus))
def test_opportunity_status_enum_values(status: OpportunityStatus) -> None:
    assert isinstance(status.value, str)


@pytest.mark.parametrize("otype", list(OpportunityType))
def test_opportunity_type_enum_values(otype: OpportunityType) -> None:
    assert isinstance(otype.value, str)


def test_hypothesis_status_rejects_arbitrary_string() -> None:
    with pytest.raises(ValidationError):
        OpportunityHypothesis(
            hypothesis_id="h-1",
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
            opportunity_id="online_booking_friction",
            opportunity_type=OpportunityType.CAPABILITY_GAP,
            statement="test",
            confidence=0.5,
            status="PROBABLY_TRUE",  # not a valid OpportunityStatus
        )


def test_hypothesis_rejects_evidence_id_in_both_support_and_contradict() -> None:
    with pytest.raises(ValidationError):
        OpportunityHypothesis(
            hypothesis_id="h-1",
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
            opportunity_id="online_booking_friction",
            opportunity_type=OpportunityType.CAPABILITY_GAP,
            statement="test",
            supporting_evidence_ids=["ev-1"],
            contradicting_evidence_ids=["ev-1"],
            confidence=0.5,
            status=OpportunityStatus.CONFIRMED,
        )


def test_hypothesis_rejects_out_of_range_confidence() -> None:
    with pytest.raises(ValidationError):
        OpportunityHypothesis(
            hypothesis_id="h-1",
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
            opportunity_id="online_booking_friction",
            opportunity_type=OpportunityType.CAPABILITY_GAP,
            statement="test",
            confidence=1.5,
            status=OpportunityStatus.CONFIRMED,
        )


def _hypothesis(**overrides) -> OpportunityHypothesis:
    defaults = {
        "hypothesis_id": "h-1",
        "run_id": RUN_ID,
        "business_id": BUSINESS_ID,
        "investigation_id": INVESTIGATION_ID,
        "opportunity_id": "online_booking_friction",
        "opportunity_type": OpportunityType.CAPABILITY_GAP,
        "statement": "test",
        "supporting_evidence_ids": [],
        "contradicting_evidence_ids": [],
        "confidence": 0.5,
        "status": OpportunityStatus.CONFIRMED,
    }
    defaults.update(overrides)
    return OpportunityHypothesis(**defaults)


def _usage() -> UsageMetadata:
    return UsageMetadata(
        investigation_id=INVESTIGATION_ID,
        model="gemini-3.6-flash",
        prompt_tokens=100,
        output_tokens=50,
        thought_tokens=10,
        total_tokens=160,
        timestamp="2026-08-25T00:01:00Z",
        invocation_id="inv-abc",
    )


def test_investigation_result_accepts_consistent_ids() -> None:
    ev = _evidence()
    hyp = _hypothesis(supporting_evidence_ids=[ev.evidence_id])
    result = InvestigationResult(
        investigation=_investigation(),
        business=_business(),
        hypotheses=[hyp],
        evidence=[ev],
        usage=[_usage()],
        contact_recommendation=ContactRecommendation.HUMAN_REVIEW,
        contact_reason="Confirmed opportunity requires review.",
    )
    assert result.hypotheses[0].supporting_evidence_ids == [ev.evidence_id]


def test_investigation_result_rejects_hypothesis_referencing_unknown_evidence() -> None:
    hyp = _hypothesis(supporting_evidence_ids=["does-not-exist"])
    with pytest.raises(ValidationError):
        InvestigationResult(
            investigation=_investigation(),
            business=_business(),
            hypotheses=[hyp],
            evidence=[],
            usage=[_usage()],
            contact_recommendation=ContactRecommendation.HUMAN_REVIEW,
            contact_reason="test",
        )


def test_investigation_result_rejects_evidence_from_wrong_investigation() -> None:
    bad_evidence = _evidence().model_copy(update={"investigation_id": "other-inv"})
    with pytest.raises(ValidationError):
        InvestigationResult(
            investigation=_investigation(),
            business=_business(),
            hypotheses=[],
            evidence=[bad_evidence],
            usage=[_usage()],
            contact_recommendation=ContactRecommendation.DO_NOT_CONTACT,
            contact_reason="test",
        )


def test_investigation_result_rejects_duplicate_evidence_ids() -> None:
    ev1 = _evidence("ev-1")
    ev2 = _evidence("ev-1")
    with pytest.raises(ValidationError):
        InvestigationResult(
            investigation=_investigation(),
            business=_business(),
            hypotheses=[],
            evidence=[ev1, ev2],
            usage=[_usage()],
            contact_recommendation=ContactRecommendation.DO_NOT_CONTACT,
            contact_reason="test",
        )
