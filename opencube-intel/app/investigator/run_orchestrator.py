"""Production Execution V1 — asynchronous orchestration of the accepted
analytical engines.

This module TRANSPORTS and CONTROLS execution. It never reinterprets an
analytical output. It calls, unmodified:

    market_scout.discover / select_for_investigation
    investigator.run_investigation      (one business, one task)
    verification_selection.select_hypotheses_for_verification
    verification_batch_runner.run_verification_batch
    opportunity_matcher.build_match / latest_verification_by_hypothesis
    investigator.finalize_run

Nothing here decides an OpportunityStatus, a VerificationOutcome, or a
MatchStatus, and nothing here writes a hypothesis or a verification directly.

Delivery model: Cloud Tasks is at-least-once, so every step is guarded by a
durable Firestore state check before any expensive work. There are no
Firestore transactions, no distributed locks, and no persisted progress
counters anywhere in this file — see `maybe_enqueue_finalize` for why none
are needed.
"""

from __future__ import annotations

import datetime
import uuid

from app.investigator import (
    firestore_store,
    investigator,
    market_scout,
    opportunity_matcher,
    tasks_client,
    verification_batch_runner,
    verification_selection,
)
from app.investigator.catalog import MED_SPA_CATALOG, get_evaluated_definitions
from app.investigator.models import (
    TERMINAL_RUN_STATUSES,
    Business,
    Investigation,
    InvestigationStatus,
    OpportunityHypothesis,
    Run,
    RunStatus,
    Verification,
)

TERMINAL_INVESTIGATION_STATUSES = frozenset(
    {InvestigationStatus.COMPLETED, InvestigationStatus.FAILED}
)
TERMINAL_VERIFICATION_EXECUTION_STATUSES = frozenset({"COMPLETED", "FAILED"})

# Cloud Tasks attempt index at which SCOUT stops asking for a retry and
# records a terminal failure instead. With queue maxAttempts=3 the header
# values seen are 0, 1, 2 — so 2 is the final attempt.
_SCOUT_FINAL_RETRY_COUNT = 2

_MAX_FAILURE_MESSAGE_CHARS = 500


class RunNotFound(LookupError):
    """The addressed Run or Investigation document does not exist. Permanent
    — the caller should answer 404 and Cloud Tasks should not retry."""


class TaskNotReady(RuntimeError):
    """The task arrived before its preconditions were durably true, or a
    recoverable infrastructure error occurred. The caller should answer 503
    so Cloud Tasks retries with backoff."""


def _now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def investigation_id_for(run_id: str, business_id: str) -> str:
    """Deterministic Investigation document ID.

    Deliberately not uuid4: a re-delivered SCOUT task must re-`set()` the
    same ten documents rather than create a second, orphaned set that would
    permanently break the `len(investigations) == businesses_total` readiness
    check. `business_id` is the Places place_id, which is document-ID safe.
    """
    return f"{run_id}__{business_id}"


def _load_run(run_id: str) -> Run:
    doc = firestore_store.get_run(run_id)
    if doc is None:
        raise RunNotFound(f"Run {run_id} not found")
    return Run(**doc)


def _truncate(message: str) -> str:
    return message[:_MAX_FAILURE_MESSAGE_CHARS]


# ---------------------------------------------------------------------------
# POST /runs
# ---------------------------------------------------------------------------


def create_run(
    *,
    vertical: str,
    geography: str,
    provider_capabilities: list[str],
) -> Run:
    """Persist a QUEUED Run and enqueue its SCOUT task.

    The Run is written before the enqueue so a crash between the two leaves a
    visible record; if the enqueue itself fails the Run is rewritten as FAILED
    so it never appears successfully queued with no task behind it.
    """
    now = _now()
    run = Run(
        run_id=str(uuid.uuid4()),
        created_at=now,
        started_at=now,
        status=RunStatus.QUEUED,
        vertical=vertical,
        geography=geography,
        provider_capabilities=list(provider_capabilities),
    )
    firestore_store.save_run(run)

    try:
        tasks_client.enqueue_scout(run.run_id)
    except Exception as exc:
        failed = run.model_copy(
            update={
                "status": RunStatus.FAILED,
                "failure_message": _truncate(f"Failed to enqueue discovery task: {exc}"),
                "completed_at": _now(),
            }
        )
        firestore_store.save_run(failed)
        raise

    return run


