/**
 * Mirrors `app/api/read_schemas.py` and `app/api/schemas.py`.
 *
 * These are transport shapes, not a second domain model. The frontend never
 * recomputes a status, a match, or a count — the backend is the source of
 * truth for every analytical field here (DECISIONS.md #1, #21, #34).
 */

export type RunStatus =
  | "CREATED"
  | "QUEUED"
  | "DISCOVERING"
  | "INVESTIGATING"
  | "FINALIZING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

export type InvestigationStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type OpportunityStatus =
  | "UNVERIFIED"
  | "CONFIRMED"
  | "CONTRADICTED"
  | "INSUFFICIENT_EVIDENCE";

export type VerificationOutcome =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "INSUFFICIENT_EVIDENCE";

export type VerificationExecutionStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

/** The Matcher's own six states, plus IN_PROGRESS for a run still in flight. */
export type VerificationState =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "INSUFFICIENT_EVIDENCE"
  | "NO_INDEPENDENT_SOURCE"
  | "FAILED"
  | "IN_PROGRESS"
  | "NONE"
  | "UNKNOWN";

export type MatchStatus = "MATCHED" | "NOT_MATCHED" | "UNRESOLVED";

export type EvidenceRole = "SUPPORTING" | "CONTRADICTING" | "INDEPENDENT";

export interface LabelledCount {
  key: string;
  label: string;
  count: number;
}

export interface RunSummary {
  run_id: string;
  status: RunStatus;
  is_terminal: boolean;
  vertical: string;
  geography: string;

  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failure_message: string | null;

  businesses_total: number | null;
  discovery_raw_candidate_count: number | null;

  investigations_total: number;
  investigations_completed: number;
  investigations_failed: number;
  investigations_in_progress: number;

  hypotheses_total: number;
  verifications_total: number;
  verifications_completed: number;

  matches_total: number;
  matches_matched: number;
  matches_not_matched: number;
  matches_unresolved: number;

  investigation_count: number | null;
  completed_investigation_count: number | null;
  failed_investigation_count: number | null;
}

export interface RunListResponse {
  runs: RunSummary[];
  total: number;
  truncated: boolean;
}

/** `GET /runs/{run_id}` — the accepted production route. */
export interface RunStatusResponse {
  run_id: string;
  status: RunStatus;
  vertical: string;
  geography: string;
  provider_capabilities: string[];

  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failure_message: string | null;

  businesses_total: number | null;

  investigations_total: number;
  investigations_completed: number;
  investigations_failed: number;
  investigations_in_progress: number;
  hypotheses_total: number;
  verifications_total: number;
  verifications_completed: number;
  matches_total: number;

  discovery_queries: string[] | null;
  discovery_raw_candidate_count: number | null;

  investigation_count: number | null;
  completed_investigation_count: number | null;
  failed_investigation_count: number | null;

  is_terminal: boolean;
}

export interface MatchRow {
  match_id: string;
  run_id: string;
  hypothesis_id: string;
  business_id: string;
  business_display_name: string | null;
  business_website_url: string | null;
  investigation_id: string;
  verification_id: string | null;

  opportunity_id: string;
  opportunity_name: string | null;
  opportunity_type: string | null;

  original_status: OpportunityStatus;
  verification_execution_status: VerificationExecutionStatus | null;
  verification_outcome: VerificationOutcome | null;
  no_independent_source_found: boolean | null;

  match_status: MatchStatus;
  reason_code: string;
  reasoning: string;

  primary_capability_id: string | null;
  primary_capability_label: string | null;
  supporting_capability_ids: string[];

  source_hypothesis_evidence_ids: string[];
  source_verification_evidence_ids: string[];
  created_at: string;
}

export interface MatchListResponse {
  matches: MatchRow[];
  total: number;
  truncated: boolean;
}

export interface OverviewKpis {
  runs_total: number;
  runs_completed: number;
  runs_active: number;
  businesses_discovered: number;
  businesses_investigated: number;
  evidence_total: number;
  hypotheses_total: number;
  verifications_completed: number;
  matches_total: number;
  matches_matched: number;
  review_needed: number;
}

export interface OverviewResponse {
  generated_at: string;
  kpis: OverviewKpis;
  hypothesis_status_counts: LabelledCount[];
  verification_state_counts: LabelledCount[];
  match_status_counts: LabelledCount[];
  matched_capability_counts: LabelledCount[];
  opportunity_counts: LabelledCount[];
  recent_runs: RunSummary[];
  highlighted_matches: MatchRow[];
  truncated: boolean;
}

