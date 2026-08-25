"""Minimal source-adapter seam.

Every retrieval module (public_web_fetcher today; an independent
verification source later) produces `SourceMaterial`. This is the only
contract the reasoning layer depends on, so adding a second, independent
source in a later milestone does not require a rewrite of the reasoning
layer. No plugin framework or source registry — just this shape.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.investigator.models import SourceType


class SourceMaterial(BaseModel):
    source_type: SourceType
    source_url: str
    retrieved_at: str
    content: str
