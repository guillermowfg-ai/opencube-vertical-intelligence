/** Turns a back-end `LabelledCount[]` into renderable segments.
 *
 * Counts are passed through untouched — this only attaches a label, a tone
 * and a meaning, then orders the segments so green and rose are never
 * neighbours in a stacked bar (see `compareTone`). */

import { compareTone, type Tone } from "./domain";
import type { StatusHelpers } from "./useStatus";
import type { LabelledCount, MatchStatus, OpportunityStatus, VerificationState } from "./types";

export interface Segment {
  key: string;
  label: string;
  count: number;
  tone: Tone;
  meaning?: string;
}

export type StatusKind = "fit" | "finding" | "secondOpinion";

function describe(status: StatusHelpers, kind: StatusKind, key: string) {
  try {
    if (kind === "fit") return status.fit(key as MatchStatus);
    if (kind === "finding") return status.finding(key as OpportunityStatus);
    return status.secondOpinion(key as VerificationState);
  } catch {
    // A key the UI has no vocabulary for is shown with the back end's own
    // label rather than dropped: an unrecognised state is information.
    return null;
  }
}

export function toSegments(
  counts: LabelledCount[],
  kind: StatusKind,
  status: StatusHelpers,
): Segment[] {
  return counts
    .map((entry) => {
      const meta = describe(status, kind, entry.key);
      return {
        key: entry.key,
        label: meta?.label ?? entry.label,
        count: entry.count,
        tone: meta?.tone ?? ("muted" as Tone),
        meaning: meta?.meaning,
      };
    })
    .sort((a, b) => compareTone(a.tone, b.tone));
}

/** Builds the three-way fit distribution from the flat counts a row carries,
 * so a table cell and a panel speak the same visual language. */
export function fitSegments(
  row: {
    matches_matched: number;
    matches_not_matched?: number;
    matches_unresolved: number;
  },
  status: StatusHelpers,
): Segment[] {
  return toSegments(
    [
      { key: "MATCHED", label: "MATCHED", count: row.matches_matched },
      { key: "UNRESOLVED", label: "UNRESOLVED", count: row.matches_unresolved },
      { key: "NOT_MATCHED", label: "NOT_MATCHED", count: row.matches_not_matched ?? 0 },
    ],
    "fit",
    status,
  );
}
