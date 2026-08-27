"""Frontend V1 read-only API.

    GET /overview                            platform snapshot + recent runs
    GET /runs                                run list with derived progress
    GET /runs/{run_id}/businesses            per-business rows for one run
    GET /matches                             match list across runs
    GET /matches/{match_id}                  one auditable opportunity detail
    GET /businesses                          canonical businesses across runs
    GET /catalog                             the declarative V1 vocabularies

Every route here is a projection. This module performs no analytical work:
it never classifies a hypothesis, never decides a match, never writes a
document, and never calls anything in `firestore_store` whose name begins
with `save_`. Where a derived value is needed it delegates to the accepted
engine — verification display state comes from
`opportunity_matcher.classify_verification_state`, so the UI and the Matcher
can never drift apart — and where a label is needed it comes from the two
declarative catalogs.

Progress counts are derived at read time rather than read from a counter,
for the reason DECISIONS.md #24 gives: under at-least-once delivery a stored
counter is the largest duplication hazard in the system.

Scale note: the aggregate routes stream whole collections and group in
memory. That is the right trade for V1 — a run is ~10 businesses and ~30
matches, so the whole corpus is a few hundred documents — and it is bounded
by `_MAX_DOCS`, which sets `truncated` on the response rather than silently
returning a partial picture.
"""

from __future__ import annotations

import collections
import datetime

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import ValidationError

from app.api.read_schemas import (
    BusinessAggregateView,
    BusinessListResponse,
    BusinessRowView,
    BusinessView,
    CapabilityView,
    CatalogResponse,
    EvidenceView,
    HypothesisView,
    LabelledCount,
    MatchDetailResponse,
    MatchListResponse,
    MatchRowView,
    OpportunityDefinitionView,
    OverviewKpis,
    OverviewResponse,
    RejectedSourceView,
    RunBusinessesResponse,
    RunListResponse,
    RunRefView,
    RunSummaryView,
    VerificationView,
)
from app.investigator import (
    capability_catalog,
    catalog,
    firestore_store,
    market_scout,
    opportunity_matcher,
)
from app.investigator.models import (
    TERMINAL_RUN_STATUSES,
    InvestigationStatus,
    MatchStatus,
    OpportunityStatus,
    RunStatus,
    Verification,
    VerificationExecutionStatus,
)

router = APIRouter(tags=["frontend"])

# Hard ceiling per collection on the aggregate routes. Reaching it is
# reported as `truncated: true`, never hidden.
_MAX_DOCS = 5000

_TERMINAL_RUN_VALUES = {s.value for s in TERMINAL_RUN_STATUSES}

_OPPORTUNITY_DEFINITIONS = {d.opportunity_id: d for d in catalog.MED_SPA_CATALOG}

# Verification display buckets, in the order a distribution should render.
_VERIFICATION_STATES = (
    "SUPPORTS",
    "CONTRADICTS",
    "INSUFFICIENT_EVIDENCE",
    "NO_INDEPENDENT_SOURCE",
    "FAILED",
    "IN_PROGRESS",
)


# ---------------------------------------------------------------------------
# Projection helpers
# ---------------------------------------------------------------------------


def _humanize(key: str) -> str:
    return key.replace("_", " ").capitalize()


def _counts(keys: tuple[str, ...], tally: dict[str, int]) -> list[LabelledCount]:
    """Every known key is emitted, including zeros: a distribution that
    silently omits its empty buckets reads as if the state cannot occur."""
    ordered = [LabelledCount(key=k, label=_humanize(k), count=tally.get(k, 0)) for k in keys]
    extra = sorted(set(tally) - set(keys))
    ordered.extend(
        LabelledCount(key=k, label=_humanize(k), count=tally[k]) for k in extra
    )
    return ordered


