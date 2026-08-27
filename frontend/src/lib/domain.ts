/**
 * Presentation vocabulary for the pipeline's statuses.
 *
 * This file assigns labels, colours and one-line meanings. It does not assign
 * *outcomes*: no function here decides whether something matched, was
 * confirmed, or needs review — it only describes a value the backend already
 * produced. The three layers are deliberately kept visually distinct, because
 * conflating them is the exact mistake this product exists to avoid:
 *
 *   epistemic   OpportunityStatus     what the Investigator concluded
 *   independent VerificationState     what an independent source said
 *   commercial  MatchStatus           whether OpenCube can act on it
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
  | "negative"
  | "caution"
  | "neutral"
  | "info"
  | "brand";

interface ToneClasses {
  badge: string;
  dot: string;
  /** Solid fill for chart marks. These steps were validated with the dataviz
   * palette checker: teal / rose / amber / slate / blue clears CVD
   * separation, the normal-vision floor and 3:1 contrast against the light
   * surface. Slate deliberately sits below the chroma floor — it is the
   * reserved neutral status and is meant to read as grey. */
  fill: string;
  accentText: string;
}

/** Full class strings, never interpolated, so Tailwind's scanner sees them. */
export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  positive: {
    badge: "bg-teal-50 text-teal-800 ring-teal-600/20",
    dot: "bg-teal-600",
    fill: "bg-teal-600",
    accentText: "text-teal-700",
  },
  negative: {
    badge: "bg-rose-50 text-rose-800 ring-rose-600/20",
    dot: "bg-rose-700",
    fill: "bg-rose-700",
    accentText: "text-rose-700",
  },
  caution: {
    badge: "bg-amber-50 text-amber-900 ring-amber-600/25",
    dot: "bg-amber-600",
    fill: "bg-amber-600",
    accentText: "text-amber-700",
  },
  neutral: {
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
    dot: "bg-slate-500",
    fill: "bg-slate-500",
    accentText: "text-slate-600",
  },
  info: {
    badge: "bg-blue-50 text-blue-800 ring-blue-700/20",
    dot: "bg-blue-700",
    fill: "bg-blue-700",
    accentText: "text-blue-700",
  },
  brand: {
    badge: "bg-brand-50 text-brand-700 ring-brand-600/25",
    dot: "bg-brand-500",
    fill: "bg-brand-500",
    accentText: "text-brand-700",
  },
};

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** Shown in a tooltip and in detail panels — the sentence that makes the
   * status legible to someone who did not build the pipeline. */
  meaning: string;
}

export const MATCH_STATUS: Record<MatchStatus, StatusMeta> = {
  MATCHED: {
    label: "Matched",
    tone: "positive",
    meaning:
      "Commercially eligible: the evidence supports an opportunity an OpenCube capability addresses. Not contact authorisation.",
  },
  NOT_MATCHED: {
    label: "Not matched",
    tone: "neutral",
    meaning:
      "Evaluated and rejected. The evidence contradicted the opportunity, or independently confirmed it does not apply.",
  },
  UNRESOLVED: {
    label: "Unresolved",
    tone: "caution",
    meaning:
      "The Investigator and the independent verification disagree, or the evidence never cleared the confirmation bar. Needs a human.",
  },
};

export const OPPORTUNITY_STATUS: Record<OpportunityStatus, StatusMeta> = {
  CONFIRMED: {
    label: "Confirmed",
    tone: "positive",
    meaning: "The Investigator found evidence supporting this opportunity.",
  },
  CONTRADICTED: {
    label: "Contradicted",
    tone: "negative",
    meaning: "The Investigator found evidence against this opportunity.",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient evidence",
    tone: "caution",
    meaning:
      "Nothing publicly observable settled the question either way. Not a negative finding.",
  },
  UNVERIFIED: {
    label: "Unverified",
    tone: "neutral",
    meaning: "Formed but not yet assessed.",
  },
};

export const VERIFICATION_STATE: Record<VerificationState, StatusMeta> = {
  SUPPORTS: {
    label: "Supports",
    tone: "positive",
    meaning: "An independent source corroborated the original finding.",
  },
  CONTRADICTS: {
    label: "Contradicts",
    tone: "negative",
    meaning: "An independent source disagreed with the original finding.",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Inconclusive",
    tone: "caution",
    meaning:
      "Independent sources were read but did not settle the question either way.",
  },
  NO_INDEPENDENT_SOURCE: {
    label: "No independent source",
    tone: "neutral",
    meaning:
      "No source independent of the business itself could be found. Deliberately not recorded as inconclusive.",
  },
  FAILED: {
    label: "Verification failed",
    tone: "negative",
    meaning:
      "The verification attempt did not complete technically. A different fact from an inconclusive result.",
  },
  IN_PROGRESS: {
    label: "Verifying",
    tone: "info",
    meaning: "The verification attempt is still running.",
  },
  NONE: {
    label: "Not verified",
    tone: "neutral",
    meaning: "No independent verification was attempted for this hypothesis.",
  },
  UNKNOWN: {
    label: "Unrecognised",
    tone: "neutral",
    meaning:
      "The verification record matches none of the known states and was not forced into one.",
  },
};

