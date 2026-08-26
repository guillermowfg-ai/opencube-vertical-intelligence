"""SCOUT partial-dispatch recovery.

The failure this file exists to prevent: SCOUT persists ten Investigations,
commits `businesses_total`, creates three of ten business tasks, and then hits
a transport error. If the retry treated `businesses_total is not None` as
"nothing left to do", seven Investigations would sit IN_PROGRESS forever with
no worker ever asked to run them, and the Run could never finalize.

`businesses_total` proves discovery finished. It proves nothing about dispatch.
"""

from __future__ import annotations

import pytest
from orchestration_factories import (
    RUN_ID,
    FakeDiscovery,
    make_business,
    make_run,
    seed_run_with_investigations,
)

from app.investigator import market_scout, run_orchestrator
from app.investigator.models import RunStatus

BUSINESS_IDS = [f"biz{i}" for i in range(10)]


@pytest.fixture
def no_discovery(monkeypatch: pytest.MonkeyPatch):
    """Market Scout must not be reachable at all on a replay path."""
    calls = {"discover": 0, "select": 0}

    def forbidden_discover(**_kwargs):
        calls["discover"] += 1
        raise AssertionError("SCOUT replay must never re-run discovery")

    def forbidden_select(*_args, **_kwargs):
        calls["select"] += 1
        raise AssertionError("SCOUT replay must never re-select businesses")

    monkeypatch.setattr(market_scout, "discover", forbidden_discover)
    monkeypatch.setattr(market_scout, "select_for_investigation", forbidden_select)
    return calls


def test_retry_completes_the_missing_half_of_the_dispatch_set(
    store, tasks, no_discovery
):
    """businesses_total persisted, 10 Investigations exist, 5 task names
    already exist, 5 do not. The retry must attempt all 10 and end with
    exactly 10 unique tasks."""
    seed_run_with_investigations(store, BUSINESS_IDS)
    already = [f"biz-{RUN_ID}-{b}" for b in BUSINESS_IDS[:5]]
    tasks.preexisting(*already)

    result = run_orchestrator.scout_step(RUN_ID)

    assert no_discovery["discover"] == 0, "Market Scout discovery must not be called"
    assert no_discovery["select"] == 0, "Places must not be called"

    # Every expected business task was attempted, not just the missing ones.
    assert sorted(tasks.attempts) == sorted(
        f"biz-{RUN_ID}-{b}" for b in BUSINESS_IDS
    )
    assert len(tasks.attempts) == 10

    # AlreadyExists counted as dispatched; the missing five were created.
    assert result["status"] == "ok"
    assert result["tasks_already_existed"] == 5
    assert result["tasks_created"] == 5

    # Final unique task set is exactly 10 — no duplicates.
    assert len(tasks.names("biz-")) == 10
    assert len(set(tasks.attempts)) == 10


def test_transient_dispatch_error_then_retry_completes_without_rediscovery(
    store, tasks, monkeypatch
):
    """First SCOUT attempt discovers, persists, creates a few tasks, then the
    transport fails. Nothing is rolled back, and a later retry finishes the
    job without touching Places."""
    businesses = [make_business(b) for b in BUSINESS_IDS]
    calls = {"discover": 0}

    def counting_discover(**_kwargs):
        calls["discover"] += 1
        return FakeDiscovery(businesses)

    monkeypatch.setattr(market_scout, "discover", counting_discover)
    monkeypatch.setattr(
        market_scout,
        "select_for_investigation",
        lambda d, *, target_count: businesses[:target_count],
    )
    store.save_run(make_run())

    # --- attempt 1: dies during dispatch, after 3 successful creations ---
    tasks.raise_on_attempt = 4
    with pytest.raises(run_orchestrator.TaskNotReady):
        run_orchestrator.scout_step(RUN_ID, retry_count=0)

    assert calls["discover"] == 1
    assert len(tasks.names("biz-")) == 3

    # Discovery is NOT rolled back: businesses, investigations and the
    # readiness barrier all survive so the retry can replay dispatch.
    run_after_failure = store.get_run(RUN_ID)
    assert run_after_failure["businesses_total"] == 10
    assert run_after_failure["status"] != RunStatus.FAILED.value
    assert len(store.investigations) == 10
    assert len(store.businesses) == 10

    # --- attempt 2: transport recovered ---
    tasks.raise_on_attempt = None
    monkeypatch.setattr(
        market_scout,
        "discover",
        lambda **_: (_ for _ in ()).throw(AssertionError("must not rediscover")),
    )

    result = run_orchestrator.scout_step(RUN_ID, retry_count=1)

    assert result["status"] == "ok"
    assert calls["discover"] == 1, "no rediscovery on the recovery attempt"
    assert result["tasks_already_existed"] == 3
    assert result["tasks_created"] == 7
    assert len(tasks.names("biz-")) == 10

    # The transient failure message is cleared once dispatch actually completes.
    assert store.get_run(RUN_ID)["failure_message"] is None


def test_replay_dispatch_set_comes_from_persisted_investigations(
    store, tasks, no_discovery
):
    """The replay dispatch set is the canonical persisted Investigations, so
    the deterministic task names it produces are exactly reproducible."""
    seed_run_with_investigations(store, BUSINESS_IDS[:4])

    result = run_orchestrator.scout_step(RUN_ID)

    assert result["businesses_total"] == 4
    assert tasks.names("biz-") == sorted(
        f"biz-{RUN_ID}-{b}" for b in BUSINESS_IDS[:4]
    )
    payloads = [t.payload for t in tasks.tasks.values()]
    assert all(
        p["investigation_id"] == f"{RUN_ID}__{p['business_id']}" for p in payloads
    )