def _verification_display_state(doc: dict) -> str:
    """The Matcher's own six-state classification, plus IN_PROGRESS.

    `classify_verification_state` deliberately refuses an IN_PROGRESS
    Verification because the Matcher requires a terminal record. A live run
    legitimately has IN_PROGRESS Verifications on screen, so that one case is
    handled here and every terminal case is delegated, which keeps the UI's
    vocabulary identical to the reconciliation matrix's by construction.
    """
    if doc.get("execution_status") == VerificationExecutionStatus.IN_PROGRESS.value:
        return "IN_PROGRESS"
    try:
        return opportunity_matcher.classify_verification_state(
            Verification(**doc)
        ).value
    except (ValidationError, opportunity_matcher.UnexpectedVerificationStateError):
        # A record that matches none of the known states is surfaced as
        # UNKNOWN rather than forced into a bucket it does not belong in.
        return "UNKNOWN"


def _capability_view(capability_id: str | None) -> CapabilityView | None:
    if capability_id is None:
        return None
    return CapabilityView(
        capability_id=capability_id,
        label=capability_catalog.CAPABILITIES.get(capability_id, capability_id),
    )


def _opportunity_view(opportunity_id: str) -> OpportunityDefinitionView | None:
    definition = _OPPORTUNITY_DEFINITIONS.get(opportunity_id)
    if definition is None:
        return None
    return OpportunityDefinitionView(
        opportunity_id=definition.opportunity_id,
        name=definition.name,
        opportunity_type=definition.opportunity_type.value,
        description=definition.description,
        provider_capability=definition.provider_capability,
        publicly_observable=definition.publicly_observable,
        requires_independent_verification=definition.requires_independent_verification,
        evidence_signals=list(definition.evidence_signals),
        contradiction_signals=list(definition.contradiction_signals),
    )


def _business_view(doc: dict | None) -> BusinessView | None:
    if doc is None:
        return None
    return BusinessView(
        business_id=doc.get("business_id", ""),
        display_name=doc.get("display_name", ""),
        formatted_address=doc.get("formatted_address"),
        website_url=doc.get("website_url"),
        phone_number=doc.get("phone_number"),
        maps_url=doc.get("maps_url"),
        place_id=doc.get("place_id"),
    )


def _match_row(doc: dict, business: dict | None) -> MatchRowView:
    definition = _OPPORTUNITY_DEFINITIONS.get(doc.get("opportunity_id", ""))
    primary_capability_id = doc.get("primary_capability_id")
    return MatchRowView(
        match_id=doc["match_id"],
        run_id=doc.get("run_id", ""),
        hypothesis_id=doc.get("hypothesis_id", ""),
        business_id=doc.get("business_id", ""),
        business_display_name=(business or {}).get("display_name"),
        business_website_url=(business or {}).get("website_url"),
        investigation_id=doc.get("investigation_id", ""),
        verification_id=doc.get("verification_id"),
        opportunity_id=doc.get("opportunity_id", ""),
        opportunity_name=definition.name if definition else None,
        opportunity_type=definition.opportunity_type.value if definition else None,
        original_status=doc.get("original_status", ""),
        verification_execution_status=doc.get("verification_execution_status"),
        verification_outcome=doc.get("verification_outcome"),
        no_independent_source_found=doc.get("no_independent_source_found"),
        match_status=doc.get("match_status", ""),
        reason_code=doc.get("reason_code", ""),
        reasoning=doc.get("reasoning", ""),
        primary_capability_id=primary_capability_id,
        primary_capability_label=(
            capability_catalog.CAPABILITIES.get(primary_capability_id)
            if primary_capability_id
            else None
        ),
        supporting_capability_ids=list(doc.get("supporting_capability_ids") or []),
        source_hypothesis_evidence_ids=list(
            doc.get("source_hypothesis_evidence_ids") or []
        ),
        source_verification_evidence_ids=list(
            doc.get("source_verification_evidence_ids") or []
        ),
        created_at=doc.get("created_at", ""),
    )


