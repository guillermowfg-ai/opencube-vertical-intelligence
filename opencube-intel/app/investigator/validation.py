"""Deterministic assembly + validation of Gemini output into domain models.

No regex heuristics that try to judge whether prose "is interpretive" —
the evidence/inference guarantee comes from architecture (bounded source
material, a constrained prompt, schema validation) plus the reference-
integrity checks enforced here and in `models.py`'s Pydantic validators.
"""

from __future__ import annotations

import uuid

from app.investigator.gemini_reasoner import GeminiHypothesisEvaluation
from app.investigator.models import (
    Evidence,
    OpportunityDefinition,
    OpportunityHypothesis,
)
from app.investigator.source_adapter import SourceMaterial
from app.investigator.verification_reasoner import GeminiVerificationEvaluation


class AssemblyError(ValueError):
    """Raised when Gemini output cannot be safely assembled into domain models."""


def assign_evidence_records(
    evaluation: GeminiHypothesisEvaluation,
    sources: list[SourceMaterial],
    *,
    run_id: str,
    business_id: str,
    investigation_id: str,
    collected_by: str,
) -> list[Evidence]:
    """Turn Gemini's evidence items into persisted Evidence records.

    Every item's source_url must match a URL actually fetched by the
    retrieval layer (already checked once in gemini_reasoner, re-checked
    here as the deterministic gate before persistence).
    """
    sources_by_url = {s.source_url: s for s in sources}
    records: list[Evidence] = []
    for item in evaluation.evidence:
        source = sources_by_url.get(item.source_url)
        if source is None:
            raise AssemblyError(
                f"Evidence cites unknown source_url: {item.source_url!r}"
            )
        records.append(
            Evidence(
                evidence_id=str(uuid.uuid4()),
                run_id=run_id,
                business_id=business_id,
                investigation_id=investigation_id,
                source_url=source.source_url,
                source_type=source.source_type,
                observation=item.observation,
                retrieved_at=source.retrieved_at,
                collected_by=collected_by,
            )
        )
    return records


def build_hypothesis(
    evaluation: GeminiHypothesisEvaluation,
    evidence_records: list[Evidence],
    definition: OpportunityDefinition,
    *,
    run_id: str,
    business_id: str,
    investigation_id: str,
) -> OpportunityHypothesis:
    """Map Gemini's index-based evidence references to persisted evidence_ids."""

    def _resolve(indices: list[int]) -> list[str]:
        resolved: list[str] = []
        for i in indices:
            if not 0 <= i < len(evidence_records):
                raise AssemblyError(f"Evidence index out of range: {i}")
            resolved.append(evidence_records[i].evidence_id)
        return resolved

    return OpportunityHypothesis(
        hypothesis_id=str(uuid.uuid4()),
        run_id=run_id,
        business_id=business_id,
        investigation_id=investigation_id,
        opportunity_id=definition.opportunity_id,
        opportunity_type=definition.opportunity_type,
        statement=definition.description,
        supporting_evidence_ids=_resolve(evaluation.supporting_evidence_indices),
        contradicting_evidence_ids=_resolve(evaluation.contradicting_evidence_indices),
        confidence=evaluation.confidence,
        status=evaluation.status,
    )


def assign_verification_evidence_records(
    evaluation: GeminiVerificationEvaluation,
    independent_sources: list[SourceMaterial],
    *,
    run_id: str,
    business_id: str,
    investigation_id: str,
    collected_by: str,
) -> list[Evidence]:
    """Verification Loop equivalent of assign_evidence_records above: every
    item's source_url must match a URL actually fetched by
    resolve_and_fetch_independent_source (already checked once in
    verification_reasoner, re-checked here as the deterministic gate before
    persistence). Reuses the canonical Evidence model -- no parallel
    VerificationEvidence type.
    """
    sources_by_url = {s.source_url: s for s in independent_sources}
    records: list[Evidence] = []
    for item in evaluation.evidence:
        source = sources_by_url.get(item.source_url)
        if source is None:
            raise AssemblyError(
                f"Verification evidence cites unknown source_url: {item.source_url!r}"
            )
        records.append(
            Evidence(
                evidence_id=str(uuid.uuid4()),
                run_id=run_id,
                business_id=business_id,
                investigation_id=investigation_id,
                source_url=source.source_url,
                source_type=source.source_type,
                observation=item.observation,
                retrieved_at=source.retrieved_at,
                collected_by=collected_by,
            )
        )
    return records
