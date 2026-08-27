/**
 * The colour half of the status vocabulary. The words live in `src/i18n`.
 *
 * Splitting them is deliberate: a status's colour is a fact about the design
 * system and must not change with the language, while its label and its
 * plain-language explanation must.
 *
 * Three layers are kept visually distinct, because conflating them is the
 * exact mistake this product exists to avoid:
 *
 *   finding        OpportunityStatus     what our own research concluded
 *   secondOpinion  VerificationState     what a source outside the business said
 *   fit            MatchStatus           whether OpenCube has something that helps
 */

import type {
  InvestigationStatus,
  MatchStatus,
  OpportunityStatus,
  RunStatus,
  VerificationState,
} from "./types";

export type Tone =
  | "positive"
  | "caution"
  | "negative"
  | "muted"
  | "neutral"
  | "info"
  | "brand";

interface ToneClasses {
  badge: string;
  dot: string;
  /** Solid fill for chart marks. Validated with the dataviz palette checker in
   * the render order below (green -> amber -> rose -> slate -> violet -> cyan):
   * lightness, normal-vision separation and 3:1 contrast all pass. Green and
   * rose are never placed adjacent -- that pair is the classic red/green
   * confusion and cannot be tuned into compliance. The one remaining warning,
   * green<->amber at dE 6.2, sits in the band that is legal with secondary
   * encoding, which every distribution here has: a 2px gap between segments
   * plus a legend carrying the label, the count and the share as text.
   * Slate is deliberately below the chroma floor -- it is the reserved
   * "nothing here" tone and is meant to read as grey. */
  fill: string;
  /** Same colour as `fill`, for an SVG arc. Written out rather than derived
   * from `fill` at runtime: Tailwind only generates classes it can see as
   * literal strings in the source. */
  stroke: string;
  accentText: string;
}

/** Full class strings, never interpolated, so Tailwind's scanner sees them. */
export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  positive: {
    badge: "bg-green-50 text-green-800 ring-green-600/20",
    dot: "bg-green-600",
    fill: "bg-green-600",
    stroke: "stroke-green-600",
    accentText: "text-green-700",
  },
  caution: {
    badge: "bg-amber-50 text-amber-900 ring-amber-600/25",
    dot: "bg-amber-600",
    fill: "bg-amber-600",
    stroke: "stroke-amber-600",
    accentText: "text-amber-700",
  },
  negative: {
    badge: "bg-rose-50 text-rose-800 ring-rose-600/20",
    dot: "bg-rose-600",
    fill: "bg-rose-600",
    stroke: "stroke-rose-600",
    accentText: "text-rose-700",
  },
  muted: {
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
    dot: "bg-slate-500",
    fill: "bg-slate-500",
    stroke: "stroke-slate-500",
    accentText: "text-slate-600",
  },
  neutral: {
    badge: "bg-violet-50 text-violet-800 ring-violet-600/20",
    dot: "bg-violet-600",
    fill: "bg-violet-600",
    stroke: "stroke-violet-600",
    accentText: "text-violet-700",
  },
  info: {
    badge: "bg-cyan-50 text-cyan-900 ring-cyan-600/25",
    dot: "bg-cyan-600",
    fill: "bg-cyan-600",
    stroke: "stroke-cyan-600",
    accentText: "text-cyan-700",
  },
  brand: {
    badge: "bg-brand-50 text-brand-700 ring-brand-600/25",
    dot: "bg-brand-500",
    fill: "bg-brand-500",
    stroke: "stroke-brand-500",
    accentText: "text-brand-700",
  },
};

/** Render order for every distribution, chosen so green and rose are never
 * neighbours. Also reads as a spectrum: yes -> unsure -> no -> nothing. */
const TONE_RANK: Record<Tone, number> = {
  positive: 0,
  caution: 1,
  negative: 2,
  muted: 3,
  neutral: 4,
  info: 5,
  brand: 6,
};

