"""Public product API: POST /runs, GET /runs/{id}, GET /runs/{id}/matches."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from orchestration_factories import (
    RUN_ID,
    make_hypothesis,
    make_investigation,
    make_verification,
    seed_run_with_investigations,
)

from app.api.routes import router
from app.investigator import market_scout, opportunity_matcher
from app.investigator.models import InvestigationStatus, RunStatus


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture
def no_market_scout(monkeypatch: pytest.MonkeyPatch):
    """POST /runs must return before any discovery happens."""
    def forbidden(*_args, **_kwargs):
        raise AssertionError("POST /runs must not run Market Scout synchronously")

    monkeypatch.setattr(market_scout, "discover", forbidden)
    monkeypatch.setattr(market_scout, "select_for_investigation", forbidden)


def test_post_runs_accepts_defaults_and_enqueues_scout(
    client, store, tasks, no_market_scout
):
    response = client.post("/runs", json={})

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == RunStatus.QUEUED.value
    run_id = body["run_id"]

    run = store.get_run(run_id)
    assert run["status"] == RunStatus.QUEUED.value
    assert run["vertical"] == market_scout.VERTICAL
    assert run["geography"] == market_scout.GEOGRAPHY
    assert run["provider_capabilities"] == market_scout.DEFAULT_PROVIDER_CAPABILITIES
    assert run["started_at"] is not None

    assert tasks.names() == [f"scout-{run_id}"]
    assert tasks.tasks[f"scout-{run_id}"].route == "/tasks/scout"
    assert tasks.tasks[f"scout-{run_id}"].payload == {"run_id": run_id}


def test_post_runs_accepts_the_frozen_values_explicitly(
    client, store, tasks, no_market_scout
):
    response = client.post(
        "/runs",
        json={
            "vertical": market_scout.VERTICAL,
            "geography": market_scout.GEOGRAPHY,
            "provider_capabilities": ["AI Voice Reception"],
        },
    )

    assert response.status_code == 202
    run = store.get_run(response.json()["run_id"])
    assert run["provider_capabilities"] == ["AI Voice Reception"]


@pytest.mark.parametrize(
    "payload",
    [
        {"vertical": "Dental"},
        {"geography": "Broward County, Florida"},
        {"unknown_field": 1},
        {"provider_capabilities": "not-a-list"},
    ],
)
def test_post_runs_rejects_unfrozen_or_malformed_input(
    client, store, tasks, no_market_scout, payload
):
    assert client.post("/runs", json=payload).status_code == 422
    assert store.runs == {}
    assert tasks.tasks == {}


def test_post_runs_enqueue_failure_never_leaves_a_phantom_queued_run(
    client, store, tasks, no_market_scout, monkeypatch
):
    from app.investigator import tasks_client

    def boom(**_kwargs):
        raise RuntimeError("Cloud Tasks unavailable")

    monkeypatch.setattr(tasks_client, "enqueue", boom)

    response = client.post("/runs", json={})

    assert response.status_code == 503
    assert len(store.runs) == 1
    run = next(iter(store.runs.values()))
    assert run["status"] == RunStatus.FAILED.value
    assert "Cloud Tasks unavailable" in run["failure_message"]


def test_get_run_returns_404_for_an_unknown_run(client, store, tasks):
    assert client.get("/runs/nope").status_code == 404


def test_get_run_derives_progress_rather_than_reading_counters(client, store, tasks):
    seed_run_with_investigations(store, ["biz0", "biz1", "biz2"])
    store.save_investigation(
        make_investigation("biz0", status=InvestigationStatus.COMPLETED)
    )
    store.save_investigation(
        make_investigation("biz1", status=InvestigationStatus.FAILED)
    )
    hypothesis = make_hypothesis("h0", "biz0")
    store.save_hypothesis(hypothesis)
    store.save_verification(make_verification("v0", hypothesis))

    body = client.get(f"/runs/{RUN_ID}").json()

    assert body["businesses_total"] == 3
    assert body["investigations_total"] == 3
    assert body["investigations_completed"] == 1
    assert body["investigations_failed"] == 1
    assert body["investigations_in_progress"] == 1
    assert body["hypotheses_total"] == 1
    assert body["verifications_total"] == 1
    assert body["verifications_completed"] == 1
    assert body["matches_total"] == 0
    assert body["is_terminal"] is False
    # finalize_run's persisted output stays null until the run is terminal.
    assert body["investigation_count"] is None


def test_get_run_reports_terminal_state(client, store, tasks):
    seed_run_with_investigations(
        store, ["biz0"], status=InvestigationStatus.COMPLETED, run_status=RunStatus.COMPLETED
    )
    body = client.get(f"/runs/{RUN_ID}").json()
    assert body["status"] == RunStatus.COMPLETED.value
    assert body["is_terminal"] is True


def test_get_matches_returns_summary_and_business_identity(client, store, tasks):
    seed_run_with_investigations(
        store, ["biz0", "biz1"], status=InvestigationStatus.COMPLETED
    )
    hypotheses = [make_hypothesis("h0", "biz0"), make_hypothesis("h1", "biz1")]
    verification = make_verification("v0", hypotheses[0])
    store.save_verification(verification)
    for hypothesis in hypotheses:
        store.save_hypothesis(hypothesis)
    store.save_opportunity_match(
        opportunity_matcher.build_match(hypotheses[0], verification)
    )
    store.save_opportunity_match(opportunity_matcher.build_match(hypotheses[1], None))

    body = client.get(f"/runs/{RUN_ID}/matches").json()

    assert len(body["matches"]) == 2
    assert body["summary"]["total_evaluated"] == 2
    counts = body["summary"]["match_status_counts"]
    assert counts["MATCHED"] + counts["NOT_MATCHED"] + counts["UNRESOLVED"] == 2
    assert {m["business_display_name"] for m in body["matches"]} == {
        "Spa biz0",
        "Spa biz1",
    }
    assert all("reason_code" in m and "reasoning" in m for m in body["matches"])
    # Provenance IDs travel; Evidence bodies never do.
    assert all("source_hypothesis_evidence_ids" in m for m in body["matches"])
    assert "evidence" not in body


def test_get_matches_returns_404_for_an_unknown_run(client, store, tasks):
    assert client.get("/runs/nope/matches").status_code == 404


def test_production_routes_are_wired_into_the_adk_application():
    """The 2-line include in fast_api_app.py is load-bearing: without it the
    deployed service would answer 404 for every production route."""
    from app.fast_api_app import app as adk_app

    with TestClient(adk_app) as adk_client:
        # A validation failure proves the route resolves without running the
        # handler body (no Firestore, no Cloud Tasks).
        assert adk_client.post("/runs", json={"unknown": 1}).status_code == 422
        assert adk_client.post("/tasks/scout", json={}).status_code == 422
        # The ADK agent route is not shadowed by /runs.
        assert adk_client.get("/health").status_code == 200
