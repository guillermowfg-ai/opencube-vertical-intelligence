"""Med Spa Opportunity Catalog — V1.

Declarative only. Gemini does not invent opportunity categories in V1;
it evaluates only definitions supplied from this catalog, and only against
publicly-observable evidence gathered by the retrieval layer.

Reasoning direction (see implementation prompt section 8):
    OPENCUBE CAPABILITY -> RELEVANT OPPORTUNITY DEFINITIONS
        -> PUBLIC EVIDENCE -> BOUNDED HYPOTHESIS EVALUATION

Never:
    BUSINESS -> GEMINI FINDS ANYTHING NEGATIVE

Definitions A, B, C are evaluated in V1. D and E are declared for future
milestones only — they are intentionally excluded from `EVALUATED_OPPORTUNITY_IDS`
so the orchestrator never invokes Gemini against them today.
"""

from __future__ import annotations

from app.investigator.models import OpportunityDefinition, OpportunityType

ONLINE_BOOKING_FRICTION = OpportunityDefinition(
    opportunity_id="online_booking_friction",
    opportunity_type=OpportunityType.CAPABILITY_GAP,
    name="Online booking friction",
    provider_capability="AI Appointment / Booking Assistance",
    description=(
        "Evaluates whether the business exposes a direct, functioning online "
        "booking path, versus requiring phone-only scheduling or an unclear "
        "booking path."
    ),
    publicly_observable=True,
    evidence_signals=[
        "No visible booking call-to-action on the homepage or navigation.",
        "Appointments appear to require a telephone call only.",
        "A booking path exists but is unclear or requires an observable handoff "
        "(e.g. 'call to book', a broken or missing link).",
    ],
    contradiction_signals=[
        "A prominent 'Book Now' or equivalent call-to-action is present.",
        "A functioning direct booking platform (e.g. Boulevard, Vagaro, "
        "Mindbody) is linked and reachable.",
        "The booking path is clear and does not require a phone call.",
    ],
    claims_not_allowed_without_evidence=[
        "Booking conversion is low.",
        "Customers abandon the booking process.",
        "The business is losing $X in revenue.",
        "The current booking software performs poorly.",
    ],
    requires_independent_verification=False,
)

AFTER_HOURS_LEAD_INTAKE = OpportunityDefinition(
    opportunity_id="after_hours_lead_intake",
    opportunity_type=OpportunityType.PAIN,
    name="Immediate / after-hours lead intake",
    provider_capability=(
        "AI Lead Intake & Qualification, AI Voice Reception, "
        "Missed-call Recovery"
    ),
    description=(
        "Evaluates whether the business exposes any asynchronous or "
        "after-hours lead intake channel beyond a telephone number."
    ),
    publicly_observable=True,
    evidence_signals=[
        "Only a telephone number is presented as a way to reach the business.",
        "No visible asynchronous digital intake channel (contact form, chat, "
        "booking alternative) is present.",
        "Published hours or contact information suggest inquiries outside "
        "business hours have no stated path to a response.",
    ],
    contradiction_signals=[
        "A visible 24/7 intake channel is present (form, chat, booking link).",
        "A functioning booking or contact path exists independent of a phone call.",
        "A functioning digital lead intake mechanism is present.",
    ],
    claims_not_allowed_without_evidence=[
        "Calls are being missed.",
        "Staff responds slowly.",
        "Leads are being lost.",
        "After-hours inquiries are being ignored.",
    ],
    requires_independent_verification=False,
)

