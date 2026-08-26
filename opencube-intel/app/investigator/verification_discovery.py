"""Call 1 — Google Search grounding / independent-source discovery.

Discovery only. This module never creates Evidence, never decides an
outcome, and never persists search-model prose as fact — it only extracts
candidate URLs from grounding metadata for the independence filter and
fetcher (public_web_fetcher.resolve_and_fetch_independent_source) to
process downstream. No response_schema/structured output is attached to
this call: combining a search tool with schema-constrained output would
blur discovery and evidence together, which is exactly what this
architecture keeps apart.
"""

from __future__ import annotations

import datetime
import os

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.investigator.models import (
    Business,
    OpportunityDefinition,
    OpportunityHypothesis,
)

MODEL = "gemini-3.6-flash"
_MAX_RETRIES = 2

# One deterministic search-topic phrase per opportunity_id -- keeps the
# requested query bounded and reproducible without any NLP over
# verification_target's free text.
_SEARCH_TOPIC_PHRASES: dict[str, str] = {
    "online_booking_friction": "online booking appointment",
    "after_hours_lead_intake": "after hours contact appointment",
    "lead_follow_up_effectiveness": "response time reviews",
}


class RawCandidate(BaseModel):
    uri: str
    title: str | None = None


class DiscoveryCallResult(BaseModel):
    requested_search_query: str
    executed_search_queries: list[str] = Field(default_factory=list)
    candidates: list[RawCandidate] = Field(default_factory=list)
    model: str
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    thought_tokens: int | None = None
    total_tokens: int | None = None
    timestamp: str
    invocation_id: str | None = None
    raw_error: str | None = None


def _city_state(formatted_address: str | None) -> str:
    if not formatted_address:
        return ""
    parts = [p.strip() for p in formatted_address.split(",")]
    city = parts[1] if len(parts) > 1 else ""
    state = parts[2].split()[0] if len(parts) > 2 and parts[2].split() else ""
    return f"{city}, {state}".strip(", ")


def build_requested_search_query(business: Business, definition: OpportunityDefinition) -> str:
    """One deterministic, bounded search query. No iteration, no NLP over
    free-text verification_target -- reproducible from business identity +
    a fixed per-opportunity topic phrase."""
    topic = _SEARCH_TOPIC_PHRASES.get(definition.opportunity_id, definition.name.lower())
    location = _city_state(business.formatted_address)
    parts = [f'"{business.display_name}"']
    if location:
        parts.append(location)
    parts.append(topic)
    return " ".join(parts)


def discover_independent_candidates(
    business: Business,
    hypothesis: OpportunityHypothesis,
    definition: OpportunityDefinition,
    verification_target: str,
) -> DiscoveryCallResult:
    requested_search_query = build_requested_search_query(business, definition)
    location = _city_state(business.formatted_address)

    prompt = f"""Search the web for public information about the business "{business.display_name}" \
{f"located in {location} " if location else ""}regarding this proposition:

{verification_target}

Search query to use: {requested_search_query}

Report what you find. Prioritize independent third-party sources (business \
directories, booking platforms, review sites, professional listings) over the \
business's own website."""

    client = genai.Client(
        vertexai=True,
        project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
    )

    last_error: str | None = None
    for _attempt in range(_MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    temperature=0.0,
                ),
            )
        except Exception as exc:  # network/API error -- retry within bound
            last_error = str(exc)
            continue

        usage = response.usage_metadata
        result_kwargs = {
            "requested_search_query": requested_search_query,
            "model": response.model_version or MODEL,
            "prompt_tokens": usage.prompt_token_count if usage else None,
            "output_tokens": usage.candidates_token_count if usage else None,
            "thought_tokens": usage.thoughts_token_count if usage else None,
            "total_tokens": usage.total_token_count if usage else None,
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "invocation_id": response.response_id,
        }

        gm = None
        if response.candidates:
            gm = getattr(response.candidates[0], "grounding_metadata", None)

        if gm is None:
            # No grounding metadata is a valid (if unhelpful) discovery
            # result, not a technical failure -- it simply yields zero
            # candidates and the caller's zero-source path applies.
            return DiscoveryCallResult(executed_search_queries=[], candidates=[], **result_kwargs)

        executed_search_queries = list(gm.web_search_queries or [])
        candidates = [
            RawCandidate(uri=web.uri, title=getattr(web, "title", None))
            for chunk in (gm.grounding_chunks or [])
            if (web := getattr(chunk, "web", None)) is not None and getattr(web, "uri", None)
        ]
        return DiscoveryCallResult(
            executed_search_queries=executed_search_queries,
            candidates=candidates,
            **result_kwargs,
        )

    return DiscoveryCallResult(
        requested_search_query=requested_search_query,
        model=MODEL,
        timestamp=datetime.datetime.now(datetime.UTC).isoformat(),
        raw_error=last_error,
    )
