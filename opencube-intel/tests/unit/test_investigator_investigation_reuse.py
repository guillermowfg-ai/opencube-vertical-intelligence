from app.investigator import gemini_reasoner, investigator, public_web_fetcher
from app.investigator.catalog import ONLINE_BOOKING_FRICTION
from app.investigator.gemini_reasoner import GeminiCallResult
from app.investigator.models import Business, Investigation, InvestigationStatus, Run, RunStatus

RUN_ID = "run-1"


def _run() -> Run:
    return Run(
        run_id=RUN_ID,
        created_at="2026-08-25T00:00:00Z",
        status=RunStatus.IN_PROGRESS,
        vertical="Med Spa",
        geography="Miami-Dade County, Florida",
    )


def _biz() -> Business:
    return Business(
        business_id="biz-1",
        display_name="Test Spa",
        place_id="biz-1",
        website_url="https://example.com",
    )


def _patch_no_firestore_no_web(monkeypatch, save_investigation_calls: list[str]) -> None:
    monkeypatch.setattr(investigator.firestore_store, "save_run", lambda run: None)
    monkeypatch.setattr(investigator.firestore_store, "save_business", lambda business: None)
    monkeypatch.setattr(
        investigator.firestore_store,
        "save_investigation",
        lambda inv: save_investigation_calls.append(inv.investigation_id),
    )
    monkeypatch.setattr(investigator.firestore_store, "save_evidence", lambda e: None)
    monkeypatch.setattr(investigator.firestore_store, "save_hypothesis", lambda h: None)
    monkeypatch.setattr(
        investigator.firestore_store, "save_usage_metadata", lambda usage, doc_id: None
    )
    monkeypatch.setattr(public_web_fetcher, "fetch_business_sources", lambda url: [])


def test_run_investigation_reuses_precreated_investigation_without_duplicating(monkeypatch) -> None:
    save_investigation_calls: list[str] = []
    _patch_no_firestore_no_web(monkeypatch, save_investigation_calls)

    pre_created = Investigation(
        investigation_id="fixed-inv-id",
        run_id=RUN_ID,
        business_id="biz-1",
        created_at="2026-08-25T00:00:00Z",
        status=InvestigationStatus.IN_PROGRESS,
    )

    result = investigator.run_investigation(
        _run(), _biz(), [], investigation=pre_created, persist=True
    )

    assert result.investigation.investigation_id == "fixed-inv-id"
    # Only the completion update writes an Investigation document here — the
    # pre-created one was already persisted by the caller before this call.
    assert save_investigation_calls == ["fixed-inv-id"]


def test_run_investigation_populates_run_id_on_usage_metadata(monkeypatch) -> None:
    save_investigation_calls: list[str] = []
    _patch_no_firestore_no_web(monkeypatch, save_investigation_calls)

    monkeypatch.setattr(
        gemini_reasoner,
        "evaluate_hypothesis",
        lambda business, definition, sources: GeminiCallResult(
            evaluation=None,
            model="gemini-3.6-flash",
            prompt_tokens=1,
            output_tokens=1,
            thought_tokens=0,
            total_tokens=2,
            timestamp="2026-08-25T00:00:10Z",
            invocation_id="inv-1",
            raw_error="forced-none-for-test",
        ),
    )

    result = investigator.run_investigation(
        _run(), _biz(), [ONLINE_BOOKING_FRICTION], persist=True
    )

    assert len(result.usage) == 1
    assert result.usage[0].run_id == RUN_ID
    assert result.usage[0].investigation_id == result.investigation.investigation_id
