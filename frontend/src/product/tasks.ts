/**
 * Task templates.
 *
 * Exactly one template exists, because exactly one workflow is genuinely
 * executable today. The shape allows more later; it must never advertise a
 * capability the back end cannot perform.
 */

import { TEAM, type TeamMemberId } from "./team";
import { fill } from "../i18n";
import type { Dictionary } from "../i18n";
import type { CatalogResponse } from "../lib/types";

export type TaskTemplateId = "market_opportunity_intelligence";

export interface TaskTemplate {
  id: TaskTemplateId;
  team: TeamMemberId[];
  /** Every member is required: the back end has no way to skip a stage, so
   * the picker presents them as required rather than as fake toggles. */
  requiresFullTeam: true;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "market_opportunity_intelligence",
    team: TEAM.map((member) => member.id),
    requiresFullTeam: true,
  },
];

export const DEFAULT_TEMPLATE = TASK_TEMPLATES[0];

/**
 * The instruction the user is asking for, in their own language.
 *
 * Built from the template and the real, published execution parameters -- not
 * from a free-text box the back end would silently ignore. `POST /runs`
 * accepts no instruction field, so inventing one would be a lie told in the
 * user's own words.
 */
export function buildTaskInstruction(
  t: Dictionary,
  execution: { vertical: string; geography: string; target_business_count: number },
): string {
  return fill(t.taskTemplates.market_opportunity_intelligence.instruction, {
    vertical: execution.vertical,
    geography: execution.geography,
    count: execution.target_business_count,
  });
}

/** The execution parameters the API publishes, with a safe fallback shape for
 * the moment before /catalog resolves. */
export function executionOf(catalog: CatalogResponse | null) {
  return catalog?.execution ?? null;
}
