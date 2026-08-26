"""Public website retrieval — separate from inference.

Rules (implementation prompt section 9):
  - Maximum 3 same-domain pages per investigation: homepage, a booking/
    contact page if discovered, and one relevant service/about page.
  - Respect robots.txt.
  - Descriptive User-Agent.
  - Explicit timeouts.
  - Polite delay between requests.
  - Same-domain only, no recursive crawling.
  - Graceful degradation: one inaccessible page must not crash the
    investigation.

Never: bypass auth/anti-bot controls, probe private APIs, interact with
chat widgets, submit forms, call phone numbers, or send messages.
"""

from __future__ import annotations

import dataclasses
import datetime
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.investigator.models import SourceType
from app.investigator.source_adapter import SourceMaterial

USER_AGENT = "OpenCubeVerticalIntelligenceBot/0.1 (+https://opencube.studio; investigation research)"
_TIMEOUT = 10.0
_REQUEST_DELAY_SECONDS = 1.5
_MAX_PAGES = 3
_MAX_CONTENT_CHARS = 6000

_BOOKING_KEYWORDS = (
    "book",
    "appointment",
    "schedule",
    "reserve",
)
_CONTACT_KEYWORDS = ("contact",)
_ABOUT_SERVICE_KEYWORDS = ("about", "service", "treatment", "menu")


class _PageExtractor(HTMLParser):
    """Strips a page to visible text plus (href, link_text) pairs."""

    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._current_href: str | None = None
        self._current_link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skip_depth += 1
        if tag == "a":
            href = dict(attrs).get("href")
            self._current_href = href
            self._current_link_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style") and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag == "a" and self._current_href is not None:
            text = " ".join(self._current_link_text).strip()
            self.links.append((self._current_href, text))
            self._current_href = None
            self._current_link_text = []

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        stripped = data.strip()
        if not stripped:
            return
        self._text_parts.append(stripped)
        if self._current_href is not None:
            self._current_link_text.append(stripped)

    def text(self) -> str:
        return " ".join(self._text_parts)


def _hostname(url: str) -> str:
    """netloc, lowercased, with a leading 'www.' stripped. Empty on a bad URL."""
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except ValueError:
        return ""


def _same_domain(url: str, domain: str) -> bool:
    return _hostname(url) == domain


def _load_robot_parser(base_url: str, client: httpx.Client) -> RobotFileParser:
    rp = RobotFileParser()
    robots_url = urljoin(base_url, "/robots.txt")
    try:
        resp = client.get(robots_url, headers={"User-Agent": USER_AGENT}, timeout=_TIMEOUT)
        if resp.status_code == 200:
            rp.parse(resp.text.splitlines())
        else:
            rp.parse([])  # no robots.txt -> allow by default
    except httpx.HTTPError:
        rp.parse([])
    return rp


def _score_link(href: str, text: str, keywords: tuple[str, ...]) -> bool:
    haystack = f"{href} {text}".lower()
    return any(k in haystack for k in keywords)


