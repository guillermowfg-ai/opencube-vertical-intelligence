"""Structural guards on the public Judge Mode surface.

Judge Mode is the only part of this system that is reachable by an anonymous
caller, so its route surface is asserted rather than assumed. These tests are
deliberately structural: the claim is that a write route cannot exist here, not
that one particular request happens to be rejected today.

Nothing here touches Firestore. Route matching is checked by asking the router
whether a scope matches, which never runs the endpoint.
"""

from __future__ import annotations

from fastapi import FastAPI
from starlette.routing import Match

from app.api import read_routes
from app.api import routes as production_routes
from app.judge_app import (
    API_PREFIX,
    mutating_routes,
    route_inventory,
)
from app.judge_app import (
    app as judge_app,
)

WRITE_PATHS = ("/runs", "/tasks/scout", "/tasks/investigate", "/tasks/finalize")
MUTATING_METHODS = ("POST", "PUT", "PATCH", "DELETE")


def _match(app: FastAPI, method: str, path: str) -> Match:
    """Best match the app's router can make for method+path, without calling it.

    `Match.FULL` means a route serves it. `Match.PARTIAL` means the path exists
    but not for that method — a 405, which still proves the path is registered.
    `Match.NONE` means the route does not exist at all, which is what every
    write probe must return.
    """
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "root_path": "",
        "headers": [],
        "query_string": b"",
    }
    best = Match.NONE
    for route in app.routes:
        matched, _ = route.matches(scope)
        if matched.value > best.value:
            best = matched
    return best


# ---------------------------------------------------------------------------
# 1. Zero mutating routes
# ---------------------------------------------------------------------------


def test_judge_app_registers_no_mutating_route() -> None:
    assert mutating_routes(judge_app) == []


def test_every_registered_judge_route_is_a_get() -> None:
    inventory = route_inventory(judge_app)
    assert inventory, "the judge app must register something"
    for methods, path in inventory:
        assert set(methods) <= {"GET", "HEAD", "OPTIONS"}, f"{methods} {path}"


# ---------------------------------------------------------------------------
# 2 & 3. The production write paths do not exist here
# ---------------------------------------------------------------------------


def test_post_runs_is_served_by_no_route() -> None:
    """`GET /api/runs` exists; the check is that no route serves a POST to it."""
    for prefix in ("", API_PREFIX):
        assert _match(judge_app, "POST", f"{prefix}/runs") is not Match.FULL


def test_task_handler_paths_are_served_by_no_api_route() -> None:
    """The three Cloud Tasks handlers exist nowhere in the judge app.

    A bare `GET` under these paths falls through to the SPA catch-all, as any
    unknown path does — that is the interface shell, not a task handler. What
    must never happen is an API route serving them, under any verb.
    """
    api_paths = {path for _, path in route_inventory(judge_app)}
    for path in ("/tasks/scout", "/tasks/investigate", "/tasks/finalize"):
        for prefix in ("", API_PREFIX):
            assert f"{prefix}{path}" not in api_paths
            for method in MUTATING_METHODS:
                assert _match(judge_app, method, f"{prefix}{path}") is not Match.FULL, (
                    f"{method} {prefix}{path} must not be served"
                )


def test_no_mutating_method_reaches_any_judge_path() -> None:
    """Sweep every read path the judge app serves with every mutating verb."""
    from fastapi.testclient import TestClient

    paths = [
        path.replace("{run_id}", "r").replace("{match_id}", "m")
        for _, path in route_inventory(judge_app)
        if not path.endswith("{full_path:path}")
    ]
    with TestClient(judge_app) as client:
        for path in paths:
            for method in MUTATING_METHODS:
                assert _match(judge_app, method, path) is not Match.FULL, (
                    f"{method} {path} must not be served"
                )
                assert client.request(method, path).status_code == 404, (
                    f"{method} {path} must answer 404"
                )


