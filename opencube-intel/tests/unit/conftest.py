"""Shared in-memory fakes for the Production Execution V1 orchestration tests.

No Firestore emulator and no Cloud Tasks client: `firestore_store` is a thin,
flat module and `tasks_client` is a thin wrapper, so both are replaced
function-by-function. Documents are stored exactly as Firestore would hold
them -- `as_firestore_dict` output, i.e. enums already flattened to strings --
so a test can never pass because a model object happened to survive a round
trip that the real store would have flattened.
"""

from __future__ import annotations

import dataclasses

import pytest

from app.investigator import firestore_store, tasks_client
from app.investigator.models import as_firestore_dict


class FakeStore:
    """In-memory stand-in for every function in firestore_store."""

    def __init__(self) -> None:
        self.runs: dict[str, dict] = {}
        self.businesses: dict[str, dict] = {}
        self.investigations: dict[str, dict] = {}
        self.evidence: dict[str, dict] = {}
        self.hypotheses: dict[str, dict] = {}
        self.usage: dict[str, dict] = {}
        self.verifications: dict[str, dict] = {}
        self.matches: dict[str, dict] = {}
        self.forbidden_calls: list[str] = []

    # --- writes ---
    def save_run(self, run) -> None:
        self.runs[run.run_id] = as_firestore_dict(run)

    def save_business(self, business) -> None:
        self.businesses[business.business_id] = as_firestore_dict(business)

    def save_investigation(self, investigation) -> None:
        self.investigations[investigation.investigation_id] = as_firestore_dict(
            investigation
        )

    def save_evidence(self, evidence) -> None:
        self.forbidden_calls.append("save_evidence")
        self.evidence[evidence.evidence_id] = as_firestore_dict(evidence)

    def save_hypothesis(self, hypothesis) -> None:
        self.forbidden_calls.append("save_hypothesis")
        self.hypotheses[hypothesis.hypothesis_id] = as_firestore_dict(hypothesis)

    def save_usage_metadata(self, usage, doc_id: str) -> None:
        self.usage[doc_id] = as_firestore_dict(usage)

    def save_verification(self, verification) -> None:
        self.forbidden_calls.append("save_verification")
        self.verifications[verification.verification_id] = as_firestore_dict(
            verification
        )

    def save_opportunity_match(self, match) -> None:
        self.matches[match.match_id] = as_firestore_dict(match)

    # --- point reads ---
    def get_run(self, run_id: str) -> dict | None:
        return self.runs.get(run_id)

    def get_business(self, business_id: str) -> dict | None:
        return self.businesses.get(business_id)

    def get_investigation(self, investigation_id: str) -> dict | None:
        return self.investigations.get(investigation_id)

    def get_evidence(self, evidence_id: str) -> dict | None:
        return self.evidence.get(evidence_id)

    # --- queries ---
    def _by_run(self, table: dict[str, dict], run_id: str) -> list[dict]:
        return [d for d in table.values() if d.get("run_id") == run_id]

    def list_investigations_for_run(self, run_id: str) -> list[dict]:
        return self._by_run(self.investigations, run_id)

    def list_evidence_for_run(self, run_id: str) -> list[dict]:
        return self._by_run(self.evidence, run_id)

    def list_hypotheses_for_run(self, run_id: str) -> list[dict]:
        return self._by_run(self.hypotheses, run_id)

    def list_verifications_for_run(self, run_id: str) -> list[dict]:
        return self._by_run(self.verifications, run_id)

    def list_matches_for_run(self, run_id: str) -> list[dict]:
        return self._by_run(self.matches, run_id)

    def list_usage_for_run(self, run_id: str) -> list[dict]:
        return self._by_run(self.usage, run_id)

    def list_businesses_for_run(self, run_id: str) -> list[dict]:
        out = []
        for inv in self.list_investigations_for_run(run_id):
            business = self.businesses.get(inv["business_id"])
            if business is not None:
                out.append(business)
        return out

    def list_evidence_for_investigation(self, investigation_id: str) -> list[dict]:
        return [
            d
            for d in self.evidence.values()
            if d.get("investigation_id") == investigation_id
        ]

    def list_hypotheses_for_investigation(self, investigation_id: str) -> list[dict]:
        return [
            d
            for d in self.hypotheses.values()
            if d.get("investigation_id") == investigation_id
        ]

    def list_usage_for_investigation(self, investigation_id: str) -> list[dict]:
        return [
            d for d in self.usage.values() if d.get("investigation_id") == investigation_id
        ]

    def list_verifications_for_hypothesis(self, hypothesis_id: str) -> list[dict]:
        return [
            d for d in self.verifications.values() if d.get("hypothesis_id") == hypothesis_id
        ]

    # --- read-only queries added for the frontend read API ---
    def list_runs(self, limit: int | None = None) -> list[dict]:
        return list(self.runs.values())[:limit]

    def list_all_businesses(self, limit: int | None = None) -> list[dict]:
        return list(self.businesses.values())[:limit]

    def list_all_investigations(self, limit: int | None = None) -> list[dict]:
        return list(self.investigations.values())[:limit]

    def list_all_hypotheses(self, limit: int | None = None) -> list[dict]:
        return list(self.hypotheses.values())[:limit]

    def list_all_verifications(self, limit: int | None = None) -> list[dict]:
        return list(self.verifications.values())[:limit]

    def list_all_matches(self, limit: int | None = None) -> list[dict]:
        return list(self.matches.values())[:limit]

    def get_hypothesis(self, hypothesis_id: str) -> dict | None:
        return self.hypotheses.get(hypothesis_id)

    def get_verification(self, verification_id: str) -> dict | None:
        return self.verifications.get(verification_id)

    def get_match(self, match_id: str) -> dict | None:
        return self.matches.get(match_id)


