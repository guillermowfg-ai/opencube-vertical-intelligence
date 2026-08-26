"""Deterministic, content-blind selection of which hypotheses V1 verifies.

Decided entirely from already-persisted hypothesis fields (status,
hypothesis_id) -- before any Verification result is known, and reproducibly
so the same input list always yields the same selection. Never chooses
based on which outcome looks interesting (implementation prompt section 20).
"""

from __future__ import annotations

from app.investigator.models import OpportunityHypothesis, OpportunityStatus

DEFAULT_SAMPLE_SIZE = 4


def select_hypotheses_for_verification(
    hypotheses: list[OpportunityHypothesis], *, sample_size: int = DEFAULT_SAMPLE_SIZE
) -> list[OpportunityHypothesis]:
    """ALL CONFIRMED, unconditionally, plus a deterministic fixed-size slice
    of CONTRADICTED and of INSUFFICIENT_EVIDENCE, ordered by hypothesis_id.
    """
    confirmed = [h for h in hypotheses if h.status == OpportunityStatus.CONFIRMED]
    contradicted = sorted(
        (h for h in hypotheses if h.status == OpportunityStatus.CONTRADICTED),
        key=lambda h: h.hypothesis_id,
    )[:sample_size]
    insufficient = sorted(
        (h for h in hypotheses if h.status == OpportunityStatus.INSUFFICIENT_EVIDENCE),
        key=lambda h: h.hypothesis_id,
    )[:sample_size]

    selected_ids: set[str] = set()
    selection: list[OpportunityHypothesis] = []
    for group in (confirmed, contradicted, insufficient):
        for h in group:
            if h.hypothesis_id not in selected_ids:
                selection.append(h)
                selected_ids.add(h.hypothesis_id)
    return selection
