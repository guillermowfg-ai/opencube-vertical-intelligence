"""Deterministic construction of the immutable verification_target.

The proposition an independent Verification is asked to resolve must be
bounded to what the original Evidence actually established — never the raw
OpportunityDefinition description, never freely written by Gemini, and
never mutated after search results are seen (implementation prompt
section 5 / section 19).

No Gemini call. No randomness. Same inputs -> same output.
"""

from __future__ import annotations

from app.investigator.models import OpportunityStatus

# One deterministic template pair per (opportunity_id, original_status).
# CONTRADICTED and INSUFFICIENT_EVIDENCE target the same underlying
# proposition that was originally evaluated -- never a new opposite claim.
_TARGETS: dict[tuple[str, OpportunityStatus], str] = {
    ("online_booking_friction", OpportunityStatus.CONFIRMED): (
        "The inspected public presence does not expose a visible direct "
        "online booking path."
    ),
    ("online_booking_friction", OpportunityStatus.CONTRADICTED): (
        "The inspected public presence exposes a visible direct online "
        "booking path."
    ),
    ("online_booking_friction", OpportunityStatus.INSUFFICIENT_EVIDENCE): (
        "The inspected public presence does not expose a visible direct "
        "online booking path."
    ),
    ("after_hours_lead_intake", OpportunityStatus.CONFIRMED): (
        "The inspected public presence exposes no asynchronous or "
        "after-hours lead intake channel beyond a telephone number."
    ),
    ("after_hours_lead_intake", OpportunityStatus.CONTRADICTED): (
        "The inspected public presence exposes an asynchronous or "
        "after-hours lead intake channel beyond a telephone number."
    ),
    ("after_hours_lead_intake", OpportunityStatus.INSUFFICIENT_EVIDENCE): (
        "The inspected public presence exposes no asynchronous or "
        "after-hours lead intake channel beyond a telephone number."
    ),
    ("lead_follow_up_effectiveness", OpportunityStatus.CONFIRMED): (
        "The business's public presence does not exhibit a published, "
        "verifiable lead follow-up response-time commitment."
    ),
    ("lead_follow_up_effectiveness", OpportunityStatus.CONTRADICTED): (
        "The business's public presence exhibits a published, verifiable "
        "lead follow-up response-time commitment."
    ),
    ("lead_follow_up_effectiveness", OpportunityStatus.INSUFFICIENT_EVIDENCE): (
        "The business's public presence does not exhibit a published, "
        "verifiable lead follow-up response-time commitment."
    ),
}


class UnknownVerificationTargetError(ValueError):
    """Raised when no deterministic template exists for this input pair."""


def build_verification_target(opportunity_id: str, original_status: OpportunityStatus) -> str:
    """Deterministically derive the bounded proposition to independently verify.

    Raises UnknownVerificationTargetError rather than fabricating a target
    for an (opportunity_id, status) pair this module has no template for --
    a missing template must fail closed, not silently invent a claim.
    """
    key = (opportunity_id, original_status)
    if key not in _TARGETS:
        raise UnknownVerificationTargetError(
            f"No deterministic verification_target template for "
            f"opportunity_id={opportunity_id!r}, original_status={original_status!r}"
        )
    return _TARGETS[key]
