/** Runs — every discovery-to-matching sweep, newest first. */

import { api, useResource } from "../lib/api";
import { isRunLive } from "../lib/domain";
import { pluralize } from "../lib/format";
import { RunsTable } from "../components/RunsTable";
import { Card, PageHeader } from "../components/ui/primitives";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

export function RunsPage() {
  const { data, error, loading, reload } = useResource(
    (signal) => api.runs(50, signal),
    [],
    { pollMs: 30_000 },
  );

  const live = data?.runs.filter((run) => isRunLive(run.status)).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Runs"
        subtitle="A run discovers businesses in the active vertical, investigates each one, verifies what it found against independent sources, and reconciles the two into commercial eligibility."
        meta={
          data ? (
            <p className="text-sm text-ink-soft">
              <span className="numerals font-medium text-ink">{data.total}</span>{" "}
              {pluralize(data.total, "run")}
              {live > 0 ? (
                <>
                  {" · "}
                  <span className="numerals font-medium text-blue-700">{live}</span> in
                  flight
                </>
              ) : null}
            </p>
          ) : undefined
        }
      />

      <Card>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} context="The run list" />
        ) : loading || !data ? (
          <SkeletonRows rows={6} />
        ) : (
          <RunsTable
            runs={data.runs}
            empty={
              <EmptyState
                title="No runs yet"
                description="Runs are created through the backend API (POST /runs), which stays off the browser surface in V1. Once a run exists it appears here with live progress."
              />
            }
          />
        )}
      </Card>
    </>
  );
}