class _Corpus:
    """One pass over the flat collections, indexed by run and by business.

    Built once per aggregate request. Nothing is cached across requests: a
    run in flight changes on every poll, and a stale snapshot on a progress
    screen is worse than an extra query at this scale.
    """

    def __init__(self) -> None:
        self.runs = firestore_store.list_runs(limit=_MAX_DOCS)
        self.investigations = firestore_store.list_all_investigations(limit=_MAX_DOCS)
        self.hypotheses = firestore_store.list_all_hypotheses(limit=_MAX_DOCS)
        self.verifications = firestore_store.list_all_verifications(limit=_MAX_DOCS)
        self.matches = firestore_store.list_all_matches(limit=_MAX_DOCS)

        self.truncated = any(
            len(rows) >= _MAX_DOCS
            for rows in (
                self.runs,
                self.investigations,
                self.hypotheses,
                self.verifications,
                self.matches,
            )
        )

        self.investigations_by_run = _group(self.investigations, "run_id")
        self.hypotheses_by_run = _group(self.hypotheses, "run_id")
        self.verifications_by_run = _group(self.verifications, "run_id")
        self.matches_by_run = _group(self.matches, "run_id")

    def run_summary(self, run: dict) -> RunSummaryView:
        run_id = run.get("run_id", "")
        investigations = self.investigations_by_run.get(run_id, [])
        verifications = self.verifications_by_run.get(run_id, [])
        matches = self.matches_by_run.get(run_id, [])
        match_status = collections.Counter(m.get("match_status") for m in matches)
        run_status = run.get("status", RunStatus.CREATED.value)

        return RunSummaryView(
            run_id=run_id,
            status=run_status,
            is_terminal=run_status in _TERMINAL_RUN_VALUES,
            vertical=run.get("vertical", ""),
            geography=run.get("geography", ""),
            created_at=run.get("created_at", ""),
            started_at=run.get("started_at"),
            completed_at=run.get("completed_at"),
            failure_message=run.get("failure_message"),
            businesses_total=run.get("businesses_total"),
            discovery_raw_candidate_count=run.get("discovery_raw_candidate_count"),
            investigations_total=len(investigations),
            investigations_completed=_count_status(
                investigations, InvestigationStatus.COMPLETED.value
            ),
            investigations_failed=_count_status(
                investigations, InvestigationStatus.FAILED.value
            ),
            investigations_in_progress=_count_status(
                investigations, InvestigationStatus.IN_PROGRESS.value
            ),
            hypotheses_total=len(self.hypotheses_by_run.get(run_id, [])),
            verifications_total=len(verifications),
            verifications_completed=sum(
                1
                for v in verifications
                if v.get("execution_status") == VerificationExecutionStatus.COMPLETED.value
            ),
            matches_total=len(matches),
            matches_matched=match_status.get(MatchStatus.MATCHED.value, 0),
            matches_not_matched=match_status.get(MatchStatus.NOT_MATCHED.value, 0),
            matches_unresolved=match_status.get(MatchStatus.UNRESOLVED.value, 0),
            investigation_count=run.get("investigation_count"),
            completed_investigation_count=run.get("completed_investigation_count"),
            failed_investigation_count=run.get("failed_investigation_count"),
        )

    def sorted_runs(self) -> list[dict]:
        """Newest first. `created_at` is an application-written ISO-8601
        string, so lexicographic order is chronological order and no
        Firestore composite index is required."""
        return sorted(self.runs, key=lambda r: r.get("created_at") or "", reverse=True)


def _group(rows: list[dict], key: str) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = collections.defaultdict(list)
    for row in rows:
        grouped[row.get(key, "")].append(row)
    return dict(grouped)


def _count_status(rows: list[dict], value: str) -> int:
    return sum(1 for row in rows if row.get("status") == value)