# ---------------------------------------------------------------------------
# SCOUT task
# ---------------------------------------------------------------------------


def _discover_and_persist(run: Run) -> tuple[Run, list[tuple[str, str]]]:
    """SCOUT phase A: discovery, canonical persistence, readiness barrier.

    Runs at most once per Run. Returns the updated Run and the deterministic
    dispatch set as (investigation_id, business_id) pairs.
    """
    run = run.model_copy(update={"status": RunStatus.DISCOVERING})
    firestore_store.save_run(run)

    discovery = market_scout.discover()
    selected = market_scout.select_for_investigation(
        discovery, target_count=market_scout.DEFAULT_TARGET_COUNT
    )

    dispatch_set: list[tuple[str, str]] = []
    for business in selected:
        firestore_store.save_business(business)
        investigation_id = investigation_id_for(run.run_id, business.business_id)
        firestore_store.save_investigation(
            Investigation(
                investigation_id=investigation_id,
                run_id=run.run_id,
                business_id=business.business_id,
                created_at=_now(),
                status=InvestigationStatus.IN_PROGRESS,
            )
        )
        dispatch_set.append((investigation_id, business.business_id))

    if not dispatch_set:
        run = run.model_copy(
            update={
                "businesses_total": 0,
                "discovery_queries": discovery.queries,
                "discovery_raw_candidate_count": discovery.raw_candidate_count,
                "status": RunStatus.FAILED,
                "failure_message": "Market Scout selected 0 eligible businesses",
                "completed_at": _now(),
            }
        )
        firestore_store.save_run(run)
        return run, []

    # The readiness barrier. This single write means "discovery and
    # Investigation pre-creation completed" — NOT "every business task was
    # dispatched". It must land before any business task is created so that
    # a worker which finishes fast can evaluate readiness correctly.
    run = run.model_copy(
        update={
            "businesses_total": len(dispatch_set),
            "discovery_queries": discovery.queries,
            "discovery_raw_candidate_count": discovery.raw_candidate_count,
            "status": RunStatus.INVESTIGATING,
        }
    )
    firestore_store.save_run(run)
    return run, dispatch_set


def _dispatch_set_from_persisted(run_id: str) -> list[tuple[str, str]]:
    """SCOUT replay: rebuild the dispatch set from already-persisted
    Investigations. Never re-discovers, never calls Places, never re-selects.
    """
    investigations = firestore_store.list_investigations_for_run(run_id)
    return sorted(
        (doc["investigation_id"], doc["business_id"]) for doc in investigations
    )


def _scout_failure(run: Run, exc: Exception, retry_count: int) -> dict:
    """Record a SCOUT failure. Ask for a retry until the final attempt, then
    make the Run terminally FAILED so it never hangs in DISCOVERING.

    Never rolls back discovery: persisted Businesses and Investigations stay,
    `businesses_total` is never reset, so the retry replays dispatch instead
    of re-running Places.
    """
    message = _truncate(f"Market Scout task failed: {exc}")
    if retry_count < _SCOUT_FINAL_RETRY_COUNT:
        firestore_store.save_run(run.model_copy(update={"failure_message": message}))
        raise TaskNotReady(message) from exc

    firestore_store.save_run(
        run.model_copy(
            update={
                "status": RunStatus.FAILED,
                "failure_message": message,
                "completed_at": _now(),
            }
        )
    )
    return {"status": "failed", "reason": message}


