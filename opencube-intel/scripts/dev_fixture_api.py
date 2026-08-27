"""Local frontend development server. NOT a product surface.

Serves the real API routers (`app.api.routes`, `app.api.read_routes`) with
`firestore_store` replaced by an in-memory dict, so the frontend can be built
and reviewed without Cloud credentials, a Firestore emulator, or spending a
single Gemini call.

What is fixed and what is real:

  * Persistence is fake — an in-memory dict, not Firestore.
  * The documents are fixtures — they describe businesses that do not exist.
  * Everything else is the product. The routers are the deployed routers,
    the models are the frozen models, and every `OpportunityMatch` below is
    produced by calling `opportunity_matcher.build_match` on the fixture
    hypothesis and verification. Nothing hand-writes a `match_status`, a
    `reason_code` or a capability mapping, so a UI built against this server
    is built against the real reconciliation matrix.

This module is never imported by `app/`, is never deployed (the Dockerfile
copies only `./app`), and must never be used to populate a real environment.

    uv run python scripts/dev_fixture_api.py        # http://127.0.0.1:8000
"""

from __future__ import annotations

import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.investigator import firestore_store, opportunity_matcher
from app.investigator.models import (
    Business,
    Evidence,
    Investigation,
    InvestigationStatus,
    OpportunityHypothesis,
    OpportunityStatus,
    OpportunityType,
    RejectedSourceCandidate,
    Run,
    RunStatus,
    SourceType,
    Verification,
    VerificationExecutionStatus,
    VerificationOutcome,
    as_firestore_dict,
)

BUSINESS_BY_ID: dict[str, tuple[str, str, str | None, str]] = {}

VERTICAL = "Med Spa"
GEOGRAPHY = "Miami-Dade County, Florida"
CAPABILITIES = [
    "AI Appointment / Booking Assistance",
    "AI Lead Intake & Qualification",
    "AI Voice Reception",
    "Missed-call Recovery",
    "Automated Lead Follow-up",
]


# ---------------------------------------------------------------------------
# In-memory stand-in for firestore_store
# ---------------------------------------------------------------------------


class MemoryStore:
    def __init__(self) -> None:
        self.runs: dict[str, dict] = {}
        self.businesses: dict[str, dict] = {}
        self.investigations: dict[str, dict] = {}
        self.evidence: dict[str, dict] = {}
        self.hypotheses: dict[str, dict] = {}
        self.verifications: dict[str, dict] = {}
        self.matches: dict[str, dict] = {}

    def save_run(self, run) -> None:
        self.runs[run.run_id] = as_firestore_dict(run)

    def save_business(self, business) -> None:
        self.businesses[business.business_id] = as_firestore_dict(business)

    def save_investigation(self, investigation) -> None:
        self.investigations[investigation.investigation_id] = as_firestore_dict(investigation)

    def save_evidence(self, evidence) -> None:
        self.evidence[evidence.evidence_id] = as_firestore_dict(evidence)

    def save_hypothesis(self, hypothesis) -> None:
        self.hypotheses[hypothesis.hypothesis_id] = as_firestore_dict(hypothesis)

    def save_verification(self, verification) -> None:
        self.verifications[verification.verification_id] = as_firestore_dict(verification)

    def save_opportunity_match(self, match) -> None:
        self.matches[match.match_id] = as_firestore_dict(match)

    def save_usage_metadata(self, usage, doc_id: str) -> None:
        pass

    def get_run(self, run_id):
        return self.runs.get(run_id)

    def get_business(self, business_id):
        return self.businesses.get(business_id)

    def get_investigation(self, investigation_id):
        return self.investigations.get(investigation_id)

    def get_evidence(self, evidence_id):
        return self.evidence.get(evidence_id)

    def get_hypothesis(self, hypothesis_id):
        return self.hypotheses.get(hypothesis_id)

    def get_verification(self, verification_id):
        return self.verifications.get(verification_id)

    def get_match(self, match_id):
        return self.matches.get(match_id)

    def _by(self, table, key, value):
        return [d for d in table.values() if d.get(key) == value]

    def list_investigations_for_run(self, run_id):
        return self._by(self.investigations, "run_id", run_id)

    def list_evidence_for_run(self, run_id):
        return self._by(self.evidence, "run_id", run_id)

    def list_hypotheses_for_run(self, run_id):
        return self._by(self.hypotheses, "run_id", run_id)

    def list_verifications_for_run(self, run_id):
        return self._by(self.verifications, "run_id", run_id)

    def list_matches_for_run(self, run_id):
        return self._by(self.matches, "run_id", run_id)

    def list_usage_for_run(self, run_id):
        return []

    def list_usage_for_investigation(self, investigation_id):
        return []

    def list_businesses_for_run(self, run_id):
        return [
            self.businesses[i["business_id"]]
            for i in self.list_investigations_for_run(run_id)
            if i["business_id"] in self.businesses
        ]

    def list_evidence_for_investigation(self, investigation_id):
        return self._by(self.evidence, "investigation_id", investigation_id)

    def list_hypotheses_for_investigation(self, investigation_id):
        return self._by(self.hypotheses, "investigation_id", investigation_id)

    def list_verifications_for_hypothesis(self, hypothesis_id):
        return self._by(self.verifications, "hypothesis_id", hypothesis_id)

    def list_runs(self, limit=None):
        return list(self.runs.values())[:limit]

    def list_all_businesses(self, limit=None):
        return list(self.businesses.values())[:limit]

    def list_all_investigations(self, limit=None):
        return list(self.investigations.values())[:limit]

    def list_all_hypotheses(self, limit=None):
        return list(self.hypotheses.values())[:limit]

    def list_all_verifications(self, limit=None):
        return list(self.verifications.values())[:limit]

    def list_all_matches(self, limit=None):
        return list(self.matches.values())[:limit]


