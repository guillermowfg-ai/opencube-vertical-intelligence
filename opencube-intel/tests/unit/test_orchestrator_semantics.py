"""Regression guard: orchestration transports execution, it never reinterprets
an analytical result.

Every assertion here is about a boundary that the frozen contract forbids
crossing. If one of these fails, someone has moved analysis into the transport
layer.
"""

from __future__ import annotations

import ast
import inspect

import pytest
from orchestration_factories import (
    RUN_ID,
    make_hypothesis,
    make_verification,
    seed_run_with_investigations,
)

from app.investigator import (
    opportunity_matcher,
    run_orchestrator,
    verification_batch_runner,
    verification_selection,
)
from app.investigator.models import (
    InvestigationStatus,
    OpportunityStatus,
    VerificationExecutionStatus,
)

BUSINESS_IDS = ["biz0", "biz1"]


def _code_identifiers(module) -> set[str]:
    """Every identifier the module actually uses in code.

    Deliberately AST-based rather than a text search: the module's own
    docstring names the very concepts it promises not to decide, and a
    substring scan would flag that prose as a violation.
    """
    tree = ast.parse(inspect.getsource(module))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
        elif isinstance(node, ast.alias):
            names.add(node.asname or node.name.split(".")[-1])
    return names


def test_orchestrator_never_writes_analytical_documents_itself():
    """Evidence, hypotheses and verifications are written by the accepted
    engines. The orchestrator writes runs, businesses, investigations and
    matches -- nothing that carries an epistemic judgement it did not receive."""
    identifiers = _code_identifiers(run_orchestrator)
    for forbidden in (
        "save_hypothesis",
        "save_verification",
        "save_evidence",
        "save_usage_metadata",
    ):
        assert forbidden not in identifiers, (
            f"run_orchestrator must never call firestore_store.{forbidden}"
        )


def test_orchestrator_declares_no_analytical_vocabulary():
    """No status/outcome/reason-code decision may be spelled out here."""
    identifiers = _code_identifiers(run_orchestrator)
    for forbidden in ("MatchStatus", "MatchReasonCode", "VerificationOutcome"):
        assert forbidden not in identifiers, (
            f"run_orchestrator must not reference {forbidden}"
        )


def test_finalize_passes_the_frozen_selection_through_unmodified(
    store, tasks, monkeypatch
):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    hypotheses = [
        make_hypothesis("h0", "biz0", status=OpportunityStatus.CONFIRMED),
        make_hypothesis("h1", "biz1", status=OpportunityStatus.CONTRADICTED),
        make_hypothesis("h2", "biz0", status=OpportunityStatus.INSUFFICIENT_EVIDENCE),
    ]
    for hypothesis in hypotheses:
        store.save_hypothesis(hypothesis)

    expected = verification_selection.select_hypotheses_for_verification(hypotheses)
    seen: list[list[str]] = []

    def capture(run_id, businesses, definitions, hyps, *, persist):
        seen.append([h.hypothesis_id for h in hyps])
        return object()

    monkeypatch.setattr(verification_batch_runner, "run_verification_batch", capture)

    run_orchestrator.finalize_step(RUN_ID)

    assert seen == [[h.hypothesis_id for h in expected]]


def test_matcher_is_called_once_per_hypothesis_with_the_latest_verification(
    store, tasks, monkeypatch
):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    hypothesis = make_hypothesis("h0", "biz0")
    store.save_hypothesis(hypothesis)
    older = make_verification("v-old", hypothesis, created_at="2026-08-26T01:00:00+00:00")
    newer = make_verification("v-new", hypothesis, created_at="2026-08-26T02:00:00+00:00")
    store.save_verification(older)
    store.save_verification(newer)

    monkeypatch.setattr(
        verification_batch_runner,
        "run_verification_batch",
        lambda *a, **k: pytest.fail("already terminally verified"),
    )

    seen: list[tuple[str, str | None]] = []
    real_build_match = opportunity_matcher.build_match

    def spy_build_match(h, v):
        seen.append((h.hypothesis_id, v.verification_id if v else None))
        return real_build_match(h, v)

    monkeypatch.setattr(opportunity_matcher, "build_match", spy_build_match)

    run_orchestrator.finalize_step(RUN_ID)

    assert seen == [("h0", "v-new")], "the latest Verification by created_at wins"


def test_orchestrator_leaves_hypotheses_and_verifications_byte_identical(
    store, tasks, monkeypatch
):
    seed_run_with_investigations(
        store, BUSINESS_IDS, status=InvestigationStatus.COMPLETED
    )
    hypothesis = make_hypothesis("h0", "biz0")
    store.save_hypothesis(hypothesis)
    store.save_verification(
        make_verification(
            "v0", hypothesis, execution_status=VerificationExecutionStatus.COMPLETED
        )
    )
    before_hypotheses = {k: dict(v) for k, v in store.hypotheses.items()}
    before_verifications = {k: dict(v) for k, v in store.verifications.items()}
    # Only writes made from here on belong to the orchestrator; the seeding
    # above legitimately used the same store methods.
    writes_before = len(store.forbidden_calls)

    monkeypatch.setattr(
        verification_batch_runner,
        "run_verification_batch",
        lambda *a, **k: pytest.fail("nothing left to verify"),
    )

    run_orchestrator.finalize_step(RUN_ID)

    assert store.hypotheses == before_hypotheses
    assert store.verifications == before_verifications
    assert store.forbidden_calls[writes_before:] == [], (
        "the orchestrator rewrote an analytical document"
    )