export interface BusinessRow {
  business_id: string;
  display_name: string;
  formatted_address: string | null;
  website_url: string | null;
  phone_number: string | null;
  maps_url: string | null;

  investigation_id: string;
  investigation_status: InvestigationStatus;
  investigation_created_at: string | null;
  investigation_completed_at: string | null;
  source_count: number;
  evidence_count: number;

  hypotheses_total: number;
  hypothesis_status_counts: LabelledCount[];
  verifications_total: number;

  matches_total: number;
  matches_matched: number;
  matches_not_matched: number;
  matches_unresolved: number;
  matched_capability_ids: string[];
}

export interface RunBusinessesResponse {
  run_id: string;
  status: RunStatus;
  businesses: BusinessRow[];
}

export interface EvidenceItem {
  evidence_id: string;
  source_url: string;
  source_type: string;
  observation: string;
  retrieved_at: string;
  collected_by: string;
  role: EvidenceRole;
}

export interface Hypothesis {
  hypothesis_id: string;
  run_id: string;
  business_id: string;
  investigation_id: string;
  opportunity_id: string;
  opportunity_type: string;
  statement: string;
  confidence: number;
  status: OpportunityStatus;
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
}

export interface RejectedSource {
  url: string;
  reason: string;
}

export interface Verification {
  verification_id: string;
  hypothesis_id: string;
  original_status: OpportunityStatus;
  verification_target: string;
  execution_status: VerificationExecutionStatus;
  outcome: VerificationOutcome | null;
  no_independent_source_found: boolean;
  independent_sources_fetched: number;
  requested_search_query: string | null;
  executed_search_queries: string[];
  candidate_source_urls: string[];
  rejected_sources: RejectedSource[];
  reasoning: string | null;
  confidence: number | null;
  created_at: string;
  completed_at: string | null;
  failure_reason: string | null;
}

export interface OpportunityDefinition {
  opportunity_id: string;
  name: string;
  opportunity_type: string;
  description: string;
  provider_capability: string;
  publicly_observable: boolean;
  requires_independent_verification: boolean;
  evidence_signals: string[];
  contradiction_signals: string[];
}

export interface BusinessIdentity {
  business_id: string;
  display_name: string;
  formatted_address: string | null;
  website_url: string | null;
  phone_number: string | null;
  maps_url: string | null;
  place_id: string | null;
}

export interface Capability {
  capability_id: string;
  label: string;
}

export interface RunRef {
  run_id: string;
  status: RunStatus;
  vertical: string;
  geography: string;
  created_at: string;
}

export interface MatchDetail {
  match: MatchRow;
  run: RunRef | null;
  business: BusinessIdentity | null;
  opportunity: OpportunityDefinition | null;
  primary_capability: Capability | null;
  supporting_capabilities: Capability[];
  hypothesis: Hypothesis | null;
  verification: Verification | null;
  hypothesis_evidence: EvidenceItem[];
  verification_evidence: EvidenceItem[];
}

export interface BusinessAggregate {
  business_id: string;
  display_name: string;
  formatted_address: string | null;
  website_url: string | null;
  phone_number: string | null;
  maps_url: string | null;

  runs_total: number;
  investigations_total: number;
  investigations_completed: number;
  last_investigated_at: string | null;

  hypotheses_total: number;
  matches_total: number;
  matches_matched: number;
  matches_unresolved: number;
  latest_run_id: string | null;
}

export interface BusinessListResponse {
  businesses: BusinessAggregate[];
  total: number;
  truncated: boolean;
}

/** Exactly what `POST /runs` accepts, published by the back end so the UI
 * never renders a control the API would reject. */
export interface ExecutionParameters {
  vertical: string;
  vertical_locked: boolean;
  geography: string;
  geography_locked: boolean;
  target_business_count: number;
  target_business_count_locked: boolean;
  provider_capabilities_editable: boolean;
  provider_capabilities_max: number;
  /** False today: the value is recorded on the task but no engine reads it. */
  provider_capabilities_affect_analysis: boolean;
}

export interface CatalogResponse {
  vertical: string;
  geography: string;
  default_provider_capabilities: string[];
  execution: ExecutionParameters;
  evaluated_opportunity_ids: string[];
  opportunities: OpportunityDefinition[];
  capabilities: Capability[];
}

/** `POST /runs` -- the product's only write. */
export interface CreateTaskRequest {
  provider_capabilities?: string[];
}

export interface CreateTaskResponse {
  run_id: string;
  status: RunStatus;
  created_at: string;
}
