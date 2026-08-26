"""OpenCube capability catalog — Opportunity Matcher V1.

Declarative only, mirrors app/investigator/catalog.py's discipline: this
module is a static taxonomy (opportunity type -> corresponding OpenCube
capability), never a business-by-business inference. No capability catalog
existed in code before Opportunity Matcher V1 -- `OpportunityDefinition.
provider_capability` upstream is free text, not an ID.

Capability fit is NOT evidence of need (DECISIONS.md's Opportunity Matcher
V1 entry). This mapping is populated on every OpportunityMatch regardless of
match_status -- eligibility is carried exclusively by MatchStatus, never by
whether a capability_id is present.

CRM and Cloud PBX exist in OpenCube's commercial catalog but were never
independently evaluated as standalone factual opportunity classes by the
Business Investigator (see catalog.py's PBX_TELEPHONY_COST_OPTIMIZATION and
CRM_OPTIMIZATION_OR_REPLACEMENT, both declared-only, outside
EVALUATED_OPPORTUNITY_IDS). They must never appear as a primary or
supporting capability for any opportunity_id evaluated in V1.
"""

from __future__ import annotations

CAPABILITIES: dict[str, str] = {
    "ai_lead_intake_qualification": "AI Lead Intake & Qualification",
    "ai_appointment_booking_assistance": "AI Appointment / Booking Assistance",
    "ai_voice_reception_telephone_agent": "AI Voice Reception / Telephone Agent",
    "missed_call_after_hours_lead_recovery": "Missed-call / After-hours Lead Recovery",
    "automated_lead_follow_up": "Automated Lead Follow-up",
    "ai_client_concierge_faq": "AI Client Concierge / FAQ & Service Guidance",
    "crm": "CRM",
    "cloud_pbx_business_telephony": "Cloud PBX / Business Telephony",
    "workflow_automation_integrations": "Workflow Automation & Integrations",
    "website_landing_page_conversion": "Websites / Landing Page Conversion Infrastructure",
    "omnichannel_messaging": "Omnichannel Messaging",
    "marketing_digital_growth_enablement": "Marketing / Digital Growth Enablement",
}

# opportunity_id -> (primary_capability_id, [supporting_capability_ids]).
# Frozen for V1: only the three opportunity_ids Business Investigator V1
# actually evaluates (catalog.EVALUATED_OPPORTUNITY_IDS) appear here.
OPPORTUNITY_CAPABILITY_MAP: dict[str, tuple[str, list[str]]] = {
    "online_booking_friction": (
        "ai_appointment_booking_assistance",
        [],
    ),
    "after_hours_lead_intake": (
        "missed_call_after_hours_lead_recovery",
        ["ai_lead_intake_qualification"],
    ),
    "lead_follow_up_effectiveness": (
        "automated_lead_follow_up",
        [],
    ),
}


class UnknownOpportunityCapabilityMappingError(ValueError):
    """Raised when no deterministic capability mapping exists for this
    opportunity_id. Fails closed rather than fabricating a mapping --
    mirrors verification_target.UnknownVerificationTargetError."""


def get_capability_mapping(opportunity_id: str) -> tuple[str, list[str]]:
    """Deterministically return (primary_capability_id, supporting_capability_ids)
    for opportunity_id. Raises rather than silently returning an empty
    mapping for an opportunity_id this module has no taxonomy entry for."""
    if opportunity_id not in OPPORTUNITY_CAPABILITY_MAP:
        raise UnknownOpportunityCapabilityMappingError(
            f"No deterministic capability mapping for opportunity_id={opportunity_id!r}"
        )
    return OPPORTUNITY_CAPABILITY_MAP[opportunity_id]
