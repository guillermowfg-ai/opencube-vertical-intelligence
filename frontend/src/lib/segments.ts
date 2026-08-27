/** Turns a backend `LabelledCount[]` into renderable segments, using the
 * presentation vocabulary in `domain.ts`. Counts are passed through
 * untouched — this only attaches a label, a tone and a meaning. */

import {
  MATCH_STATUS,
  OPPORTUNITY_STATUS,
  VERIFICATION_STATE,
  type StatusMeta,
  type Tone,
} from "./domain";
import type { LabelledCount } from "./types";

export interface Segment {
  key: string;
  label: string;
  count: number;
  tone: Tone;
  meaning?: string;
}

export type StatusKind = "match" | "hypothesis" | "verification";

const LOOKUPS: Record<StatusKind, Record<string, StatusMeta | undefined>> = {
  match: MATCH_STATUS as Record<string, StatusMeta>,
  hypothesis: OPPORTUNITY_STATUS as Record<string, StatusMeta>,
  verification: VERIFICATION_STATE as Record<string, StatusMeta>,
};

export function toSegments(counts: LabelledCount[], kind: StatusKind): Segment[] {
  const lookup = LOOKUPS[kind];
  return counts.map((entry) => {
    const meta = lookup[entry.key];
    return {
      key: entry.key,
      label: meta?.label ?? entry.label,
      count: entry.count,
      tone: meta?.tone ?? "neutral",
      meaning: meta?.meaning,
    };
  });
}

/** Builds the three-way match distribution from the flat counts a row
 * carries, so a table cell and a panel speak the same visual language. */
export function matchSegments(row: {
  matches_matched: number;
  matches_not_matched?: number;
  matches_unresolved: number;
}): Segment[] {
  return toSegments(
    [
      { key: "MATCHED", label: "Matched", count: row.matches_matched },
      { key: "NOT_MATCHED", label: "Not matched", count: row.matches_not_matched ?? 0 },
      { key: "UNRESOLVED", label: "Unresolved", count: row.matches_unresolved },
    ],
    "match",
  );
}