LEAD_FOLLOW_UP_EFFECTIVENESS = OpportunityDefinition(
    opportunity_id="lead_follow_up_effectiveness",
    opportunity_type=OpportunityType.PAIN,
    name="Lead follow-up effectiveness",
    provider_capability="Automated Lead Follow-up",
    description=(
        "Evaluates whether the business's lead follow-up speed or quality is "
        "deficient. This is normally NOT observable from public web sources — "
        "included specifically to test that the system does not manufacture "
        "operational pain when no evidence exists."
    ),
    publicly_observable=False,
    evidence_signals=[
        "A direct, first-party account (e.g. a published response-time "
        "commitment) is the only acceptable public signal.",
    ],
    contradiction_signals=[
        "A published, verifiable guaranteed response time is met or exceeded "
        "by observable behavior.",
    ],
    claims_not_allowed_without_evidence=[
        "Follow-up is slow.",
        "Leads are forgotten.",
        "The sales team fails to nurture leads.",
        "Conversion is poor.",
    ],
    requires_independent_verification=True,
)

# --- Declared only. Not evaluated in V1. ---

PBX_TELEPHONY_COST_OPTIMIZATION = OpportunityDefinition(
    opportunity_id="pbx_telephony_cost_optimization",
    opportunity_type=OpportunityType.COST_OPTIMIZATION,
    name="PBX / business telephony cost optimization",
    provider_capability="AI Voice Reception / Telephony consolidation",
    description=(
        "Evaluates whether OpenCube could competitively replace, consolidate, "
        "or augment the business's telephony spend. The existence of a phone "
        "number or a PBX vendor does not by itself establish overpayment."
    ),
    publicly_observable=True,
    evidence_signals=[
        "The incumbent telephony/PBX provider is identifiable from public "
        "sources.",
    ],
    contradiction_signals=[
        "Published evidence shows a recently negotiated, competitive contract.",
    ],
    claims_not_allowed_without_evidence=[
        "The business is overpaying for telephony.",
        "A specific savings percentage or dollar amount is achievable "
        "(requires: incumbent provider, comparable plan, user/extension "
        "count, published incumbent pricing, feature parity, and an "
        "OpenCube comparable price — none of which may be fabricated).",
    ],
    requires_independent_verification=True,
)

CRM_OPTIMIZATION_OR_REPLACEMENT = OpportunityDefinition(
    opportunity_id="crm_optimization_or_replacement",
    opportunity_type=OpportunityType.CAPABILITY_GAP,
    name="CRM optimization / replacement",
    provider_capability="CRM Integration / Workflow Automation",
    description=(
        "Evaluates whether OpenCube could improve or replace the business's "
        "CRM/practice-management tooling. Vendor detection is factual "
        "evidence only if genuinely observable (e.g. a booking platform's "
        "branding on the site); it does not establish satisfaction, cost, "
        "configuration quality, or lost records."
    ),
    publicly_observable=True,
    evidence_signals=[
        "A CRM or practice-management vendor is identifiable from public "
        "sources (e.g. booking widget branding).",
    ],
    contradiction_signals=[
        "Published evidence shows a modern, actively maintained CRM "
        "integration with no observable gaps.",
    ],
    claims_not_allowed_without_evidence=[
        "Staff dislikes the CRM.",
        "The CRM is expensive.",
        "The CRM is poorly configured.",
        "Leads are being lost.",
        "Records are duplicated.",
    ],
    requires_independent_verification=True,
)

MED_SPA_CATALOG: list[OpportunityDefinition] = [
    ONLINE_BOOKING_FRICTION,
    AFTER_HOURS_LEAD_INTAKE,
    LEAD_FOLLOW_UP_EFFECTIVENESS,
    PBX_TELEPHONY_COST_OPTIMIZATION,
    CRM_OPTIMIZATION_OR_REPLACEMENT,
]

# V1 evaluates only these three. D and E remain catalog-only.
EVALUATED_OPPORTUNITY_IDS: frozenset[str] = frozenset(
    {
        ONLINE_BOOKING_FRICTION.opportunity_id,
        AFTER_HOURS_LEAD_INTAKE.opportunity_id,
        LEAD_FOLLOW_UP_EFFECTIVENESS.opportunity_id,
    }
)


def get_evaluated_definitions() -> list[OpportunityDefinition]:
    return [d for d in MED_SPA_CATALOG if d.opportunity_id in EVALUATED_OPPORTUNITY_IDS]
