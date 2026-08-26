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

from app.investigator import (
    firestore_store,
    public_web_fetcher,
    verification_batch_runner,
    verification_discovery,
    verification_reasoner,
)
from app.investigator.catalog import ONLINE_BOOKING_FRICTION
from app.investigator.models import (
    Business,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
    UsageMetadata,
    VerificationExecutionStatus,
    VerificationOutcome,
)
from app.investigator.public_web_fetcher import IndependentFetchResult
from app.investigator.source_adapter import SourceMaterial
from app.investigator.verification_discovery import DiscoveryCallResult, RawCandidate
from app.investigator.verification_reasoner import (
    GeminiVerificationEvaluation,
    GeminiVerificationEvidenceItem,
    VerificationCallResult,
)

RUN_ID = "run-1"


def _hyp(
    hypothesis_id: str,
    business_id: str,
    status: OpportunityStatus = OpportunityStatus.CONFIRMED,
) -> OpportunityHypothesis:
    return OpportunityHypothesis(
        hypothesis_id=hypothesis_id,
        run_id=RUN_ID,
        business_id=business_id,
        investigation_id=f"inv-{hypothesis_id}",
        opportunity_id="online_booking_friction",
        opportunity_type=OpportunityType.CAPABILITY_GAP,
        statement="s",
        confidence=0.85,
        status=status,
    )


def _biz(business_id: str) -> Business:
    return Business(
        business_id=business_id,
        display_name=f"Business {business_id}",
        website_url=f"https://{business_id}.example.com",
    )


def _patch_firestore_noops(monkeypatch, usage_calls: list | None = None) -> None:
    monkeypatch.setattr(firestore_store, "save_verification", lambda v: None)
    monkeypatch.setattr(firestore_store, "save_evidence", lambda e: None)
    monkeypatch.setattr(firestore_store, "get_evidence", lambda eid: None)
    if usage_calls is not None:
        monkeypatch.setattr(
            firestore_store,
            "save_usage_metadata",
            lambda u, doc_id: usage_calls.append((u, doc_id)),
        )
    else:
        monkeypatch.setattr(firestore_store, "save_usage_metadata", lambda u, doc_id: None)


def _empty_discovery() -> DiscoveryCallResult:
    return DiscoveryCallResult(
        requested_search_query="q",
        executed_search_queries=[],
        candidates=[],
        model="gemini-3.6-flash",
        timestamp="t",
    )


def test_one_hypothesis_failure_does_not_abort_batch(monkeypatch) -> None:
    _patch_firestore_noops(monkeypatch)

    def flaky_discover(business, hypothesis, definition, verification_target):
        if hypothesis.hypothesis_id == "h-fail":
            raise RuntimeError("simulated discovery crash")
        return _empty_discovery()

    monkeypatch.setattr(verification_discovery, "discover_independent_candidates", flaky_discover)

    businesses = {"b1": _biz("b1"), "b2": _biz("b2")}
    definitions = {"online_booking_friction": ONLINE_BOOKING_FRICTION}
    hyps = [_hyp("h-fail", "b1"), _hyp("h-ok", "b2")]

    batch = verification_batch_runner.run_verification_batch(RUN_ID, businesses, definitions, hyps)

    assert len(batch.attempts) == 2
    assert batch.attempts[0].error is not None
    assert not batch.attempts[0].succeeded
    assert batch.attempts[1].succeeded
    assert batch.attempts[1].verification.no_independent_source_found is True


