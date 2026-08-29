/**
 * The OpenCube Intelligence team.
 *
 * Each member is a real stage of the pipeline, not a persona invented for the
 * interface. The `kind` field matters, and there are three of them because
 * exactly three things happen here.
 *
 * Only the Investigator and the Verification Agent reason with a language
 * model. The Market Scout makes no model call at all -- it searches a business
 * directory and filters the results by fixed rules -- and the Opportunity
 * Matcher is a deterministic decision engine. Calling either of those an "AI
 * agent" would misrepresent the two parts of the system that are provably
 * repeatable, which is a product strength, so the distinction lives in the data
 * model rather than being left to whoever writes a card.
 */

export type TeamMemberKind = "discovery" | "agent" | "engine";

export interface TeamMember {
  id: TeamMemberId;
  kind: TeamMemberKind;
  /** Position in the workflow, 1-based. */
  step: number;
  /** The run phase this member is responsible for, used to derive live
   * activity from persisted progress. */
  phase: "DISCOVERING" | "INVESTIGATING" | "FINALIZING";
}

export type TeamMemberId =
  | "market_scout"
  | "business_investigator"
  | "verification_agent"
  | "opportunity_matcher";

export const TEAM: TeamMember[] = [
  // No model call: a business-directory search plus deterministic filtering.
  { id: "market_scout", kind: "discovery", step: 1, phase: "DISCOVERING" },
  { id: "business_investigator", kind: "agent", step: 2, phase: "INVESTIGATING" },
  { id: "verification_agent", kind: "agent", step: 3, phase: "FINALIZING" },
  // Deterministic: a fixed lookup table, zero model calls. Never an agent.
  { id: "opportunity_matcher", kind: "engine", step: 4, phase: "FINALIZING" },
];

export function teamMember(id: TeamMemberId): TeamMember {
  const member = TEAM.find((entry) => entry.id === id);
  if (!member) throw new Error(`Unknown team member: ${id}`);
  return member;
}
