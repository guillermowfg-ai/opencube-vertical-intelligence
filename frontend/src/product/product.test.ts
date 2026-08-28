import { describe, expect, it } from "vitest";
import { TEAM, teamMember } from "./team";
import { DEFAULT_TEMPLATE, TASK_TEMPLATES, buildTaskInstruction } from "./tasks";
import { memberState } from "./activity";
import { capabilityLabel, opportunityLabel } from "./labels";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import type { RunStatusResponse } from "../lib/types";

const RUN: RunStatusResponse = {
  run_id: "5fc062f1-3f5c-46ae-8f7f-9981ab11b669",
  status: "COMPLETED",
  vertical: "Med Spa",
  geography: "Miami-Dade County, Florida",
  provider_capabilities: ["AI Voice Reception"],
  created_at: "2026-08-26T18:29:43+00:00",
  started_at: "2026-08-26T18:29:43+00:00",
  completed_at: "2026-08-26T18:33:36+00:00",
  failure_message: null,
  businesses_total: 10,
  investigations_total: 10,
  investigations_completed: 10,
  investigations_failed: 0,
  investigations_in_progress: 0,
  hypotheses_total: 30,
  verifications_total: 10,
  verifications_completed: 10,
  matches_total: 30,
  discovery_queries: [],
  discovery_raw_candidate_count: 40,
  investigation_count: 10,
  completed_investigation_count: 10,
  failed_investigation_count: 0,
  is_terminal: true,
};

const run = (patch: Partial<RunStatusResponse>): RunStatusResponse => ({ ...RUN, ...patch });

describe("the team", () => {
  it("has exactly the four real members, in workflow order", () => {
    expect(TEAM.map((m) => m.id)).toEqual([
      "market_scout",
      "business_investigator",
      "verification_agent",
      "opportunity_matcher",
    ]);
    expect(TEAM.map((m) => m.step)).toEqual([1, 2, 3, 4]);
  });

  it("labels the Matcher a decision engine, never an AI agent", () => {
    expect(teamMember("opportunity_matcher").kind).toBe("engine");
    for (const id of ["market_scout", "business_investigator", "verification_agent"] as const) {
      expect(teamMember(id).kind).toBe("agent");
    }
    // And the words match the distinction, in both languages.
    expect(en.team.kind.engine).not.toBe(en.team.kind.agent);
    expect(es.team.kind.engine).not.toBe(es.team.kind.agent);
    expect(en.team.kind.engine.toLowerCase()).not.toContain("agent");
    expect(es.team.kind.engine.toLowerCase()).not.toContain("agente");
  });

  it("names every member in both languages", () => {
    for (const member of TEAM) {
      expect(en.team.members[member.id].name.length).toBeGreaterThan(0);
      expect(es.team.members[member.id].name.length).toBeGreaterThan(0);
      expect(es.team.members[member.id].role).not.toBe(en.team.members[member.id].role);
    }
  });
});

describe("task templates", () => {
  it("offers exactly one, because exactly one is executable", () => {
    expect(TASK_TEMPLATES).toHaveLength(1);
    expect(DEFAULT_TEMPLATE.id).toBe("market_opportunity_intelligence");
  });

  it("requires the whole team — the back end cannot skip a stage", () => {
    expect(DEFAULT_TEMPLATE.requiresFullTeam).toBe(true);
    expect(DEFAULT_TEMPLATE.team).toEqual(TEAM.map((m) => m.id));
  });

  it("builds an instruction from the real parameters, in the reader's language", () => {
    const execution = {
      vertical: "Med Spa",
      geography: "Miami-Dade County, Florida",
      target_business_count: 10,
    };
    const english = buildTaskInstruction(en, execution);
    const spanish = buildTaskInstruction(es, execution);

    for (const text of [english, spanish]) {
      expect(text).toContain("Med Spa");
      expect(text).toContain("Miami-Dade County, Florida");
      expect(text).toContain("10");
      // No unfilled placeholders ever reach a user.
      expect(text).not.toMatch(/\{\w+\}/);
    }
    expect(english).not.toBe(spanish);
  });

  it("never promises anything the API cannot do", () => {
    const instruction = buildTaskInstruction(en, {
      vertical: "Med Spa",
      geography: "Miami-Dade County, Florida",
      target_business_count: 10,
    }).toLowerCase();
    // POST /runs accepts no free-text instruction and no scheduling, so the
    // generated wording must not imply either.
    for (const claim of ["every day", "schedule", "continuously", "monitor"]) {
      expect(instruction).not.toContain(claim);
    }
  });
});

