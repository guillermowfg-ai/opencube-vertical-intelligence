# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Hosted Judge Mode — a separate, public, structurally read-only application.

This is NOT the production application. `app.fast_api_app` stays exactly as it
is, private, and is what runs the analytical workflow. This module builds a
second FastAPI app that is deployed to its own Cloud Run service with its own
service account, and it exists to let someone explore completed production data
without there being any path from the public URL to a paid execution.

Three properties define it, and the tests in
`tests/unit/test_judge_app.py` enforce all three:

  1. **Only GET survives.** The judge API router is assembled by walking the
     accepted routers and keeping a route only if its method set is exactly
     `{"GET"}`. `POST /runs` and the three `/tasks/*` handlers are therefore
     not filtered, not guarded and not 401'd — they are never registered, so
     they do not exist to be reached. A method guard in front of routing turns
     every non-read verb into a 404 before a handler is selected, and the SPA
     fallback refuses anything under `/api/` rather than answering it with
     `index.html`. A probe at a write path gets a 404, not a 200 and not a 405.

  2. **The production surface is untouched.** Routes are adopted by reference
     into a fresh `APIRouter`; `include_router` then re-creates them under the
     `/api` prefix on this app only. `app.api.routes.router` and
     `app.api.read_routes.router` are never mutated, so importing this module
     cannot change what the production application serves.

  3. **Nothing analytical is initialized.** No Gemini client, no Places client,
     no Cloud Tasks client and no ADK runner or scaffold agent. Every client in
     this codebase is constructed lazily inside the function that needs it, and
     no function that needs one is reachable from any route here. The only
     Google client this process ever builds is the Firestore reader, on the
     first read request.

The HTTP surface is the last line of this defence, not the only one. The judge
runtime service account holds a Firestore read role and nothing else: no
Vertex AI, no Cloud Tasks enqueue, no `run.invoker` on the private production
service. A write route reintroduced here by accident would still be unable to
call a model, enqueue a task, or reach the production core.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.routing import APIRoute

from app.api import read_routes
from app.api import routes as production_routes

# ---------------------------------------------------------------------------
# Route surface
# ---------------------------------------------------------------------------

API_PREFIX = "/api"

# The read router is read-only by construction (a production test already
# asserts no read route calls a `save_*`), so every GET on it is adopted.
#
# From the production router exactly one route is adopted: run detail, which is
# the only endpoint the interface needs that does not live in the read router.
# It is named explicitly rather than taken because it happens to be a GET, so a
# future GET added to the production router is not silently published here.
_ADOPTED_PRODUCTION_READS: frozenset[str] = frozenset({"/runs/{run_id}"})

# Anything outside this set is a mutation as far as this app is concerned.
_READ_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})


def _judge_api_router() -> APIRouter:
    """Assemble the judge API from the accepted routers, GET routes only."""
    router = APIRouter()

    for route in read_routes.router.routes:
        if isinstance(route, APIRoute) and route.methods == {"GET"}:
            router.routes.append(route)

    for route in production_routes.router.routes:
        if not isinstance(route, APIRoute) or route.methods != {"GET"}:
            continue
        if route.path in _ADOPTED_PRODUCTION_READS:
            router.routes.append(route)

    return router


def route_inventory(application: FastAPI) -> list[tuple[tuple[str, ...], str]]:
    """Every path operation `application` will actually serve.

    `include_router` does not put `APIRoute` objects on `app.routes` in current
    FastAPI — it appends a lazy wrapper that materialises them on demand. Asking
    that wrapper for its effective routes is the only way to see the real
    surface, and seeing the real surface is the entire point of this milestone,
    so the inventory is computed here once and shared by the startup assertion,
    the tests and the operator check rather than re-derived three times.
    """
    inventory: list[tuple[tuple[str, ...], str]] = []

    def walk(routes: object) -> None:
        for route in routes:  # type: ignore[union-attr]
            if isinstance(route, APIRoute):
                inventory.append((tuple(sorted(route.methods)), route.path))
                continue
            candidates = getattr(route, "effective_candidates", None)
            if callable(candidates):
                for context in candidates():
                    methods = getattr(context, "methods", None) or ()
                    path = getattr(context, "path", None)
                    if path is not None:
                        inventory.append((tuple(sorted(methods)), path))
                continue
            nested = getattr(route, "routes", None)
            if nested is not None:
                walk(nested)

    walk(application.routes)
    return sorted(set(inventory))


def mutating_routes(application: FastAPI) -> list[tuple[tuple[str, ...], str]]:
    """The inventory entries that are not purely reads. Must always be empty."""
    return [
        entry for entry in route_inventory(application) if not set(entry[0]) <= _READ_METHODS
    ]


def _assert_read_only(application: FastAPI) -> None:
    """Fail at import time rather than serve a mutating route publicly."""
    offenders = mutating_routes(application)
    if offenders:
        raise RuntimeError(
            "Judge Mode refuses to start: mutating routes registered — "
            + ", ".join(f"{list(m)} {p}" for m, p in offenders)
        )


# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------

# The compiled read-only bundle. In the container this is /code/static (see
# Dockerfile.judge); locally it falls back to the sibling frontend build so the
# app can be smoke-tested without Docker.
STATIC_DIR = Path(
    os.getenv(
        "JUDGE_STATIC_DIR",
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    )
).resolve()

_INDEX = STATIC_DIR / "index.html"


def _static_file(relative: str) -> Path | None:
    """Resolve a request path inside STATIC_DIR, or None if it escapes it."""
    if not relative:
        return None
    candidate = (STATIC_DIR / relative).resolve()
    if candidate == STATIC_DIR or STATIC_DIR not in candidate.parents:
        return None
    return candidate if candidate.is_file() else None


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="opencube-intel-judge",
    description=(
        "Public read-only Judge Mode for OpenCube Intel. Serves the product "
        "interface and read projections of completed production runs. It "
        "registers no mutating route and cannot start a task."
    ),
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

@app.middleware("http")
async def refuse_non_read_methods(request, call_next):  # type: ignore[no-untyped-def]
    """Refuse anything that is not a read, before routing gets a say.

    The route table already contains no mutating operation, so this cannot
    change which handler runs — nothing mutating can run. What it changes is
    the answer a prober gets. The SPA fallback below is a `GET` catch-all, so
    without this a `POST /tasks/scout` would match that catch-all's path and
    come back `405 Method Not Allowed` — technically correct, and exactly the
    wrong thing to tell someone, because it reads as "this path exists, try
    another verb". A path that was never registered should say so.

    It is also the cheapest real boundary in the stack: a write never reaches
    routing, dependency resolution, or a Firestore client.
    """
    if request.method not in _READ_METHODS:
        return JSONResponse({"detail": "Not found"}, status_code=status.HTTP_404_NOT_FOUND)
    return await call_next(request)


app.include_router(_judge_api_router(), prefix=API_PREFIX)


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    return {"status": "ok", "mode": "judge-readonly"}


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str) -> FileResponse:
    """Serve the compiled interface, with client-side routing.

    An unmatched path under the API prefix is a 404 and never the SPA shell:
    a probe at a write route must look like what it is — a route that does not
    exist — rather than getting a 200 with an HTML page.
    """
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    asset = _static_file(full_path)
    if asset is not None:
        return FileResponse(asset)

    if not _INDEX.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Judge Mode interface bundle is not present in this image.",
        )
    return FileResponse(_INDEX)


_assert_read_only(app)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