STORE = MemoryStore()

for _name in dir(MemoryStore):
    if not _name.startswith("_") and hasattr(firestore_store, _name):
        setattr(firestore_store, _name, getattr(STORE, _name))


# ---------------------------------------------------------------------------
# Fixture corpus
# ---------------------------------------------------------------------------

# Anchored to "three days ago" at import time rather than to a fixed calendar
# date, so the relative timestamps the UI renders ("2 days ago", "18 minutes
# ago") stay sensible however long after writing this the server is started.
BASE = datetime.datetime.now(datetime.UTC).replace(
    minute=0, second=0, microsecond=0
) - datetime.timedelta(days=3)


def ts(minutes: int) -> str:
    return (BASE + datetime.timedelta(minutes=minutes)).isoformat()


BUSINESSES = [
    ("brickell-glow", "Brickell Glow Aesthetics", "1200 Brickell Ave, Miami, FL 33131, USA",
     "https://brickellglow.example.com", "+1 305-555-0111"),
    ("gables-lux", "Gables Luxe Med Spa", "2800 Ponce de Leon Blvd, Coral Gables, FL 33134, USA",
     "https://gableslux.example.com", "+1 305-555-0122"),
    ("collins-radiance", "Collins Radiance Skin Studio", "1601 Collins Ave, Miami Beach, FL 33139, USA",
     "https://collinsradiance.example.com", "+1 305-555-0133"),
    ("aventura-renew", "Aventura Renew Wellness", "19501 Biscayne Blvd, Aventura, FL 33180, USA",
     "https://aventurarenew.example.com", "+1 305-555-0144"),
    ("doral-contour", "Doral Contour Clinic", "8300 NW 53rd St, Doral, FL 33166, USA",
     None, "+1 305-555-0155"),
    ("midtown-vitalis", "Midtown Vitalis Aesthetics", "3401 N Miami Ave, Miami, FL 33127, USA",
     "https://midtownvitalis.example.com", "+1 305-555-0166"),
]

BUSINESS_BY_ID.update({b[0]: (b[1], b[2], b[3], b[4]) for b in BUSINESSES})

