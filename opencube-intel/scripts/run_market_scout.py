"""Market Scout V1 — real-execution proof.

Discovers real Miami-Dade County med spas across the five frozen submarkets,
selects ~10 using outcome-blind criteria only, runs the accepted Business
Investigator once per business via the thin batch runner, persists
everything to Firestore, and prints a Run summary + read-back proof.

Market Scout does business discovery and normalization only — it does not
diagnose pain or commercial opportunity. That responsibility stays entirely
inside the Business Investigator, called unmodified via batch_runner.

Run with:
    uv run python scripts/run_market_scout.py
"""

from __future__ import annotations

import datetime
import json
import uuid

from dotenv import load_dotenv

load_dotenv()

from app.investigator import batch_runner, firestore_store, market_scout  # noqa: E402
from app.investigator.catalog import get_evaluated_definitions  # noqa: E402
from app.investigator.models import Run, RunStatus  # noqa: E402

TARGET_SELECTION_COUNT = 10
PROVIDER_CAPABILITIES = [
    "AI Appointment / Booking Assistance",
    "AI Lead Intake & Qualification",
    "AI Voice Reception",
    "Missed-call Recovery",
    "Automated Lead Follow-up",
]


def _print_header(title: str) -> None:
    print("\n" + "=" * 88)
    print(title)
    print("=" * 88)


def main() -> None:
    _print_header("MARKET SCOUT V1 — DISCOVERY (Places API, 5 frozen Miami-Dade submarkets)")
    discovery = market_scout.discover()
    print(f"Queries issued ({len(discovery.queries)}):")
    for q in discovery.queries:
        print(f"  - {q}")
    print(f"\nRaw candidate count (pre-normalization): {discovery.raw_candidate_count}")
    print(f"Accepted after normalization/dedup: {len(discovery.accepted)}")
    print(f"Rejected: {len(discovery.rejected)}")
    for r in discovery.rejected:
        print(f"  - REJECTED [{r.reason}]: {r.display_name!r} (place_id={r.place_id})")
    print("\nAccepted, by submarket:")
    for submarket, businesses in discovery.by_submarket.items():
        print(f"  {submarket}: {len(businesses)}")
        for b in businesses:
            print(f"    - {b.display_name} | website={b.website_url} | place_id={b.place_id}")

    _print_header("MARKET SCOUT V1 — OUTCOME-BLIND SELECTION")
    selected = market_scout.select_for_investigation(discovery, target_count=TARGET_SELECTION_COUNT)
    print(
        f"Selected {len(selected)} businesses using deterministic, outcome-blind criteria only "
        "(valid Place ID, name present, in-geography, public website present, deduplicated, "
        "distributed across submarkets). No website content was inspected for selection."
    )
    for b in selected:
        print(f"  - {b.display_name} | place_id={b.place_id} | website={b.website_url}")
    if len(selected) < TARGET_SELECTION_COUNT:
        print(
            f"\nNOTE: selected count ({len(selected)}) is below the target "
            f"({TARGET_SELECTION_COUNT}) because only that many outcome-blind-eligible "
            "candidates (public website present, in-geography, deduplicated) were "
            "discovered across the five frozen submarkets. The set is frozen as-is; no "
            "replacement candidates will be added after this point."
        )

    run = Run(
        run_id=str(uuid.uuid4()),
        created_at=datetime.datetime.now(datetime.UTC).isoformat(),
        status=RunStatus.IN_PROGRESS,
        vertical=market_scout.VERTICAL,
        geography=market_scout.GEOGRAPHY,
        provider_capabilities=PROVIDER_CAPABILITIES,
        discovery_queries=discovery.queries,
        discovery_raw_candidate_count=discovery.raw_candidate_count,
    )
    print(f"\nrun_id={run.run_id}")
    print(f"run.status (initial)={run.status.value}")

    definitions = get_evaluated_definitions()
    _print_header(
        f"MARKET SCOUT V1 — BATCH INVESTIGATION ({len(selected)} businesses, "
        f"{len(definitions)} opportunity definitions each)"
    )
    batch = batch_runner.run_batch(run, selected, definitions, persist=True)

    for outcome in batch.outcomes:
        b = outcome.business
        print(f"\n-- {b.display_name} (business_id={b.business_id}) --")
        if not outcome.succeeded:
            print(f"   FAILED: investigation_id={outcome.investigation_id} error={outcome.error}")
            continue
        result = outcome.result
        print(f"   investigation_id={result.investigation.investigation_id}")
        print(f"   investigation.status={result.investigation.status.value}")
        print(f"   contact_recommendation={result.contact_recommendation.value}")
        print(f"   contact_reason={result.contact_reason}")
        for h in result.hypotheses:
            print(f"     hypothesis={h.opportunity_id} status={h.status.value} confidence={h.confidence}")

    _print_header("MARKET SCOUT V1 — RUN LIFECYCLE")
    print(f"run_id={run.run_id}")
    print(f"run.status (final)={run.status.value}")
    print(f"run.investigation_count={run.investigation_count}")
    print(f"run.completed_investigation_count={run.completed_investigation_count}")
    print(f"run.failed_investigation_count={run.failed_investigation_count}")

    _print_header("MARKET SCOUT V1 — AGGREGATE INTELLIGENCE SUMMARY")
    summary = batch_runner.summarize_batch(batch)
    print(json.dumps(summary, indent=2))
    print(
        f"\nDiscovered={discovery.raw_candidate_count} "
        f"Selected={len(selected)} "
        f"Investigated={summary['investigated']} "
        f"Completed={summary['completed']} "
        f"Failed={summary['failed']}"
    )

    _print_header("FIRESTORE PERSISTENCE PROOF (write -> read back)")
    run_readback = firestore_store.get_run(run.run_id)
    print(f"runs/{run.run_id} ->", json.dumps(run_readback, indent=2))

    businesses_readback = firestore_store.list_businesses_for_run(run.run_id)
    print(f"\nbusinesses in scan (via investigations where run_id==...): count={len(businesses_readback)}")
    for b in businesses_readback:
        print(f"  - {b['display_name']} (business_id={b['business_id']})")

    investigations_readback = firestore_store.list_investigations_for_run(run.run_id)
    print(f"\ninvestigations (where run_id==...): count={len(investigations_readback)}")

    evidence_readback = firestore_store.list_evidence_for_run(run.run_id)
    print(f"evidence (where run_id==...): count={len(evidence_readback)}")

    hypotheses_readback = firestore_store.list_hypotheses_for_run(run.run_id)
    print(f"hypotheses (where run_id==...): count={len(hypotheses_readback)}")

    usage_readback = firestore_store.list_usage_for_run(run.run_id)
    total_tokens = sum(u.get("total_tokens") or 0 for u in usage_readback)
    print(f"usage_metadata (where run_id==...): count={len(usage_readback)} total_tokens={total_tokens}")

    _print_header("DONE")


if __name__ == "__main__":
    main()
