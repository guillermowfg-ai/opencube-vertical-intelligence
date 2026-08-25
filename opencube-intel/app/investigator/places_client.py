"""Thin client over Places API (New) for business discovery/identity.

Retrieval only — no inference. Places metadata establishes who a business
is (name, address, website, place_id); it is not proof of operational pain
and callers must not treat it as Evidence for a hypothesis.
"""

from __future__ import annotations

import os

import google.auth
import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest

from app.investigator.models import Business

_PLACES_BASE = "https://places.googleapis.com/v1"
_TIMEOUT = 10.0

_SEARCH_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri"
)
_DETAILS_FIELD_MASK = (
    "id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,googleMapsUri"
)


class PlacesClientError(RuntimeError):
    pass


def _get_access_token() -> str:
    creds, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    if not creds.valid:
        creds.refresh(GoogleAuthRequest())
    return creds.token


def _headers(field_mask: str) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {_get_access_token()}",
        "X-Goog-FieldMask": field_mask,
        "Content-Type": "application/json",
    }
    if quota_project := os.environ.get("GOOGLE_CLOUD_PROJECT"):
        headers["X-Goog-User-Project"] = quota_project
    return headers


def search_businesses(query: str, max_results: int = 5) -> list[Business]:
    """Text-search Places API (New) for real businesses matching `query`."""
    resp = httpx.post(
        f"{_PLACES_BASE}/places:searchText",
        headers=_headers(_SEARCH_FIELD_MASK),
        json={"textQuery": query, "maxResultCount": max_results},
        timeout=_TIMEOUT,
    )
    if resp.status_code != 200:
        raise PlacesClientError(f"Places searchText failed: {resp.status_code} {resp.text}")
    data = resp.json()
    return [_business_from_place(p) for p in data.get("places", [])]


def get_business(place_id: str) -> Business:
    """Fetch full place details for a known place_id."""
    place_id = place_id.removeprefix("places/")
    resp = httpx.get(
        f"{_PLACES_BASE}/places/{place_id}",
        headers=_headers(_DETAILS_FIELD_MASK),
        timeout=_TIMEOUT,
    )
    if resp.status_code != 200:
        raise PlacesClientError(f"Places details failed: {resp.status_code} {resp.text}")
    return _business_from_place(resp.json())


def _business_from_place(place: dict) -> Business:
    place_id = place.get("id", "")
    return Business(
        business_id=place_id,
        display_name=place.get("displayName", {}).get("text", ""),
        formatted_address=place.get("formattedAddress"),
        website_url=place.get("websiteUri"),
        place_id=place_id,
        phone_number=place.get("nationalPhoneNumber"),
        maps_url=place.get("googleMapsUri"),
    )