# (business_id, opportunity_id, hypothesis status, statement, [supporting obs], [contradicting obs])
HYPOTHESES = [
    ("brickell-glow", "online_booking_friction", OpportunityStatus.CONFIRMED,
     "The site exposes no direct online booking path; every appointment call-to-action resolves to a telephone number.",
     ["The homepage header and footer both present 'Call to book' with a telephone number and no booking link.",
      "The 'Appointments' navigation entry links to a contact form, not to a scheduling platform."],
     []),
    ("brickell-glow", "after_hours_lead_intake", OpportunityStatus.CONFIRMED,
     "Published hours end at 18:00 with no stated after-hours intake channel for inbound enquiries.",
     ["Listed hours are Mon-Fri 10:00-18:00, Sat 10:00-15:00, closed Sunday.",
      "The contact page states 'We respond to messages during business hours.'"],
     []),
    ("brickell-glow", "lead_follow_up_effectiveness", OpportunityStatus.INSUFFICIENT_EVIDENCE,
     "No publicly observable signal establishes how inbound enquiries are followed up.",
     [], []),
    ("gables-lux", "online_booking_friction", OpportunityStatus.CONTRADICTED,
     "A functioning direct booking path is present and reachable from the homepage.",
     [],
     ["A prominent 'Book Now' button in the site header links to a third-party scheduling platform.",
      "The scheduling platform loads a live availability calendar without requiring a phone call."]),
    ("gables-lux", "after_hours_lead_intake", OpportunityStatus.CONFIRMED,
     "Published hours end at 19:00 and the site names no after-hours intake channel.",
     ["Listed hours are Mon-Sat 09:00-19:00.",
      "No chat widget, callback form or after-hours number appears on any public page."],
     []),
    ("gables-lux", "lead_follow_up_effectiveness", OpportunityStatus.INSUFFICIENT_EVIDENCE,
     "Follow-up handling after an enquiry is not publicly observable.",
     [], []),
    ("collins-radiance", "online_booking_friction", OpportunityStatus.CONFIRMED,
     "The booking path requires an observable handoff: the 'Book' link opens an email client rather than a scheduler.",
     ["The 'Book' call-to-action is a mailto: link addressed to the front desk.",
      "No scheduling platform is referenced anywhere in the page source or navigation."],
     []),
    ("collins-radiance", "after_hours_lead_intake", OpportunityStatus.INSUFFICIENT_EVIDENCE,
     "Operating hours are not published, so after-hours coverage cannot be established.",
     [], []),
    ("collins-radiance", "lead_follow_up_effectiveness", OpportunityStatus.CONFIRMED,
     "The site's only enquiry channel is a form that states a 48-72 hour response window.",
     ["The contact form states 'We aim to reply within 48-72 hours.'"],
     []),
    ("aventura-renew", "online_booking_friction", OpportunityStatus.CONFIRMED,
     "Appointments require a telephone call; the site presents no booking interface.",
     ["Every service page ends with 'Call us to schedule your consultation.'",
      "The Places listing exposes no booking action."],
     []),
    ("aventura-renew", "after_hours_lead_intake", OpportunityStatus.CONTRADICTED,
     "An after-hours intake channel is present and explicitly advertised.",
     [],
     ["The site footer advertises a 24/7 answering line for new patient enquiries."]),
    ("aventura-renew", "lead_follow_up_effectiveness", OpportunityStatus.INSUFFICIENT_EVIDENCE,
     "No public signal describes follow-up after an initial enquiry.",
     [], []),
    ("doral-contour", "online_booking_friction", OpportunityStatus.CONFIRMED,
     "The business has no reachable website; the only booking route observable is the listed telephone number.",
     ["The Places record lists a telephone number and no website.",
      "No booking action is exposed on the Places listing."],
     []),
    ("doral-contour", "after_hours_lead_intake", OpportunityStatus.INSUFFICIENT_EVIDENCE,
     "With no website, after-hours intake coverage is not publicly observable.",
     [], []),
    ("doral-contour", "lead_follow_up_effectiveness", OpportunityStatus.INSUFFICIENT_EVIDENCE,
     "Follow-up handling is not publicly observable for this business.",
     [], []),
    ("midtown-vitalis", "online_booking_friction", OpportunityStatus.CONFIRMED,
     "The booking link is present but broken, leaving the telephone number as the only working path.",
     ["The 'Schedule' navigation link returns a 404 page.",
      "The homepage banner directs visitors to call the clinic instead."],
     []),
    ("midtown-vitalis", "after_hours_lead_intake", OpportunityStatus.CONFIRMED,
     "Published hours end at 17:00 with no after-hours channel named.",
     ["Listed hours are Tue-Sat 11:00-17:00."],
     []),
    ("midtown-vitalis", "lead_follow_up_effectiveness", OpportunityStatus.CONTRADICTED,
     "An automated follow-up sequence is publicly described on the site.",
     [],
     ["The 'New Patients' page describes an automated three-message follow-up sequence after enquiry."]),
]