def _resolve_business_names(business_ids: set[str]) -> dict[str, dict]:
    resolved: dict[str, dict] = {}
    for business_id in business_ids:
        doc = firestore_store.get_business(business_id)
        if doc is not None:
            resolved[business_id] = doc
    return resolved


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/overview", response_model=OverviewResponse)
def get_overview(
    recent_runs: int = Query(default=5, ge=1, le=50),
    highlights: int = Query(default=6, ge=0, le=50),
) -> OverviewResponse:
    corpus = _Corpus()
    runs = corpus.sorted_runs()

    hypothesis_tally = collections.Counter(
        h.get("status") for h in corpus.hypotheses if h.get("status")
    )
    verification_tally = collections.Counter(
        _verification_display_state(v) for v in corpus.verifications
    )
    match_tally = collections.Counter(
        m.get("match_status") for m in corpus.matches if m.get("match_status")
    )
    opportunity_tally = collections.Counter(
        m.get("opportunity_id") for m in corpus.matches if m.get("opportunity_id")
    )
    capability_tally = collections.Counter(
        m.get("primary_capability_id")
        for m in corpus.matches
        if m.get("match_status") == MatchStatus.MATCHED.value
        and m.get("primary_capability_id")
    )

    matched = [
        m for m in corpus.matches if m.get("match_status") == MatchStatus.MATCHED.value
    ]
    matched.sort(key=lambda m: m.get("created_at") or "", reverse=True)
    highlighted = matched[:highlights]
    businesses = _resolve_business_names({m.get("business_id", "") for m in highlighted})

    kpis = OverviewKpis(
        runs_total=len(runs),
        runs_completed=sum(
            1 for r in runs if r.get("status") == RunStatus.COMPLETED.value
        ),
        runs_active=sum(
            1 for r in runs if r.get("status") not in _TERMINAL_RUN_VALUES
        ),
        # Distinct businesses that were actually pulled into an
        # investigation, not the size of the canonical Business collection:
        # a business discovered by Market Scout but not selected was never
        # part of a run's working set.
        businesses_discovered=len({i.get("business_id") for i in corpus.investigations}),
        businesses_investigated=len(
            {
                i.get("business_id")
                for i in corpus.investigations
                if i.get("status") == InvestigationStatus.COMPLETED.value
            }
        ),
        evidence_total=sum(int(i.get("evidence_count") or 0) for i in corpus.investigations),
        hypotheses_total=len(corpus.hypotheses),
        verifications_completed=sum(
            1
            for v in corpus.verifications
            if v.get("execution_status") == VerificationExecutionStatus.COMPLETED.value
        ),
        matches_total=len(corpus.matches),
        matches_matched=match_tally.get(MatchStatus.MATCHED.value, 0),
        review_needed=match_tally.get(MatchStatus.UNRESOLVED.value, 0),
    )

    return OverviewResponse(
        generated_at=datetime.datetime.now(datetime.UTC).isoformat(),
        kpis=kpis,
        hypothesis_status_counts=_counts(
            tuple(s.value for s in OpportunityStatus), dict(hypothesis_tally)
        ),
        verification_state_counts=_counts(_VERIFICATION_STATES, dict(verification_tally)),
        match_status_counts=_counts(
            tuple(s.value for s in MatchStatus), dict(match_tally)
        ),
        matched_capability_counts=[
            LabelledCount(
                key=capability_id,
                label=capability_catalog.CAPABILITIES.get(capability_id, capability_id),
                count=count,
            )
            for capability_id, count in capability_tally.most_common()
        ],
        opportunity_counts=[
            LabelledCount(
                key=opportunity_id,
                label=(
                    _OPPORTUNITY_DEFINITIONS[opportunity_id].name
                    if opportunity_id in _OPPORTUNITY_DEFINITIONS
                    else opportunity_id
                ),
                count=count,
            )
            for opportunity_id, count in opportunity_tally.most_common()
        ],
        recent_runs=[corpus.run_summary(r) for r in runs[:recent_runs]],
        highlighted_matches=[
            _match_row(m, businesses.get(m.get("business_id", ""))) for m in highlighted
        ],
        truncated=corpus.truncated,
    )


@router.get("/runs", response_model=RunListResponse)
def list_runs(limit: int = Query(default=50, ge=1, le=200)) -> RunListResponse:
    corpus = _Corpus()
    runs = corpus.sorted_runs()
    return RunListResponse(
        runs=[corpus.run_summary(r) for r in runs[:limit]],
        total=len(runs),
        truncated=corpus.truncated,
    )


