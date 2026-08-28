/**
 * What was asked, where, and who did it.
 *
 * Every field is read from the task's own persisted record or rebuilt from the
 * published execution parameters. It shows the user-facing instruction and
 * nothing behind it: no system prompts, no agent instructions, no model
 * configuration. Task transparency is about what was asked, not about how the
 * asking was implemented.
 */

import { TEAM } from "../product/team";
import { DEFAULT_TEMPLATE, buildTaskInstruction } from "../product/tasks";
import { capabilityLabel } from "../product/labels";
import { useI18n } from "../i18n";
import { formatDateTime, formatDuration } from "../lib/format";
import type { ExecutionParameters, RunStatusResponse } from "../lib/types";
import { Chip } from "./ui/StatusBadge";
import { Card, Mono, SectionHeading } from "./ui/primitives";

export function TaskBrief({
  run,
  execution,
}: {
  run: RunStatusResponse;
  /** Published by /catalog. Null while it loads; the task's own persisted
   * vertical and geography still render without it. */
  execution: ExecutionParameters | null;
}) {
  const { t, locale } = useI18n();
  const copy = t.taskBrief;
  const template = t.taskTemplates[DEFAULT_TEMPLATE.id];

  // Built from the task's own persisted values, so a task always describes
  // what it actually ran with rather than today's defaults.
  const instruction = buildTaskInstruction(t, {
    vertical: run.vertical,
    geography: run.geography,
    target_business_count:
      run.businesses_total ?? execution?.target_business_count ?? run.investigations_total,
  });

  return (
    <Card>
      <SectionHeading title={copy.title} description={copy.subtitle} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow">{copy.task}</p>
          <p className="mt-1 text-[0.9375rem] font-semibold text-ink">{template.name}</p>

          <p className="eyebrow mt-4">{copy.instruction}</p>
          <blockquote className="mt-1.5 border-l-2 border-brand-300 pl-4 text-sm leading-relaxed text-ink">
            {instruction}
          </blockquote>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-3">
            <div>
              <dt className="eyebrow">{copy.market}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{run.vertical}</dd>
            </div>
            <div>
              <dt className="eyebrow">{copy.area}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{run.geography}</dd>
            </div>
            <div>
              <dt className="eyebrow">{copy.businessesRequested}</dt>
              <dd className="numerals mt-1 text-sm font-medium text-ink">
                {run.businesses_total ?? execution?.target_business_count ?? "—"}
              </dd>
            </div>
          </dl>

          {run.provider_capabilities.length > 0 ? (
            <div className="mt-4 border-t border-hairline pt-4">
              <p className="eyebrow mb-2">{copy.servicesRecorded}</p>
              <div className="flex flex-wrap gap-1.5">
                {run.provider_capabilities.map((capability) => (
                  <Chip key={capability}>{capabilityLabel(t, capability, capability)}</Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <p className="eyebrow">{copy.teamUsed}</p>
          <ul className="mt-2 space-y-2">
            {TEAM.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-hairline bg-canvas px-3 py-2"
              >
                <span
                  aria-hidden="true"
                  className="numerals flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-[0.6875rem] font-semibold text-ink-muted"
                >
                  {member.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {t.team.members[member.id].name}
                  </p>
                </div>
                <span className="shrink-0 text-[0.6875rem] tracking-[0.06em] text-ink-muted uppercase">
                  {t.team.kind[member.kind]}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 border-t border-hairline pt-4 text-sm">
            <p className="eyebrow">{copy.execution}</p>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-soft">{copy.started}</dt>
              <dd className="text-ink">{formatDateTime(locale, run.started_at ?? run.created_at)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-soft">{copy.finished}</dt>
              <dd className="text-ink">
                {run.completed_at ? formatDateTime(locale, run.completed_at) : copy.stillRunning}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-soft">{copy.duration}</dt>
              <dd className="numerals text-ink">
                {formatDuration(run.started_at ?? run.created_at, run.completed_at)}
              </dd>
            </div>
            <div className="border-t border-hairline pt-2.5">
              <dt className="eyebrow">{copy.reference}</dt>
              <dd className="mt-1">
                <Mono>{run.run_id}</Mono>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}
