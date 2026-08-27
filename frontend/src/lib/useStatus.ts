/**
 * Joins the colour vocabulary (`domain.ts`) to the translated words
 * (`src/i18n`). Components ask for a status and get back everything they need
 * to render it in the current language.
 */

import {
  EVIDENCE_ROLE_TONE,
  FINDING_TONE,
  FIT_TONE,
  RESEARCH_TONE,
  RUN_TONE,
  SECOND_OPINION_TONE,
  type Tone,
} from "./domain";
import { useI18n } from "../i18n";
import type {
  InvestigationStatus,
  MatchStatus,
  OpportunityStatus,
  RunStatus,
  VerificationState,
} from "./types";

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** The sentence that makes the status legible to someone who did not build
   * the pipeline. Shown on hover, and in full on detail screens. */
  meaning: string;
}

export function useStatus() {
  const { t } = useI18n();

  return {
    /** What our own research concluded. */
    finding: (status: OpportunityStatus): StatusMeta => ({
      ...t.status.finding[status],
      tone: FINDING_TONE[status],
    }),

    /** What a source outside the business said. */
    secondOpinion: (state: VerificationState): StatusMeta => ({
      ...t.status.secondOpinion[state],
      tone: SECOND_OPINION_TONE[state],
    }),

    /** Whether OpenCube has something that helps. */
    fit: (status: MatchStatus): StatusMeta => ({
      ...t.status.fit[status],
      tone: FIT_TONE[status],
    }),

    run: (status: RunStatus): StatusMeta => ({
      ...t.status.run[status],
      tone: RUN_TONE[status],
    }),

    research: (status: InvestigationStatus): StatusMeta => ({
      ...t.status.research[status],
      tone: RESEARCH_TONE[status],
    }),

    evidenceRole: (role: string): StatusMeta => {
      const key = role in t.status.evidence ? (role as keyof typeof t.status.evidence) : "INDEPENDENT";
      return { ...t.status.evidence[key], tone: EVIDENCE_ROLE_TONE[key] ?? "info" };
    },
  };
}

export type StatusHelpers = ReturnType<typeof useStatus>;
