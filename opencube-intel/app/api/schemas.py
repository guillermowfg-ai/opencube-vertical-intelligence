"""Request/response contracts for the production API.

Every request model forbids extra fields: a typo in a client payload should
be a loud 422, not a silently ignored field that changes nothing.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateRunRequest(_StrictModel):
    """Market Scout V1 is frozen to one vertical and one geography, with
    hardcoded submarket queries and a hardcoded county filter. Accepting a
    different value would silently produce nonsense, so a mismatch is a 422
    rather than a best-effort run. Omitting a field selects the frozen default.

    There is deliberately no target_business_count: the ~10-business scale is
    a cost guardrail, not a client-tunable parameter.
    """

    vertical: str | None = None
    geography: str | None = None
    provider_capabilities: list[str] | None = Field(default=None, max_length=20)


class CreateRunResponse(BaseModel):
    run_id: str
    status: str
    created_at: str


class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    vertical: str
    geography: str
    provider_capabilities: list[str]

    created_at: str
    started_at: str | None
    completed_at: str | None
    failure_message: str | None

    businesses_total: int | None

    # Derived at read time (see run_orchestrator.run_progress), never stored.
    investigations_total: int
    investigations_completed: int
    investigations_failed: int
    investigations_in_progress: int
    hypotheses_total: int
    verifications_total: int
    verifications_completed: int
    matches_total: int

    discovery_queries: list[str] | None
    discovery_raw_candidate_count: int | None

    # Persisted finalize_run() output — authoritative, but null until the
    # Run reaches a terminal state.
    investigation_count: int | None
    completed_investigation_count: int | None
    failed_investigation_count: int | None

    is_terminal: bool


class MatchView(BaseModel):
    """One OpportunityMatch plus the business identity a UI needs to render
    it. Evidence IDs are included for provenance; Evidence bodies are not."""

    match_id: str
    hypothesis_id: str
    business_id: str
    business_display_name: str | None
    business_website_url: str | None
    investigation_id: str
    verification_id: str | None
    opportunity_id: str
    original_status: str
    verification_execution_status: str | None
    verification_outcome: str | None
    no_independent_source_found: bool | None
    match_status: str
    reason_code: str
    reasoning: str
    primary_capability_id: str | None
    supporting_capability_ids: list[str]
    source_hypothesis_evidence_ids: list[str]
    source_verification_evidence_ids: list[str]
    created_at: str


class RunMatchesResponse(BaseModel):
    run_id: str
    status: str
    summary: dict
    matches: list[MatchView]


class ScoutTaskRequest(_StrictModel):
    run_id: str


class InvestigateTaskRequest(_StrictModel):
    run_id: str
    investigation_id: str
    business_id: str


class FinalizeTaskRequest(_StrictModel):
    run_id: str


class TaskAck(BaseModel):
    status: str
    detail: dict | None = None