def scout_step(run_id: str, *, retry_count: int = 0) -> dict:
    """Discover businesses (once) and dispatch every business task (replayable).

    SCOUT has two logically separate phases and only the first is one-shot:

        A. discovery + canonical persistence + readiness barrier
        B. deterministic business-task dispatch

    `businesses_total is not None` proves phase A finished. It proves nothing
    about phase B — a first attempt can create three of ten tasks and then hit
    a transport error. So a retry skips phase A and replays phase B in full
    over the persisted Investigations: tasks that already exist come back as
    AlreadyExists (counted as dispatched), and the missing ones are created.
    Without this, a partial dispatch would strand the Run forever with
    IN_PROGRESS Investigations that no worker was ever asked to run.
    """
    run = _load_run(run_id)
    if run.status in TERMINAL_RUN_STATUSES:
        return {"status": "noop", "reason": "run_terminal"}

    rediscovered = run.businesses_total is None
    try:
        if rediscovered:
            run, dispatch_set = _discover_and_persist(run)
        else:
            dispatch_set = _dispatch_set_from_persisted(run_id)
    except Exception as exc:
        return _scout_failure(run, exc, retry_count)

    if not dispatch_set:
        # Phase A already recorded the terminal FAILED state.
        return {"status": "failed", "reason": "no_eligible_businesses"}

    created = 0
    already_existed = 0
    try:
        for investigation_id, business_id in dispatch_set:
            if tasks_client.enqueue_investigate(run_id, investigation_id, business_id):
                created += 1
            else:
                already_existed += 1
    except Exception as exc:
        # Do NOT roll back discovery, delete Businesses/Investigations, or
        # reset businesses_total. The retry replays the full dispatch set.
        return _scout_failure(run, exc, retry_count)

    # Dispatch is complete only now, with every expected business having
    # either been created or reported AlreadyExists. A failure message left
    # by an earlier, recovered attempt is no longer true.
    if run.failure_message is not None:
        run = run.model_copy(update={"failure_message": None})
        firestore_store.save_run(run)

    return {
        "status": "ok",
        "discovered": rediscovered,
        "businesses_total": len(dispatch_set),
        "tasks_created": created,
        "tasks_already_existed": already_existed,
    }


# ---------------------------------------------------------------------------
# BUSINESS task
# ---------------------------------------------------------------------------


def investigate_step(run_id: str, investigation_id: str, business_id: str) -> dict:
    """Run exactly one business investigation, then test for finalization.

    Two guards precede any expensive work: a terminal Run (a late delivery
    must not start new analytical work after the Run is already done) and a
    terminal Investigation (a re-delivery of work that already completed or
    already failed must be a cheap no-op, never a second set of Gemini calls).

    An analytical failure is recorded on the Investigation and answered 200:
    retrying failed reasoning burns money for the same result, and per-business
    failure isolation is an accepted, frozen property of this pipeline.
    """
    inv_doc = firestore_store.get_investigation(investigation_id)
    if inv_doc is None:
        raise RunNotFound(f"Investigation {investigation_id} not found")
    investigation = Investigation(**inv_doc)

    run = _load_run(run_id)
    if run.status in TERMINAL_RUN_STATUSES:
        return {"status": "noop", "reason": "run_terminal"}

    if investigation.status in TERMINAL_INVESTIGATION_STATUSES:
        outcome = {"status": "noop", "reason": "investigation_terminal"}
    else:
        outcome = _run_one_investigation(run, investigation, business_id)

    # Runs on every path, including both no-op paths: a retry whose only job
    # is to re-attempt a lost finalization enqueue must still get there.
    _enqueue_finalize_or_retry(run_id)
    return outcome


def _run_one_investigation(
    run: Run, investigation: Investigation, business_id: str
) -> dict:
    business_doc = firestore_store.get_business(business_id)
    if business_doc is None:
        return _fail_investigation(
            investigation, f"Business {business_id} not found"
        )

    try:
        investigator.run_investigation(
            run,
            Business(**business_doc),
            get_evaluated_definitions(),
            investigation=investigation,
            persist=True,
        )
    except Exception as exc:
        return _fail_investigation(investigation, str(exc))

    return {"status": "ok", "investigation_id": investigation.investigation_id}


