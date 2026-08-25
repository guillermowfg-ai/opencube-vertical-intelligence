"""Typed domain models for the Business Investigator.

Evidence and inference are kept as structurally distinct model families
(see DECISIONS.md #4): `Evidence` carries only factual observations,
`OpportunityHypothesis` carries interpretation and is always traceable
back to the Evidence records that support or contradict it.
"""

from __future__ import annotations

import enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class RunStatus(enum.StrEnum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class InvestigationStatus(enum.StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class OpportunityType(enum.StrEnum):
    PAIN = "PAIN"
    CAPABILITY_GAP = "CAPABILITY_GAP"
    COST_OPTIMIZATION = "COST_OPTIMIZATION"


class OpportunityStatus(enum.StrEnum):
    UNVERIFIED = "UNVERIFIED"
    CONFIRMED = "CONFIRMED"
    CONTRADICTED = "CONTRADICTED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class SourceType(enum.StrEnum):
    WEBSITE = "WEBSITE"
    PLACES = "PLACES"


class ContactRecommendation(enum.StrEnum):
    DO_NOT_CONTACT = "DO_NOT_CONTACT"
    HUMAN_REVIEW = "HUMAN_REVIEW"


class Run(BaseModel):
    run_id: str
    created_at: str
    status: RunStatus = RunStatus.CREATED
    vertical: str
    geography: str
    provider_capabilities: list[str] = Field(default_factory=list)

    # Optional Market Scout discovery metadata (reproducibility). Left
    # optional so pre-existing persisted Run documents without these fields
    # remain readable.
    discovery_queries: list[str] | None = None
    discovery_raw_candidate_count: int | None = None

    # Optional run-lifecycle bookkeeping, populated once all of the Run's
    # Investigations reach a terminal InvestigationStatus. Optional for the
    # same backward-compatibility reason as the discovery fields above.
    investigation_count: int | None = None
    completed_investigation_count: int | None = None
    failed_investigation_count: int | None = None


class Business(BaseModel):
    """Canonical, reusable business record.

    Intentionally carries no `run_id`: the same business may be
    investigated across multiple runs without being recreated.
    """

    business_id: str
    display_name: str
    formatted_address: str | None = None
    website_url: str | None = None
    place_id: str | None = None
    phone_number: str | None = None
    maps_url: str | None = None


class Investigation(BaseModel):
    """The bridge between a reusable Business and a run-specific analysis."""

    investigation_id: str
    run_id: str
    business_id: str
    created_at: str
    completed_at: str | None = None
    status: InvestigationStatus = InvestigationStatus.IN_PROGRESS
    source_count: int = 0
    evidence_count: int = 0


class Evidence(BaseModel):
    """A factual, source-attributed observation. Never an interpretation."""

    evidence_id: str
    run_id: str
    business_id: str
    investigation_id: str
    source_url: str
    source_type: SourceType
    observation: str
    retrieved_at: str
    collected_by: str

    @model_validator(mode="after")
    def _non_empty_observation(self) -> Evidence:
        if not self.observation or not self.observation.strip():
            raise ValueError("Evidence.observation must be non-empty")
        if not self.source_url or not self.source_url.strip():
            raise ValueError("Evidence.source_url must be non-empty")
        return self


class OpportunityDefinition(BaseModel):
    """A declarative, catalog-sourced definition of a commercial opportunity.

    Gemini evaluates only definitions supplied from this catalog — it does
    not invent opportunity categories.
    """

    opportunity_id: str
    opportunity_type: OpportunityType
    name: str
    provider_capability: str
    description: str
    publicly_observable: bool
    evidence_signals: list[str]
    contradiction_signals: list[str]
    claims_not_allowed_without_evidence: list[str]
    requires_independent_verification: bool = False


class OpportunityHypothesis(BaseModel):
    hypothesis_id: str
    run_id: str
    business_id: str
    investigation_id: str
    opportunity_id: str
    opportunity_type: OpportunityType
    statement: str
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    contradicting_evidence_ids: list[str] = Field(default_factory=list)
    confidence: float
    status: OpportunityStatus

    @model_validator(mode="after")
    def _no_duplicate_refs(self) -> OpportunityHypothesis:
        for name in ("supporting_evidence_ids", "contradicting_evidence_ids"):
            ids = getattr(self, name)
            if len(ids) != len(set(ids)):
                raise ValueError(f"OpportunityHypothesis.{name} contains duplicates")
        overlap = set(self.supporting_evidence_ids) & set(self.contradicting_evidence_ids)
        if overlap:
            raise ValueError(
                f"Evidence IDs cannot both support and contradict: {overlap}"
            )
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be within [0.0, 1.0]")
        return self


class UsageMetadata(BaseModel):
    """Auditable Gemini invocation accounting. No pricing is hardcoded."""

    investigation_id: str
    # Optional: added so per-run token totals don't require an N+1 join
    # through Investigation. Optional so the three pre-existing V1 usage
    # documents that carry only investigation_id remain readable.
    run_id: str | None = None
    model: str
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    thought_tokens: int | None = None
    total_tokens: int | None = None
    timestamp: str
    invocation_id: str | None = None


class InvestigationResult(BaseModel):
    """The full auditable output of one investigation."""

    investigation: Investigation
    business: Business
    hypotheses: list[OpportunityHypothesis]
    evidence: list[Evidence]
    usage: list[UsageMetadata]
    contact_recommendation: ContactRecommendation
    contact_reason: str

    @model_validator(mode="after")
    def _reference_integrity(self) -> InvestigationResult:
        evidence_ids = {e.evidence_id for e in self.evidence}
        if len(evidence_ids) != len(self.evidence):
            raise ValueError("Duplicate evidence_id in InvestigationResult.evidence")
        hypothesis_ids = {h.hypothesis_id for h in self.hypotheses}
        if len(hypothesis_ids) != len(self.hypotheses):
            raise ValueError("Duplicate hypothesis_id in InvestigationResult.hypotheses")

        for e in self.evidence:
            if (
                e.run_id != self.investigation.run_id
                or e.business_id != self.investigation.business_id
                or e.investigation_id != self.investigation.investigation_id
            ):
                raise ValueError(
                    f"Evidence {e.evidence_id} run/business/investigation id mismatch"
                )

        for h in self.hypotheses:
            if (
                h.run_id != self.investigation.run_id
                or h.business_id != self.investigation.business_id
                or h.investigation_id != self.investigation.investigation_id
            ):
                raise ValueError(
                    f"Hypothesis {h.hypothesis_id} run/business/investigation id mismatch"
                )
            for ref in (*h.supporting_evidence_ids, *h.contradicting_evidence_ids):
                if ref not in evidence_ids:
                    raise ValueError(
                        f"Hypothesis {h.hypothesis_id} references unknown evidence {ref}"
                    )
        return self


def as_firestore_dict(model: BaseModel) -> dict[str, Any]:
    """Enum-safe, Firestore-writable dict for any model in this module."""
    return model.model_dump(mode="json")
