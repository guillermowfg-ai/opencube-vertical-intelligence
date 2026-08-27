import { describe, expect, it } from "vitest";
import {
  FINDING_TONE,
  FIT_TONE,
  SECOND_OPINION_TONE,
  TONE_CLASSES,
  compareTone,
  isRunLive,
  reasonCodeLabel,
  runPhaseStates,
  verificationStateOf,
  type Tone,
} from "./domain";
import { fitSegments, toSegments } from "./segments";
import type { StatusHelpers } from "./useStatus";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import type { RunStatus } from "./types";

/** The real hook needs React context; the mapping it performs is this small,
 * so the tests exercise it directly against the English dictionary. */
const status = {
  finding: (key: keyof typeof en.status.finding) => ({
    ...en.status.finding[key],
    tone: FINDING_TONE[key as keyof typeof FINDING_TONE],
  }),
  secondOpinion: (key: keyof typeof en.status.secondOpinion) => ({
    ...en.status.secondOpinion[key],
    tone: SECOND_OPINION_TONE[key as keyof typeof SECOND_OPINION_TONE],
  }),
  fit: (key: keyof typeof en.status.fit) => ({
    ...en.status.fit[key],
    tone: FIT_TONE[key as keyof typeof FIT_TONE],
  }),
} as unknown as StatusHelpers;

describe("verificationStateOf", () => {
  const base = {
    verification_id: "ver-1",
    verification_execution_status: "COMPLETED" as string | null,
    verification_outcome: null as string | null,
    no_independent_source_found: false as boolean | null,
  };

  it("reports no second opinion at all as NONE, not as a negative result", () => {
    expect(verificationStateOf({ ...base, verification_id: null })).toBe("NONE");
  });

  it("keeps 'found no outside source' distinct from 'did not settle it'", () => {
    expect(verificationStateOf({ ...base, no_independent_source_found: true })).toBe(
      "NO_INDEPENDENT_SOURCE",
    );
    expect(
      verificationStateOf({ ...base, verification_outcome: "INSUFFICIENT_EVIDENCE" }),
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("keeps a technical failure distinct from an inconclusive answer", () => {
    expect(verificationStateOf({ ...base, verification_execution_status: "FAILED" })).toBe(
      "FAILED",
    );
  });

  it("surfaces a still-running check instead of guessing an outcome", () => {
    expect(
      verificationStateOf({ ...base, verification_execution_status: "IN_PROGRESS" }),
    ).toBe("IN_PROGRESS");
  });

  it("never invents an outcome for a completed record that carries none", () => {
    expect(verificationStateOf(base)).toBe("UNKNOWN");
  });
});

describe("status colours", () => {
  it("keeps the three layers visually distinct where they would be confused", () => {
    // A finding our research confirmed and an opportunity we decided against
    // must never read the same.
    expect(FINDING_TONE.CONFIRMED).not.toBe(FIT_TONE.NOT_MATCHED);
    // "Needs a person" is the review bucket; it must not read as a rejection.
    expect(FIT_TONE.UNRESOLVED).toBe("caution");
    expect(FIT_TONE.NOT_MATCHED).toBe("neutral");
  });

  it("never places green next to rose in the render order", () => {
    const ordered = (["positive", "caution", "negative", "muted", "neutral", "info"] as Tone[])
      .slice()
      .sort(compareTone);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const pair = [ordered[i], ordered[i + 1]];
      expect(pair.includes("positive") && pair.includes("negative")).toBe(false);
    }
  });

  it("gives every tone a chart fill and a matching stroke", () => {
    for (const [tone, classes] of Object.entries(TONE_CLASSES)) {
      expect(classes.stroke).toBe(classes.fill.replace("bg-", "stroke-"));
      expect(tone.length).toBeGreaterThan(0);
    }
  });
});

describe("runPhaseStates", () => {
  it("walks the spine as the analysis advances", () => {
    expect(runPhaseStates("QUEUED").QUEUED).toBe("active");
    expect(runPhaseStates("INVESTIGATING").DISCOVERING).toBe("done");
    expect(runPhaseStates("INVESTIGATING").FINALIZING).toBe("pending");
    // A finished analysis has no phase still running.
    expect(runPhaseStates("COMPLETED").COMPLETED).toBe("done");
    expect(runPhaseStates("COMPLETED").FINALIZING).toBe("done");
  });

  it("does not draw an analysis that ended with errors as if it stopped early", () => {
    const states = runPhaseStates("FAILED");
    expect(states.INVESTIGATING).toBe("done");
    expect(states.FINALIZING).toBe("done");
    expect(states.COMPLETED).toBe("failed");
  });

  it("keeps the pre-async statuses readable", () => {
    expect(runPhaseStates("IN_PROGRESS").INVESTIGATING).toBe("active");
    expect(runPhaseStates("CREATED").QUEUED).toBe("active");
  });
});

describe("isRunLive", () => {
  it("treats only the two terminal statuses as finished", () => {
    const live: RunStatus[] = [
      "CREATED",
      "QUEUED",
      "DISCOVERING",
      "INVESTIGATING",
      "FINALIZING",
      "IN_PROGRESS",
    ];
    for (const value of live) expect(isRunLive(value)).toBe(true);
    expect(isRunLive("COMPLETED")).toBe(false);
    expect(isRunLive("FAILED")).toBe(false);
  });
});

describe("segments", () => {
  it("passes counts through untouched and only attaches presentation", () => {
    const segments = toSegments(
      [
        { key: "CONFIRMED", label: "CONFIRMED", count: 9 },
        { key: "CONTRADICTED", label: "CONTRADICTED", count: 3 },
      ],
      "finding",
      status,
    );
    expect(segments.map((s) => s.count).sort()).toEqual([3, 9]);
    const confirmed = segments.find((s) => s.key === "CONFIRMED");
    expect(confirmed?.tone).toBe(FINDING_TONE.CONFIRMED);
    expect(confirmed?.label).toBe(en.status.finding.CONFIRMED.label);
  });

  it("orders segments so the green and rose fills are never neighbours", () => {
    const segments = toSegments(
      [
        { key: "CONFIRMED", label: "", count: 3 },
        { key: "CONTRADICTED", label: "", count: 32 },
        { key: "INSUFFICIENT_EVIDENCE", label: "", count: 28 },
      ],
      "finding",
      status,
    );
    expect(segments.map((s) => s.key)).toEqual([
      "CONFIRMED",
      "INSUFFICIENT_EVIDENCE",
      "CONTRADICTED",
    ]);
  });

  it("always emits all three fit buckets so a zero is visible", () => {
    const segments = fitSegments(
      { matches_matched: 3, matches_not_matched: 56, matches_unresolved: 0 },
      status,
    );
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.key)).toEqual(["MATCHED", "UNRESOLVED", "NOT_MATCHED"]);
  });
});

