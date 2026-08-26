"""SCOUT task: discovery runs once, dispatch is replayable."""

from __future__ import annotations

import pytest
from orchestration_factories import RUN_ID, FakeDiscovery, make_business, make_run

from app.investigator import market_scout, run_orchestrator
from app.investigator.models import InvestigationStatus, RunStatus


@pytest.fixture
def selected(monkeypatch: pytest.MonkeyPatch):
    """Patch Market Scout so no Places call is ever made."""
    businesses = [make_business(f"biz{i}") for i in range(10)]
    calls = {"discover": 0, "select": 0}

    def fake_discover(**_kwargs):
        calls["discover"] += 1
        return FakeDiscovery(businesses)

    def fake_select(discovery, *, target_count):
        calls["select"] += 1
        return businesses[:target_count]

    monkeypatch.setattr(market_scout, "discover", fake_discover)
    monkeypatch.setattr(market_scout, "select_for_investigation", fake_select)
    return businesses, calls


def test_scout_discovers_persists_and_dispatches(store, tasks, selected):
    businesses, calls = selected
    store.save_run(make_run())

    result = run_orchestrator.scout_step(RUN_ID)

    assert result["status"] == "ok"
    assert calls["discover"] == 1
    assert result["businesses_total"] == 10
    assert result["tasks_created"] == 10

    run = store.get_run(RUN_ID)
    assert run["businesses_total"] == 10
    assert run["status"] == RunStatus.INVESTIGATING.value
    assert run["discovery_raw_candidate_count"] == 37

    # Deterministic Investigation IDs, one per business, all IN_PROGRESS.
    assert sorted(store.investigations) == sorted(
        f"{RUN_ID}__{b.business_id}" for b in businesses
    )
    assert all(
        d["status"] == InvestigationStatus.IN_PROGRESS.value
        for d in store.investigations.values()
    )
    assert sorted(store.businesses) == sorted(b.business_id for b in businesses)

    assert tasks.names("biz-") == sorted(
        f"biz-{RUN_ID}-{b.business_id}" for b in businesses
    )


def test_scout_duplicate_delivery_does_not_rediscover(store, tasks, selected):
    _, calls = selected
    store.save_run(make_run())
    run_orchestrator.scout_step(RUN_ID)
    assert calls["discover"] == 1

    result = run_orchestrator.scout_step(RUN_ID)

    assert result["status"] == "ok"
    assert result["discovered"] is False
    assert calls["discover"] == 1, "a re-delivery must never call Places again"
    assert calls["select"] == 1
    assert result["tasks_created"] == 0
    assert result["tasks_already_existed"] == 10
    assert len(store.investigations) == 10, "no second, orphaned Investigation set"
    assert len(tasks.names("biz-")) == 10


def test_scout_terminal_run_is_noop(store, tasks, selected):
    _, calls = selected
    store.save_run(make_run(status=RunStatus.COMPLETED))

    result = run_orchestrator.scout_step(RUN_ID)

    assert result == {"status": "noop", "reason": "run_terminal"}
    assert calls["discover"] == 0
    assert tasks.tasks == {}


def test_scout_zero_eligible_businesses_fails_the_run(store, tasks, monkeypatch):
    monkeypatch.setattr(market_scout, "discover", lambda **_: FakeDiscovery([]))
    monkeypatch.setattr(
        market_scout, "select_for_investigation", lambda d, *, target_count: []
    )
    store.save_run(make_run())

    result = run_orchestrator.scout_step(RUN_ID)

    assert result["status"] == "failed"
    run = store.get_run(RUN_ID)
    assert run["status"] == RunStatus.FAILED.value
    assert run["businesses_total"] == 0
    assert "0 eligible businesses" in run["failure_message"]
    assert tasks.tasks == {}


def test_scout_discovery_error_asks_for_retry_before_final_attempt(
    store, tasks, monkeypatch
):
    def boom(**_kwargs):
        raise RuntimeError("Places unavailable")

    monkeypatch.setattr(market_scout, "discover", boom)
    store.save_run(make_run())

    with pytest.raises(run_orchestrator.TaskNotReady):
        run_orchestrator.scout_step(RUN_ID, retry_count=0)

    run = store.get_run(RUN_ID)
    assert run["status"] != RunStatus.FAILED.value
    assert "Places unavailable" in run["failure_message"]


def test_scout_discovery_error_on_final_attempt_fails_the_run(
    store, tasks, monkeypatch
):
    def boom(**_kwargs):
        raise RuntimeError("Places unavailable")

    monkeypatch.setattr(market_scout, "discover", boom)
    store.save_run(make_run())

    result = run_orchestrator.scout_step(RUN_ID, retry_count=2)

    assert result["status"] == "failed"
    run = store.get_run(RUN_ID)
    assert run["status"] == RunStatus.FAILED.value
    assert "Places unavailable" in run["failure_message"]
