/** Tasks -- everything the user has asked their team to do. */

import { api, useResource } from "../lib/api";
import { isRunLive } from "../lib/domain";
import { canLaunchTasks } from "../product/mode";
import { useI18n } from "../i18n";
import { TaskCard } from "../components/TaskCard";
import { NewTaskButton } from "../components/NewTaskButton";
import { Card, PageHeader } from "../components/ui/primitives";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

export function TasksPage() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useResource(
    (signal) => api.runs(50, signal),
    [],
    { pollMs: 20_000 },
  );

  const runs = data?.runs ?? [];
  const active = runs.filter((run) => isRunLive(run.status));
  const past = runs.filter((run) => !isRunLive(run.status));

  return (
    <>
      <PageHeader
        eyebrow={t.tasks.eyebrow}
        title={t.tasks.title}
        subtitle={t.tasks.subtitle}
        actions={canLaunchTasks ? <NewTaskButton label={t.tasks.newTask} /> : undefined}
      />

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} context={t.runs.error} />
      ) : loading || !data ? (
        <SkeletonRows rows={4} />
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState
            title={t.tasks.empty}
            description={canLaunchTasks ? t.tasks.emptyHelp : t.runs.emptyHelp}
            action={canLaunchTasks ? <NewTaskButton label={t.tasks.newTask} /> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 ? (
            <section className="grid items-start gap-4 lg:grid-cols-2">
              {active.map((run) => (
                <TaskCard key={run.run_id} run={run} />
              ))}
            </section>
          ) : null}
          <section className="grid items-start gap-4 lg:grid-cols-2">
            {past.map((run) => (
              <TaskCard key={run.run_id} run={run} />
            ))}
          </section>
        </div>
      )}
    </>
  );
}
