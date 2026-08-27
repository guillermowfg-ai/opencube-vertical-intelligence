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
    OpportunityMatch,
    Run,
    UsageMetadata,
    Verification,
    as_firestore_dict,
)

RUNS = "runs"
BUSINESSES = "businesses"
INVESTIGATIONS = "investigations"
EVIDENCE = "evidence"
HYPOTHESES = "hypotheses"
USAGE = "usage_metadata"
VERIFICATIONS = "verifications"
OPPORTUNITY_MATCHES = "opportunity_matches"


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


def get_evidence(evidence_id: str) -> dict | None:
    doc = get_client().collection(EVIDENCE).document(evidence_id).get()
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


def save_verification(verification: Verification) -> None:
    get_client().collection(VERIFICATIONS).document(verification.verification_id).set(
        as_firestore_dict(verification)
    )


def list_verifications_for_run(run_id: str) -> list[dict]:
    query = get_client().collection(VERIFICATIONS).where("run_id", "==", run_id)
    return [d.to_dict() for d in query.stream()]


def list_verifications_for_hypothesis(hypothesis_id: str) -> list[dict]:
    query = get_client().collection(VERIFICATIONS).where("hypothesis_id", "==", hypothesis_id)
    return [d.to_dict() for d in query.stream()]


def save_opportunity_match(match: OpportunityMatch) -> None:
    get_client().collection(OPPORTUNITY_MATCHES).document(match.match_id).set(
        as_firestore_dict(match)
    )


def list_matches_for_run(run_id: str) -> list[dict]:
    query = get_client().collection(OPPORTUNITY_MATCHES).where("run_id", "==", run_id)
    return [d.to_dict() for d in query.stream()]


# ---------------------------------------------------------------------------
# Read-only helpers added for the frontend (Frontend V1).
#
# Strictly additive: no new collection, no new document shape, no write path.
# Everything here is a thin query over the same flat collections the accepted
# milestones already write, kept in this module so the API layer never touches
# the Firestore client directly.
# ---------------------------------------------------------------------------


def _list_all(collection: str, limit: int | None = None) -> list[dict]:
    query = get_client().collection(collection)
    if limit is not None:
        query = query.limit(limit)
    return [d.to_dict() for d in query.stream()]


def list_runs(limit: int | None = None) -> list[dict]:
    """Every Run document. Deliberately unordered here — `created_at` is an
    ISO-8601 string written by the application, so ordering is done in the
    API layer rather than requiring a Firestore index."""
    return _list_all(RUNS, limit)


def list_all_businesses(limit: int | None = None) -> list[dict]:
    return _list_all(BUSINESSES, limit)


def list_all_investigations(limit: int | None = None) -> list[dict]:
    return _list_all(INVESTIGATIONS, limit)


def list_all_hypotheses(limit: int | None = None) -> list[dict]:
    return _list_all(HYPOTHESES, limit)


def list_all_verifications(limit: int | None = None) -> list[dict]:
    return _list_all(VERIFICATIONS, limit)


def list_all_matches(limit: int | None = None) -> list[dict]:
    return _list_all(OPPORTUNITY_MATCHES, limit)


def get_hypothesis(hypothesis_id: str) -> dict | None:
    doc = get_client().collection(HYPOTHESES).document(hypothesis_id).get()
    return doc.to_dict() if doc.exists else None


def get_verification(verification_id: str) -> dict | None:
    doc = get_client().collection(VERIFICATIONS).document(verification_id).get()
    return doc.to_dict() if doc.exists else None


def get_match(match_id: str) -> dict | None:
    doc = get_client().collection(OPPORTUNITY_MATCHES).document(match_id).get()
    return doc.to_dict() if doc.exists else None