export function compareTone(a: Tone, b: Tone): number {
  return TONE_RANK[a] - TONE_RANK[b];
}

export const FIT_TONE: Record<MatchStatus, Tone> = {
  MATCHED: "positive",
  UNRESOLVED: "caution",
  NOT_MATCHED: "neutral",
};

export const FINDING_TONE: Record<OpportunityStatus, Tone> = {
  CONFIRMED: "positive",
  INSUFFICIENT_EVIDENCE: "caution",
  CONTRADICTED: "negative",
  UNVERIFIED: "muted",
};

export const SECOND_OPINION_TONE: Record<VerificationState, Tone> = {
  SUPPORTS: "positive",
  INSUFFICIENT_EVIDENCE: "caution",
  CONTRADICTS: "negative",
  FAILED: "muted",
  NO_INDEPENDENT_SOURCE: "neutral",
  IN_PROGRESS: "info",
  NONE: "muted",
  UNKNOWN: "muted",
};

export const RUN_TONE: Record<RunStatus, Tone> = {
  CREATED: "muted",
  QUEUED: "muted",
  DISCOVERING: "info",
  INVESTIGATING: "info",
  FINALIZING: "info",
  IN_PROGRESS: "info",
  COMPLETED: "positive",
  FAILED: "negative",
};

export const RESEARCH_TONE: Record<InvestigationStatus, Tone> = {
  IN_PROGRESS: "info",
  COMPLETED: "positive",
  FAILED: "negative",
};

export const EVIDENCE_ROLE_TONE: Record<string, Tone> = {
  SUPPORTING: "positive",
  CONTRADICTING: "negative",
  INDEPENDENT: "info",
};

export const RUN_PHASES = [
  "QUEUED",
  "DISCOVERING",
  "INVESTIGATING",
  "FINALIZING",
  "COMPLETED",
] as const;

export type RunPhase = (typeof RUN_PHASES)[number];
export type PhaseState = "done" | "active" | "pending" | "failed";

/**
 * Positions an analysis on the Find -> Research -> Check -> Match spine.
 * Purely presentational ordering of a status the back end set; it never infers
 * a phase the analysis did not report.
 */
export function runPhaseStates(status: RunStatus): Record<RunPhase, PhaseState> {
  const legacyIndex: Partial<Record<RunStatus, number>> = {
    CREATED: 0,
    IN_PROGRESS: 2,
  };
  const current = legacyIndex[status] ?? RUN_PHASES.indexOf(status as RunPhase);
  const failed = status === "FAILED";
  const terminal = status === "COMPLETED";

  const states = {} as Record<RunPhase, PhaseState>;
  RUN_PHASES.forEach((phase, index) => {
    if (failed) {
      states[phase] = phase === "COMPLETED" ? "failed" : "done";
      return;
    }
    if (current < 0) {
      states[phase] = "pending";
      return;
    }
    states[phase] =
      index < current || (terminal && index <= current)
        ? "done"
        : index === current
          ? "active"
          : "pending";
  });
  return states;
}

export function isRunLive(status: RunStatus): boolean {
  return status !== "COMPLETED" && status !== "FAILED";
}

/** Reason codes are exhaustive and frozen back-end side. The UI shows the
 * back end's own reasoning sentence and only tidies the code for a chip. */
export function reasonCodeLabel(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** The state a match's second opinion was in, reconstructed for display from
 * the fields the back end already stored on the match itself. */
export function verificationStateOf(match: {
  verification_id: string | null;
  verification_execution_status: string | null;
  verification_outcome: string | null;
  no_independent_source_found: boolean | null;
}): VerificationState {
  if (!match.verification_id) return "NONE";
  if (match.verification_execution_status === "FAILED") return "FAILED";
  if (match.verification_execution_status === "IN_PROGRESS") return "IN_PROGRESS";
  if (match.no_independent_source_found) return "NO_INDEPENDENT_SOURCE";
  if (match.verification_outcome) return match.verification_outcome as VerificationState;
  return "UNKNOWN";
}
