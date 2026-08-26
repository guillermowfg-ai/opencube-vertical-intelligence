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

"""Opportunity Matcher V1 — real-execution proof.

Loads all 30 original OpportunityHypotheses and all 9 Verification records
from the existing accepted Market Scout run, applies the frozen deterministic
reconciliation matrix, and persists exactly one OpportunityMatch per
hypothesis. Does NOT rerun Market Scout, Business Investigator, or
Verification Loop -- only adds new `opportunity_matches` documents. Zero
Gemini calls, zero Search grounding.

Run with:
    uv run python scripts/run_opportunity_matcher.py
"""

from __future__ import annotations

import collections

from dotenv import load_dotenv

load_dotenv()

from app.investigator import firestore_store, opportunity_matcher  # noqa: E402
from app.investigator.models import OpportunityHypothesis, Verification  # noqa: E402

RUN_ID = "1c9959cb-2aba-4cf6-ba9d-94848d7a3b01"


def _print_header(title: str) -> None:
    print("\n" + "=" * 88)
    print(title)
    print("=" * 88)


def _latest_verification_by_hypothesis(
    verifications: list[Verification],
) -> dict[str, Verification]:
    """One Verification per hypothesis_id. If more than one exists for the
    same hypothesis_id (not expected in the accepted dataset, but not
    schema-enforced either), keep the latest by created_at -- never delete
    or mutate the others."""
    by_hypothesis: dict[str, Verification] = {}
    for v in verifications:
        current = by_hypothesis.get(v.hypothesis_id)
        if current is None or v.created_at > current.created_at:
            by_hypothesis[v.hypothesis_id] = v
    return by_hypothesis


def main() -> None:
    _print_header("OPPORTUNITY MATCHER V1 — LOADING EXISTING ACCEPTED RUN (read-only)")
    hypothesis_dicts = firestore_store.list_hypotheses_for_run(RUN_ID)
    hypotheses = sorted(
        (OpportunityHypothesis(**d) for d in hypothesis_dicts), key=lambda h: h.hypothesis_id
    )
    print(f"run_id: {RUN_ID}")
    print(f"total hypotheses loaded: {len(hypotheses)}")
    by_status: dict[str, int] = {}
    for h in hypotheses:
        by_status[h.status.value] = by_status.get(h.status.value, 0) + 1
    print(f"by original status: {by_status}")

    verification_dicts = firestore_store.list_verifications_for_run(RUN_ID)
    verifications = [Verification(**d) for d in verification_dicts]
    print(f"total verifications loaded: {len(verifications)}")
    verification_by_hypothesis = _latest_verification_by_hypothesis(verifications)

    # Pre-execution snapshot for the immutability proof (step 7 below).
    pre_hypothesis_dicts = {h["hypothesis_id"]: h for h in hypothesis_dicts}
    pre_verification_dicts = {v["verification_id"]: v for v in verification_dicts}

    _print_header("BUILDING OPPORTUNITY MATCHES (deterministic, zero Gemini calls)")
    matches = []
    for h in hypotheses:
        verification = verification_by_hypothesis.get(h.hypothesis_id)
        match = opportunity_matcher.build_match(h, verification)
        matches.append(match)
        firestore_store.save_opportunity_match(match)

    _print_header("PER-HYPOTHESIS RESULTS (all 30, no sampling)")
    for m in matches:
        print(
            f"\nhypothesis_id={m.hypothesis_id} opportunity_id={m.opportunity_id} "
            f"original_status={m.original_status.value}"
        )
        print(f"  verification_id={m.verification_id}")
        print(
            f"  verification_execution_status="
            f"{m.verification_execution_status.value if m.verification_execution_status else None} "
            f"verification_outcome={m.verification_outcome.value if m.verification_outcome else None} "
            f"no_independent_source_found={m.no_independent_source_found}"
        )
        print(f"  match_status={m.match_status.value} reason_code={m.reason_code.value}")
        print(f"  primary_capability_id={m.primary_capability_id}")
        print(f"  source_hypothesis_evidence_ids={m.source_hypothesis_evidence_ids}")
        print(f"  source_verification_evidence_ids={m.source_verification_evidence_ids}")

    _print_header("AGGREGATE SUMMARY")
    summary = opportunity_matcher.summarize_matches(matches)
    print(f"total_evaluated: {summary['total_evaluated']}")
    print(f"match_status_counts: {summary['match_status_counts']}")
    print(
        f"verification_coverage: {summary['verification_coverage']}/{summary['total_evaluated']}"
    )
    print(f"reason_code_counts: {summary['reason_code_counts']}")
    print(f"opportunity_id_counts: {summary['opportunity_id_counts']}")
    print(f"primary_capability_counts_matched: {summary['primary_capability_counts_matched']}")

    assert (
        summary["match_status_counts"]["MATCHED"]
        + summary["match_status_counts"]["NOT_MATCHED"]
        + summary["match_status_counts"]["UNRESOLVED"]
        == summary["total_evaluated"]
    )

    _print_header("REPRESENTATIVE RECORDS")
    by_status = collections.defaultdict(list)
    for m in matches:
        by_status[m.match_status.value].append(m)
    for status in ("MATCHED", "NOT_MATCHED", "UNRESOLVED"):
        examples = by_status.get(status, [])
        print(f"\n{status}:")
        if not examples:
            print("  NONE")
            continue
        m = examples[0]
        print(f"  hypothesis_id={m.hypothesis_id} business_id={m.business_id}")
        print(f"  opportunity_id={m.opportunity_id} original_status={m.original_status.value}")
        print(
            f"  verification_execution_status="
            f"{m.verification_execution_status.value if m.verification_execution_status else None} "
            f"verification_outcome={m.verification_outcome.value if m.verification_outcome else None}"
        )
        print(f"  reason_code={m.reason_code.value}")
        print(f"  primary_capability_id={m.primary_capability_id}")
        print(f"  source_hypothesis_evidence_ids={m.source_hypothesis_evidence_ids}")
        print(f"  source_verification_evidence_ids={m.source_verification_evidence_ids}")

    _print_header("FIRESTORE READ-BACK PROOF")
    persisted = firestore_store.list_matches_for_run(RUN_ID)
    print(f"opportunity_matches documents readable for run_id={RUN_ID}: {len(persisted)}")
    persisted_match_ids = {d["match_id"] for d in persisted}
    hypothesis_ids = {h.hypothesis_id for h in hypotheses}
    print(f"match_id == hypothesis_id for all records: {persisted_match_ids == hypothesis_ids}")
    print(f"duplicate matches: {len(persisted) - len(persisted_match_ids)}")

    _print_header("IMMUTABILITY PROOF (re-read original collections, compare to pre-run snapshot)")
    post_hypothesis_dicts = {
        d["hypothesis_id"]: d for d in firestore_store.list_hypotheses_for_run(RUN_ID)
    }
    post_verification_dicts = {
        d["verification_id"]: d for d in firestore_store.list_verifications_for_run(RUN_ID)
    }
    hypotheses_unchanged = pre_hypothesis_dicts == post_hypothesis_dicts
    verifications_unchanged = pre_verification_dicts == post_verification_dicts
    print(f"OpportunityHypotheses unchanged: {hypotheses_unchanged}")
    print(f"Verifications unchanged: {verifications_unchanged}")
    assert hypotheses_unchanged, "Matcher must never mutate OpportunityHypothesis documents"
    assert verifications_unchanged, "Matcher must never mutate Verification documents"


if __name__ == "__main__":
    main()
