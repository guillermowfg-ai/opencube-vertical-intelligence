"""Frontend V1 read-only API: /overview, /runs, /matches, /businesses, /catalog.

These routes must be projections and nothing else. The tests below assert
both halves of that: the numbers a screen renders are correct, and the
routes never write, never re-decide a match, and never invent a status the
pipeline did not persist.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from orchestration_factories import (
    RUN_ID,
    make_hypothesis,
    make_verification,
    seed_run_with_investigations,
)

from app.api.read_routes import router as read_router
from app.investigator import market_scout, opportunity_matcher
from app.investigator import run_orchestrator as orchestrator
from app.investigator.models import (
    Evidence,
    InvestigationStatus,
    MatchStatus,
    OpportunityStatus,
    RunStatus,
    SourceType,
    VerificationExecutionStatus,
    VerificationOutcome,
)

TS = "2026-08-26T00:00:00+00:00"


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(read_router)
    return TestClient(app)


def _evidence(evidence_id: str, business_id: str, observation: str) -> Evidence:
    return Evidence(
        evidence_id=evidence_id,
        run_id=RUN_ID,
        business_id=business_id,
        investigation_id=f"{RUN_ID}__{business_id}",
        source_url=f"https://example.com/{evidence_id}",
        source_type=SourceType.WEBSITE,
        observation=observation,
        retrieved_at=TS,
        collected_by="business_investigator",
    )


@pytest.fixture
def seeded(store):
    """One finished run: two businesses, three hypotheses, one verification,
    three matches — enough to exercise every aggregate the UI renders."""
    run = seed_run_with_investigations(
        store,
        ["biz-a", "biz-b"],
        status=InvestigationStatus.COMPLETED,
        run_status=RunStatus.COMPLETED,
    )
    run.completed_at = TS
    run.investigation_count = 2
    run.completed_investigation_count = 2
    run.failed_investigation_count = 0
    store.save_run(run)

    support = _evidence("ev-support", "biz-a", "No booking call-to-action on the homepage.")
    contradict = _evidence("ev-contra", "biz-a", "A Book Now button is present in the nav.")
    independent = _evidence("ev-indep", "biz-a", "A directory listing shows phone-only booking.")
    independent.collected_by = "verification_loop"
    for item in (support, contradict, independent):
        store.save_evidence(item)

    confirmed = make_hypothesis("hyp-confirmed", "biz-a", status=OpportunityStatus.CONFIRMED)
    confirmed.supporting_evidence_ids = ["ev-support"]
    confirmed.contradicting_evidence_ids = ["ev-contra"]

    contradicted = make_hypothesis(
        "hyp-contradicted",
        "biz-a",
        status=OpportunityStatus.CONTRADICTED,
        opportunity_id="after_hours_lead_intake",
    )
    insufficient = make_hypothesis(
        "hyp-insufficient",
        "biz-b",
        status=OpportunityStatus.INSUFFICIENT_EVIDENCE,
        opportunity_id="lead_follow_up_effectiveness",
    )
    for hypothesis in (confirmed, contradicted, insufficient):
        store.save_hypothesis(hypothesis)

    verification = make_verification(
        "ver-1",
        confirmed,
        execution_status=VerificationExecutionStatus.COMPLETED,
        outcome=VerificationOutcome.SUPPORTS,
    )
    verification.independent_evidence_ids = ["ev-indep"]
    verification.verification_target = "Whether a direct online booking path exists."
    verification.reasoning = "The independent directory listing corroborates phone-only booking."
    store.save_verification(verification)

    store.save_opportunity_match(opportunity_matcher.build_match(confirmed, verification))
    store.save_opportunity_match(opportunity_matcher.build_match(contradicted, None))
    store.save_opportunity_match(opportunity_matcher.build_match(insufficient, None))
    return store


# ---------------------------------------------------------------------------
# /overview
# ---------------------------------------------------------------------------


def test_overview_reports_the_real_counts(client, seeded):
    body = client.get("/overview").json()

    kpis = body["kpis"]
    assert kpis["runs_total"] == 1
    assert kpis["runs_completed"] == 1
    assert kpis["runs_active"] == 0
    assert kpis["businesses_discovered"] == 2
    assert kpis["businesses_investigated"] == 2
    assert kpis["hypotheses_total"] == 3
    assert kpis["verifications_completed"] == 1
    assert kpis["matches_total"] == 3
    assert body["truncated"] is False


def test_overview_distributions_keep_every_bucket_including_zeros(client, seeded):
    body = client.get("/overview").json()

    hypothesis = {c["key"]: c["count"] for c in body["hypothesis_status_counts"]}
    assert hypothesis == {
        "UNVERIFIED": 0,
        "CONFIRMED": 1,
        "CONTRADICTED": 1,
        "INSUFFICIENT_EVIDENCE": 1,
    }

    verification = {c["key"]: c["count"] for c in body["verification_state_counts"]}
    assert verification["SUPPORTS"] == 1
    assert verification["NO_INDEPENDENT_SOURCE"] == 0
    assert verification["FAILED"] == 0
    assert verification["IN_PROGRESS"] == 0

    match = {c["key"]: c["count"] for c in body["match_status_counts"]}
    assert set(match) == {s.value for s in MatchStatus}
    assert sum(match.values()) == 3


def test_overview_highlights_only_matched_opportunities(client, seeded):
    body = client.get("/overview").json()
    highlighted = body["highlighted_matches"]

    assert highlighted, "a MATCHED opportunity exists and must be surfaced"
    assert {m["match_status"] for m in highlighted} == {MatchStatus.MATCHED.value}
    assert highlighted[0]["business_display_name"] == "Spa biz-a"
    assert highlighted[0]["opportunity_name"] == "Online booking friction"
    assert highlighted[0]["primary_capability_label"] == "AI Appointment / Booking Assistance"


def test_overview_verification_state_reuses_the_matcher_classification(
    client, store, monkeypatch
):
    """The UI vocabulary must come from the Matcher, not a parallel copy."""
    seed_run_with_investigations(
        store,
        ["biz-a"],
        status=InvestigationStatus.COMPLETED,
        run_status=RunStatus.COMPLETED,
    )
    hypothesis = make_hypothesis("hyp-1", "biz-a")
    store.save_hypothesis(hypothesis)
    verification = make_verification(
        "ver-1", hypothesis, execution_status=VerificationExecutionStatus.FAILED, outcome=None
    )
    store.save_verification(verification)
    # The hypothesis must be reconciled to count as a completed result at all.
    store.save_opportunity_match(
        opportunity_matcher.build_match(hypothesis, verification)
    )

    calls: list[str] = []
    original = opportunity_matcher.classify_verification_state

    def spy(verification):
        calls.append(verification.verification_id)
        return original(verification)

    monkeypatch.setattr(opportunity_matcher, "classify_verification_state", spy)
    body = client.get("/overview").json()

    assert calls == ["ver-1"]
    assert {c["key"]: c["count"] for c in body["verification_state_counts"]}["FAILED"] == 1


def test_a_terminal_run_with_no_matches_never_enters_the_result_totals(
    client, seeded, store
):
    """The exact shape of the legacy run 01cbfec1 once it is marked FAILED.

    Terminal status alone must not readmit hypotheses that never reached the
    Matcher; if it did, honestly recording an abandoned run as FAILED would
    silently inflate the denominator with work that produced no answer.
    """
    legacy = seed_run_with_investigations(
        store,
        ["biz-legacy"],
        status=InvestigationStatus.COMPLETED,
        run_status=RunStatus.FAILED,
        run_id="run-legacy",
    )
    for index in range(3):
        store.save_hypothesis(
            make_hypothesis(
                f"hyp-legacy-{index}",
                "biz-legacy",
                status=OpportunityStatus.CONTRADICTED,
                run_id=legacy.run_id,
            )
        )
    # ... and no matches at all, exactly like the legacy run.

    body = client.get("/overview").json()

    assert body["kpis"]["hypotheses_total"] == 3, "the legacy 3 must stay out"
    assert body["kpis"]["matches_total"] == 3
    assert {c["key"]: c["count"] for c in body["hypothesis_status_counts"]}[
        "CONTRADICTED"
    ] == 1
    assert body["runs_without_results"] == 1
    # Still visible in history, with its real status.
    assert "run-legacy" in {r["run_id"] for r in body["recent_runs"]}


def test_every_completed_result_metric_shares_one_denominator(client, seeded, store):
    """No two numbers on the dashboard may be computed against different
    populations of evaluated opportunities."""
    legacy = seed_run_with_investigations(
        store,
        ["biz-legacy"],
        status=InvestigationStatus.COMPLETED,
        run_status=RunStatus.FAILED,
        run_id="run-legacy",
    )
    for index in range(3):
        store.save_hypothesis(
            make_hypothesis(f"hyp-legacy-{index}", "biz-legacy", run_id=legacy.run_id)
        )

    body = client.get("/overview").json()
    denominator = body["kpis"]["matches_total"]

    assert body["kpis"]["hypotheses_total"] == denominator
    assert sum(c["count"] for c in body["match_status_counts"]) == denominator
    assert sum(c["count"] for c in body["hypothesis_status_counts"]) == denominator
    assert sum(c["count"] for c in body["opportunity_counts"]) == denominator
    assert (
        body["kpis"]["matches_matched"] + body["kpis"]["review_needed"]
        <= denominator
    )
    # A verification only exists for a reconciled hypothesis, so its own
    # population can be smaller -- but never larger than the denominator.
    assert sum(c["count"] for c in body["verification_state_counts"]) <= denominator


def test_overview_counts_only_runs_whose_analysis_finished(client, seeded, store):
    """A run still in flight keeps its place in history but must not be
    counted as a result. This is the shape of the pre-async run 01cbfec1:
    one completed investigation, three hypotheses, and no matcher output,
    left non-terminal by a code path that no longer exists."""
    stranded = seed_run_with_investigations(
        store,
        ["biz-stranded"],
        status=InvestigationStatus.COMPLETED,
        run_status=RunStatus.IN_PROGRESS,
        run_id="run-stranded",
    )
    for index in range(3):
        store.save_hypothesis(
            make_hypothesis(
                f"hyp-stranded-{index}",
                "biz-stranded",
                status=OpportunityStatus.CONTRADICTED,
                run_id=stranded.run_id,
            )
        )

    body = client.get("/overview").json()

    # The seeded terminal run's numbers are untouched by the stranded one.
    assert body["kpis"]["hypotheses_total"] == 3
    assert body["kpis"]["businesses_discovered"] == 2
    assert body["runs_without_results"] == 1

    hypothesis = {c["key"]: c["count"] for c in body["hypothesis_status_counts"]}
    assert hypothesis["CONTRADICTED"] == 1, "the stranded run's 3 must not be counted"

    # It is still visible in history, with its real status.
    assert "run-stranded" in {r["run_id"] for r in body["recent_runs"]}
    assert body["kpis"]["runs_total"] == 2
    assert body["kpis"]["runs_active"] == 1


def test_overview_still_counts_a_failed_run_that_produced_results(client, store, seeded):
    """A failed run is terminal and its output is real (DECISIONS.md #30), so
    excluding it would throw away work that genuinely completed."""
    failed = seed_run_with_investigations(
        store,
        ["biz-failed"],
        status=InvestigationStatus.COMPLETED,
        run_status=RunStatus.FAILED,
        run_id="run-failed",
    )
    hypothesis = make_hypothesis(
        "hyp-failed", "biz-failed", status=OpportunityStatus.CONFIRMED, run_id=failed.run_id
    )
    store.save_hypothesis(hypothesis)
    store.save_opportunity_match(opportunity_matcher.build_match(hypothesis, None))

    body = client.get("/overview").json()

    assert body["kpis"]["hypotheses_total"] == 4
    assert body["kpis"]["matches_total"] == 4
    assert body["runs_without_results"] == 0


def test_overview_handles_an_empty_platform(client, store):
    body = client.get("/overview").json()

    assert body["kpis"]["runs_total"] == 0
    assert body["recent_runs"] == []
    assert body["highlighted_matches"] == []
    # The buckets still exist, so an empty dashboard shows a real zero rather
    # than an absent chart.
    assert len(body["match_status_counts"]) == len(MatchStatus)


# ---------------------------------------------------------------------------
# /runs
# ---------------------------------------------------------------------------


def test_run_list_derives_progress_and_sorts_newest_first(client, store, seeded):
    older = seed_run_with_investigations(
        store, ["biz-c"], status=InvestigationStatus.IN_PROGRESS, run_id="run-older"
    )
    older.created_at = "2020-01-01T00:00:00+00:00"
    store.save_run(older)

    body = client.get("/runs").json()

    assert body["total"] == 2
    assert [r["run_id"] for r in body["runs"]] == [RUN_ID, "run-older"]

    finished = body["runs"][0]
    assert finished["is_terminal"] is True
    assert finished["investigations_total"] == 2
    assert finished["investigations_completed"] == 2
    assert finished["hypotheses_total"] == 3
    assert finished["matches_total"] == 3
    assert finished["matches_matched"] + finished["matches_not_matched"] + finished[
        "matches_unresolved"
    ] == 3

    active = body["runs"][1]
    assert active["is_terminal"] is False
    assert active["investigations_in_progress"] == 1
    # finalize_run has not written its counts yet, and the view says so
    # rather than substituting the derived numbers.
    assert active["investigation_count"] is None


def test_run_list_respects_limit(client, seeded):
    body = client.get("/runs", params={"limit": 1}).json()
    assert len(body["runs"]) == 1
    assert body["total"] == 1


# ---------------------------------------------------------------------------
# /runs/{run_id}/businesses
# ---------------------------------------------------------------------------


def test_run_businesses_rows_carry_per_business_aggregates(client, seeded):
    body = client.get(f"/runs/{RUN_ID}/businesses").json()

    assert [b["display_name"] for b in body["businesses"]] == ["Spa biz-a", "Spa biz-b"]
    first = body["businesses"][0]
    assert first["investigation_id"] == f"{RUN_ID}__biz-a"
    assert first["investigation_status"] == InvestigationStatus.COMPLETED.value
    assert first["hypotheses_total"] == 2
    assert first["verifications_total"] == 1
    assert first["matches_total"] == 2
    assert first["matched_capability_ids"] == ["ai_appointment_booking_assistance"]


def test_run_businesses_404s_for_an_unknown_run(client, store):
    assert client.get("/runs/nope/businesses").status_code == 404


# ---------------------------------------------------------------------------
# /matches
# ---------------------------------------------------------------------------


def test_match_list_filters_by_status_and_run(client, seeded):
    body = client.get("/matches", params={"match_status": "MATCHED"}).json()
    assert {m["match_status"] for m in body["matches"]} == {MatchStatus.MATCHED.value}

    scoped = client.get("/matches", params={"run_id": RUN_ID}).json()
    assert scoped["total"] == 3
    assert {m["run_id"] for m in scoped["matches"]} == {RUN_ID}


def test_match_list_rejects_an_unknown_status(client, seeded):
    response = client.get("/matches", params={"match_status": "PROMISING"})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# /matches/{match_id}
# ---------------------------------------------------------------------------


def test_match_detail_resolves_the_full_provenance_chain(client, seeded):
    body = client.get("/matches/hyp-confirmed").json()

    assert body["match"]["match_status"] == MatchStatus.MATCHED.value
    assert body["match"]["reason_code"] == "CONFIRMED_INDEPENDENTLY_SUPPORTED"
    assert body["business"]["display_name"] == "Spa biz-a"
    assert body["run"]["run_id"] == RUN_ID
    assert body["opportunity"]["name"] == "Online booking friction"
    assert body["primary_capability"]["label"] == "AI Appointment / Booking Assistance"

    assert body["hypothesis"]["status"] == OpportunityStatus.CONFIRMED.value
    assert body["verification"]["outcome"] == VerificationOutcome.SUPPORTS.value
    assert body["verification"]["verification_target"]

    roles = [(e["evidence_id"], e["role"]) for e in body["hypothesis_evidence"]]
    assert roles == [("ev-support", "SUPPORTING"), ("ev-contra", "CONTRADICTING")]
    assert [e["evidence_id"] for e in body["verification_evidence"]] == ["ev-indep"]
    assert body["verification_evidence"][0]["collected_by"] == "verification_loop"
    assert body["hypothesis_evidence"][0]["observation"]


def test_match_detail_without_a_verification_says_so(client, seeded):
    body = client.get("/matches/hyp-contradicted").json()

    assert body["verification"] is None
    assert body["verification_evidence"] == []
    assert body["match"]["match_status"] == MatchStatus.NOT_MATCHED.value


def test_match_detail_404s_for_an_unknown_match(client, seeded):
    assert client.get("/matches/nope").status_code == 404


# ---------------------------------------------------------------------------
# /businesses and /catalog
# ---------------------------------------------------------------------------


def test_business_list_aggregates_across_runs(client, seeded):
    body = client.get("/businesses").json()

    by_id = {b["business_id"]: b for b in body["businesses"]}
    assert by_id["biz-a"]["runs_total"] == 1
    assert by_id["biz-a"]["hypotheses_total"] == 2
    assert by_id["biz-a"]["matches_matched"] == 1
    assert by_id["biz-b"]["matches_matched"] == 0
    # Ranked by matched opportunities, so the actionable business is first.
    assert body["businesses"][0]["business_id"] == "biz-a"


def test_catalog_serves_the_declarative_vocabularies(client, store):
    body = client.get("/catalog").json()

    assert body["vertical"] == "Med Spa"
    assert body["geography"] == "Miami-Dade County, Florida"
    assert len(body["evaluated_opportunity_ids"]) == 3
    assert "online_booking_friction" in body["evaluated_opportunity_ids"]
    assert any(c["capability_id"] == "crm" for c in body["capabilities"])


def test_catalog_publishes_what_post_runs_actually_accepts(client, store):
    """The UI must never render a control the API would reject, so the frozen
    parameters are published rather than reimplemented in the frontend."""
    execution = client.get("/catalog").json()["execution"]

    assert execution["vertical"] == market_scout.VERTICAL
    assert execution["geography"] == market_scout.GEOGRAPHY
    assert execution["vertical_locked"] is True
    assert execution["geography_locked"] is True

    # There is no target_business_count field on CreateRunRequest at all.
    assert execution["target_business_count"] == market_scout.DEFAULT_TARGET_COUNT
    assert execution["target_business_count_locked"] is True

    assert execution["provider_capabilities_editable"] is True
    assert execution["provider_capabilities_max"] == 20


def test_catalog_reports_that_capabilities_do_not_steer_the_analysis(client, store):
    """`provider_capabilities` is persisted on the Run and returned by
    GET /runs/{id}, but no analytical engine reads it. The flag exists so the
    UI labels it as recorded scope instead of implying it changes the work."""
    body = client.get("/catalog").json()
    assert body["execution"]["provider_capabilities_affect_analysis"] is False

    source = Path(orchestrator.__file__).read_text()
    tree = ast.parse(source)
    readers = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute) and node.attr == "provider_capabilities"
    ]
    # Only create_run touches it, and only to write it onto the Run.
    assert len(readers) == 0, "run_orchestrator must not read provider_capabilities"


# ---------------------------------------------------------------------------
# The read API is read-only. Structurally.
# ---------------------------------------------------------------------------


def test_read_routes_never_write(client, seeded, monkeypatch):
    from app.investigator import firestore_store

    for name in dir(firestore_store):
        if name.startswith("save_"):
            monkeypatch.setattr(
                firestore_store,
                name,
                lambda *a, _n=name, **k: pytest.fail(f"read route called {_n}"),
            )

    for path in ("/overview", "/runs", f"/runs/{RUN_ID}/businesses", "/matches",
                 "/matches/hyp-confirmed", "/businesses", "/catalog"):
        assert client.get(path).status_code == 200
