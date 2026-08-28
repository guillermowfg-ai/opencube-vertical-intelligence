/**
 * Turning persisted progress into what each team member is doing.
 *
 * Every state is derived from fields the pipeline already writes -- Run.status,
 * businesses_total, and the counts of investigations, verifications and
 * matches. Nothing is invented.
 *
 * One honest limitation is encoded here rather than papered over: the back end
 * runs verification and matching inside a single FINALIZING phase, so there is
 * no persisted moment at which the Verification Agent has finished and the
 * Opportunity Matcher has not started. Rather than fake a hand-off, both move
 * together, and the screen says so.
 */

import type { TeamMember } from "./team";
import type { RunStatusResponse } from "../lib/types";

export type MemberState = "waiting" | "working" | "done" | "problem";

/** The persisted fields each member's state is read from. Exported so the
 * tests exercise exactly what the screen renders. */
export function memberState(
  member: TeamMember,
  run: Pick<
    RunStatusResponse,
    | "status"
    | "businesses_total"
    | "investigations_total"
    | "investigations_completed"
    | "investigations_failed"
    | "verifications_total"
    | "matches_total"
    | "is_terminal"
  >,
): MemberState {
  const settled = run.investigations_completed + run.investigations_failed;
  const total = run.businesses_total ?? run.investigations_total;

  if (run.status === "FAILED") {
    // A failed analysis still produced whatever it produced; only the stage
    // that could not finish is marked as a problem.
    if (member.id === "market_scout") return total > 0 ? "done" : "problem";
    if (member.id === "business_investigator") {
      return run.investigations_failed > 0 ? "problem" : settled > 0 ? "done" : "problem";
    }
    return run.matches_total > 0 ? "done" : "problem";
  }

  if (run.status === "COMPLETED") return "done";

  switch (member.id) {
    case "market_scout":
      // businesses_total is the readiness barrier: it is written in the same
      // commit that ends discovery.
      return run.businesses_total !== null ? "done" : "working";
    case "business_investigator":
      if (run.businesses_total === null) return "waiting";
      return total > 0 && settled >= total ? "done" : "working";
    // Verification and matching share one phase; neither can be reported as
    // finished ahead of the other without inventing telemetry.
    case "verification_agent":
    case "opportunity_matcher":
      if (run.status === "FINALIZING") return "working";
      if (run.matches_total > 0) return "done";
      return "waiting";
    default:
      return "waiting";
  }
}
