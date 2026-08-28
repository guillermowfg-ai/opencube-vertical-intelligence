"""Read-only view contracts for the OpenCube Intel frontend.

Strictly additive to `app/api/schemas.py`. Nothing here introduces a new
persisted shape, a new analytical field, or a new interpretation: every view
is a projection of documents the accepted milestones already write, plus
labels resolved from the two declarative catalogs
(`catalog.MED_SPA_CATALOG`, `capability_catalog.CAPABILITIES`).

The accepted `MatchView` is deliberately left untouched. `MatchRowView`
below is its superset for list screens — it adds `run_id`, which the
frontend needs to link a match back to its run and which `MatchView` never
carried because it was only ever served from a run-scoped route.
"""

from __future__ import annotations

from pydantic import BaseModel


class RunSummaryView(BaseModel):
    """One Run plus the progress counts a list screen needs.

    Counts are derived at read time from the same collections
    `run_orchestrator.run_progress` queries (DECISIONS.md #24 — progress is
    never a stored counter). `investigation_count` /
    `completed_investigation_count` / `failed_investigation_count` are the
    persisted `finalize_run` outputs and stay null until the Run is terminal;
    the `investigations_*` fields are always populated.
    """

    run_id: str
    status: str
    is_terminal: bool
    vertical: str
    geography: str

    created_at: str
    started_at: str | None
    completed_at: str | None
    failure_message: str | None

    businesses_total: int | None
    discovery_raw_candidate_count: int | None

    investigations_total: int
    investigations_completed: int
    investigations_failed: int
    investigations_in_progress: int

    hypotheses_total: int
    verifications_total: int
    verifications_completed: int

    matches_total: int
    matches_matched: int
    matches_not_matched: int
    matches_unresolved: int

    investigation_count: int | None
    completed_investigation_count: int | None
    failed_investigation_count: int | None


class RunListResponse(BaseModel):
    runs: list[RunSummaryView]
    total: int
    truncated: bool


class CapabilityView(BaseModel):
    capability_id: str
    label: str


class LabelledCount(BaseModel):
    key: str
    label: str
    count: int


class OverviewKpis(BaseModel):
    runs_total: int
    runs_completed: int
    runs_active: int
    businesses_discovered: int
    businesses_investigated: int
    # Investigator evidence only — the sum of `Investigation.evidence_count`.
    # Verification Loop evidence shares the same canonical collection
    # (DECISIONS.md #14) and is deliberately NOT folded in here: the two have
    # different provenance, and counting them together would be the exact
    # conflation that decision forbids. Counting all evidence would also make
    # this route scale with the fastest-growing collection in the system.
    evidence_total: int
    hypotheses_total: int
    verifications_completed: int
    matches_total: int
    matches_matched: int
    review_needed: int


class OverviewResponse(BaseModel):
    generated_at: str
    kpis: OverviewKpis
    hypothesis_status_counts: list[LabelledCount]
    verification_state_counts: list[LabelledCount]
    match_status_counts: list[LabelledCount]
    matched_capability_counts: list[LabelledCount]
    opportunity_counts: list[LabelledCount]
    recent_runs: list[RunSummaryView]
    highlighted_matches: list[MatchRowView]
    # How many runs were left out of every aggregate above because they never
    # reached a terminal state. Reported rather than hidden: a dashboard that
    # silently drops records is as misleading as one that miscounts them.
    active_runs_excluded: int
    truncated: bool


class MatchRowView(BaseModel):
    """`MatchView` plus `run_id` and the resolved catalog labels a list
    screen renders. No analytical field is recomputed here."""

    match_id: str
    run_id: str
    hypothesis_id: str
    business_id: str
    business_display_name: str | None
    business_website_url: str | None
    investigation_id: str
    verification_id: str | None

    opportunity_id: str
    opportunity_name: str | None
    opportunity_type: str | None

    original_status: str
    verification_execution_status: str | None
    verification_outcome: str | None
    no_independent_source_found: bool | None

    match_status: str
    reason_code: str
    reasoning: str

    primary_capability_id: str | None
    primary_capability_label: str | None
    supporting_capability_ids: list[str]

    source_hypothesis_evidence_ids: list[str]
    source_verification_evidence_ids: list[str]
    created_at: str


class MatchListResponse(BaseModel):
    matches: list[MatchRowView]
    total: int
    truncated: bool


class EvidenceView(BaseModel):
    """A persisted Evidence document plus its role in this hypothesis.

    `role` is not stored and is not a judgement: it is read directly off the
    hypothesis's own `supporting_evidence_ids` / `contradicting_evidence_ids`
    lists, or set to INDEPENDENT for Verification evidence.
    """

    evidence_id: str
    source_url: str
    source_type: str
    observation: str
    retrieved_at: str
    collected_by: str
    role: str