def _fail_investigation(investigation: Investigation, reason: str) -> dict:
    firestore_store.save_investigation(
        investigation.model_copy(
            update={
                "status": InvestigationStatus.FAILED,
                "completed_at": _now(),
            }
        )
    )
    return {
        "status": "investigation_failed",
        "investigation_id": investigation.investigation_id,
        "reason": _truncate(reason),
    }


def _enqueue_finalize_or_retry(run_id: str) -> None:
    """Infrastructure failures while scheduling finalization are retryable.

    By this point the Investigation is terminal, so the Cloud Tasks retry is
    a cheap no-op that re-attempts only the enqueue — no Gemini work repeats.
    This is the documented recovery path for a worker that dies between
    marking its investigation terminal and scheduling finalization.
    """
    try:
        maybe_enqueue_finalize(run_id)
    except Exception as exc:
        raise TaskNotReady(f"Failed to enqueue finalization: {exc}") from exc


# ---------------------------------------------------------------------------
# Finalization scheduling
# ---------------------------------------------------------------------------


def maybe_enqueue_finalize(run_id: str) -> bool:
    """Schedule finalization exactly once, without a transaction or a lock.

    Every business worker that observes "all Investigations terminal" tries to
    create a task named `finalize-{run_id}`. Cloud Tasks enforces name
    uniqueness server-side, so exactly one creation succeeds and the rest come
    back AlreadyExists (swallowed in tasks_client as the success signal it is).

    Nothing is committed before the enqueue, which is what makes this safer
    than a Firestore flag: a worker that dies between "observed ready" and
    "enqueued" costs nothing, because the next worker to finish tries again —
    and if it was the last worker, its own Cloud Tasks retry re-enters here
    through the terminal-Investigation no-op path.
    """
    run_doc = firestore_store.get_run(run_id)
    if run_doc is None:
        return False

    businesses_total = run_doc.get("businesses_total")
    if businesses_total is None:
        return False  # SCOUT has not committed the readiness barrier yet

    investigations = firestore_store.list_investigations_for_run(run_id)
    if len(investigations) < businesses_total:
        return False
    if any(
        doc.get("status") == InvestigationStatus.IN_PROGRESS.value
        for doc in investigations
    ):
        return False

    created = tasks_client.enqueue_finalize(run_id)
    if created:
        # Audit metadata only — never read for control flow, so losing this
        # write cannot affect correctness.
        firestore_store.save_run(
            Run(**run_doc).model_copy(update={"finalize_enqueued_at": _now()})
        )
    return created


# ---------------------------------------------------------------------------
# FINALIZE task
# ---------------------------------------------------------------------------


def finalize_step(run_id: str) -> dict:
    """Verification + Matcher + terminal Run state, for one run.

    Re-entrant by construction: an already-terminal Run is a no-op, a
    hypothesis whose Verification already reached a terminal execution status
    is never verified again, and the Matcher rebuilds identical documents
    because `match_id == hypothesis_id`.
    """
    run = _load_run(run_id)
    if run.status in TERMINAL_RUN_STATUSES:
        return {"status": "noop", "reason": "run_terminal"}

    investigations = [
        Investigation(**doc)
        for doc in firestore_store.list_investigations_for_run(run_id)
    ]
    _require_investigations_terminal(run, investigations)

    run = run.model_copy(update={"status": RunStatus.FINALIZING})
    firestore_store.save_run(run)

    hypotheses = [
        OpportunityHypothesis(**doc)
        for doc in firestore_store.list_hypotheses_for_run(run_id)
    ]
    verifications_run = _run_pending_verifications(run_id, hypotheses)
    matches_written = _write_matches(run_id, hypotheses)

    # The only writer of a terminal RunStatus, with its frozen rule intact:
    # any failed Investigation means the Run is not a fully successful run.
    investigator.finalize_run(run, investigations)
    run.completed_at = _now()
    firestore_store.save_run(run)

    return {
        "status": "ok",
        "run_status": run.status.value,
        "hypotheses": len(hypotheses),
        "verifications_run": verifications_run,
        "matches_written": matches_written,
    }


