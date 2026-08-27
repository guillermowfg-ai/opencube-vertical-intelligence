/** Analyses -- every sweep across this market, newest first. */

import { api, useResource } from "../lib/api";
import { isRunLive } from "../lib/domain";
import { fill, useI18n } from "../i18n";
import { RunsTable } from "../components/RunsTable";
import { Card, PageHeader } from "../components/ui/primitives";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

export function RunsPage() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useResource(
    (signal) => api.runs(50, signal),
    [],
    { pollMs: 30_000 },
  );

  const live = data?.runs.filter((run) => isRunLive(run.status)).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={t.runs.eyebrow}
        title={t.runs.title}
        subtitle={t.runs.subtitle}
        meta={
          data ? (
            <p className="text-sm text-ink-soft">
              <span className="numerals font-medium text-ink">
                {data.total === 1 ? t.runs.countOne : fill(t.runs.count, { count: data.total })}
              </span>
              {live > 0 ? (
                <>
                  {" · "}
                  <span className="numerals font-medium text-cyan-700">
                    {fill(t.runs.live, { count: live })}
                  </span>
                </>
              ) : null}
            </p>
          ) : undefined
        }
      />

      <Card>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} context={t.runs.error} />
        ) : loading || !data ? (
          <SkeletonRows rows={6} />
        ) : (
          <RunsTable
            runs={data.runs}
            empty={<EmptyState title={t.runs.empty} description={t.runs.emptyHelp} />}
          />
        )}
      </Card>
    </>
  );
}
