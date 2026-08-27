import { describe, expect, it } from "vitest";
import {
  formatConfidence,
  formatDuration,
  formatRelative,
  hostnameOf,
  shortId,
} from "./format";

const EN = "en-US";
const ES = "es-419";

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
    expect(formatRelative(EN, "2026-08-27T11:59:30+00:00", now)).toMatch(/second/);
    expect(formatRelative(EN, "2026-08-27T11:20:00+00:00", now)).toMatch(/minute/);
    expect(formatRelative(EN, "2026-08-24T12:00:00+00:00", now)).toMatch(/day/);
  });

  it("follows the chosen language, so a Spanish screen is fully Spanish", () => {
    const now = new Date("2026-08-27T12:00:00+00:00").getTime();
    const english = formatRelative(EN, "2026-08-24T12:00:00+00:00", now);
    const spanish = formatRelative(ES, "2026-08-24T12:00:00+00:00", now);
    expect(english).not.toBe(spanish);
    expect(spanish).toMatch(/día|dias|días/i);
  });

  it("passes unparseable input straight through rather than showing a wrong date", () => {
    expect(formatRelative(EN, "not-a-date")).toBe("not-a-date");
    expect(formatRelative(EN, null)).toBe("—");
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
    const a = shortId("5fc062f1-3f5c-46ae-8f7f-9981ab11b669", 6);
    const b = shortId("5fc062f1-3f5c-46ae-8f7f-9981ab00000", 6);
    expect(a).not.toBe(b);
    expect(a.startsWith("5fc062")).toBe(true);
  });

  it("leaves short values alone", () => {
    expect(shortId("abc")).toBe("abc");
  });
});