_STORE_FUNCTIONS = (
    "save_run",
    "save_business",
    "save_investigation",
    "save_evidence",
    "save_hypothesis",
    "save_usage_metadata",
    "save_verification",
    "save_opportunity_match",
    "get_run",
    "get_business",
    "get_investigation",
    "get_evidence",
    "list_investigations_for_run",
    "list_evidence_for_run",
    "list_hypotheses_for_run",
    "list_verifications_for_run",
    "list_matches_for_run",
    "list_usage_for_run",
    "list_businesses_for_run",
    "list_evidence_for_investigation",
    "list_hypotheses_for_investigation",
    "list_usage_for_investigation",
    "list_verifications_for_hypothesis",
    "list_runs",
    "list_all_businesses",
    "list_all_investigations",
    "list_all_hypotheses",
    "list_all_verifications",
    "list_all_matches",
    "get_hypothesis",
    "get_verification",
    "get_match",
)


@dataclasses.dataclass
class EnqueuedTask:
    name: str
    route: str
    payload: dict
    dispatch_deadline_s: int


class FakeTasks:
    """Stand-in for tasks_client.enqueue with real Cloud Tasks name semantics:
    a name that already exists is reported as a duplicate (False), never as a
    second task."""

    def __init__(self) -> None:
        self.tasks: dict[str, EnqueuedTask] = {}
        self.attempts: list[str] = []
        self.raise_on_attempt: int | None = None
        self.raise_for_names: set[str] = set()

    def preexisting(self, *names: str) -> None:
        for name in names:
            self.tasks[name] = EnqueuedTask(name, "<preexisting>", {}, 0)

    def enqueue(self, *, route: str, payload: dict, name: str, dispatch_deadline_s: int) -> bool:
        self.attempts.append(name)
        if self.raise_on_attempt is not None and len(self.attempts) >= self.raise_on_attempt:
            raise RuntimeError("simulated Cloud Tasks transport error")
        if name in self.raise_for_names:
            raise RuntimeError("simulated Cloud Tasks transport error")
        if name in self.tasks:
            return False
        self.tasks[name] = EnqueuedTask(name, route, payload, dispatch_deadline_s)
        return True

    def names(self, prefix: str = "") -> list[str]:
        return sorted(n for n in self.tasks if n.startswith(prefix))


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch) -> FakeStore:
    fake = FakeStore()
    for name in _STORE_FUNCTIONS:
        monkeypatch.setattr(firestore_store, name, getattr(fake, name))
    return fake


@pytest.fixture
def tasks(monkeypatch: pytest.MonkeyPatch) -> FakeTasks:
    fake = FakeTasks()
    monkeypatch.setattr(tasks_client, "enqueue", fake.enqueue)
    return fake