def test_common_accidental_mutation_variants_are_refused_with_404() -> None:
    """Every mutating probe answers 404, never 401, 405 or 200.

    405 would be a misleading answer for a path that was never registered — it
    reads as "exists, wrong verb" — so the method guard turns the whole class
    into 404 before routing.
    """
    from fastapi.testclient import TestClient

    with TestClient(judge_app) as client:
        for path in WRITE_PATHS:
            for variant in (path, f"{path}/", f"{API_PREFIX}{path}", f"{API_PREFIX}{path}/"):
                for method in MUTATING_METHODS:
                    response = client.request(method, variant)
                    assert response.status_code == 404, (
                        f"{method} {variant} -> {response.status_code}"
                    )


# ---------------------------------------------------------------------------
# The read surface the interface actually needs
# ---------------------------------------------------------------------------


def test_the_interface_read_routes_are_all_served() -> None:
    required = {
        "/api/overview",
        "/api/runs",
        "/api/runs/{run_id}",
        "/api/runs/{run_id}/businesses",
        "/api/matches",
        "/api/matches/{match_id}",
        "/api/businesses",
        "/api/catalog",
    }
    served = {path for methods, path in route_inventory(judge_app) if "GET" in methods}
    assert required <= served, f"missing: {sorted(required - served)}"


def test_an_unknown_api_path_is_not_swallowed_by_the_spa_fallback() -> None:
    """A probe under /api must 404, never return the interface shell with 200."""
    from fastapi.testclient import TestClient

    with TestClient(judge_app) as client:
        assert client.get(f"{API_PREFIX}/does-not-exist").status_code == 404
        assert client.post(f"{API_PREFIX}/runs").status_code == 404
        assert client.post(f"{API_PREFIX}/tasks/scout").status_code == 404
        assert client.post("/runs").status_code == 404


def test_healthz_does_not_touch_any_google_client() -> None:
    from fastapi.testclient import TestClient

    with TestClient(judge_app) as client:
        response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["mode"] == "judge-readonly"


# ---------------------------------------------------------------------------
# The production surface is untouched by importing Judge Mode
# ---------------------------------------------------------------------------


def test_importing_judge_mode_does_not_mutate_the_production_routers() -> None:
    production = [(tuple(sorted(r.methods)), r.path) for r in production_routes.router.routes]
    read = [(tuple(sorted(r.methods)), r.path) for r in read_routes.router.routes]

    assert production == [
        (("POST",), "/runs"),
        (("GET",), "/runs/{run_id}"),
        (("GET",), "/runs/{run_id}/matches"),
        (("POST",), "/tasks/scout"),
        (("POST",), "/tasks/investigate"),
        (("POST",), "/tasks/finalize"),
    ]
    assert read == [
        (("GET",), "/overview"),
        (("GET",), "/runs"),
        (("GET",), "/runs/{run_id}/businesses"),
        (("GET",), "/matches"),
        (("GET",), "/matches/{match_id}"),
        (("GET",), "/businesses"),
        (("GET",), "/catalog"),
    ]


def test_the_production_application_still_serves_its_write_routes() -> None:
    """Judge Mode must not have narrowed the private production app."""
    from app.fast_api_app import app as production_app

    assert _match(production_app, "POST", "/runs") is Match.FULL
    for path in ("/tasks/scout", "/tasks/investigate", "/tasks/finalize"):
        assert _match(production_app, "POST", path) is Match.FULL


# ---------------------------------------------------------------------------
# Nothing analytical is initialised by serving reads
# ---------------------------------------------------------------------------


def test_judge_module_builds_no_client_at_import_time() -> None:
    """Every Google client in this codebase is lazy; assert it stayed that way."""
    from app.investigator import firestore_store, tasks_client

    assert firestore_store.get_client.cache_info().currsize == 0
    assert tasks_client.get_client.cache_info().currsize == 0


def test_judge_app_declares_no_analytical_environment() -> None:
    """The judge source must not reference model, Places or queue configuration."""
    from pathlib import Path

    source = Path(__file__).resolve().parents[2] / "app" / "judge_app.py"
    text = source.read_text()
    for forbidden in (
        "genai",
        "gemini_reasoner",
        "verification_reasoner",
        "verification_discovery",
        "places_client",
        "tasks_client",
        "TASKS_QUEUE",
        "SERVICE_URL",
        "TASK_INVOKER_SA",
        "root_agent",
    ):
        assert forbidden not in text, f"judge_app.py must not reference {forbidden}"
