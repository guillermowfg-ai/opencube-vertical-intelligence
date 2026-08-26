# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import httpx
import pytest

from app.investigator import public_web_fetcher
from app.investigator.models import Verification as VerificationModel
from app.investigator.models import VerificationExecutionStatus


class _FakeResponse:
    def __init__(self, url: str, status_code: int = 200, text: str = "Independent directory content.") -> None:
        self.url = url
        self.status_code = status_code
        self.text = text


class _FakeClient:
    """Stands in for httpx.Client: returns `main_response` for the candidate
    fetch and a 404 (no robots.txt -> allow by default) for any robots.txt
    lookup, mirroring fetch_business_sources' own robots-absent handling."""

    def __init__(self, main_response: _FakeResponse) -> None:
        self._main_response = main_response

    def __call__(self, *args, **kwargs) -> "_FakeClient":
        return self

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, *args) -> bool:
        return False

    def get(self, url: str, **kwargs) -> _FakeResponse:
        if url.endswith("/robots.txt"):
            return _FakeResponse(url, status_code=404, text="")
        return self._main_response


def _patch_client(monkeypatch, response: _FakeResponse) -> None:
    monkeypatch.setattr(public_web_fetcher.httpx, "Client", _FakeClient(response))


def test_same_business_domain_rejected(monkeypatch) -> None:
    _patch_client(monkeypatch, _FakeResponse("https://aromaslaser.com/some-page"))
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "same_business_domain"


def test_business_subdomain_rejected(monkeypatch) -> None:
    _patch_client(monkeypatch, _FakeResponse("https://blog.aromaslaser.com/post"))
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "business_subdomain"


def test_exact_original_evidence_url_rejected(monkeypatch) -> None:
    original = "https://directory.example.com/aromas-medspa"
    _patch_client(monkeypatch, _FakeResponse(original))
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls={original},
    )
    assert result.source is None
    assert result.rejected_reason == "original_evidence_url"


def test_google_host_rejected(monkeypatch) -> None:
    _patch_client(monkeypatch, _FakeResponse("https://www.google.com/search?q=aromas+medspa"))
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "google_host"


def test_unresolved_redirect_rejected(monkeypatch) -> None:
    # The server never actually redirected -- the terminal URL is still a
    # Vertex grounding-redirect link. Must never be guessed at or trusted.
    _patch_client(
        monkeypatch,
        _FakeResponse(
            "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123"
        ),
    )
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "unresolved_redirect"


def test_non_2xx_rejected(monkeypatch) -> None:
    _patch_client(
        monkeypatch, _FakeResponse("https://directory.example.com/blocked", status_code=403)
    )
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "non_2xx"


def test_invalid_url_rejected() -> None:
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "not-a-url",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "invalid_url"


def test_independent_source_accepted(monkeypatch) -> None:
    _patch_client(
        monkeypatch,
        _FakeResponse(
            "https://directory.example.com/aromas-medspa",
            text="Online booking not available yet for this listing.",
        ),
    )
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.rejected_reason is None
    assert result.source is not None
    assert result.source.source_url == "https://directory.example.com/aromas-medspa"
    assert "online booking not available" in result.source.content.lower()


def test_fetch_failure_rejected(monkeypatch) -> None:
    def _raise(*args, **kwargs):
        raise httpx.ConnectTimeout("simulated timeout")

    class _RaisingClient:
        def __call__(self, *a, **k):
            return self

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **k):
            _raise()

    monkeypatch.setattr(public_web_fetcher.httpx, "Client", _RaisingClient())
    result = public_web_fetcher.resolve_and_fetch_independent_source(
        "https://vertexaisearch.example/redirect",
        business_domain="aromaslaser.com",
        original_source_urls=set(),
    )
    assert result.source is None
    assert result.rejected_reason == "fetch_failed"


# --- zero-independent-source vs epistemic-insufficiency semantics ---------


def test_no_independent_source_found_carries_no_outcome() -> None:
    v = VerificationModel(
        verification_id="v1",
        run_id="r1",
        business_id="b1",
        investigation_id="i1",
        hypothesis_id="h1",
        opportunity_id="online_booking_friction",
        original_status="CONFIRMED",
        verification_target="target",
        execution_status=VerificationExecutionStatus.COMPLETED,
        outcome=None,
        no_independent_source_found=True,
        independent_sources_fetched=0,
        created_at="t",
    )
    assert v.outcome is None
    assert v.no_independent_source_found is True


def test_no_independent_source_found_rejects_an_outcome() -> None:
    with pytest.raises(ValueError, match="no_independent_source_found"):
        VerificationModel(
            verification_id="v1",
            run_id="r1",
            business_id="b1",
            investigation_id="i1",
            hypothesis_id="h1",
            opportunity_id="online_booking_friction",
            original_status="CONFIRMED",
            verification_target="target",
            execution_status=VerificationExecutionStatus.COMPLETED,
            outcome="INSUFFICIENT_EVIDENCE",
            no_independent_source_found=True,
            independent_sources_fetched=0,
            created_at="t",
        )


def test_failed_execution_rejects_an_outcome() -> None:
    with pytest.raises(ValueError, match="FAILED"):
        VerificationModel(
            verification_id="v1",
            run_id="r1",
            business_id="b1",
            investigation_id="i1",
            hypothesis_id="h1",
            opportunity_id="online_booking_friction",
            original_status="CONFIRMED",
            verification_target="target",
            execution_status=VerificationExecutionStatus.FAILED,
            outcome="SUPPORTS",
            failure_reason="boom",
            created_at="t",
        )