# hypothesis key -> (execution_status, outcome, no_independent_source, independent observations)
VERIFICATIONS = {
    ("brickell-glow", "online_booking_friction"): (
        VerificationExecutionStatus.COMPLETED, VerificationOutcome.SUPPORTS, False,
        ["An independent Miami aesthetics directory lists the clinic as 'phone booking only'."],
    ),
    ("brickell-glow", "after_hours_lead_intake"): (
        VerificationExecutionStatus.COMPLETED, None, True, [],
    ),
    ("gables-lux", "online_booking_friction"): (
        VerificationExecutionStatus.COMPLETED, VerificationOutcome.SUPPORTS, False,
        ["A regional beauty guide lists the clinic with an online booking link to the same scheduling platform."],
    ),
    ("gables-lux", "after_hours_lead_intake"): (
        VerificationExecutionStatus.COMPLETED, VerificationOutcome.INSUFFICIENT_EVIDENCE, False,
        ["A local business directory records opening hours but says nothing about after-hours contact."],
    ),
    ("collins-radiance", "online_booking_friction"): (
        VerificationExecutionStatus.COMPLETED, VerificationOutcome.CONTRADICTS, False,
        ["A third-party spa marketplace shows a live bookable calendar for this clinic."],
    ),
    ("collins-radiance", "lead_follow_up_effectiveness"): (
        VerificationExecutionStatus.FAILED, None, False, [],
    ),
    ("aventura-renew", "online_booking_friction"): (
        VerificationExecutionStatus.COMPLETED, VerificationOutcome.SUPPORTS, False,
        ["A neighbourhood directory entry lists a telephone number as the sole appointment route."],
    ),
    ("midtown-vitalis", "online_booking_friction"): (
        VerificationExecutionStatus.COMPLETED, None, True, [],
    ),
    ("midtown-vitalis", "after_hours_lead_intake"): (
        VerificationExecutionStatus.COMPLETED, VerificationOutcome.SUPPORTS, False,
        ["An independent listing records the same closing time and names no after-hours line."],
    ),
}

VERIFICATION_TARGETS = {
    "online_booking_friction": "Whether a direct, functioning online booking path exists for this business.",
    "after_hours_lead_intake": "Whether an after-hours or immediate lead intake channel exists for this business.",
    "lead_follow_up_effectiveness": "Whether an observable follow-up process exists after an inbound enquiry.",
}

OPPORTUNITY_TYPES = {
    "online_booking_friction": OpportunityType.CAPABILITY_GAP,
    "after_hours_lead_intake": OpportunityType.PAIN,
    "lead_follow_up_effectiveness": OpportunityType.PAIN,
}

CONFIDENCE = {
    OpportunityStatus.CONFIRMED: 0.86,
    OpportunityStatus.CONTRADICTED: 0.81,
    OpportunityStatus.INSUFFICIENT_EVIDENCE: 0.34,
    OpportunityStatus.UNVERIFIED: 0.5,
}


