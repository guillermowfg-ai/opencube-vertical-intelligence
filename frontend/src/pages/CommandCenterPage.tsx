/**
 * Command centre -- the executive snapshot.
 *
 * Ordered by the question someone actually opens the product with: what is
 * running right now, how much has been done, what is worth acting on, and
 * where the evidence disagrees with itself.
 */

import { Link } from "react-router-dom";
import { api, useResource } from "../lib/api";
import { isRunLive } from "../lib/domain";
import { toSegments } from "../lib/segments";
import { useStatus } from "../lib/useStatus";
import { fill, useI18n } from "../i18n";
import { capabilityLabel, opportunityLabel } from "../product/labels";
import { formatDateTime, formatRelative, shortId } from "../lib/format";
import { TaskCard } from "../components/TaskCard";
import { NewTaskButton } from "../components/NewTaskButton";
import { canLaunchTasks } from "../product/mode";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Distribution, RankedBars, ResultDonut, StatCard } from "../components/ui/metrics";
import { Card, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import {
  EmptyState,
  ErrorState,
  SkeletonCards,
  SkeletonPanel,
  SkeletonRows,
} from "../components/ui/states";

export function CommandCenterPage() {
  const { t } = useI18n();
  const status = useStatus();
  const { data, error, loading, refreshing, reload } = useResource(
    (signal) => api.overview(signal),
    [],
    { pollMs: 30_000 },
  );

  if (error && !data) {
    return (
      <>
        <TaskLauncher generatedAt={null} refreshing={false} />
        <ErrorState error={error} onRetry={reload} context={t.overview.error} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <TaskLauncher generatedAt={null} refreshing={false} />
        <SkeletonCards count={6} />
        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
        <div className="mt-8">
          <SkeletonRows rows={4} />
        </div>
      </>
    );
  }

  const { kpis } = data;
  const activeRuns = data.recent_runs.filter((run) => isRunLive(run.status));
  // Derived from the same counts the donut renders -- never a fixed number.
  const evaluatedCount = data.match_status_counts.reduce((sum, c) => sum + c.count, 0);
  const rejectedCount =
    data.match_status_counts.find((c) => c.key === "NOT_MATCHED")?.count ?? 0;
  const recentRuns = data.recent_runs.filter((run) => !isRunLive(run.status)).slice(0, 2);

  return (
    <>
      <TaskLauncher generatedAt={data.generated_at} refreshing={refreshing} />

      {activeRuns.length > 0 ? (
        <section className="mb-6" aria-label={t.commandCenter.activeTitle}>
          <SectionHeading
            title={t.commandCenter.activeTitle}
            description={t.commandCenter.activeSubtitle}
          />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {activeRuns.map((run) => (
              <TaskCard key={run.run_id} run={run} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8" aria-label={t.commandCenter.recentTitle}>
        <SectionHeading
          title={t.commandCenter.recentTitle}
          description={t.commandCenter.recentSubtitle}
          action={
            <Link
              to="/tasks"
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              {t.common.viewAll} →
            </Link>
          }
        />
        {recentRuns.length === 0 ? (
          <Card>
            <EmptyState
              compact
              title={t.tasks.empty}
              description={canLaunchTasks ? t.tasks.emptyHelp : t.runs.emptyHelp}
            />
          </Card>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {recentRuns.map((run) => (
              <TaskCard key={run.run_id} run={run} />
            ))}
          </div>
        )}
      </section>

      <SectionHeading
        eyebrow={t.commandCenter.snapshotEyebrow}
        title={t.commandCenter.snapshotTitle}
        description={
          data.runs_without_results > 0
            ? `${t.commandCenter.snapshotSubtitle} ${fill(
                data.runs_without_results === 1
                  ? t.commandCenter.snapshotExcluded
                  : t.commandCenter.snapshotExcludedPlural,
                { count: data.runs_without_results },
              )}`
            : t.commandCenter.snapshotSubtitle
        }
      />

      <section aria-label={t.overview.title}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label={t.overview.kpi.runs}
            value={kpis.runs_total}
            hint={
              kpis.runs_active > 0
                ? fill(t.overview.kpi.runsHintActive, { count: kpis.runs_active })
                : fill(t.overview.kpi.runsHintDone, { count: kpis.runs_completed })
            }
            to="/runs"
          />
          <StatCard
            label={t.overview.kpi.businesses}
            value={kpis.businesses_discovered}
            hint={t.overview.kpi.businessesHint}
            to="/businesses"
          />
          <StatCard
            label={t.overview.kpi.researched}
            value={kpis.businesses_investigated}
            hint={fill(t.overview.kpi.researchedHint, { count: kpis.evidence_total })}
          />
          <StatCard
            label={t.overview.kpi.secondOpinions}
            value={kpis.verifications_completed}
            hint={fill(t.overview.kpi.secondOpinionsHint, { count: kpis.hypotheses_total })}
          />
          <StatCard
            label={t.overview.kpi.goodFit}
            value={kpis.matches_matched}
            hint={fill(t.overview.kpi.goodFitHint, { count: kpis.matches_total })}
            emphasis
            to="/matches?status=MATCHED"
          />
          <StatCard
            label={t.overview.kpi.needsPerson}
            value={kpis.review_needed}
            hint={t.overview.kpi.needsPersonHint}
            tone={kpis.review_needed > 0 ? "caution" : undefined}
            to="/matches?status=UNRESOLVED"
          />
        </div>
      </section>

      <section className="mt-6">
        <ResultDonut
          title={t.overview.fit.title}
          segments={toSegments(data.match_status_counts, "fit", status)}
          totalLabel={t.conservative.evaluated}
          emptyMessage={t.overview.fit.empty}
          headline={fill(t.conservative.headline, {
            rejected: rejectedCount,
            total: evaluatedCount,
          })}
          principle={t.conservative.principle}
        />
      </section>

      <section className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title={t.overview.findings.title}
            description={t.overview.findings.description}
          />
          <Distribution
            segments={toSegments(data.hypothesis_status_counts, "finding", status)}
            emptyMessage={t.overview.findings.empty}
          />
        </Card>

        <Card>
          <SectionHeading
            title={t.overview.verification.title}
            description={t.overview.verification.description}
          />
          <Distribution
            segments={toSegments(data.verification_state_counts, "secondOpinion", status)}
            emptyMessage={t.overview.verification.empty}
          />
        </Card>
      </section>

      <section className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <SectionHeading
            title={t.overview.highlights.title}
            description={t.overview.highlights.description}
            action={
              <Link
                to="/matches?status=MATCHED"
                className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
              >
                {t.common.viewAll} →
              </Link>
            }
          />
          {data.highlighted_matches.length === 0 ? (
            <EmptyState
              compact
              title={t.overview.highlights.empty}
              description={t.overview.highlights.emptyHelp}
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {data.highlighted_matches.map((match) => (
                <li key={match.match_id}>
                  <Link
                    to={`/matches/${encodeURIComponent(match.match_id)}`}
                    className="group flex items-start gap-4 py-3.5 transition-colors first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-brand-700">
                        {match.business_display_name ?? match.business_id}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-ink-soft">
                        {opportunityLabel(t, match.opportunity_id, match.opportunity_name)}
                      </p>
                      <p className="mt-1.5 truncate text-xs text-ink-muted">
                        {match.primary_capability_label ? (
                          <>
                            {capabilityLabel(
                              t,
                              match.primary_capability_id,
                              match.primary_capability_label,
                            )}{" "}
                            ·{" "}
                          </>
                        ) : null}
                        {/* The analysis is what separates two otherwise
                            identical rows: the same business can be a good fit
                            for the same opportunity in several analyses, for
                            different reasons. */}
                        <span className="font-mono">{shortId(match.run_id, 8)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge meta={status.fit(match.match_status)} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionHeading
              title={t.overview.capability.title}
              description={t.overview.capability.description}
            />
            <RankedBars
              items={data.matched_capability_counts.map((item) => ({
                ...item,
                label: capabilityLabel(t, item.key, item.label) ?? item.label,
              }))}
              emptyMessage={t.overview.capability.empty}
            />
          </Card>

          <Card>
            <SectionHeading
              title={t.overview.coverage.title}
              description={t.overview.coverage.description}
            />
            <RankedBars
              items={data.opportunity_counts.map((item) => ({
                ...item,
                label: opportunityLabel(t, item.key, item.label),
              }))}
              fill="bg-slate-300"
              emptyMessage={t.overview.coverage.empty}
            />
          </Card>
        </div>
      </section>

    </>
  );
}

/**
 * The product's opening statement: what this is, and the one action that
 * starts it. Task -> Team -> Result, said in three words each.
 */
function TaskLauncher({
  generatedAt,
  refreshing,
}: {
  generatedAt: string | null;
  refreshing: boolean;
}) {
  const { t, locale } = useI18n();
  const copy = t.commandCenter;

  return (
    <section className="card relative mb-8 overflow-hidden p-6 sm:p-8">
      <span
        aria-hidden="true"
        className="lattice pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 [mask-image:linear-gradient(to_left,black,transparent)] sm:block"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow">{copy.heroEyebrow}</p>
            {generatedAt ? (
              <span
                className={cx(
                  "inline-flex items-center gap-2 text-xs font-medium",
                  refreshing ? "text-cyan-700" : "text-ink-muted",
                )}
                title={formatDateTime(locale, generatedAt)}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "size-1.5 rounded-full",
                    refreshing ? "live-dot bg-cyan-600" : "bg-slate-400",
                  )}
                />
                {refreshing
                  ? t.common.refreshing
                  : fill(t.common.updated, { time: formatRelative(locale, generatedAt) })}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            {copy.heroTitle}
          </h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            {copy.heroSubtitle}
          </p>

          <ol className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {[copy.heroSteps.task, copy.heroSteps.team, copy.heroSteps.result].map(
              (step, index) => (
                <li key={step} className="flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-brand-400">
                      →
                    </span>
                  ) : null}
                  <span className="font-medium text-ink">{step}</span>
                </li>
              ),
            )}
          </ol>
        </div>

        {canLaunchTasks ? <NewTaskButton label={copy.heroAction} /> : null}
      </div>
    </section>
  );
}

