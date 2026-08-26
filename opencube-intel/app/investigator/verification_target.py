"""Deterministic construction of the immutable verification_target.

The proposition an independent Verification is asked to resolve must be
bounded to what the original Evidence actually established — never the raw
OpportunityDefinition description, never freely written by Gemini, and
never mutated after search results are seen (implementation prompt
section 5 / section 19).

CRITICAL invariant: the canonical proposition for a given opportunity_id is
status-independent. SUPPORTS/CONTRADICTS/INSUFFICIENT_EVIDENCE must always
be evaluated against the SAME bounded claim regardless of whether the
original Investigator status was CONFIRMED, CONTRADICTED, or
INSUFFICIENT_EVIDENCE -- the original status is context for the reasoner,
never a selector for a different (let alone polarity-flipped) proposition.

No Gemini call. No randomness. Same inputs -> same output.
"""

from __future__ import annotations

from app.investigator.models import OpportunityStatus

# One canonical, status-independent target per opportunity_id. The original
# OpportunityStatus is accepted by build_verification_target below for
# call-site/context compatibility only -- it must never select a different
# entry here.
_CANONICAL_TARGETS: dict[str, str] = {
    "online_booking_friction": (
        "The inspected public presence does not expose a visible direct "
        "online booking path."
    ),
    "after_hours_lead_intake": (
        "The inspected public presence does not expose an asynchronous or "
        "after-hours lead intake channel beyond a telephone number."
    ),
    "lead_follow_up_effectiveness": (
        "The business's public presence does not exhibit a published, "
        "verifiable lead follow-up response-time commitment."
    ),
}


class UnknownVerificationTargetError(ValueError):
    """Raised when no deterministic template exists for this opportunity_id."""


def build_verification_target(opportunity_id: str, original_status: OpportunityStatus) -> str:
    """Deterministically derive the bounded, status-independent proposition
    to independently verify.

    `original_status` is accepted for context/compatibility only -- it never
    selects a different template. Raises UnknownVerificationTargetError
    rather than fabricating a target for an opportunity_id this module has
    no canonical template for -- a missing template must fail closed, not
    silently invent a claim.
    """
    del original_status  # context only -- must never change which target is returned
    if opportunity_id not in _CANONICAL_TARGETS:
        raise UnknownVerificationTargetError(
            f"No canonical verification_target template for opportunity_id={opportunity_id!r}"
        )
    return _CANONICAL_TARGETS[opportunity_id]