describe("translations", () => {
  it("covers every English key in Spanish, with different words", () => {
    const walk = (a: unknown, b: unknown, path: string): void => {
      if (typeof a === "string") {
        expect(typeof b, path).toBe("string");
        return;
      }
      const left = a as Record<string, unknown>;
      const right = b as Record<string, unknown>;
      expect(Object.keys(right).sort(), path).toEqual(Object.keys(left).sort());
      for (const key of Object.keys(left)) walk(left[key], right[key], `${path}.${key}`);
    };
    walk(en, es, "root");
  });

  it("keeps every placeholder the English string declares", () => {
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();
    const walk = (a: unknown, b: unknown, path: string): void => {
      if (typeof a === "string") {
        expect(placeholders(b as string), path).toEqual(placeholders(a));
        return;
      }
      const left = a as Record<string, unknown>;
      for (const key of Object.keys(left)) {
        walk(left[key], (b as Record<string, unknown>)[key], `${path}.${key}`);
      }
    };
    walk(en, es, "root");
  });

  it("actually translates the user-facing labels", () => {
    expect(es.nav.overview).not.toBe(en.nav.overview);
    expect(es.status.fit.MATCHED.label).not.toBe(en.status.fit.MATCHED.label);
    expect(es.matchDetail.step4.caveat).not.toBe(en.matchDetail.step4.caveat);
  });
});

/** The frozen reason codes from `app/investigator/models.py`
 * (MatchReasonCode). If the back end adds a cell, this list and both
 * dictionaries must grow with it. */
const REASON_CODES = [
  "CONFIRMED_NO_VERIFICATION",
  "CONFIRMED_INDEPENDENTLY_SUPPORTED",
  "CONFIRMED_INDEPENDENTLY_CONTRADICTED_CONFLICT",
  "CONFIRMED_VERIFICATION_INCONCLUSIVE",
  "CONFIRMED_NO_INDEPENDENT_SOURCE",
  "CONFIRMED_VERIFICATION_FAILED_TECHNICAL",
  "CONTRADICTED_UNVERIFIED",
  "CONTRADICTED_INDEPENDENTLY_SUPPORTED_CONFLICT",
  "CONTRADICTED_INDEPENDENTLY_CONFIRMED",
  "CONTRADICTED_VERIFICATION_INCONCLUSIVE",
  "CONTRADICTED_NO_INDEPENDENT_SOURCE",
  "CONTRADICTED_VERIFICATION_FAILED_TECHNICAL",
  "INSUFFICIENT_EVIDENCE_UNVERIFIED",
  "INSUFFICIENT_EVIDENCE_INDEPENDENTLY_SUPPORTED_UNRESOLVED",
  "INSUFFICIENT_EVIDENCE_INDEPENDENTLY_CONTRADICTED",
  "INSUFFICIENT_EVIDENCE_TWICE_INCONCLUSIVE",
  "INSUFFICIENT_EVIDENCE_NO_INDEPENDENT_SOURCE",
  "INSUFFICIENT_EVIDENCE_VERIFICATION_FAILED_TECHNICAL",
];

describe("reason codes", () => {
  it("has a plain-language reading for all 18 cells, in both languages", () => {
    expect(REASON_CODES).toHaveLength(18);
    for (const code of REASON_CODES) {
      expect(en.reasons, code).toHaveProperty(code);
      expect(es.reasons, code).toHaveProperty(code);
    }
  });

  it("carries no reading for a code the back end does not define", () => {
    expect(Object.keys(en.reasons).sort()).toEqual([...REASON_CODES].sort());
  });

  it("explains rather than restates the code", () => {
    for (const code of REASON_CODES) {
      const text = (en.reasons as Record<string, string>)[code];
      // A real sentence, not the code tidied up.
      expect(text.length, code).toBeGreaterThan(40);
      expect(text, code).not.toContain("_");
    }
  });
});

describe("reasonCodeLabel", () => {
  it("tidies a frozen reason code without changing its meaning", () => {
    expect(reasonCodeLabel("CONFIRMED_INDEPENDENTLY_SUPPORTED")).toBe(
      "Confirmed independently supported",
    );
  });
});