export const RUN_STATUS: Record<RunStatus, StatusMeta> = {
  CREATED: { label: "Created", tone: "neutral", meaning: "Persisted, not yet queued." },
  QUEUED: { label: "Queued", tone: "neutral", meaning: "Accepted; discovery task enqueued." },
  DISCOVERING: {
    label: "Discovering",
    tone: "info",
    meaning: "Market Scout is finding and filtering candidate businesses.",
  },
  INVESTIGATING: {
    label: "Investigating",
    tone: "info",
    meaning: "One worker per business is gathering evidence and forming hypotheses.",
  },
  FINALIZING: {
    label: "Finalising",
    tone: "info",
    meaning: "Verification and opportunity matching are running over the run's hypotheses.",
  },
  IN_PROGRESS: { label: "In progress", tone: "info", meaning: "Running." },
  COMPLETED: {
    label: "Completed",
    tone: "positive",
    meaning: "Every investigation finished successfully and the run was finalised.",
  },
  FAILED: {
    label: "Failed",
    tone: "negative",
    meaning:
      "At least one investigation failed. Results from the rest of the run are still produced and still valid.",
  },
};

export const INVESTIGATION_STATUS: Record<InvestigationStatus, StatusMeta> = {
  IN_PROGRESS: { label: "In progress", tone: "info", meaning: "Worker running." },
  COMPLETED: { label: "Completed", tone: "positive", meaning: "Finished successfully." },
  FAILED: { label: "Failed", tone: "negative", meaning: "The worker did not complete." },
};

const RUN_PHASES: RunStatus[] = [
  "QUEUED",
  "DISCOVERING",
  "INVESTIGATING",
  "FINALIZING",
  "COMPLETED",
];

export const PHASE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  DISCOVERING: "Discovery",
  INVESTIGATING: "Investigation",
  FINALIZING: "Verification & matching",
  COMPLETED: "Complete",
};

export type PhaseState = "done" | "active" | "pending" | "failed";

/**
 * Positions a run on the Discovery → Investigation → Verification → Matching
 * spine. Purely presentational ordering of a status the backend set; it never
 * infers a phase the run did not report.
 */
export function runPhaseStates(status: RunStatus): Record<string, PhaseState> {
  const legacyIndex: Partial<Record<RunStatus, number>> = {
    CREATED: 0,
    IN_PROGRESS: 2,
  };
  const current = legacyIndex[status] ?? RUN_PHASES.indexOf(status);
  const failed = status === "FAILED";

  const states: Record<string, PhaseState> = {};
  RUN_PHASES.forEach((phase, index) => {
    if (failed) {
      states[phase] = phase === "COMPLETED" ? "failed" : "done";
      return;
    }
    if (current < 0) {
      states[phase] = "pending";
      return;
    }
    // A completed run has no active phase left — the last node is done, not
    // still running.
    const terminal = status === "COMPLETED";
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

/** Reason codes are exhaustive and frozen backend-side; the UI shows the
 * backend's own `reasoning` sentence and only shortens the code for a chip. */
export function reasonCodeLabel(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function opportunityTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  switch (type) {
    case "PAIN":
      return "Pain";
    case "CAPABILITY_GAP":
      return "Capability gap";
    case "COST_OPTIMIZATION":
      return "Cost optimisation";
    default:
      return reasonCodeLabel(type);
  }
}

export function evidenceRoleMeta(role: string): StatusMeta {
  switch (role) {
    case "SUPPORTING":
      return {
        label: "Supporting",
        tone: "positive",
        meaning: "Cited by the hypothesis as evidence for the opportunity.",
      };
    case "CONTRADICTING":
      return {
        label: "Contradicting",
        tone: "negative",
        meaning: "Cited by the hypothesis as evidence against the opportunity.",
      };
    default:
      return {
        label: "Independent",
        tone: "info",
        meaning: "Collected by the Verification Loop from a source outside the business.",
      };
  }
}

/** The state a match's verification was in, reconstructed for display from
 * the fields the Matcher already stored on the match itself. */
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