def test_failed_execution_is_distinct_from_no_independent_source(monkeypatch) -> None:
    _patch_firestore_noops(monkeypatch)
    business = _biz("b1")
    hyp = _hyp("h1", "b1")

    # (a) discovery technically fails (bounded retries exhausted)
    monkeypatch.setattr(
        verification_discovery,
        "discover_independent_candidates",
        lambda *a, **k: DiscoveryCallResult(
            requested_search_query="q", model="m", timestamp="t", raw_error="grounding call failed"
        ),
    )
    failed = verification_batch_runner.run_one_verification(
        RUN_ID, business, ONLINE_BOOKING_FRICTION, hyp
    )
    assert failed.execution_status == VerificationExecutionStatus.FAILED
    assert failed.no_independent_source_found is False
    assert failed.outcome is None

    # (b) discovery succeeds but yields zero candidates
    monkeypatch.setattr(
        verification_discovery, "discover_independent_candidates", lambda *a, **k: _empty_discovery()
    )
    no_source = verification_batch_runner.run_one_verification(
        RUN_ID, business, ONLINE_BOOKING_FRICTION, hyp
    )
    assert no_source.execution_status == VerificationExecutionStatus.COMPLETED
    assert no_source.no_independent_source_found is True
    assert no_source.outcome is None

    assert failed.execution_status != no_source.execution_status or (
        failed.no_independent_source_found != no_source.no_independent_source_found
    )


def test_original_hypothesis_is_never_persisted_by_verification(monkeypatch) -> None:
    usage_calls: list = []
    _patch_firestore_noops(monkeypatch, usage_calls)

    def _raise_if_called(*args, **kwargs):
        raise AssertionError("Verification must never write to the hypotheses collection")

    monkeypatch.setattr(firestore_store, "save_hypothesis", _raise_if_called)

    business = _biz("b1")
    hyp = _hyp("h1", "b1")
    source = SourceMaterial(
        source_type="WEBSITE",
        source_url="https://directory.example.com/listing",
        retrieved_at="t",
        content="Online booking not available yet.",
    )

    monkeypatch.setattr(
        verification_discovery,
        "discover_independent_candidates",
        lambda *a, **k: DiscoveryCallResult(
            requested_search_query="q",
            executed_search_queries=["q"],
            candidates=[RawCandidate(uri="https://redirect.example/x", title="directory.example.com")],
            model="m",
            timestamp="t",
        ),
    )
    monkeypatch.setattr(
        public_web_fetcher,
        "resolve_and_fetch_independent_source",
        lambda *a, **k: IndependentFetchResult(source=source, rejected_reason=None),
    )
    monkeypatch.setattr(
        verification_reasoner,
        "evaluate_verification",
        lambda *a, **k: VerificationCallResult(
            evaluation=GeminiVerificationEvaluation(
                outcome=VerificationOutcome.SUPPORTS,
                confidence=0.8,
                evidence=[
                    GeminiVerificationEvidenceItem(
                        source_url=source.source_url, observation="States booking unavailable."
                    )
                ],
                reasoning="Independent listing confirms no booking path.",
            ),
            model="m",
            prompt_tokens=1,
            output_tokens=1,
            thought_tokens=0,
            total_tokens=2,
            timestamp="t",
            invocation_id="inv1",
        ),
    )

    original_snapshot = hyp.model_copy(deep=True)
    verification = verification_batch_runner.run_one_verification(
        RUN_ID, business, ONLINE_BOOKING_FRICTION, hyp
    )

    assert hyp == original_snapshot  # untouched
    assert verification.execution_status == VerificationExecutionStatus.COMPLETED
    assert verification.outcome == VerificationOutcome.SUPPORTS
    assert len(verification.independent_evidence_ids) == 1

    phases = {call[0].phase for call in usage_calls}
    assert phases == {"verification_discovery", "verification_reasoning"}
    verification_ids = {call[0].verification_id for call in usage_calls}
    assert verification_ids == {verification.verification_id}


def test_legacy_usage_metadata_without_new_fields_remains_valid() -> None:
    legacy = UsageMetadata(
        investigation_id="inv-legacy",
        model="gemini-3.6-flash",
        timestamp="2026-01-01T00:00:00Z",
    )
    assert legacy.phase is None
    assert legacy.verification_id is None
    assert legacy.run_id is None
