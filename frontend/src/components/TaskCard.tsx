/**
 * One task, as the person who asked for it thinks about it.
 *
 * The task type and market lead; the internal run id stays available as
 * secondary metadata rather than as the title.
 */

import { Link } from "react-router-dom";
import { isRunLive } from "../lib/domain";
import { formatDuration, formatRelative } from "../lib/format";
import { useStatus } from "../lib/useStatus";
import { TEAM } from "../product/team";
import { DEFAULT_TEMPLATE } from "../product/tasks";
import { fill, useI18n } from "../i18n";
import type { RunSummary } from "../lib/types";
import { StatusBadge } from "./ui/StatusBadge";
import { Mono } from "./ui/primitives";
import { ProgressBar } from "./ui/metrics";
import { cx } from "../lib/cx";

export function TaskCard({ run }: { run: RunSummary }) {
  const { t, locale } = useI18n();
  const status = useStatus();
  const copy = t.tasks.card;
  const live = isRunLive(run.status);
  const total = run.businesses_total ?? run.investigations_total;
  const settled = run.investigations_completed + run.investigations_failed;

  return (
    <Link
      to={`/tasks/${encodeURIComponent(run.run_id)}`}
      className={cx(
        "card hover-lift block p-5",
        live && "border-brand-200 bg-brand-50/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-semibold text-ink">
            {t.taskTemplates[DEFAULT_TEMPLATE.id].name}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {run.vertical} · {run.geography}
          </p>
        </div>
        <StatusBadge meta={status.run(run.status)} live={live} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
        <span>{fill(copy.teamMembers, { count: TEAM.length })}</span>
        {total > 0 ? <span>{fill(copy.businesses, { count: total })}</span> : null}
        <span>{formatRelative(locale, run.created_at)}</span>
        <span>
          {run.completed_at
            ? fill(copy.completedIn, {
                duration: formatDuration(run.started_at ?? run.created_at, run.completed_at),
              })
            : live
              ? copy.running
              : "—"}
        </span>
      </div>

      {live && total > 0 ? (
        <div className="mt-4">
          <ProgressBar
            value={settled}
            max={total}
            tone={run.investigations_failed > 0 ? "caution" : "info"}
            label={
              <>
                <span className="numerals font-medium text-ink">
                  {settled}/{total}
                </span>
                <span className="text-xs text-ink-muted">{copy.running}</span>
              </>
            }
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4">
        {run.matches_total === 0 ? (
          <span className="text-sm text-ink-muted">{copy.nothingYet}</span>
        ) : (
          <>
            <span className="numerals text-sm font-medium text-green-700">
              {fill(copy.goodFit, { count: run.matches_matched })}
            </span>
            {run.matches_unresolved > 0 ? (
              <span className="numerals text-sm font-medium text-amber-700">
                {fill(copy.needsReview, { count: run.matches_unresolved })}
              </span>
            ) : null}
          </>
        )}
        <span className="ml-auto text-sm font-medium text-brand-600">
          {copy.viewResults} →
        </span>
      </div>

      <p className="mt-3 text-[0.6875rem] text-ink-muted">
        {copy.reference} <Mono>{run.run_id}</Mono>
      </p>
    </Link>
  );
}
