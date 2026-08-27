/**
 * The analysis list, shared by the command centre and the Analyses screen so
 * the two never disagree about what progress means.
 */

import type { ReactNode } from "react";
import { isRunLive } from "../lib/domain";
import { formatDateTime, formatDuration, formatRelative } from "../lib/format";
import { fitSegments } from "../lib/segments";
import { useStatus } from "../lib/useStatus";
import { fill, useI18n } from "../i18n";
import type { RunSummary } from "../lib/types";
import { DataTable, PrimaryCell, type Column } from "./ui/DataTable";
import { StatusBadge } from "./ui/StatusBadge";
import { MiniDistribution, ProgressBar } from "./ui/metrics";

export function RunsTable({ runs, empty }: { runs: RunSummary[]; empty?: ReactNode }) {
  const { t, locale } = useI18n();
  const status = useStatus();
  const copy = t.runs.table;

  const columns: Column<RunSummary>[] = [
    {
      key: "run",
      header: copy.run,
      className: "max-w-[300px]",
      render: (run) => (
        <PrimaryCell
          title={<span className="font-mono text-[0.8125rem]">{run.run_id}</span>}
          subtitle={`${run.vertical} · ${run.geography}`}
        />
      ),
    },
    {
      key: "status",
      header: copy.status,
      render: (run) => (
        <StatusBadge meta={status.run(run.status)} live={isRunLive(run.status)} />
      ),
    },
    {
      key: "progress",
      header: copy.progress,
      className: "min-w-[168px]",
      render: (run) => {
        const total = run.businesses_total ?? run.investigations_total;
        const done = run.investigations_completed + run.investigations_failed;
        if (total === 0) {
          return <span className="text-xs text-ink-muted">{copy.awaiting}</span>;
        }
        // Blue while work is still moving, amber once something failed, green
        // only when every business settled cleanly.
        const tone =
          run.investigations_failed > 0
            ? "caution"
            : done === total
              ? "positive"
              : "info";
        return (
          <div className="w-40">
            <ProgressBar
              value={done}
              max={total}
              tone={tone}
              label={
                <>
                  <span className="numerals font-medium text-ink">
                    {done}/{total}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {run.investigations_failed > 0
                      ? fill(copy.failedCount, { count: run.investigations_failed })
                      : run.investigations_in_progress > 0
                        ? fill(copy.running, { count: run.investigations_in_progress })
                        : copy.complete}
                  </span>
                </>
              }
            />
          </div>
        );
      },
    },
    {
      key: "outcomes",
      header: copy.outcomes,
      className: "min-w-[150px]",
      render: (run) =>
        run.matches_total === 0 ? (
          <span className="text-xs text-ink-muted">
            {isRunLive(run.status) ? copy.notYet : t.common.none}
          </span>
        ) : (
          <div>
            <MiniDistribution segments={fitSegments(run, status)} />
            <p className="numerals mt-1.5 text-xs text-ink-soft">
              <span className="font-medium text-green-700">
                {fill(copy.goodFit, { count: run.matches_matched })}
              </span>
              {run.matches_unresolved > 0 ? (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700">
                    {fill(copy.toReview, { count: run.matches_unresolved })}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        ),
    },
    {
      key: "findings",
      header: copy.findings,
      numeric: true,
      render: (run) => run.hypotheses_total,
    },
    {
      key: "started",
      header: copy.started,
      render: (run) => (
        <span
          title={formatDateTime(locale, run.created_at)}
          className="whitespace-nowrap text-ink-soft"
        >
          {formatRelative(locale, run.created_at)}
        </span>
      ),
    },
    {
      key: "duration",
      header: copy.duration,
      numeric: true,
      render: (run) => (
        <span className="text-ink-soft">
          {formatDuration(run.started_at ?? run.created_at, run.completed_at)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={runs}
      rowKey={(run) => run.run_id}
      rowHref={(run) => `/runs/${encodeURIComponent(run.run_id)}`}
      empty={empty}
    />
  );
}