def _seed_completed_run() -> None:
    run_id = "run-2026-08-24-medspa-miami"
    run = Run(
        run_id=run_id,
        created_at=ts(0),
        started_at=ts(0),
        completed_at=ts(74),
        status=RunStatus.COMPLETED,
        vertical=VERTICAL,
        geography=GEOGRAPHY,
        provider_capabilities=CAPABILITIES,
        discovery_queries=[
            "med spa in Brickell, Miami, FL",
            "med spa in Coral Gables, FL",
            "med spa in Miami Beach, FL",
            "med spa in Aventura, FL",
            "med spa in Doral, FL",
        ],
        discovery_raw_candidate_count=41,
        businesses_total=len(BUSINESSES),
        investigation_count=len(BUSINESSES),
        completed_investigation_count=len(BUSINESSES),
        failed_investigation_count=0,
        finalize_enqueued_at=ts(52),
    )
    STORE.save_run(run)

    evidence_seq = 0
    for bid, name, address, website, phone in BUSINESSES:
        STORE.save_business(
            Business(
                business_id=bid,
                display_name=name,
                formatted_address=address,
                website_url=website,
                place_id=f"places/{bid}",
                phone_number=phone,
                maps_url=f"https://maps.google.com/?cid={bid}",
            )
        )

    for bid, opportunity_id, status_, statement, supporting, contradicting in HYPOTHESES:
        investigation_id = f"{run_id}__{bid}"
        supporting_ids: list[str] = []
        contradicting_ids: list[str] = []
        website = BUSINESS_BY_ID[bid][2]

        for observation, bucket in (
            *[(o, supporting_ids) for o in supporting],
            *[(o, contradicting_ids) for o in contradicting],
        ):
            evidence_seq += 1
            evidence_id = f"ev-{evidence_seq:03d}"
            STORE.save_evidence(
                Evidence(
                    evidence_id=evidence_id,
                    run_id=run_id,
                    business_id=bid,
                    investigation_id=investigation_id,
                    source_url=website or f"https://maps.google.com/?cid={bid}",
                    source_type=SourceType.WEBSITE if website else SourceType.PLACES,
                    observation=observation,
                    retrieved_at=ts(12),
                    collected_by="business_investigator",
                )
            )
            bucket.append(evidence_id)

        hypothesis = OpportunityHypothesis(
            hypothesis_id=f"hyp-{bid}-{opportunity_id}",
            run_id=run_id,
            business_id=bid,
            investigation_id=investigation_id,
            opportunity_id=opportunity_id,
            opportunity_type=OPPORTUNITY_TYPES[opportunity_id],
            statement=statement,
            supporting_evidence_ids=supporting_ids,
            contradicting_evidence_ids=contradicting_ids,
            confidence=CONFIDENCE[status_],
            status=status_,
        )
        STORE.save_hypothesis(hypothesis)

        verification = None
        spec = VERIFICATIONS.get((bid, opportunity_id))
        if spec is not None:
            execution_status, outcome, no_source, observations = spec
            independent_ids = []
            for observation in observations:
                evidence_seq += 1
                evidence_id = f"ev-{evidence_seq:03d}"
                STORE.save_evidence(
                    Evidence(
                        evidence_id=evidence_id,
                        run_id=run_id,
                        business_id=bid,
                        investigation_id=investigation_id,
                        source_url=f"https://directory.example.org/{bid}-{opportunity_id}",
                        source_type=SourceType.WEBSITE,
                        observation=observation,
                        retrieved_at=ts(40),
                        collected_by="verification_loop",
                    )
                )
                independent_ids.append(evidence_id)

            verification = Verification(
                verification_id=f"ver-{bid}-{opportunity_id}",
                run_id=run_id,
                business_id=bid,
                investigation_id=investigation_id,
                hypothesis_id=hypothesis.hypothesis_id,
                opportunity_id=opportunity_id,
                original_status=status_,
                verification_target=VERIFICATION_TARGETS[opportunity_id],
                execution_status=execution_status,
                outcome=outcome,
                independent_evidence_ids=independent_ids,
                requested_search_query=f"{BUSINESS_BY_ID[bid][0]} appointment booking",
                executed_search_queries=[
                    f"{BUSINESS_BY_ID[bid][0]} appointment booking",
                    f"{BUSINESS_BY_ID[bid][0]} hours contact",
                ],
                candidate_source_urls=[
                    f"https://directory.example.org/{bid}-{opportunity_id}",
                    BUSINESS_BY_ID[bid][2] or "https://example.com",
                    "https://socialnetwork.example.com/" + bid,
                ],
                rejected_sources=[
                    RejectedSourceCandidate(
                        url=BUSINESS_BY_ID[bid][2] or "https://example.com",
                        reason="Not independent: the business's own domain.",
                    ),
                    RejectedSourceCandidate(
                        url="https://socialnetwork.example.com/" + bid,
                        reason="Not independent: business-controlled profile.",
                    ),
                ],
                independent_sources_fetched=len(independent_ids),
                no_independent_source_found=no_source,
                reasoning=(
                    None
                    if execution_status == VerificationExecutionStatus.FAILED
                    else "Independent source material was assessed against the original hypothesis."
                ),
                confidence=(
                    None if execution_status == VerificationExecutionStatus.FAILED else 0.72
                ),
                created_at=ts(38),
                completed_at=ts(44),
                failure_reason=(
                    "Source fetch exceeded the per-source timeout."
                    if execution_status == VerificationExecutionStatus.FAILED
                    else None
                ),
            )
            STORE.save_verification(verification)

        # The real matcher decides. Nothing here hand-writes a match_status.
        STORE.save_opportunity_match(
            opportunity_matcher.build_match(hypothesis, verification)
        )

    for index, (bid, *_rest) in enumerate(BUSINESSES):
        investigation_id = f"{run_id}__{bid}"
        STORE.save_investigation(
            Investigation(
                investigation_id=investigation_id,
                run_id=run_id,
                business_id=bid,
                created_at=ts(4 + index * 3),
                completed_at=ts(10 + index * 6),
                status=InvestigationStatus.COMPLETED,
                source_count=2 if bid != "doral-contour" else 1,
                evidence_count=len(STORE.list_evidence_for_investigation(investigation_id)),
            )
        )