def _require_investigations_terminal(
    run: Run, investigations: list[Investigation]
) -> None:
    if run.businesses_total is None:
        raise TaskNotReady("Run has no businesses_total; SCOUT has not completed")
    if len(investigations) < run.businesses_total:
        raise TaskNotReady(
            f"Only {len(investigations)} of {run.businesses_total} Investigations exist"
        )
    if any(i.status == InvestigationStatus.IN_PROGRESS for i in investigations):
        raise TaskNotReady("One or more Investigations are still IN_PROGRESS")


def _run_pending_verifications(
    run_id: str, hypotheses: list[OpportunityHypothesis]
) -> int:
    """Apply the frozen selection policy, minus anything already verified.

    Suppression rule: a hypothesis whose Verification already reached a
    terminal execution status (COMPLETED or FAILED) is never re-verified by a
    FINALIZE retry. FAILED counts as done because it is already a legitimate
    terminal analytical state that the Matcher's reconciliation matrix handles
    explicitly — re-running it would spend two more Gemini calls to reach the
    same recorded conclusion. Only IN_PROGRESS orphans left by a killed
    FINALIZE, and hypotheses never attempted, are run; the orphan record is
    left untouched and `latest_verification_by_hypothesis` supersedes it.
    """
    selected = verification_selection.select_hypotheses_for_verification(hypotheses)

    already_verified = {
        doc["hypothesis_id"]
        for doc in firestore_store.list_verifications_for_run(run_id)
        if doc.get("execution_status") in TERMINAL_VERIFICATION_EXECUTION_STATUSES
    }
    todo = [h for h in selected if h.hypothesis_id not in already_verified]
    if not todo:
        return 0

    businesses_by_id: dict[str, Business] = {}
    for business_id in {h.business_id for h in todo}:
        doc = firestore_store.get_business(business_id)
        if doc is not None:
            businesses_by_id[business_id] = Business(**doc)

    definitions_by_id = {d.opportunity_id: d for d in MED_SPA_CATALOG}
    verification_batch_runner.run_verification_batch(
        run_id, businesses_by_id, definitions_by_id, todo, persist=True
    )
    return len(todo)


def _write_matches(run_id: str, hypotheses: list[OpportunityHypothesis]) -> int:
    """Exactly one OpportunityMatch per hypothesis — verified or not."""
    verifications = [
        Verification(**doc)
        for doc in firestore_store.list_verifications_for_run(run_id)
    ]
    by_hypothesis = opportunity_matcher.latest_verification_by_hypothesis(verifications)

    for hypothesis in hypotheses:
        firestore_store.save_opportunity_match(
            opportunity_matcher.build_match(
                hypothesis, by_hypothesis.get(hypothesis.hypothesis_id)
            )
        )
    return len(hypotheses)


# ---------------------------------------------------------------------------
# Derived progress (GET /runs/{run_id})
# ---------------------------------------------------------------------------


def run_progress(run_id: str) -> dict:
    """Progress derived by query, never from persisted counters.

    An incremented counter is the single largest duplication hazard under
    at-least-once delivery; a query over ~50 documents is idempotent by
    construction and cheap at this scale.
    """
    investigations = firestore_store.list_investigations_for_run(run_id)
    verifications = firestore_store.list_verifications_for_run(run_id)

    return {
        "investigations_total": len(investigations),
        "investigations_completed": sum(
            1
            for d in investigations
            if d.get("status") == InvestigationStatus.COMPLETED.value
        ),
        "investigations_failed": sum(
            1
            for d in investigations
            if d.get("status") == InvestigationStatus.FAILED.value
        ),
        "investigations_in_progress": sum(
            1
            for d in investigations
            if d.get("status") == InvestigationStatus.IN_PROGRESS.value
        ),
        "hypotheses_total": len(firestore_store.list_hypotheses_for_run(run_id)),
        "verifications_total": len(verifications),
        "verifications_completed": sum(
            1 for d in verifications if d.get("execution_status") == "COMPLETED"
        ),
        "matches_total": len(firestore_store.list_matches_for_run(run_id)),
    }
