"""Market Scout V1 — business discovery and normalization only.

Market Scout discovers and normalizes businesses (WHO exists in the target
market). It does not diagnose pain, score commercial opportunity, or inspect
website content — that is the Business Investigator's job:

    MARKET SCOUT          -> discovers and normalizes businesses
    BUSINESS INVESTIGATOR -> collects factual evidence, evaluates bounded
                              opportunities

Selection here is deliberately outcome-blind: it uses only deterministic
market-discovery criteria (valid Place ID, name present, in-geography,
website present, deduplicated, distributed across submarkets) and never
inspects website content, booking flows, or any other evidence signal that
would predict an Investigator outcome. Doing that here would collect
evidence outside the Evidence model — unrecorded and unauditable.
"""

from __future__ import annotations

import dataclasses

from app.investigator.models import Business
from app.investigator.places_client import search_businesses

GEOGRAPHY = "Miami-Dade County, Florida"
VERTICAL = "Med Spa"

# Frozen V1 run defaults. Previously duplicated in scripts/run_market_scout.py;
# they live here so the local proof script and the production API share one
# source of truth rather than drifting apart.
DEFAULT_TARGET_COUNT = 10
DEFAULT_PROVIDER_CAPABILITIES: list[str] = [
    "AI Appointment / Booking Assistance",
    "AI Lead Intake & Qualification",
    "AI Voice Reception",
    "Missed-call Recovery",
    "Automated Lead Follow-up",
]

# Frozen V1 submarkets (implementation prompt section 4). A single broad
# query returns scattered, low-quality results, so V1 issues one targeted
# query per submarket and merges. South Florida (Broward, Palm Beach) is
# later expansion, not V1.
SUBMARKET_QUERIES: dict[str, str] = {
    "Brickell / Downtown Miami": "med spa in Brickell, Miami, FL",
    "Coral Gables": "med spa in Coral Gables, FL",
    "Miami Beach": "med spa in Miami Beach, FL",
    "Aventura": "med spa in Aventura, FL",
    "Doral": "med spa in Doral, FL",
}

# Used only to check that a discovered business's formatted_address falls
# inside the frozen Miami-Dade County target geography. This is a factual,
# deterministic geography check on Places-supplied address text — not an
# inference about the business.
_MIAMI_DADE_MUNICIPALITIES: tuple[str, ...] = (
    "miami-dade",
    "miami beach",
    "miami",
    "coral gables",
    "doral",
    "aventura",
    "brickell",
    "hialeah",
    "homestead",
    "kendall",
    "miami lakes",
    "miami springs",
    "north miami beach",
    "north miami",
    "opa-locka",
    "opa locka",
    "south miami",
    "sunny isles beach",
    "sweetwater",
    "bal harbour",
    "bay harbor islands",
    "cutler bay",
    "el portal",
    "florida city",
    "golden beach",
    "indian creek",
    "key biscayne",
    "medley",
    "miami gardens",
    "palmetto bay",
    "pinecrest",
    "surfside",
    "virginia gardens",
    "west miami",
)


@dataclasses.dataclass
class RejectedCandidate:
    display_name: str
    place_id: str | None
    reason: str


@dataclasses.dataclass
class DiscoveryResult:
    queries: list[str]
    raw_candidate_count: int
    accepted: list[Business]
    rejected: list[RejectedCandidate]
    by_submarket: dict[str, list[Business]]


def _in_target_geography(business: Business) -> bool:
    address = (business.formatted_address or "").lower()
    if not address:
        return False
    is_florida = ", fl" in address or address.endswith(" fl") or ", florida" in address
    if not is_florida:
        return False
    return any(m in address for m in _MIAMI_DADE_MUNICIPALITIES)


def discover(*, max_results_per_query: int = 8) -> DiscoveryResult:
    """Issue one Places text-search query per frozen submarket, merge, and
    normalize/reject deterministically. Never inspects website content.
    """
    raw_count = 0
    accepted: list[Business] = []
    rejected: list[RejectedCandidate] = []
    seen_place_ids: set[str] = set()
    by_submarket: dict[str, list[Business]] = {name: [] for name in SUBMARKET_QUERIES}

    for submarket, query in SUBMARKET_QUERIES.items():
        candidates = search_businesses(query, max_results=max_results_per_query)
        raw_count += len(candidates)
        for business in candidates:
            if not business.place_id:
                rejected.append(
                    RejectedCandidate(business.display_name, business.place_id, "missing_place_id")
                )
                continue
            if not business.display_name or not business.display_name.strip():
                rejected.append(
                    RejectedCandidate(business.display_name, business.place_id, "missing_name")
                )
                continue
            if business.place_id in seen_place_ids:
                rejected.append(
                    RejectedCandidate(business.display_name, business.place_id, "duplicate_place_id")
                )
                continue
            if not _in_target_geography(business):
                rejected.append(
                    RejectedCandidate(
                        business.display_name, business.place_id, "outside_target_geography"
                    )
                )
                continue
            seen_place_ids.add(business.place_id)
            accepted.append(business)
            by_submarket[submarket].append(business)

    return DiscoveryResult(
        queries=list(SUBMARKET_QUERIES.values()),
        raw_candidate_count=raw_count,
        accepted=accepted,
        rejected=rejected,
        by_submarket=by_submarket,
    )


def select_for_investigation(
    discovery: DiscoveryResult, *, target_count: int = 10
) -> list[Business]:
    """Outcome-blind selection: valid Place ID + name + geography (already
    guaranteed by `discover`), a public website present, deduplicated, and
    distributed across submarkets via round-robin. Never inspects website
    content, booking flows, or any other evidence signal.
    """
    eligible_by_submarket: dict[str, list[Business]] = {
        submarket: [b for b in businesses if b.website_url]
        for submarket, businesses in discovery.by_submarket.items()
    }

    selected: list[Business] = []
    selected_ids: set[str] = set()
    submarkets = list(eligible_by_submarket.keys())
    max_pool_len = max((len(pool) for pool in eligible_by_submarket.values()), default=0)

    round_idx = 0
    while len(selected) < target_count and round_idx < max_pool_len:
        for submarket in submarkets:
            pool = eligible_by_submarket[submarket]
            if round_idx >= len(pool):
                continue
            candidate = pool[round_idx]
            if candidate.place_id in selected_ids:
                continue
            selected.append(candidate)
            selected_ids.add(candidate.place_id)
            if len(selected) >= target_count:
                break
        round_idx += 1

    return selected