@router.get("/runs/{run_id}/businesses", response_model=RunBusinessesResponse)
def get_run_businesses(run_id: str) -> RunBusinessesResponse:
    run = firestore_store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    investigations = firestore_store.list_investigations_for_run(run_id)
    hypotheses_by_investigation = _group(
        firestore_store.list_hypotheses_for_run(run_id), "investigation_id"
    )
    verifications_by_investigation = _group(
        firestore_store.list_verifications_for_run(run_id), "investigation_id"
    )
    matches_by_investigation = _group(
        firestore_store.list_matches_for_run(run_id), "investigation_id"
    )
    businesses = _resolve_business_names(
        {i.get("business_id", "") for i in investigations}
    )

    rows: list[BusinessRowView] = []
    for investigation in investigations:
        investigation_id = investigation.get("investigation_id", "")
        business = businesses.get(investigation.get("business_id", ""), {})
        matches = matches_by_investigation.get(investigation_id, [])
        match_tally = collections.Counter(m.get("match_status") for m in matches)
        hypothesis_tally = collections.Counter(
            h.get("status")
            for h in hypotheses_by_investigation.get(investigation_id, [])
            if h.get("status")
        )

        rows.append(
            BusinessRowView(
                business_id=investigation.get("business_id", ""),
                display_name=business.get("display_name")
                or investigation.get("business_id", ""),
                formatted_address=business.get("formatted_address"),
                website_url=business.get("website_url"),
                phone_number=business.get("phone_number"),
                maps_url=business.get("maps_url"),
                investigation_id=investigation_id,
                investigation_status=investigation.get(
                    "status", InvestigationStatus.IN_PROGRESS.value
                ),
                investigation_created_at=investigation.get("created_at"),
                investigation_completed_at=investigation.get("completed_at"),
                source_count=int(investigation.get("source_count") or 0),
                evidence_count=int(investigation.get("evidence_count") or 0),
                hypotheses_total=len(
                    hypotheses_by_investigation.get(investigation_id, [])
                ),
                hypothesis_status_counts=_counts(
                    tuple(s.value for s in OpportunityStatus), dict(hypothesis_tally)
                ),
                verifications_total=len(
                    verifications_by_investigation.get(investigation_id, [])
                ),
                matches_total=len(matches),
                matches_matched=match_tally.get(MatchStatus.MATCHED.value, 0),
                matches_not_matched=match_tally.get(MatchStatus.NOT_MATCHED.value, 0),
                matches_unresolved=match_tally.get(MatchStatus.UNRESOLVED.value, 0),
                matched_capability_ids=sorted(
                    {
                        m["primary_capability_id"]
                        for m in matches
                        if m.get("match_status") == MatchStatus.MATCHED.value
                        and m.get("primary_capability_id")
                    }
                ),
            )
        )

    rows.sort(key=lambda r: r.display_name.lower())
    return RunBusinessesResponse(
        run_id=run_id,
        status=run.get("status", RunStatus.CREATED.value),
        businesses=rows,
    )


@router.get("/matches", response_model=MatchListResponse)
def list_matches(
    run_id: str | None = Query(default=None),
    match_status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
) -> MatchListResponse:
    if run_id:
        docs = firestore_store.list_matches_for_run(run_id)
        truncated = False
    else:
        docs = firestore_store.list_all_matches(limit=_MAX_DOCS)
        truncated = len(docs) >= _MAX_DOCS

    if match_status:
        wanted = {s.strip().upper() for s in match_status.split(",") if s.strip()}
        unknown = wanted - {s.value for s in MatchStatus}
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown match_status value(s): {sorted(unknown)}",
            )
        docs = [d for d in docs if d.get("match_status") in wanted]

    docs.sort(key=lambda d: (d.get("created_at") or "", d.get("match_id") or ""), reverse=True)
    page = docs[:limit]
    businesses = _resolve_business_names({d.get("business_id", "") for d in page})

    return MatchListResponse(
        matches=[_match_row(d, businesses.get(d.get("business_id", ""))) for d in page],
        total=len(docs),
        truncated=truncated or len(docs) > limit,
    )


