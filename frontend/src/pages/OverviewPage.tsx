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
import { formatDateTime, formatRelative, shortId } from "../lib/format";
import type { RunSummary } from "../lib/types";
import { RunsTable } from "../components/RunsTable";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Distribution, RankedBars, ResultDonut, StatCard } from "../components/ui/metrics";
import { Card, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import {
  EmptyState,
  ErrorState,
  SkeletonCards,
  SkeletonPanel,
  SkeletonRows,
} from "../components/ui/states";

export function OverviewPage() {
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
        <OverviewHeader generatedAt={null} refreshing={false} />
        <ErrorState error={error} onRetry={reload} context={t.overview.error} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <OverviewHeader generatedAt={null} refreshing={false} />
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
  const liveRun = data.recent_runs.find((run) => isRunLive(run.status));

  return (
    <>
      <OverviewHeader generatedAt={data.generated_at} refreshing={refreshing} />

      {liveRun ? <LiveRunBanner run={liveRun} /> : null}

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
          totalLabel={t.nav.matches}
          emptyMessage={t.overview.fit.empty}
        >
          <p className="text-xs leading-relaxed text-vault-ink-muted">
            {t.overview.fit.description}
          </p>
        </ResultDonut>
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
                        {match.opportunity_name ?? match.opportunity_id}
                      </p>
                      <p className="mt-1.5 truncate text-xs text-ink-muted">
                        {match.primary_capability_label ? (
                          <>{match.primary_capability_label} · </>
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
              items={data.matched_capability_counts}
              emptyMessage={t.overview.capability.empty}
            />
          </Card>

          <Card>
            <SectionHeading
              title={t.overview.coverage.title}
              description={t.overview.coverage.description}
            />
            <RankedBars
              items={data.opportunity_counts}
              fill="bg-slate-300"
              emptyMessage={t.overview.coverage.empty}
            />
          </Card>
        </div>
      </section>

      <section className="mt-6">
        <Card>
          <SectionHeading
            title={t.overview.recent.title}
            description={t.overview.recent.description}
            action={
              <Link
                to="/runs"
                className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
              >
                {t.common.viewAll} →
              </Link>
            }
          />
          <RunsTable
            runs={data.recent_runs}
            empty={
              <EmptyState
                compact
                title={t.overview.recent.empty}
                description={t.overview.recent.emptyHelp}
              />
            }
          />
        </Card>
      </section>
    </>
  );
}

function OverviewHeader({
  generatedAt,
  refreshing,
}: {
  generatedAt: string | null;
  refreshing: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <PageHeader
      eyebrow={t.overview.eyebrow}
      title={t.overview.title}
      subtitle={t.overview.subtitle}
      actions={
        generatedAt ? (
          <span
            className={cx(
              "inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium transition-colors",
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
        ) : undefined
      }
    />
  );
}

function LiveRunBanner({ run }: { run: RunSummary }) {
  const { t, locale } = useI18n();
  const status = useStatus();
  const done = run.investigations_completed + run.investigations_failed;
  const total = run.businesses_total ?? run.investigations_total;

  return (
    <Link
      to={`/runs/${encodeURIComponent(run.run_id)}`}
      className="card hover-lift mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-brand-200 bg-brand-50/40 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StatusBadge meta={status.run(run.status)} live />
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium text-ink">{run.run_id}</p>
          <p className="truncate text-xs text-ink-soft">
            {run.vertical} · {run.geography} ·{" "}
            {/* The age is the point, not decoration: an analysis the back end
                still reports as unfinished may have been sitting that way for
                days. Showing when it started lets someone see that without the
                interface inventing a status the pipeline never wrote. */}
            <span title={formatDateTime(locale, run.created_at)}>
              {fill(t.common.startedRelative, {
                time: formatRelative(locale, run.created_at),
              })}
            </span>
          </p>
        </div>
      </div>
      <div className="numerals flex items-center gap-6 text-sm">
        <span className="text-ink-soft">
          <span className="font-semibold text-ink">
            {done}
            {total ? `/${total}` : ""}
          </span>{" "}
          {t.runDetail.kpi.businesses.toLowerCase()}
        </span>
      </div>
      <span className="text-sm font-medium text-brand-600">{t.common.openRun} →</span>
    </Link>
  );
}
