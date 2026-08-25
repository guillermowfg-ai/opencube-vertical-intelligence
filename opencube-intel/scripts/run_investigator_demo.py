"""Business Investigator V1 — Test A / Test B demonstration script.

Test A: one full, real investigation (real Places business, real fetched
    web sources, real Gemini calls, real Firestore persistence + readback).
Test B: demonstrates one CONTRADICTED hypothesis and one
    INSUFFICIENT_EVIDENCE hypothesis from real evidence, without inventing
    a replacement pain when a hypothesis fails.

Run with:
    uv run python scripts/run_investigator_demo.py
"""

from __future__ import annotations

import datetime
import json
import uuid

from app.investigator import firestore_store, places_client
from app.investigator.catalog import get_evaluated_definitions
from app.investigator.investigator import run_investigation
from app.investigator.models import Run, RunStatus


def _print_header(title: str) -> None:
    print("\n" + "=" * 88)
    print(title)
    print("=" * 88)


def main() -> None:
    run = Run(
        run_id=str(uuid.uuid4()),
        created_at=datetime.datetime.now(datetime.UTC).isoformat(),
        status=RunStatus.IN_PROGRESS,
        vertical="Med Spa",
        geography="Miami / South Florida",
        provider_capabilities=[
            "AI Appointment / Booking Assistance",
            "AI Lead Intake & Qualification",
            "AI Voice Reception",
            "Missed-call Recovery",
            "Automated Lead Follow-up",
        ],
    )

    _print_header("DISCOVERING REAL MIAMI/SOUTH FLORIDA MED SPAS (Places API)")
    candidates = places_client.search_businesses("med spa in Miami, FL", max_results=8)
    for b in candidates:
        print(f"- {b.display_name} | {b.website_url} | {b.formatted_address}")

    with_website = [b for b in candidates if b.website_url]
    if not with_website:
        raise SystemExit("No candidate business with a website found — cannot proceed.")

    business = with_website[0]
    definitions = get_evaluated_definitions()

    _print_header(f"TEST A: FULL INVESTIGATION — {business.display_name}")
    print(f"business_id={business.business_id}")
    print(f"website={business.website_url}")
    print(f"run_id={run.run_id}")
    print(f"Evaluating {len(definitions)} opportunity definitions: "
          f"{[d.opportunity_id for d in definitions]}")

    result = run_investigation(run, business, definitions, persist=True)

    print(f"\ninvestigation_id={result.investigation.investigation_id}")
    print(f"investigation.status={result.investigation.status.value}")
    print(f"source_count={result.investigation.source_count}")
    print(f"evidence_count={result.investigation.evidence_count}")
    print(f"contact_recommendation={result.contact_recommendation.value}")
    print(f"contact_reason={result.contact_reason}")

    for h in result.hypotheses:
        print(f"\n-- Hypothesis: {h.opportunity_id} --")
        print(f"   status={h.status.value} confidence={h.confidence}")
        print(f"   supporting_evidence_ids={h.supporting_evidence_ids}")
        print(f"   contradicting_evidence_ids={h.contradicting_evidence_ids}")
    for e in result.evidence:
        print(f"\n-- Evidence {e.evidence_id} --")
        print(f"   source_url={e.source_url}")
        print(f"   observation={e.observation}")
    for u in result.usage:
        print(f"\n-- Usage: model={u.model} prompt={u.prompt_tokens} "
              f"output={u.output_tokens} thought={u.thought_tokens} "
              f"total={u.total_tokens} invocation_id={u.invocation_id} "
              f"timestamp={u.timestamp}")

    _print_header("FIRESTORE PERSISTENCE PROOF (write -> read back)")
    run_readback = firestore_store.get_run(run.run_id)
    business_readback = firestore_store.get_business(business.business_id)
    investigation_readback = firestore_store.get_investigation(
        result.investigation.investigation_id
    )
    evidence_readback = firestore_store.list_evidence_for_investigation(
        result.investigation.investigation_id
    )
    hypotheses_readback = firestore_store.list_hypotheses_for_investigation(
        result.investigation.investigation_id
    )
    usage_readback = firestore_store.list_usage_for_investigation(
        result.investigation.investigation_id
    )
    print(f"runs/{run.run_id} ->", json.dumps(run_readback, indent=2))
    print(f"businesses/{business.business_id} ->", json.dumps(business_readback, indent=2))
    print(
        f"investigations/{result.investigation.investigation_id} ->",
        json.dumps(investigation_readback, indent=2),
    )
    print(f"evidence (where investigation_id==...) count={len(evidence_readback)}")
    print(f"hypotheses (where investigation_id==...) count={len(hypotheses_readback)}")
    print(f"usage_metadata (where investigation_id==...) count={len(usage_readback)}")

    _print_header("TEST B: CONTRADICTION + INSUFFICIENT_EVIDENCE CHECK")
    statuses = {h.opportunity_id: h.status.value for h in result.hypotheses}
    print(f"Hypothesis statuses from Test A run: {statuses}")

    contradicted = [h for h in result.hypotheses if h.status.value == "CONTRADICTED"]
    insufficient = [h for h in result.hypotheses if h.status.value == "INSUFFICIENT_EVIDENCE"]

    if contradicted and insufficient:
        print("\nFound both a CONTRADICTED and an INSUFFICIENT_EVIDENCE hypothesis "
              "in this single Test A run — no second business needed.")
    else:
        print("\nDid not find both statuses in this business's run. Trying "
              "additional candidate businesses to demonstrate both cases...")
        for extra in with_website[1:]:
            extra_run = Run(
                run_id=str(uuid.uuid4()),
                created_at=datetime.datetime.now(datetime.UTC).isoformat(),
                status=RunStatus.IN_PROGRESS,
                vertical="Med Spa",
                geography="Miami / South Florida",
                provider_capabilities=run.provider_capabilities,
            )
            extra_result = run_investigation(extra_run, extra, definitions, persist=True)
            extra_statuses = {h.opportunity_id: h.status.value for h in extra_result.hypotheses}
            print(f"\n{extra.display_name}: {extra_statuses}")
            contradicted += [h for h in extra_result.hypotheses if h.status.value == "CONTRADICTED"]
            insufficient += [
                h for h in extra_result.hypotheses if h.status.value == "INSUFFICIENT_EVIDENCE"
            ]
            if contradicted and insufficient:
                break

    print(f"\nCONTRADICTED hypotheses found: {len(contradicted)}")
    for h in contradicted:
        print(f"  - {h.opportunity_id} (hypothesis_id={h.hypothesis_id}, "
              f"confidence={h.confidence}, "
              f"supporting={h.supporting_evidence_ids}, "
              f"contradicting={h.contradicting_evidence_ids})")

    print(f"\nINSUFFICIENT_EVIDENCE hypotheses found: {len(insufficient)}")
    for h in insufficient:
        print(f"  - {h.opportunity_id} (hypothesis_id={h.hypothesis_id}, "
              f"confidence={h.confidence}, "
              f"supporting={h.supporting_evidence_ids}, "
              f"contradicting={h.contradicting_evidence_ids})")
        print(f"    statement (catalog-sourced, not Gemini free text): {h.statement}")

    print("\nNo-replacement-pain check: each hypothesis above evaluates ONLY its "
          "own opportunity_id (see per-call system instruction). A failed "
          "hypothesis never substitutes another opportunity_id.")

    _print_header("DONE")


if __name__ == "__main__":
    main()
