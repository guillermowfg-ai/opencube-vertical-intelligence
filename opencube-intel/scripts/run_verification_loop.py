"""Verification Loop V1 — real-execution proof.

Loads hypotheses from the existing accepted Market Scout run, applies the
deterministic selection policy (all CONFIRMED + a bounded, content-blind
sample of CONTRADICTED and INSUFFICIENT_EVIDENCE), and runs the real
independent Verification Loop against them. Does NOT rerun Market Scout,
does NOT touch the original Business/Investigation/Evidence/Hypothesis
documents -- only adds new `verifications`, verification-phase `evidence`,
and verification-phase `usage_metadata` documents.

Run with:
    uv run python scripts/run_verification_loop.py
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from app.investigator import (  # noqa: E402
    firestore_store,
    verification_batch_runner,
    verification_selection,
)
from app.investigator.catalog import MED_SPA_CATALOG  # noqa: E402
from app.investigator.models import Business, OpportunityHypothesis  # noqa: E402

RUN_ID = "1c9959cb-2aba-4cf6-ba9d-94848d7a3b01"


def _print_header(title: str) -> None:
    print("\n" + "=" * 88)
    print(title)
    print("=" * 88)


def main() -> None:
    _print_header("VERIFICATION LOOP V1 — LOADING EXISTING ACCEPTED RUN (read-only)")
    hypothesis_dicts = firestore_store.list_hypotheses_for_run(RUN_ID)
    hypotheses = [OpportunityHypothesis(**d) for d in hypothesis_dicts]
    print(f"run_id: {RUN_ID}")
    print(f"total hypotheses loaded: {len(hypotheses)}")
    by_status: dict[str, int] = {}
    for h in hypotheses:
        by_status[h.status.value] = by_status.get(h.status.value, 0) + 1
    print(f"by original status: {by_status}")

    _print_header("DETERMINISTIC SELECTION (all CONFIRMED + bounded sample)")
    selected = verification_selection.select_hypotheses_for_verification(hypotheses)
    print(f"scheduled for verification: {len(selected)}")
    for h in selected:
        print(f"  - hypothesis_id={h.hypothesis_id} opportunity_id={h.opportunity_id} original_status={h.status.value}")

    business_ids = {h.business_id for h in selected}
    businesses_by_id: dict[str, Business] = {}
    for business_id in business_ids:
        doc = firestore_store.get_business(business_id)
        if doc is not None:
            businesses_by_id[business_id] = Business(**doc)
    definitions_by_id = {d.opportunity_id: d for d in MED_SPA_CATALOG}

    _print_header("RUNNING VERIFICATION LOOP (real Gemini + real independent fetches)")
    batch = verification_batch_runner.run_verification_batch(
        RUN_ID, businesses_by_id, definitions_by_id, selected, persist=True
    )

    _print_header("PER-VERIFICATION RESULTS")
    for attempt in batch.attempts:
        h = attempt.hypothesis
        print(f"\nhypothesis_id={h.hypothesis_id} opportunity_id={h.opportunity_id} original_status={h.status.value}")
        if attempt.error is not None:
            print(f"  UNANTICIPATED ERROR: {attempt.error}")
            continue
        v = attempt.verification
        print(f"  verification_id={v.verification_id}")
        print(f"  execution_status={v.execution_status.value}")
        print(f"  no_independent_source_found={v.no_independent_source_found}")
        print(f"  independent_sources_fetched={v.independent_sources_fetched}")
        print(f"  outcome={v.outcome.value if v.outcome else None}")
        print(f"  confidence={v.confidence}")
        print(f"  failure_reason={v.failure_reason}")
        print(f"  requested_search_query={v.requested_search_query!r}")
        print(f"  executed_search_queries={v.executed_search_queries}")
        print(f"  candidate_source_urls={v.candidate_source_urls}")
        print(f"  rejected_sources={[(r.url, r.reason) for r in v.rejected_sources]}")
        print(f"  independent_evidence_ids={v.independent_evidence_ids}")

    _print_header("AGGREGATE SUMMARY + AGREEMENT MATRIX")
    summary = verification_batch_runner.summarize_verification_batch(batch)
    print(f"scheduled: {summary['scheduled']}")
    print(f"completed: {summary['completed']}")
    print(f"failed: {summary['failed']}")
    print(f"no_independent_source: {summary['no_independent_source']}")
    print(f"outcome_counts: {summary['outcome_counts']}")
    print("agreement_matrix:")
    for original_status, columns in summary["agreement_matrix"].items():
        print(f"  {original_status}: {columns}")

    _print_header("FIRESTORE READ-BACK PROOF")
    verifications = firestore_store.list_verifications_for_run(RUN_ID)
    print(f"verifications documents readable for run_id={RUN_ID}: {len(verifications)}")


if __name__ == "__main__":
    main()
