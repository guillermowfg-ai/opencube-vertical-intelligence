"""Gemini reasoning layer.

Gemini reasons over supplied source material only. It is never the factual
source: every Evidence.source_url it emits is validated (deterministically,
downstream) against the set of URLs actually fetched by public_web_fetcher.
It evaluates exactly one OpportunityDefinition per call and is explicitly
forbidden from substituting a different pain when the supplied one fails.
"""

from __future__ import annotations

import datetime
import os

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.investigator.models import Business, OpportunityDefinition, OpportunityStatus
from app.investigator.source_adapter import SourceMaterial

MODEL = "gemini-3.6-flash"
_MAX_RETRIES = 2


class GeminiEvidenceItem(BaseModel):
    source_url: str
    observation: str


class GeminiHypothesisEvaluation(BaseModel):
    status: OpportunityStatus
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[GeminiEvidenceItem]
    supporting_evidence_indices: list[int]
    contradicting_evidence_indices: list[int]
    reasoning: str


class GeminiCallResult(BaseModel):
    evaluation: GeminiHypothesisEvaluation | None
    model: str
    prompt_tokens: int | None
    output_tokens: int | None
    thought_tokens: int | None
    total_tokens: int | None
    timestamp: str
    invocation_id: str | None
    raw_error: str | None = None


_SYSTEM_INSTRUCTION = """You are the evidence-evaluation core of a business intelligence \
system. You reason ONLY over the public source material explicitly supplied to you in \
this request. You are not the factual source — you interpret supplied material, you do \
not invent it.

Hard rules:
- Use only the supplied public evidence. Do not invent observations.
- Every evidence item's source_url MUST be copied EXACTLY from one of the supplied \
source URLs. Never fabricate or alter a URL.
- Do not assume operational problems that are not directly observable in the supplied \
material.
- Do not transform missing information into evidence. Absence of a signal on the pages \
you were given is not proof of absence in the business's real operations unless the \
opportunity definition's evidence_signals explicitly say so.
- Do not infer financial impact, lost revenue, or conversion rates.
- Do not invent technologies, vendors, or pricing that are not directly named in the \
supplied material.
- Evaluate ONLY the single opportunity definition supplied in this request. Do not \
propose, hint at, or evaluate any other opportunity.
- If the evidence cannot responsibly establish the claim, return status \
INSUFFICIENT_EVIDENCE. Do not force a CONFIRMED or CONTRADICTED status.
- If the evidence directly disproves the claim, return CONTRADICTED.
- If the hypothesis is contradicted or insufficient, do NOT search for or suggest a \
replacement pain to preserve a commercial reason to contact this business. That is a \
critical rule: a failed hypothesis is simply a failed hypothesis.
- Never assert any of the claims listed under "claims_not_allowed_without_evidence" \
unless the supplied material contains direct, explicit evidence for that exact claim.
"""


def _build_user_prompt(
    business: Business,
    definition: OpportunityDefinition,
    sources: list[SourceMaterial],
) -> str:
    source_block = "\n\n".join(
        f"[SOURCE {i}] url={s.source_url}\ntype={s.source_type.value}\n"
        f"content=\"\"\"{s.content}\"\"\""
        for i, s in enumerate(sources)
    )
    return f"""BUSINESS (identity context only — do not treat as evidence):
name: {business.display_name}
address: {business.formatted_address}
website: {business.website_url}

OPPORTUNITY DEFINITION TO EVALUATE (evaluate this one only):
opportunity_id: {definition.opportunity_id}
name: {definition.name}
type: {definition.opportunity_type.value}
description: {definition.description}
publicly_observable: {definition.publicly_observable}
evidence_signals (would SUPPORT the hypothesis if observed):
{chr(10).join(f"- {s}" for s in definition.evidence_signals)}
contradiction_signals (would CONTRADICT the hypothesis if observed):
{chr(10).join(f"- {s}" for s in definition.contradiction_signals)}
claims_not_allowed_without_evidence (never assert these without direct proof):
{chr(10).join(f"- {c}" for c in definition.claims_not_allowed_without_evidence)}

SUPPLIED SOURCE MATERIAL (the ONLY material you may reason over):
{source_block}

TASK:
1. Write 0-4 factual Evidence items. Each observation must describe only what is \
directly visible in the supplied source material (e.g. "The homepage displays a \
'Book Now' link that points to a Boulevard booking page."). Each evidence source_url \
must exactly match one of the SOURCE urls above.
2. Evaluate the opportunity definition's hypothesis using ONLY the evidence you just \
wrote. Return a status of CONFIRMED, CONTRADICTED, or INSUFFICIENT_EVIDENCE (never \
UNVERIFIED — you are performing the verification).
3. Reference which of your evidence items (by index, 0-based, in the order you wrote \
them) support vs. contradict the hypothesis.
4. State your confidence (0.0-1.0) and a short reasoning string.
"""


def evaluate_hypothesis(
    business: Business,
    definition: OpportunityDefinition,
    sources: list[SourceMaterial],
) -> GeminiCallResult:
    client = genai.Client(
        vertexai=True,
        project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
    )
    prompt = _build_user_prompt(business, definition, sources)

    last_error: str | None = None
    for _attempt in range(_MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=GeminiHypothesisEvaluation,
                    temperature=0.0,
                ),
            )
        except Exception as exc:  # network/API error — retry within bound
            last_error = str(exc)
            continue

        usage = response.usage_metadata
        result_kwargs = {
            "model": response.model_version or MODEL,
            "prompt_tokens": usage.prompt_token_count if usage else None,
            "output_tokens": usage.candidates_token_count if usage else None,
            "thought_tokens": usage.thoughts_token_count if usage else None,
            "total_tokens": usage.total_token_count if usage else None,
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "invocation_id": response.response_id,
        }

        parsed = response.parsed
        if isinstance(parsed, GeminiHypothesisEvaluation):
            source_urls = {s.source_url for s in sources}
            if all(e.source_url in source_urls for e in parsed.evidence):
                return GeminiCallResult(evaluation=parsed, **result_kwargs)
            last_error = "Gemini cited a source_url not present in supplied sources"
            continue
        last_error = "Gemini response did not parse into the expected schema"

    return GeminiCallResult(
        evaluation=None,
        model=MODEL,
        prompt_tokens=None,
        output_tokens=None,
        thought_tokens=None,
        total_tokens=None,
        timestamp=datetime.datetime.now(datetime.UTC).isoformat(),
        invocation_id=None,
        raw_error=last_error,
    )
