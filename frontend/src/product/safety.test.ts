/**
 * Structural guards on the product's security and honesty boundaries.
 *
 * These read the source rather than the behaviour on purpose: the point is
 * that the offending call cannot exist anywhere in browser code, not that one
 * particular screen happens not to make it today.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { es } from "../i18n/es";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) && !path.endsWith(".test.ts") ? [path] : [];
  });
}

const FILES = sourceFiles().map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("the internal task endpoints are never reachable from the browser", () => {
  it("references no /tasks/scout, /tasks/investigate or /tasks/finalize route", () => {
    // The product's own screens live under /tasks, so this looks for the
    // internal Cloud Tasks handler paths specifically.
    for (const { path, text } of FILES) {
      for (const route of ["/tasks/scout", "/tasks/investigate", "/tasks/finalize"]) {
        expect(text, `${path} must not reference ${route}`).not.toContain(route);
      }
    }
  });

  it("never sends a Cloud Tasks header", () => {
    for (const { path, text } of FILES) {
      expect(text.toLowerCase(), path).not.toContain("x-cloudtasks");
    }
  });
});

describe("writes", () => {
  it("has exactly one write in the API client, and it is POST /runs", () => {
    const api = FILES.find((f) => f.path.endsWith("lib/api.ts"))!.text;
    const methods = [...api.matchAll(/method:\s*"(\w+)"/g)].map((m) => m[1]);
    expect(methods).toEqual(["POST"]);
    expect(api).toContain("`/runs`");
  });

  it("gates that write behind Product Mode", () => {
    const api = FILES.find((f) => f.path.endsWith("lib/api.ts"))!.text;
    const createTask = api.slice(api.indexOf("createTask:"));
    expect(createTask).toContain("canLaunchTasks");
    // The guard must come before the request is built.
    expect(createTask.indexOf("canLaunchTasks")).toBeLessThan(
      createTask.indexOf("method: \"POST\""),
    );
  });

  it("sends only the field CreateRunRequest accepts", () => {
    const api = FILES.find((f) => f.path.endsWith("lib/api.ts"))!.text;
    const createTask = api.slice(api.indexOf("createTask:"), api.indexOf("};", api.indexOf("createTask:")));
    // vertical and geography are frozen; sending them can only produce a 422.
    expect(createTask).not.toContain("vertical");
    expect(createTask).not.toContain("geography");
  });
});

describe("no internal implementation detail is shown to a user", () => {
  const strings = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Object.values(value as Record<string, unknown>).flatMap(strings);

  const copy = [...strings(en), ...strings(es)].join("\n").toLowerCase();

  it("never mentions system prompts, chain of thought or model configuration", () => {
    for (const leak of [
      "system prompt",
      "prompt del sistema",
      "chain of thought",
      "cadena de pensamiento",
      "temperature",
      "gemini",
      "vertex",
      "cloud tasks",
      "firestore",
    ]) {
      expect(copy, `user-facing copy must not mention "${leak}"`).not.toContain(leak);
    }
  });

  it("does not lead with internal vocabulary in the product shell", () => {
    for (const jargon of ["hypothesis", "reconciliation", "hipótesis", "reconciliación"]) {
      expect(copy, `plain-language copy must not use "${jargon}"`).not.toContain(jargon);
    }
  });
});

describe("configuration honesty", () => {
  it("tells the user which settings are fixed rather than offering them", () => {
    expect(en.newTask.config.lockedHelp.length).toBeGreaterThan(20);
    expect(es.newTask.config.lockedHelp.length).toBeGreaterThan(20);
  });

  it("says plainly that the recorded services do not steer the analysis", () => {
    expect(en.newTask.config.capabilitiesHelp.toLowerCase()).toContain("does not change");
    expect(es.newTask.config.capabilitiesHelp.toLowerCase()).toContain("no cambia");
  });

  it("renders no free-text instruction box, since POST /runs accepts none", () => {
    const newTask = FILES.find((f) => f.path.endsWith("NewTaskPage.tsx"))!.text;
    expect(newTask).not.toContain("<textarea");
    expect(newTask).not.toMatch(/<input[^>]*type="text"/);
  });
});