class HypothesisView(BaseModel):
    hypothesis_id: str
    run_id: str
    business_id: str
    investigation_id: str
    opportunity_id: str
    opportunity_type: str
    statement: str
    confidence: float
    status: str
    supporting_evidence_ids: list[str]
    contradicting_evidence_ids: list[str]


class RejectedSourceView(BaseModel):
    url: str
    reason: str


class VerificationView(BaseModel):
    verification_id: str
    hypothesis_id: str
    original_status: str
    verification_target: str
    execution_status: str
    outcome: str | None
    no_independent_source_found: bool
    independent_sources_fetched: int
    requested_search_query: str | None
    executed_search_queries: list[str]
    candidate_source_urls: list[str]
    rejected_sources: list[RejectedSourceView]
    reasoning: str | None
    confidence: float | None
    created_at: str
    completed_at: str | None
    failure_reason: str | None


class OpportunityDefinitionView(BaseModel):
    opportunity_id: str
    name: str
    opportunity_type: str
    description: str
    provider_capability: str
    publicly_observable: bool
    requires_independent_verification: bool
    evidence_signals: list[str]
    contradiction_signals: list[str]


class BusinessView(BaseModel):
    business_id: str
    display_name: str
    formatted_address: str | None
    website_url: str | None
    phone_number: str | None
    maps_url: str | None
    place_id: str | None


class RunRefView(BaseModel):
    run_id: str
    status: str
    vertical: str
    geography: str
    created_at: str


class MatchDetailResponse(BaseModel):
    """Everything the Opportunity Detail screen needs to make one match
    auditable, assembled from already-persisted documents only."""

    match: MatchRowView
    run: RunRefView | None
    business: BusinessView | None
    opportunity: OpportunityDefinitionView | None
    primary_capability: CapabilityView | None
    supporting_capabilities: list[CapabilityView]
    hypothesis: HypothesisView | None
    verification: VerificationView | None
    hypothesis_evidence: list[EvidenceView]
    verification_evidence: list[EvidenceView]


class BusinessRowView(BaseModel):
    """One investigated business inside one run."""

    business_id: str
    display_name: str
    formatted_address: str | None
    website_url: str | None
    phone_number: str | None
    maps_url: str | None

    investigation_id: str
    investigation_status: str
    investigation_created_at: str | None
    investigation_completed_at: str | None
    source_count: int
    evidence_count: int

    hypotheses_total: int
    hypothesis_status_counts: list[LabelledCount]
    verifications_total: int

    matches_total: int
    matches_matched: int
    matches_not_matched: int
    matches_unresolved: int
    matched_capability_ids: list[str]


class RunBusinessesResponse(BaseModel):
    run_id: str
    status: str
    businesses: list[BusinessRowView]


class BusinessAggregateView(BaseModel):
    """One canonical Business across every run it appears in.

    `Business` intentionally carries no run_id (DECISIONS.md), so the run
    linkage here is derived through Investigation records, never stored.
    """

    business_id: str
    display_name: str
    formatted_address: str | None
    website_url: str | None
    phone_number: str | None
    maps_url: str | None

    runs_total: int
    investigations_total: int
    investigations_completed: int
    last_investigated_at: str | None

    hypotheses_total: int
    matches_total: int
    matches_matched: int
    matches_unresolved: int
    latest_run_id: str | None


class BusinessListResponse(BaseModel):
    businesses: list[BusinessAggregateView]
    total: int
    truncated: bool


class ExecutionParameters(BaseModel):
    """Exactly what `POST /runs` accepts, published so the UI never has to
    guess and never renders a control the API would reject.

    Market Scout V1 is frozen to one vertical and one geography — a mismatch
    is a 422, not a best-effort run — and there is deliberately no
    `target_business_count` field at all: the ~10-business scale is a cost
    guardrail, not a client-tunable parameter (`CreateRunRequest`).

    `provider_capabilities` is the one value a caller can genuinely set. It is
    persisted on the Run and returned by `GET /runs/{id}`, but no analytical
    engine reads it: `grep provider_capabilities app/` reaches only
    `run_orchestrator.create_run` and the `Run` model. It records which
    OpenCube services a task was run on behalf of; it does not change what is
    analysed. `provider_capabilities_affect_analysis` says so, so the UI can
    label it honestly instead of implying it steers the work.
    """

    vertical: str
    vertical_locked: bool
    geography: str
    geography_locked: bool
    target_business_count: int
    target_business_count_locked: bool
    provider_capabilities_editable: bool
    provider_capabilities_max: int
    provider_capabilities_affect_analysis: bool


class CatalogResponse(BaseModel):
    """The two declarative catalogs, served so the UI renders the same
    vocabulary the pipeline reasons over instead of hardcoding its own."""

    vertical: str
    geography: str
    default_provider_capabilities: list[str]
    execution: ExecutionParameters
    evaluated_opportunity_ids: list[str]
    opportunities: list[OpportunityDefinitionView]
    capabilities: list[CapabilityView]


OverviewResponse.model_rebuild()
