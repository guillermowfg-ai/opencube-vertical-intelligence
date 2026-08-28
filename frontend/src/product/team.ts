/**
 * The OpenCube Intelligence team.
 *
 * Each member is a real stage of the pipeline, not a persona invented for the
 * interface. The `kind` field matters: the Opportunity Matcher is a
 * deterministic decision engine, not a language model, and labelling it as an
 * agent would misrepresent the one part of the system that is provably
 * repeatable. That distinction is a product strength, so it is in the data
 * model rather than left to whoever writes a card.
 */

export type TeamMemberKind = "agent" | "engine";

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
  { id: "market_scout", kind: "agent", step: 1, phase: "DISCOVERING" },
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