@router.get("/matches/{match_id}", response_model=MatchDetailResponse)
def get_match_detail(match_id: str) -> MatchDetailResponse:
    """One match with its full provenance chain resolved.

    Everything returned already exists in Firestore. The only work done here
    is dereferencing the evidence IDs the Matcher recorded — the hypothesis's
    own supporting/contradicting lists and the Verification's independent
    list — which is exactly what makes the decision auditable rather than
    asking the reader to trust a summary.
    """
    match = firestore_store.get_match(match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    business = firestore_store.get_business(match.get("business_id", ""))
    run = firestore_store.get_run(match.get("run_id", ""))

    hypothesis_doc = firestore_store.get_hypothesis(match.get("hypothesis_id", ""))
    verification_doc = (
        firestore_store.get_verification(match["verification_id"])
        if match.get("verification_id")
        else None
    )

    supporting_ids = list((hypothesis_doc or {}).get("supporting_evidence_ids") or [])
    contradicting_ids = list((hypothesis_doc or {}).get("contradicting_evidence_ids") or [])
    if not supporting_ids and not contradicting_ids:
        # The hypothesis document is the authority on evidence roles. If it
        # is unreadable, fall back to the IDs the Matcher itself recorded so
        # provenance is still shown, with no role claimed for them.
        supporting_ids = list(match.get("source_hypothesis_evidence_ids") or [])

    verification_evidence_ids = list(
        (verification_doc or {}).get("independent_evidence_ids")
        or match.get("source_verification_evidence_ids")
        or []
    )

    hypothesis_evidence = [
        *_evidence_views(supporting_ids, "SUPPORTING"),
        *_evidence_views(contradicting_ids, "CONTRADICTING"),
    ]
    verification_evidence = _evidence_views(verification_evidence_ids, "INDEPENDENT")

    supporting_capability_ids = list(match.get("supporting_capability_ids") or [])

    return MatchDetailResponse(
        match=_match_row(match, business),
        run=(
            RunRefView(
                run_id=run.get("run_id", ""),
                status=run.get("status", RunStatus.CREATED.value),
                vertical=run.get("vertical", ""),
                geography=run.get("geography", ""),
                created_at=run.get("created_at", ""),
            )
            if run
            else None
        ),
        business=_business_view(business),
        opportunity=_opportunity_view(match.get("opportunity_id", "")),
        primary_capability=_capability_view(match.get("primary_capability_id")),
        supporting_capabilities=[
            view
            for view in (_capability_view(c) for c in supporting_capability_ids)
            if view is not None
        ],
        hypothesis=_hypothesis_view(hypothesis_doc),
        verification=_verification_view(verification_doc),
        hypothesis_evidence=hypothesis_evidence,
        verification_evidence=verification_evidence,
    )


def _evidence_views(evidence_ids: list[str], role: str) -> list[EvidenceView]:
    views: list[EvidenceView] = []
    for evidence_id in evidence_ids:
        doc = firestore_store.get_evidence(evidence_id)
        if doc is None:
            continue
        views.append(
            EvidenceView(
                evidence_id=doc.get("evidence_id", evidence_id),
                source_url=doc.get("source_url", ""),
                source_type=doc.get("source_type", ""),
                observation=doc.get("observation", ""),
                retrieved_at=doc.get("retrieved_at", ""),
                collected_by=doc.get("collected_by", ""),
                role=role,
            )
        )
    return views


def _hypothesis_view(doc: dict | None) -> HypothesisView | None:
    if doc is None:
        return None
    return HypothesisView(
        hypothesis_id=doc.get("hypothesis_id", ""),
        run_id=doc.get("run_id", ""),
        business_id=doc.get("business_id", ""),
        investigation_id=doc.get("investigation_id", ""),
        opportunity_id=doc.get("opportunity_id", ""),
        opportunity_type=doc.get("opportunity_type", ""),
        statement=doc.get("statement", ""),
        confidence=float(doc.get("confidence") or 0.0),
        status=doc.get("status", ""),
        supporting_evidence_ids=list(doc.get("supporting_evidence_ids") or []),
        contradicting_evidence_ids=list(doc.get("contradicting_evidence_ids") or []),
    )


def _verification_view(doc: dict | None) -> VerificationView | None:
    if doc is None:
        return None
    return VerificationView(
        verification_id=doc.get("verification_id", ""),
        hypothesis_id=doc.get("hypothesis_id", ""),
        original_status=doc.get("original_status", ""),
        verification_target=doc.get("verification_target", ""),
        execution_status=doc.get("execution_status", ""),
        outcome=doc.get("outcome"),
        no_independent_source_found=bool(doc.get("no_independent_source_found")),
        independent_sources_fetched=int(doc.get("independent_sources_fetched") or 0),
        requested_search_query=doc.get("requested_search_query"),
        executed_search_queries=list(doc.get("executed_search_queries") or []),
        candidate_source_urls=list(doc.get("candidate_source_urls") or []),
        rejected_sources=[
            RejectedSourceView(url=r.get("url", ""), reason=r.get("reason", ""))
            for r in (doc.get("rejected_sources") or [])
        ],
        reasoning=doc.get("reasoning"),
        confidence=doc.get("confidence"),
        created_at=doc.get("created_at", ""),
        completed_at=doc.get("completed_at"),
        failure_reason=doc.get("failure_reason"),
    )


@router.get("/businesses", response_model=BusinessListResponse)
def list_businesses(limit: int = Query(default=200, ge=1, le=1000)) -> BusinessListResponse:
    corpus = _Corpus()
    investigations_by_business = _group(corpus.investigations, "business_id")
    hypotheses_by_business = _group(corpus.hypotheses, "business_id")
    matches_by_business = _group(corpus.matches, "business_id")

    rows: list[BusinessAggregateView] = []
    for business_id, investigations in investigations_by_business.items():
        business = firestore_store.get_business(business_id) or {}
        matches = matches_by_business.get(business_id, [])
        match_tally = collections.Counter(m.get("match_status") for m in matches)
        newest = max(
            investigations, key=lambda i: i.get("completed_at") or i.get("created_at") or ""
        )

        rows.append(
            BusinessAggregateView(
                business_id=business_id,
                display_name=business.get("display_name") or business_id,
                formatted_address=business.get("formatted_address"),
                website_url=business.get("website_url"),
                phone_number=business.get("phone_number"),
                maps_url=business.get("maps_url"),
                runs_total=len({i.get("run_id") for i in investigations}),
                investigations_total=len(investigations),
                investigations_completed=_count_status(
                    investigations, InvestigationStatus.COMPLETED.value
                ),
                last_investigated_at=newest.get("completed_at") or newest.get("created_at"),
                hypotheses_total=len(hypotheses_by_business.get(business_id, [])),
                matches_total=len(matches),
                matches_matched=match_tally.get(MatchStatus.MATCHED.value, 0),
                matches_unresolved=match_tally.get(MatchStatus.UNRESOLVED.value, 0),
                latest_run_id=newest.get("run_id"),
            )
        )

    rows.sort(key=lambda r: (-r.matches_matched, r.display_name.lower()))
    return BusinessListResponse(
        businesses=rows[:limit], total=len(rows), truncated=corpus.truncated
    )


@router.get("/catalog", response_model=CatalogResponse)
def get_catalog() -> CatalogResponse:
    return CatalogResponse(
        vertical=market_scout.VERTICAL,
        geography=market_scout.GEOGRAPHY,
        default_provider_capabilities=list(market_scout.DEFAULT_PROVIDER_CAPABILITIES),
        evaluated_opportunity_ids=sorted(catalog.EVALUATED_OPPORTUNITY_IDS),
        opportunities=[
            view
            for view in (
                _opportunity_view(d.opportunity_id) for d in catalog.MED_SPA_CATALOG
            )
            if view is not None
        ],
        capabilities=[
            CapabilityView(capability_id=key, label=label)
            for key, label in capability_catalog.CAPABILITIES.items()
        ],
    )
