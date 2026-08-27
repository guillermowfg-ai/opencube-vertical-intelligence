/**
 * The run list, shared by Overview and Runs so the two never disagree about
 * what a run's progress means.
 */

import type { ReactNode } from "react";
import { RUN_STATUS, isRunLive } from "../lib/domain";
import { formatDateTime, formatDuration, formatRelative } from "../lib/format";
import { matchSegments } from "../lib/segments";
import type { RunSummary } from "../lib/types";
import { DataTable, PrimaryCell, type Column } from "./ui/DataTable";
import { StatusBadge } from "./ui/StatusBadge";
import { MiniDistribution, ProgressBar } from "./ui/metrics";

export function RunsTable({
  runs,
  empty,
}: {
  runs: RunSummary[];
  empty?: ReactNode;
}) {
  const columns: Column<RunSummary>[] = [
    {
      key: "run",
      header: "Run",
      render: (run) => (
        <PrimaryCell
          title={run.run_id}
          subtitle={`${run.vertical} · ${run.geography}`}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (run) => (
        <StatusBadge meta={RUN_STATUS[run.status]} live={isRunLive(run.status)} />
      ),
    },
    {
      key: "progress",
      header: "Investigations",
      className: "min-w-[168px]",
      render: (run) => {
        const total = run.businesses_total ?? run.investigations_total;
        const done = run.investigations_completed + run.investigations_failed;
        if (total === 0) {
          return <span className="text-xs text-ink-muted">Awaiting discovery</span>;
        }
        return (
          <div className="w-40">
            <ProgressBar
              value={done}
              max={total}
              tone={run.investigations_failed > 0 ? "caution" : "info"}
              label={
                <>
                  <span className="numerals font-medium text-ink">
                    {done}/{total}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {run.investigations_failed > 0
                      ? `${run.investigations_failed} failed`
                      : run.investigations_in_progress > 0
                        ? `${run.investigations_in_progress} running`
                        : "complete"}
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
      header: "Opportunities",
      className: "min-w-[150px]",
      render: (run) =>
        run.matches_total === 0 ? (
          <span className="text-xs text-ink-muted">
            {isRunLive(run.status) ? "Not yet matched" : "None"}
          </span>
        ) : (
          <div>
            <MiniDistribution segments={matchSegments(run)} />
            <p className="numerals mt-1.5 text-xs text-ink-soft">
              <span className="font-medium text-teal-700">{run.matches_matched}</span>{" "}
              matched
              {run.matches_unresolved > 0 ? (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700">
                    {run.matches_unresolved}
                  </span>{" "}
                  to review
                </>
              ) : null}
            </p>
          </div>
        ),
    },
    {
      key: "hypotheses",
      header: "Hypotheses",
      numeric: true,
      render: (run) => run.hypotheses_total,
    },
    {
      key: "started",
      header: "Started",
      render: (run) => (
        <span title={formatDateTime(run.created_at)} className="whitespace-nowrap text-ink-soft">
          {formatRelative(run.created_at)}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      numeric: true,
      render: (run) => (
        <span className="text-ink-soft">
          {run.completed_at
            ? formatDuration(run.started_at ?? run.created_at, run.completed_at)
            : isRunLive(run.status)
              ? "—"
              : "—"}
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