def _seed_in_flight_run() -> None:
    run_id = "run-2026-08-27-medspa-miami"
    STORE.save_run(
        Run(
            run_id=run_id,
            created_at=ts(3 * 24 * 60 - 35),
            started_at=ts(3 * 24 * 60 - 35),
            status=RunStatus.INVESTIGATING,
            vertical=VERTICAL,
            geography=GEOGRAPHY,
            provider_capabilities=CAPABILITIES,
            discovery_queries=["med spa in Brickell, Miami, FL", "med spa in Doral, FL"],
            discovery_raw_candidate_count=33,
            businesses_total=4,
        )
    )
    statuses = [
        InvestigationStatus.COMPLETED,
        InvestigationStatus.COMPLETED,
        InvestigationStatus.IN_PROGRESS,
        InvestigationStatus.IN_PROGRESS,
    ]
    for (bid, *_rest), status_ in zip(BUSINESSES[:4], statuses, strict=True):
        STORE.save_investigation(
            Investigation(
                investigation_id=f"{run_id}__{bid}",
                run_id=run_id,
                business_id=bid,
                created_at=ts(3 * 24 * 60 - 33),
                completed_at=(
                    ts(3 * 24 * 60 - 24)
                    if status_ is InvestigationStatus.COMPLETED
                    else None
                ),
                status=status_,
                source_count=2 if status_ is InvestigationStatus.COMPLETED else 0,
                evidence_count=3 if status_ is InvestigationStatus.COMPLETED else 0,
            )
        )


def _seed_failed_run() -> None:
    run_id = "run-2026-08-20-medspa-miami"
    STORE.save_run(
        Run(
            run_id=run_id,
            created_at=ts(-5760),
            started_at=ts(-5760),
            completed_at=ts(-5700),
            status=RunStatus.FAILED,
            vertical=VERTICAL,
            geography=GEOGRAPHY,
            provider_capabilities=CAPABILITIES,
            businesses_total=2,
            investigation_count=2,
            completed_investigation_count=1,
            failed_investigation_count=1,
            failure_message="1 of 2 investigations failed during source retrieval.",
        )
    )
    for (bid, *_rest), status_ in zip(
        BUSINESSES[4:6],
        [InvestigationStatus.COMPLETED, InvestigationStatus.FAILED],
        strict=True,
    ):
        STORE.save_investigation(
            Investigation(
                investigation_id=f"{run_id}__{bid}",
                run_id=run_id,
                business_id=bid,
                created_at=ts(-5758),
                completed_at=ts(-5710),
                status=status_,
                source_count=1,
                evidence_count=2 if status_ is InvestigationStatus.COMPLETED else 0,
            )
        )


def build_app() -> FastAPI:
    _seed_completed_run()
    _seed_in_flight_run()
    _seed_failed_run()

    from app.api.read_routes import router as read_router
    from app.api.routes import router as production_router

    app = FastAPI(title="opencube-intel (local fixtures)")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(production_router)
    app.include_router(read_router)
    return app


app = build_app()


if __name__ == "__main__":
    import uvicorn

    print("OpenCube Intel — LOCAL FIXTURE API (not real data) on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
