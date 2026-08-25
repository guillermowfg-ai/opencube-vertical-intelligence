"""Batch execution — a thin, disposable loop over the accepted Investigator.

On Day 27 this loop is replaced by Cloud Tasks dispatch (one task per
business); nothing inside the Investigator should have to change when that
happens. This module contains no investigation logic of its own — it only:

  1. creates and persists each business's run-linked Investigation record
     immediately after the Business is persisted and before any failable
     retrieval/reasoning work begins (implementation prompt section 3c);
  2. calls the accepted `run_investigation` once per business, sequentially;
  3. records per-business success/failure so one business's failure never
     aborts the Run;
  4. finalizes the Run once every Investigation is terminal.
"""

from __future__ import annotations

import dataclasses
import datetime
import uuid

from app.investigator import firestore_store
from app.investigator.investigator import finalize_run, run_investigation
from app.investigator.models import (
    Business,
    ContactRecommendation,
    Investigation,
    InvestigationResult,
    InvestigationStatus,
    OpportunityDefinition,
    OpportunityStatus,
    Run,
)


def _now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


@dataclasses.dataclass
class BusinessOutcome:
    business: Business
    investigation_id: str | None
    result: InvestigationResult | None
    error: str | None

    @property
    def succeeded(self) -> bool:
        return self.error is None and self.result is not None


@dataclasses.dataclass
class BatchResult:
    run: Run
    outcomes: list[BusinessOutcome]


def run_batch(
    run: Run,
    businesses: list[Business],
    definitions: list[OpportunityDefinition],
    *,
    persist: bool = True,
) -> BatchResult:
    """Invoke the accepted Investigator once per business, sequentially."""
    if persist:
        firestore_store.save_run(run)

    outcomes: list[BusinessOutcome] = []
    terminal_investigations: list[Investigation] = []

    for business in businesses:
        if persist:
            firestore_store.save_business(business)

        investigation = Investigation(
            investigation_id=str(uuid.uuid4()),
            run_id=run.run_id,
            business_id=business.business_id,
            created_at=_now(),
            status=InvestigationStatus.IN_PROGRESS,
        )

        try:
            if persist:
                firestore_store.save_investigation(investigation)
        except Exception as exc:  # Investigation-record creation itself failed.
            outcomes.append(
                BusinessOutcome(
                    business=business,
                    investigation_id=None,
                    result=None,
                    error=f"Investigation record creation failed: {exc}",
                )
            )
            terminal_investigations.append(
                investigation.model_copy(
                    update={"status": InvestigationStatus.FAILED, "completed_at": _now()}
                )
            )
            continue

        try:
            result = run_investigation(
                run,
                business,
                definitions,
                investigation=investigation,
                persist=persist,
            )
        except Exception as exc:  # Downstream technical failure.
            failed = investigation.model_copy(
                update={"status": InvestigationStatus.FAILED, "completed_at": _now()}
            )
            if persist:
                firestore_store.save_investigation(failed)
            outcomes.append(
                BusinessOutcome(
                    business=business,
                    investigation_id=investigation.investigation_id,
                    result=None,
                    error=str(exc),
                )
            )
            terminal_investigations.append(failed)
            continue

        outcomes.append(
            BusinessOutcome(
                business=business,
                investigation_id=investigation.investigation_id,
                result=result,
                error=None,
            )
        )
        terminal_investigations.append(result.investigation)

    finalize_run(run, terminal_investigations)
    if persist:
        firestore_store.save_run(run)

    return BatchResult(run=run, outcomes=outcomes)


def summarize_batch(batch: BatchResult) -> dict:
    """Compact aggregate intelligence summary (implementation prompt section
    10). Intelligence reporting only — no outreach, no ranking, no pricing.
    """
    completed = sum(1 for o in batch.outcomes if o.result is not None)
    failed = sum(1 for o in batch.outcomes if o.error is not None)

    hypothesis_status_counts = {status.value: 0 for status in OpportunityStatus}
    contact_recommendation_counts = {rec.value: 0 for rec in ContactRecommendation}
    gemini_invocations = 0
    total_tokens = 0

    for outcome in batch.outcomes:
        if outcome.result is None:
            continue
        for hypothesis in outcome.result.hypotheses:
            hypothesis_status_counts[hypothesis.status.value] += 1
        contact_recommendation_counts[outcome.result.contact_recommendation.value] += 1
        gemini_invocations += len(outcome.result.usage)
        total_tokens += sum(u.total_tokens or 0 for u in outcome.result.usage)

    return {
        "investigated": len(batch.outcomes),
        "completed": completed,
        "failed": failed,
        "hypothesis_status_counts": hypothesis_status_counts,
        "contact_recommendation_counts": contact_recommendation_counts,
        "gemini_invocations": gemini_invocations,
        "total_tokens": total_tokens,
    }
