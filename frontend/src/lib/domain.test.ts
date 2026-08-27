import { describe, expect, it } from "vitest";
import {
  MATCH_STATUS,
  OPPORTUNITY_STATUS,
  VERIFICATION_STATE,
  isRunLive,
  reasonCodeLabel,
  runPhaseStates,
  verificationStateOf,
} from "./domain";
import { matchSegments, toSegments } from "./segments";
import type { RunStatus } from "./types";

describe("verificationStateOf", () => {
  const base = {
    verification_id: "ver-1",
    verification_execution_status: "COMPLETED" as string | null,
    verification_outcome: null as string | null,
    no_independent_source_found: false as boolean | null,
  };

  it("reports no verification at all as NONE, not as a negative result", () => {
    expect(verificationStateOf({ ...base, verification_id: null })).toBe("NONE");
  });

  it("keeps 'found no independent source' distinct from 'inconclusive'", () => {
    expect(
      verificationStateOf({ ...base, no_independent_source_found: true }),
    ).toBe("NO_INDEPENDENT_SOURCE");
    expect(
      verificationStateOf({ ...base, verification_outcome: "INSUFFICIENT_EVIDENCE" }),
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("keeps a technical failure distinct from an epistemic one", () => {
    expect(
      verificationStateOf({ ...base, verification_execution_status: "FAILED" }),
    ).toBe("FAILED");
  });

  it("surfaces a still-running verification instead of guessing an outcome", () => {
    expect(
      verificationStateOf({ ...base, verification_execution_status: "IN_PROGRESS" }),
    ).toBe("IN_PROGRESS");
  });

  it("never invents an outcome for a completed record that carries none", () => {
    expect(verificationStateOf(base)).toBe("UNKNOWN");
  });
});

describe("status vocabularies", () => {
  it("keeps the three layers visually distinct where they would be confused", () => {
    // A hypothesis the Investigator confirmed and a match the Matcher rejected
    // must never read the same.
    expect(OPPORTUNITY_STATUS.CONFIRMED.tone).not.toBe(MATCH_STATUS.NOT_MATCHED.tone);
    // Unresolved is the review bucket; it must not read as a rejection.
    expect(MATCH_STATUS.UNRESOLVED.tone).toBe("caution");
    expect(MATCH_STATUS.NOT_MATCHED.tone).toBe("neutral");
  });

  it("gives every verification state a meaning, including the unrecognised one", () => {
    for (const meta of Object.values(VERIFICATION_STATE)) {
      expect(meta.meaning.length).toBeGreaterThan(10);
    }
  });
});

describe("runPhaseStates", () => {
  it("walks the spine as the run advances", () => {
    expect(runPhaseStates("QUEUED").QUEUED).toBe("active");
    expect(runPhaseStates("INVESTIGATING").DISCOVERING).toBe("done");
    expect(runPhaseStates("INVESTIGATING").FINALIZING).toBe("pending");
    // A completed run has no phase still running — the last node is done.
    expect(runPhaseStates("COMPLETED").COMPLETED).toBe("done");
    expect(runPhaseStates("COMPLETED").FINALIZING).toBe("done");
  });

  it("does not draw a failed run as if it stopped early", () => {
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
    for (const status of live) expect(isRunLive(status)).toBe(true);
    expect(isRunLive("COMPLETED")).toBe(false);
    expect(isRunLive("FAILED")).toBe(false);
  });
});

describe("segments", () => {
  it("passes counts through untouched and only attaches presentation", () => {
    const segments = toSegments(
      [
        { key: "CONFIRMED", label: "Confirmed", count: 9 },
        { key: "CONTRADICTED", label: "Contradicted", count: 3 },
      ],
      "hypothesis",
    );
    expect(segments.map((s) => s.count)).toEqual([9, 3]);
    expect(segments[0].tone).toBe(OPPORTUNITY_STATUS.CONFIRMED.tone);
    expect(segments[0].meaning).toBe(OPPORTUNITY_STATUS.CONFIRMED.meaning);
  });

  it("falls back to the backend's own label for a key it does not know", () => {
    const [segment] = toSegments([{ key: "NEW_STATE", label: "New state", count: 1 }], "match");
    expect(segment.label).toBe("New state");
    expect(segment.tone).toBe("neutral");
  });

  it("always emits all three match buckets so a zero is visible", () => {
    const segments = matchSegments({
      matches_matched: 8,
      matches_not_matched: 8,
      matches_unresolved: 0,
    });
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.key)).toEqual(["MATCHED", "NOT_MATCHED", "UNRESOLVED"]);
  });
});

describe("reasonCodeLabel", () => {
  it("humanises a frozen reason code without changing its meaning", () => {
    expect(reasonCodeLabel("CONFIRMED_INDEPENDENTLY_SUPPORTED")).toBe(
      "Confirmed independently supported",
    );
  });
});
