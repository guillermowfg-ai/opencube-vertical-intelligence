/**
 * Guards on the pre-submission corrections. Each one exists because the
 * opposite was true and shipped.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { en } from "../i18n/en";
import { es } from "../i18n/es";

const SRC = join(process.cwd(), "src");
function files(dir = SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(path) && !path.endsWith(".test.ts") ? [path] : [];
  });
}
const FILES = files().map((path) => ({ path, text: readFileSync(path, "utf8") }));
const provider = FILES.find((f) => f.path.endsWith("I18nProvider.tsx"))!.text;

describe("English is the first-time default", () => {
  it("does not consult the browser's language at all", () => {
    // A Spanish-locale browser must not silently switch an English demo.
    expect(provider).not.toContain("navigator.languages");
    expect(provider).not.toContain("navigator.language");
  });

  it("falls back to English, and only a stored choice overrides it", () => {
    const detect = provider.slice(provider.indexOf("function detect()"));
    expect(detect).toContain('readStored() ?? "en"');
  });

  it("still persists and reads back a chosen language", () => {
    expect(provider).toContain("localStorage.setItem");
    expect(provider).toContain("localStorage.getItem");
  });
});

describe("the human gate survives every wording", () => {
  for (const [lang, dict] of [["en", en], ["es", es]] as const) {
    it(`${lang}: a good fit is never contact authorisation`, () => {
      expect(dict.action.MATCHED.detail.length).toBeGreaterThan(20);
      const approval = `${dict.action.MATCHED.detail} ${dict.status.fit.MATCHED.meaning}`.toLowerCase();
      expect(approval).toMatch(lang === "en" ? /approve|person/ : /aprobaci|persona/);
    });

    it(`${lang}: a rejection is about the reason, not the business`, () => {
      const text = `${dict.action.NOT_MATCHED.label} ${dict.action.NOT_MATCHED.detail}`.toLowerCase();
      expect(text).toMatch(lang === "en" ? /this basis|this one reason|reason/ : /motivo/);
      // Never a verdict on the business itself.
      for (const absolute of ["bad business", "mal negocio", "not a good business"]) {
        expect(text).not.toContain(absolute);
      }
    });

    it(`${lang}: unresolved means wait for a person, not no`, () => {
      const text = `${dict.action.UNRESOLVED.label} ${dict.action.UNRESOLVED.detail}`.toLowerCase();
      expect(text).toMatch(lang === "en" ? /yet|review/ : /todav|revisi/);
    });
  }

  it("ships the approval sentence inside the component, not as a caption", () => {
    const verdict = FILES.find((f) => f.path.endsWith("DecisionChain.tsx"))!.text;
    expect(verdict).toContain("t.action[status]");
    expect(verdict).toContain("copy.detail");
  });
});

describe("opportunity definitions are not 'findings'", () => {
  it("never calls an evaluated definition something we found", () => {
    for (const [lang, dict] of [["en", en], ["es", es]] as const) {
      const label = lang === "en" ? dict.runDetail.kpi.findings : dict.runDetail.kpi.findings;
      expect(label.toLowerCase()).not.toContain(lang === "en" ? "finding" : "hallazgo");
      expect(label.toLowerCase()).toContain(lang === "en" ? "evaluated" : "evaluadas");
    }
  });

  it("keeps the correction in every place that renders the same count", () => {
    const labels = [
      en.runDetail.kpi.findings,
      en.runDetail.businessesTable.findings,
      en.runs.table.findings,
      en.businesses.table.findings,
    ];
    for (const label of labels) {
      expect(label.toLowerCase()).not.toContain("finding");
    }
  });
});

describe("the conservative story is data-driven", () => {
  it("templates the rejected count rather than stating one", () => {
    for (const dict of [en, es]) {
      expect(dict.conservative.headline).toContain("{rejected}");
      expect(dict.conservative.headline).toContain("{total}");
    }
  });

  it("hardcodes no run's numbers in the source", () => {
    // 27/30/2/1 belong to one task execution, never to the application.
    const pages = FILES.filter((f) => /pages|components/.test(f.path));
    for (const { path, text } of pages) {
      expect(text, path).not.toMatch(/\b27 of 30\b/);
      expect(text, path).not.toMatch(/27 de 30/);
    }
  });

  it("says what OpenCube is for, without marketing it", () => {
    expect(en.conservative.principle.toLowerCase()).toContain("stop unsupported");
    expect(es.conservative.principle.toLowerCase()).toContain("detener contactos sin respaldo");
  });
});

describe("evidence provenance stays visible and separate", () => {
  it("names both source categories distinctly, in both languages", () => {
    for (const dict of [en, es]) {
      expect(dict.chain.firstParty).not.toBe(dict.chain.outside);
      expect(dict.chain.firstParty.length).toBeGreaterThan(8);
      expect(dict.chain.outside.length).toBeGreaterThan(8);
    }
  });

  it("explains a zero first-party count instead of showing a bare zero", () => {
    for (const dict of [en, es]) {
      expect(dict.chain.noFirstParty.length).toBeGreaterThan(30);
      // And says the outside check still happened, when it did.
      expect(dict.chain.noFirstPartyWithOutside.length).toBeGreaterThan(
        dict.chain.noFirstParty.length,
      );
    }
  });

  it("renders the observation and its source URL for every evidence item", () => {
    const detail = FILES.find((f) => f.path.endsWith("MatchDetailPage.tsx"))!.text;
    const list = detail.slice(detail.indexOf("function EvidenceList("));
    expect(list).toContain("item.observation");
    expect(list).toContain("item.source_url");
    expect(list).toContain("item.collected_by");
  });

  it("keeps the two evidence sets on separate props, never merged", () => {
    const detail = FILES.find((f) => f.path.endsWith("MatchDetailPage.tsx"))!.text;
    expect(detail).toContain("data.hypothesis_evidence");
    expect(detail).toContain("data.verification_evidence");
    expect(detail).not.toContain("[...data.hypothesis_evidence, ...data.verification_evidence]");
  });

  it("never rewrites a persisted observation", () => {
    const detail = FILES.find((f) => f.path.endsWith("MatchDetailPage.tsx"))!.text;
    // Observations are rendered as-is; no translation lookup touches them.
    expect(detail).not.toMatch(/observationLabel|translate\(item\.observation/);
  });
});

describe("the decision chain is readable in order", () => {
  it("labels all five steps in both languages", () => {
    for (const dict of [en, es]) {
      for (const key of ["observation", "problem", "check", "decision", "action"] as const) {
        expect(dict.chain[key].length).toBeGreaterThan(3);
      }
    }
  });

  it("leads with the conclusion before any evidence", () => {
    const detail = FILES.find((f) => f.path.endsWith("MatchDetailPage.tsx"))!.text;
    expect(detail.indexOf("<ActionVerdict")).toBeLessThan(detail.indexOf("<ChainStep"));
  });
});

describe("stale runs cannot contaminate results", () => {
  it("asks the back end for the exclusion count rather than filtering client-side", () => {
    const types = FILES.find((f) => f.path.endsWith("lib/types.ts"))!.text;
    expect(types).toContain("active_runs_excluded");
  });
});
