import { describe, expect, it } from "vitest";
import {
  formatConfidence,
  formatDuration,
  formatRelative,
  hostnameOf,
  pluralize,
  shortId,
} from "./format";

describe("formatDuration", () => {
  it("reports seconds, minutes and hours the way an operator says them", () => {
    const base = "2026-08-24T14:00:00+00:00";
    expect(formatDuration(base, "2026-08-24T14:00:42+00:00")).toBe("42s");
    expect(formatDuration(base, "2026-08-24T14:03:00+00:00")).toBe("3m");
    expect(formatDuration(base, "2026-08-24T14:03:20+00:00")).toBe("3m 20s");
    expect(formatDuration(base, "2026-08-24T16:14:00+00:00")).toBe("2h 14m");
  });

  it("refuses to invent a duration from a missing or reversed timestamp", () => {
    expect(formatDuration(null, "2026-08-24T14:00:00+00:00")).toBe("—");
    expect(formatDuration("2026-08-24T14:00:00+00:00", null)).toBe("—");
    expect(
      formatDuration("2026-08-24T15:00:00+00:00", "2026-08-24T14:00:00+00:00"),
    ).toBe("—");
  });
});

describe("formatRelative", () => {
  it("scales the unit to the distance", () => {
    const now = new Date("2026-08-27T12:00:00+00:00").getTime();
    expect(formatRelative("2026-08-27T11:59:30+00:00", now)).toMatch(/second/);
    expect(formatRelative("2026-08-27T11:20:00+00:00", now)).toMatch(/minute/);
    expect(formatRelative("2026-08-24T12:00:00+00:00", now)).toMatch(/day/);
  });

  it("passes unparseable input straight through rather than showing a wrong date", () => {
    expect(formatRelative("not-a-date")).toBe("not-a-date");
    expect(formatRelative(null)).toBe("—");
  });
});

describe("formatConfidence", () => {
  it("rounds to a whole percent, never implying more precision than exists", () => {
    expect(formatConfidence(0.8642)).toBe("86%");
    expect(formatConfidence(0)).toBe("0%");
    expect(formatConfidence(null)).toBe("—");
  });
});

describe("hostnameOf", () => {
  it("strips the scheme and www", () => {
    expect(hostnameOf("https://www.brickellglow.example.com/book")).toBe(
      "brickellglow.example.com",
    );
  });

  it("returns the raw value when it is not a URL", () => {
    expect(hostnameOf("places/abc")).toBe("places/abc");
    expect(hostnameOf(null)).toBe("—");
  });
});

describe("shortId", () => {
  it("keeps both ends so near-identical IDs stay distinguishable", () => {
    const a = shortId("run-2026-08-24__brickell-glow", 6);
    const b = shortId("run-2026-08-24__brickell-lux", 6);
    expect(a).not.toBe(b);
    expect(a.startsWith("run-20")).toBe(true);
  });

  it("leaves short values alone", () => {
    expect(shortId("abc")).toBe("abc");
  });
});

describe("pluralize", () => {
  it("handles the irregular case the KPI row needs", () => {
    expect(pluralize(1, "hypothesis", "hypotheses")).toBe("hypothesis");
    expect(pluralize(3, "hypothesis", "hypotheses")).toBe("hypotheses");
    expect(pluralize(2, "run")).toBe("runs");
  });
});
