/**
 * Localized display labels for canonical back-end IDs.
 *
 * The pipeline stores English names on every record. These map the stable ID
 * to a label in the reader's language, without touching the record: an ID the
 * frontend has no label for falls through to whatever the back end sent, so a
 * newly added opportunity or service still appears rather than vanishing.
 *
 * This applies only to product metadata -- names of things OpenCube defines.
 * Evidence observations, verification questions and stored reasoning are
 * findings about the real world; they stay in the language they were recorded
 * in, because rewriting them in the browser would invent content.
 */

import type { Dictionary } from "../i18n";

export function opportunityLabel(
  t: Dictionary,
  opportunityId: string,
  fallback?: string | null,
): string {
  const labels = t.productLabels.opportunities as Record<string, string | undefined>;
  return labels[opportunityId] ?? fallback ?? opportunityId;
}

export function capabilityLabel(
  t: Dictionary,
  capabilityId: string | null | undefined,
  fallback?: string | null,
): string | null {
  if (!capabilityId) return fallback ?? null;
  const labels = t.productLabels.capabilities as Record<string, string | undefined>;
  return labels[capabilityId] ?? fallback ?? capabilityId;
}
