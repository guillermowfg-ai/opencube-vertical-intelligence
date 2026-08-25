"""Firestore persistence — flat top-level collections (DECISIONS.md #1).

No subcollections: `Investigation` carries run_id + business_id; `Evidence`
and `OpportunityHypothesis` carry run_id + business_id + investigation_id;
`Business` carries none of them. This keeps `WHERE run_id == X` queries
cheap for the Day 27 async worker and the Day 28 frontend.

One thin module — no repository abstraction, no emulator harness, no DI.
"""

from __future__ import annotations

import functools

from google.cloud import firestore

from app.investigator.models import (
    Business,
    Evidence,
    Investigation,
    OpportunityHypothesis,
    Run,
    UsageMetadata,
    as_firestore_dict,
)

RUNS = "runs"
BUSINESSES = "businesses"
INVESTIGATIONS = "investigations"
EVIDENCE = "evidence"
HYPOTHESES = "hypotheses"
USAGE = "usage_metadata"


@functools.cache
def get_client() -> firestore.Client:
    return firestore.Client()


def save_run(run: Run) -> None:
    get_client().collection(RUNS).document(run.run_id).set(as_firestore_dict(run))


def save_business(business: Business) -> None:
    get_client().collection(BUSINESSES).document(business.business_id).set(
        as_firestore_dict(business)
    )


def save_investigation(investigation: Investigation) -> None:
    get_client().collection(INVESTIGATIONS).document(investigation.investigation_id).set(
        as_firestore_dict(investigation)
    )


def save_evidence(evidence: Evidence) -> None:
    get_client().collection(EVIDENCE).document(evidence.evidence_id).set(
        as_firestore_dict(evidence)
    )


def save_hypothesis(hypothesis: OpportunityHypothesis) -> None:
    get_client().collection(HYPOTHESES).document(hypothesis.hypothesis_id).set(
        as_firestore_dict(hypothesis)
    )


def save_usage_metadata(usage: UsageMetadata, doc_id: str) -> None:
    get_client().collection(USAGE).document(doc_id).set(as_firestore_dict(usage))


def get_run(run_id: str) -> dict | None:
    doc = get_client().collection(RUNS).document(run_id).get()
    return doc.to_dict() if doc.exists else None


def get_business(business_id: str) -> dict | None:
    doc = get_client().collection(BUSINESSES).document(business_id).get()
    return doc.to_dict() if doc.exists else None


def get_investigation(investigation_id: str) -> dict | None:
    doc = get_client().collection(INVESTIGATIONS).document(investigation_id).get()
    return doc.to_dict() if doc.exists else None


def list_businesses_for_run(run_id: str) -> list[dict]:
    """Businesses in this run's scan, derived via its Investigation records
    (Business itself intentionally carries no run_id — DECISIONS.md)."""
    investigations = list_investigations_for_run(run_id)
    businesses = []
    for inv in investigations:
        business = get_business(inv["business_id"])
        if business is not None:
            businesses.append(business)
    return businesses


def list_investigations_for_run(run_id: str) -> list[dict]:
    query = get_client().collection(INVESTIGATIONS).where("run_id", "==", run_id)
    return [d.to_dict() for d in query.stream()]


def list_evidence_for_run(run_id: str) -> list[dict]:
    query = get_client().collection(EVIDENCE).where("run_id", "==", run_id)
    return [d.to_dict() for d in query.stream()]


def list_hypotheses_for_run(run_id: str) -> list[dict]:
    query = get_client().collection(HYPOTHESES).where("run_id", "==", run_id)
    return [d.to_dict() for d in query.stream()]


def list_evidence_for_investigation(investigation_id: str) -> list[dict]:
    query = get_client().collection(EVIDENCE).where(
        "investigation_id", "==", investigation_id
    )
    return [d.to_dict() for d in query.stream()]


def list_hypotheses_for_investigation(investigation_id: str) -> list[dict]:
    query = get_client().collection(HYPOTHESES).where(
        "investigation_id", "==", investigation_id
    )
    return [d.to_dict() for d in query.stream()]


def list_usage_for_investigation(investigation_id: str) -> list[dict]:
    query = get_client().collection(USAGE).where(
        "investigation_id", "==", investigation_id
    )
    return [d.to_dict() for d in query.stream()]


def list_usage_for_run(run_id: str) -> list[dict]:
    """Aggregate usage lookup by run_id (avoids the N+1 join through
    Investigation that investigation_id-only usage documents required)."""
    query = get_client().collection(USAGE).where("run_id", "==", run_id)
    return [d.to_dict() for d in query.stream()]
