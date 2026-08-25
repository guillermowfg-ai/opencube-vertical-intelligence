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

from app.investigator import validation
from app.investigator.catalog import ONLINE_BOOKING_FRICTION
from app.investigator.gemini_reasoner import (
    GeminiEvidenceItem,
    GeminiHypothesisEvaluation,
)
from app.investigator.models import OpportunityStatus, SourceType
from app.investigator.source_adapter import SourceMaterial

RUN_ID = "run-1"
BUSINESS_ID = "biz-1"
INVESTIGATION_ID = "inv-1"


def _sources() -> list[SourceMaterial]:
    return [
        SourceMaterial(
            source_type=SourceType.WEBSITE,
            source_url="https://example.com/",
            retrieved_at="2026-08-25T00:00:00Z",
            content="homepage content",
        ),
        SourceMaterial(
            source_type=SourceType.WEBSITE,
            source_url="https://example.com/contact",
            retrieved_at="2026-08-25T00:00:05Z",
            content="contact content",
        ),
    ]


def test_assign_evidence_records_maps_source_metadata() -> None:
    evaluation = GeminiHypothesisEvaluation(
        status=OpportunityStatus.CONTRADICTED,
        confidence=0.9,
        evidence=[
            GeminiEvidenceItem(
                source_url="https://example.com/",
                observation="A 'Book Now' button is visible in the header.",
            )
        ],
        supporting_evidence_indices=[],
        contradicting_evidence_indices=[0],
        reasoning="Booking is available.",
    )
    records = validation.assign_evidence_records(
        evaluation,
        _sources(),
        run_id=RUN_ID,
        business_id=BUSINESS_ID,
        investigation_id=INVESTIGATION_ID,
        collected_by="test",
    )
    assert len(records) == 1
    assert records[0].source_url == "https://example.com/"
    assert records[0].source_type == SourceType.WEBSITE
    assert records[0].retrieved_at == "2026-08-25T00:00:00Z"


def test_assign_evidence_records_rejects_unknown_source_url() -> None:
    evaluation = GeminiHypothesisEvaluation(
        status=OpportunityStatus.CONFIRMED,
        confidence=0.7,
        evidence=[
            GeminiEvidenceItem(
                source_url="https://not-fetched.example.com/",
                observation="Fabricated.",
            )
        ],
        supporting_evidence_indices=[0],
        contradicting_evidence_indices=[],
        reasoning="test",
    )
    with pytest.raises(validation.AssemblyError):
        validation.assign_evidence_records(
            evaluation,
            _sources(),
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
            collected_by="test",
        )


def test_build_hypothesis_resolves_indices_to_evidence_ids() -> None:
    evaluation = GeminiHypothesisEvaluation(
        status=OpportunityStatus.CONTRADICTED,
        confidence=0.9,
        evidence=[
            GeminiEvidenceItem(
                source_url="https://example.com/",
                observation="A 'Book Now' button is visible.",
            )
        ],
        supporting_evidence_indices=[],
        contradicting_evidence_indices=[0],
        reasoning="test",
    )
    records = validation.assign_evidence_records(
        evaluation,
        _sources(),
        run_id=RUN_ID,
        business_id=BUSINESS_ID,
        investigation_id=INVESTIGATION_ID,
        collected_by="test",
    )
    hypothesis = validation.build_hypothesis(
        evaluation,
        records,
        ONLINE_BOOKING_FRICTION,
        run_id=RUN_ID,
        business_id=BUSINESS_ID,
        investigation_id=INVESTIGATION_ID,
    )
    assert hypothesis.contradicting_evidence_ids == [records[0].evidence_id]
    assert hypothesis.status == OpportunityStatus.CONTRADICTED
    assert hypothesis.opportunity_id == ONLINE_BOOKING_FRICTION.opportunity_id


def test_build_hypothesis_rejects_out_of_range_index() -> None:
    evaluation = GeminiHypothesisEvaluation(
        status=OpportunityStatus.CONFIRMED,
        confidence=0.5,
        evidence=[],
        supporting_evidence_indices=[0],
        contradicting_evidence_indices=[],
        reasoning="test",
    )
    with pytest.raises(validation.AssemblyError):
        validation.build_hypothesis(
            evaluation,
            [],
            ONLINE_BOOKING_FRICTION,
            run_id=RUN_ID,
            business_id=BUSINESS_ID,
            investigation_id=INVESTIGATION_ID,
        )
