"""Production Execution V1 routes.

Public product API:

    POST /runs                    create a run, return immediately
    GET  /runs/{run_id}           poll status + derived progress
    GET  /runs/{run_id}/matches   results

Internal Cloud Tasks handlers:

    POST /tasks/scout
    POST /tasks/investigate
    POST /tasks/finalize

The security boundary for the /tasks routes is Cloud Run IAM: the service is
private and only the runtime service account holds run.invoker on it, so an
unauthenticated caller never reaches this code. The X-CloudTasks-TaskName
check below is hygiene — it makes an accidental hand-rolled call obvious — and
is trivially spoofable, so it must never be mistaken for the access control.

Every task handler is a synchronous `def`. The entire analytical stack is
blocking (httpx, the sync genai client, sync Firestore); an `async def`
handler would run that on the event loop and stall every other request the
instance is serving.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Response, status

from app.api.schemas import (
    CreateRunRequest,
    CreateRunResponse,
    FinalizeTaskRequest,
    InvestigateTaskRequest,
    MatchView,
    RunMatchesResponse,
    RunStatusResponse,
    ScoutTaskRequest,
    TaskAck,
)
from app.investigator import firestore_store, market_scout, opportunity_matcher
from app.investigator import run_orchestrator as orchestrator
from app.investigator.models import TERMINAL_RUN_STATUSES, OpportunityMatch, RunStatus

router = APIRouter(tags=["production"])


def _require_task_caller(task_name: str | None) -> None:
    if not task_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Internal task endpoint",
        )


def _retry_count(header_value: str | None) -> int:
    try:
        return int(header_value or "0")
    except ValueError:
        return 0


# ---------------------------------------------------------------------------
# Public product API
# ---------------------------------------------------------------------------


@router.post("/runs", status_code=status.HTTP_202_ACCEPTED, response_model=CreateRunResponse)
def create_run(request: CreateRunRequest) -> CreateRunResponse:
    if request.vertical is not None and request.vertical != market_scout.VERTICAL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Market Scout V1 is frozen to vertical {market_scout.VERTICAL!r}; "
                f"got {request.vertical!r}"
            ),
        )
    if request.geography is not None and request.geography != market_scout.GEOGRAPHY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Market Scout V1 is frozen to geography {market_scout.GEOGRAPHY!r}; "
                f"got {request.geography!r}"
            ),
        )

    capabilities = request.provider_capabilities or market_scout.DEFAULT_PROVIDER_CAPABILITIES

    try:
        run = orchestrator.create_run(
            vertical=market_scout.VERTICAL,
            geography=market_scout.GEOGRAPHY,
            provider_capabilities=list(capabilities),
        )
    except Exception as exc:
        # The Run was already rewritten as FAILED by the orchestrator, so it
        # never appears successfully queued with no task behind it.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to enqueue discovery task: {exc}",
        ) from exc

    return CreateRunResponse(
        run_id=run.run_id, status=run.status.value, created_at=run.created_at
    )


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
def get_run(run_id: str) -> RunStatusResponse:
    doc = firestore_store.get_run(run_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    progress = orchestrator.run_progress(run_id)
    run_status = doc.get("status", RunStatus.CREATED.value)

    return RunStatusResponse(
        run_id=doc["run_id"],
        status=run_status,
        vertical=doc.get("vertical", ""),
        geography=doc.get("geography", ""),
        provider_capabilities=doc.get("provider_capabilities") or [],
        created_at=doc.get("created_at", ""),
        started_at=doc.get("started_at"),
        completed_at=doc.get("completed_at"),
        failure_message=doc.get("failure_message"),
        businesses_total=doc.get("businesses_total"),
        discovery_queries=doc.get("discovery_queries"),
        discovery_raw_candidate_count=doc.get("discovery_raw_candidate_count"),
        investigation_count=doc.get("investigation_count"),
        completed_investigation_count=doc.get("completed_investigation_count"),
        failed_investigation_count=doc.get("failed_investigation_count"),
        is_terminal=run_status in {s.value for s in TERMINAL_RUN_STATUSES},
        **progress,
    )


@router.get("/runs/{run_id}/matches", response_model=RunMatchesResponse)
def get_run_matches(run_id: str) -> RunMatchesResponse:
    run_doc = firestore_store.get_run(run_id)
    if run_doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    match_docs = firestore_store.list_matches_for_run(run_id)
    matches = [OpportunityMatch(**doc) for doc in match_docs]

    businesses: dict[str, dict] = {}
    for business_id in {m.business_id for m in matches}:
        business = firestore_store.get_business(business_id)
        if business is not None:
            businesses[business_id] = business

    views = [
        MatchView(
            **m.model_dump(mode="json"),
            business_display_name=businesses.get(m.business_id, {}).get("display_name"),
            business_website_url=businesses.get(m.business_id, {}).get("website_url"),
        )
        for m in matches
    ]
    views.sort(
        key=lambda v: (
            v.match_status,
            (v.business_display_name or "").lower(),
            v.opportunity_id,
        )
    )

    return RunMatchesResponse(
        run_id=run_id,
        status=run_doc.get("status", RunStatus.CREATED.value),
        summary=opportunity_matcher.summarize_matches(matches),
        matches=views,
    )


# ---------------------------------------------------------------------------
# Internal Cloud Tasks handlers
# ---------------------------------------------------------------------------


@router.post("/tasks/scout", response_model=TaskAck)
def task_scout(
    request: ScoutTaskRequest,
    response: Response,
    x_cloudtasks_taskname: str | None = Header(default=None),
    x_cloudtasks_taskretrycount: str | None = Header(default=None),
) -> TaskAck:
    _require_task_caller(x_cloudtasks_taskname)
    try:
        result = orchestrator.scout_step(
            request.run_id, retry_count=_retry_count(x_cloudtasks_taskretrycount)
        )
    except orchestrator.RunNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except orchestrator.TaskNotReady as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    response.status_code = status.HTTP_200_OK
    return TaskAck(status=result["status"], detail=result)


@router.post("/tasks/investigate", response_model=TaskAck)
def task_investigate(
    request: InvestigateTaskRequest,
    response: Response,
    x_cloudtasks_taskname: str | None = Header(default=None),
) -> TaskAck:
    _require_task_caller(x_cloudtasks_taskname)
    try:
        result = orchestrator.investigate_step(
            request.run_id, request.investigation_id, request.business_id
        )
    except orchestrator.RunNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except orchestrator.TaskNotReady as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    response.status_code = status.HTTP_200_OK
    return TaskAck(status=result["status"], detail=result)


@router.post("/tasks/finalize", response_model=TaskAck)
def task_finalize(
    request: FinalizeTaskRequest,
    response: Response,
    x_cloudtasks_taskname: str | None = Header(default=None),
) -> TaskAck:
    _require_task_caller(x_cloudtasks_taskname)
    try:
        result = orchestrator.finalize_step(request.run_id)
    except orchestrator.RunNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except orchestrator.TaskNotReady as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    response.status_code = status.HTTP_200_OK
    return TaskAck(status=result["status"], detail=result)