def fetch_business_sources(website_url: str) -> list[SourceMaterial]:
    """Fetch up to 3 same-domain pages and return them as SourceMaterial.

    Graceful degradation: any single page failure is skipped, never raised.
    """
    if not website_url:
        return []

    parsed = urlparse(website_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return []
    domain = parsed.netloc.lower().removeprefix("www.")

    sources: list[SourceMaterial] = []
    visited_urls: set[str] = set()

    with httpx.Client(follow_redirects=True) as client:
        robots = _load_robot_parser(website_url, client)

        def try_fetch(url: str) -> SourceMaterial | None:
            if url in visited_urls:
                return None
            if not _same_domain(url, domain):
                return None
            if not robots.can_fetch(USER_AGENT, url):
                return None
            visited_urls.add(url)
            try:
                resp = client.get(
                    url, headers={"User-Agent": USER_AGENT}, timeout=_TIMEOUT
                )
                resp.raise_for_status()
            except httpx.HTTPError:
                return None
            extractor = _PageExtractor()
            try:
                extractor.feed(resp.text)
            except Exception:
                return None
            content = extractor.text()[:_MAX_CONTENT_CHARS]
            if not content.strip():
                return None
            return SourceMaterial(
                source_type=SourceType.WEBSITE,
                source_url=url,
                retrieved_at=datetime.datetime.now(datetime.UTC).isoformat(),
                content=content,
            ), extractor.links

        homepage_result = try_fetch(website_url)
        if homepage_result is None:
            return []
        homepage_source, homepage_links = homepage_result
        sources.append(homepage_source)

        resolved_links = [
            (urljoin(website_url, href), text) for href, text in homepage_links
        ]

        booking_candidate = next(
            (
                url
                for url, text in resolved_links
                if _same_domain(url, domain)
                and (
                    _score_link(url, text, _BOOKING_KEYWORDS)
                    or _score_link(url, text, _CONTACT_KEYWORDS)
                )
            ),
            None,
        )
        about_candidate = next(
            (
                url
                for url, text in resolved_links
                if _same_domain(url, domain)
                and _score_link(url, text, _ABOUT_SERVICE_KEYWORDS)
            ),
            None,
        )

        for candidate in (booking_candidate, about_candidate):
            if candidate is None or len(sources) >= _MAX_PAGES:
                continue
            time.sleep(_REQUEST_DELAY_SECONDS)
            result = try_fetch(candidate)
            if result is not None:
                sources.append(result[0])

    return sources[:_MAX_PAGES]


# ---------------------------------------------------------------------------
# Independent-source fetch — Verification Loop V1.
#
# Deliberately separate from fetch_business_sources above: that function is
# scoped to one business's own domain and crawls up to 3 keyword-scored
# links. This one fetches exactly one arbitrary external candidate URL,
# resolving it to its terminal destination first (Google Search grounding
# candidate URIs are Vertex redirect links, not the underlying source) and
# rejecting anything that isn't genuinely independent of the business being
# investigated. No crawling, no further link discovery.
# ---------------------------------------------------------------------------

GOOGLE_HOST_SUFFIXES = ("google.com",)


@dataclasses.dataclass
class IndependentFetchResult:
    source: SourceMaterial | None
    rejected_reason: str | None  # None iff source is not None


def resolve_and_fetch_independent_source(
    candidate_url: str,
    *,
    business_domain: str,
    original_source_urls: set[str],
) -> IndependentFetchResult:
    """Resolve `candidate_url` to its terminal URL and, if independent and
    accessible, fetch it as a single page.

    Rejection reasons (see Verification model's RejectedSourceCandidate):
    invalid_url, fetch_failed, non_2xx, unresolved_redirect, google_host,
    same_business_domain, business_subdomain, original_evidence_url,
    robots_disallowed.
    """
    parsed = urlparse(candidate_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return IndependentFetchResult(None, "invalid_url")

    try:
        with httpx.Client(follow_redirects=True) as client:
            resp = client.get(candidate_url, headers={"User-Agent": USER_AGENT}, timeout=_TIMEOUT)
    except httpx.HTTPError:
        return IndependentFetchResult(None, "fetch_failed")

    if resp.status_code >= 400:
        return IndependentFetchResult(None, "non_2xx")

    terminal_url = str(resp.url)
    terminal_host = _hostname(terminal_url)

    if "vertexaisearch.cloud.google.com" in terminal_host or "grounding-api-redirect" in terminal_url:
        # Never guess at an unresolved redirect's true destination.
        return IndependentFetchResult(None, "unresolved_redirect")

    if terminal_host == "google.com" or any(
        terminal_host.endswith("." + suf) for suf in GOOGLE_HOST_SUFFIXES
    ):
        return IndependentFetchResult(None, "google_host")

    if terminal_host == business_domain:
        return IndependentFetchResult(None, "same_business_domain")
    if terminal_host.endswith("." + business_domain):
        return IndependentFetchResult(None, "business_subdomain")

    normalized_originals = {u.rstrip("/") for u in original_source_urls}
    if terminal_url.rstrip("/") in normalized_originals:
        return IndependentFetchResult(None, "original_evidence_url")

    terminal_parsed = urlparse(terminal_url)
    try:
        with httpx.Client(follow_redirects=True) as robots_client:
            robots = _load_robot_parser(
                f"{terminal_parsed.scheme}://{terminal_parsed.netloc}/", robots_client
            )
        if not robots.can_fetch(USER_AGENT, terminal_url):
            return IndependentFetchResult(None, "robots_disallowed")
    except httpx.HTTPError:
        pass  # robots.txt unreachable -> allow by default, same as fetch_business_sources

    extractor = _PageExtractor()
    try:
        extractor.feed(resp.text)
    except Exception:
        return IndependentFetchResult(None, "fetch_failed")
    content = extractor.text()[:_MAX_CONTENT_CHARS]
    if not content.strip():
        return IndependentFetchResult(None, "fetch_failed")

    source = SourceMaterial(
        source_type=SourceType.WEBSITE,
        source_url=terminal_url,
        retrieved_at=datetime.datetime.now(datetime.UTC).isoformat(),
        content=content,
    )
    return IndependentFetchResult(source, None)