describe("task activity derives from persisted progress", () => {
  const scout = teamMember("market_scout");
  const investigator = teamMember("business_investigator");
  const verifier = teamMember("verification_agent");
  const matcher = teamMember("opportunity_matcher");

  it("shows the whole team done when the task completed", () => {
    for (const member of TEAM) expect(memberState(member, RUN)).toBe("done");
  });

  it("waits on discovery until businesses_total is committed", () => {
    const queued = run({
      status: "QUEUED",
      businesses_total: null,
      investigations_total: 0,
      investigations_completed: 0,
      matches_total: 0,
      is_terminal: false,
    });
    expect(memberState(scout, queued)).toBe("working");
    expect(memberState(investigator, queued)).toBe("waiting");
    expect(memberState(verifier, queued)).toBe("waiting");
    expect(memberState(matcher, queued)).toBe("waiting");
  });

  it("moves to research once discovery has committed its business set", () => {
    const investigating = run({
      status: "INVESTIGATING",
      investigations_completed: 6,
      investigations_in_progress: 4,
      matches_total: 0,
      is_terminal: false,
    });
    expect(memberState(scout, investigating)).toBe("done");
    expect(memberState(investigator, investigating)).toBe("working");
    expect(memberState(verifier, investigating)).toBe("waiting");
  });

  it("moves verification and matching together, because the back end does", () => {
    const finalizing = run({ status: "FINALIZING", matches_total: 0, is_terminal: false });
    // There is no persisted moment where one is done and the other is not, so
    // the UI never claims one.
    expect(memberState(verifier, finalizing)).toBe(memberState(matcher, finalizing));
    expect(memberState(verifier, finalizing)).toBe("working");
  });

  it("marks only the stage that failed, keeping the rest of the work honest", () => {
    const failed = run({
      status: "FAILED",
      investigations_completed: 9,
      investigations_failed: 1,
      is_terminal: true,
    });
    expect(memberState(scout, failed)).toBe("done");
    expect(memberState(investigator, failed)).toBe("problem");
    // Matching still ran over what did complete.
    expect(memberState(matcher, failed)).toBe("done");
  });
});

describe("localized product metadata", () => {
  it("translates opportunity and service names by canonical ID", () => {
    expect(opportunityLabel(en, "online_booking_friction")).not.toBe(
      opportunityLabel(es, "online_booking_friction"),
    );
    expect(capabilityLabel(en, "automated_lead_follow_up")).not.toBe(
      capabilityLabel(es, "automated_lead_follow_up"),
    );
  });

  it("falls back to what the back end sent for an ID it does not know", () => {
    expect(opportunityLabel(en, "brand_new_thing", "Brand new thing")).toBe("Brand new thing");
    expect(capabilityLabel(en, "brand_new_service", "Brand new service")).toBe(
      "Brand new service",
    );
    // And to the raw ID when there is nothing else, rather than rendering blank.
    expect(opportunityLabel(en, "unknown_id")).toBe("unknown_id");
  });

  it("covers every ID the V1 catalog defines", () => {
    for (const id of [
      "online_booking_friction",
      "after_hours_lead_intake",
      "lead_follow_up_effectiveness",
    ]) {
      expect(en.productLabels.opportunities).toHaveProperty(id);
      expect(es.productLabels.opportunities).toHaveProperty(id);
    }
    for (const id of [
      "ai_appointment_booking_assistance",
      "missed_call_after_hours_lead_recovery",
      "automated_lead_follow_up",
    ]) {
      expect(en.productLabels.capabilities).toHaveProperty(id);
      expect(es.productLabels.capabilities).toHaveProperty(id);
    }
  });
});
