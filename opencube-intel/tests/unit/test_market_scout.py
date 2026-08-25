from app.investigator import market_scout
from app.investigator.market_scout import DiscoveryResult
from app.investigator.models import Business


def _biz(place_id: str, name: str, address: str, website: str | None = "https://example.com") -> Business:
    return Business(
        business_id=place_id,
        display_name=name,
        formatted_address=address,
        website_url=website,
        place_id=place_id,
    )


def test_discover_deduplicates_by_place_id(monkeypatch) -> None:
    duplicate = _biz("p1", "Glow Med Spa", "100 Brickell Ave, Miami, FL 33131")

    monkeypatch.setattr(market_scout, "search_businesses", lambda query, max_results=8: [duplicate])

    result = market_scout.discover()

    assert result.raw_candidate_count == len(market_scout.SUBMARKET_QUERIES)
    accepted_ids = [b.place_id for b in result.accepted]
    assert accepted_ids.count("p1") == 1
    assert any(r.reason == "duplicate_place_id" for r in result.rejected)


def test_discover_rejects_missing_place_id(monkeypatch) -> None:
    no_place_id = Business(
        business_id="fallback-id",
        display_name="No Place Id Spa",
        formatted_address="200 Main St, Miami, FL",
        website_url="https://example.com",
        place_id=None,
    )
    monkeypatch.setattr(market_scout, "search_businesses", lambda query, max_results=8: [no_place_id])

    result = market_scout.discover()

    assert result.accepted == []
    assert all(r.reason == "missing_place_id" for r in result.rejected)


def test_discover_rejects_missing_name(monkeypatch) -> None:
    no_name = _biz("p2", "   ", "300 Main St, Miami, FL")
    monkeypatch.setattr(market_scout, "search_businesses", lambda query, max_results=8: [no_name])

    result = market_scout.discover()

    assert result.accepted == []
    assert all(r.reason == "missing_name" for r in result.rejected)


def test_discover_rejects_outside_target_geography(monkeypatch) -> None:
    out_of_geo = _biz("p3", "Orlando Med Spa", "1 Main St, Orlando, FL 32801")
    monkeypatch.setattr(market_scout, "search_businesses", lambda query, max_results=8: [out_of_geo])

    result = market_scout.discover()

    assert result.accepted == []
    assert all(r.reason == "outside_target_geography" for r in result.rejected)


def test_discover_accepts_valid_in_geography_candidate(monkeypatch) -> None:
    valid = _biz("p4", "Coral Gables Med Spa", "50 Miracle Mile, Coral Gables, FL 33134")
    monkeypatch.setattr(market_scout, "search_businesses", lambda query, max_results=8: [valid])

    result = market_scout.discover()

    assert any(b.place_id == "p4" for b in result.accepted)


def test_select_for_investigation_excludes_businesses_without_website() -> None:
    with_site = _biz("p1", "Has Site", "1 St, Miami, FL")
    without_site = _biz("p2", "No Site", "2 St, Miami, FL", website=None)
    discovery = DiscoveryResult(
        queries=["q"],
        raw_candidate_count=2,
        accepted=[with_site, without_site],
        rejected=[],
        by_submarket={"Brickell / Downtown Miami": [with_site, without_site]},
    )

    selected = market_scout.select_for_investigation(discovery, target_count=10)

    assert selected == [with_site]


def test_select_for_investigation_distributes_across_submarkets() -> None:
    by_submarket = {
        submarket: [_biz(f"{submarket}-{i}", f"{submarket} Spa {i}", f"{i} St, Miami, FL") for i in range(4)]
        for submarket in market_scout.SUBMARKET_QUERIES
    }
    all_accepted = [b for pool in by_submarket.values() for b in pool]
    discovery = DiscoveryResult(
        queries=list(market_scout.SUBMARKET_QUERIES.values()),
        raw_candidate_count=len(all_accepted),
        accepted=all_accepted,
        rejected=[],
        by_submarket=by_submarket,
    )

    selected = market_scout.select_for_investigation(discovery, target_count=10)

    assert len(selected) == 10
    assert len({b.place_id for b in selected}) == 10
    # Round-robin distribution: no submarket should be entirely absent while
    # another submarket contributed 3+ businesses out of a 10-business pick
    # across 5 submarkets.
    counts_per_submarket: dict[str, int] = {}
    for business in selected:
        submarket = business.place_id.rsplit("-", 1)[0]
        counts_per_submarket[submarket] = counts_per_submarket.get(submarket, 0) + 1
    assert max(counts_per_submarket.values()) - min(counts_per_submarket.values()) <= 1
