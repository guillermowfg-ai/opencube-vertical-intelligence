/**
 * Overview — the executive snapshot.
 *
 * Ordered by the question an operator actually opens the product with:
 * how much has the platform done, what is running right now, what is
 * actionable, and where does the reasoning disagree with itself.
 */

import { Link } from "react-router-dom";
import { api, useResource } from "../lib/api";
import { MATCH_STATUS, RUN_STATUS, isRunLive } from "../lib/domain";
import { toSegments } from "../lib/segments";
import { formatDateTime, formatRelative, pluralize } from "../lib/format";
import type { RunSummary } from "../lib/types";
import { RunsTable } from "../components/RunsTable";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Distribution, RankedBars, StatCard } from "../components/ui/metrics";
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
  const { data, error, loading, refreshing, reload } = useResource(
    (signal) => api.overview(signal),
    [],
    { pollMs: 30_000 },
  );

  if (error && !data) {
    return (
      <>
        <OverviewHeader generatedAt={null} refreshing={false} />
        <ErrorState error={error} onRetry={reload} context="The overview" />
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

      <section aria-label="Platform totals">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Runs"
            value={kpis.runs_total}
            hint={
              kpis.runs_active > 0
                ? `${kpis.runs_active} in flight`
                : `${kpis.runs_completed} completed`
            }
            to="/runs"
          />
          <StatCard
            label="Businesses"
            value={kpis.businesses_discovered}
            hint="Pulled into an investigation"
            to="/businesses"
          />
          <StatCard
            label="Investigated"
            value={kpis.businesses_investigated}
            hint={`${kpis.evidence_total} evidence ${pluralize(kpis.evidence_total, "record")}`}
          />
          <StatCard
            label="Verifications"
            value={kpis.verifications_completed}
            hint={`Across ${kpis.hypotheses_total} ${pluralize(kpis.hypotheses_total, "hypothesis", "hypotheses")}`}
          />
          <StatCard
            label="Matched"
            value={kpis.matches_matched}
            hint={`of ${kpis.matches_total} evaluated`}
            emphasis
            to="/matches?status=MATCHED"
          />
          <StatCard
            label="Needs review"
            value={kpis.review_needed}
            hint="Unresolved conflicts"
            tone={kpis.review_needed > 0 ? "caution" : undefined}
            to="/matches?status=UNRESOLVED"
          />
        </div>
      </section>

      <section
        className="mt-8 grid items-start gap-6 xl:grid-cols-3"
        aria-label="Pipeline distributions"
      >
        <Card>
          <SectionHeading
            eyebrow="Investigator"
            title="Hypothesis outcomes"
            description="What the evidence supported before anything independent was consulted."
          />
          <Distribution
            segments={toSegments(data.hypothesis_status_counts, "hypothesis")}
            emptyMessage="No hypotheses have been formed yet."
          />
        </Card>

        <Card>
          <SectionHeading
            eyebrow="Verification loop"
            title="Independent verification"
            description="What a source outside the business said about each hypothesis."
          />
          <Distribution
            segments={toSegments(data.verification_state_counts, "verification")}
            emptyMessage="No verification has run yet."
          />
        </Card>

        <Card>
          <SectionHeading
            eyebrow="Opportunity matcher"
            title="Commercial eligibility"
            description="The deterministic reconciliation of the two columns to its left."
          />
          <Distribution
            segments={toSegments(data.match_status_counts, "match")}
            emptyMessage="No opportunities have been reconciled yet."
          />
        </Card>
      </section>

      <section className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <SectionHeading
            title="Notable opportunities"
            description="Matched opportunities, newest first. Matched means commercially eligible — never contact authorisation."
            action={
              <Link
                to="/matches?status=MATCHED"
                className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
              >
                All opportunities →
              </Link>
            }
          />
          {data.highlighted_matches.length === 0 ? (
            <EmptyState
              compact
              title="Nothing matched yet"
              description="Matched opportunities appear here once a run reaches the matching phase."
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
                      {match.primary_capability_label ? (
                        <p className="mt-1.5 truncate text-xs text-ink-muted">
                          {match.primary_capability_label}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge meta={MATCH_STATUS[match.match_status]} />
                      <span className="text-xs text-ink-muted">
                        {formatRelative(match.created_at)}
                      </span>
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
              title="Capability demand"
              description="Primary capability behind each matched opportunity."
            />
            <RankedBars
              items={data.matched_capability_counts}
              emptyMessage="No capability has been matched yet."
            />
          </Card>

          <Card>
            <SectionHeading
              title="Opportunity coverage"
              description="How often each catalog opportunity was evaluated."
            />
            <RankedBars
              items={data.opportunity_counts}
              fill="bg-slate-300"
              emptyMessage="No opportunities have been evaluated yet."
            />
          </Card>
        </div>
      </section>

      <section className="mt-8">
        <Card>
          <SectionHeading
            title="Recent runs"
            description="Each run is one discovery-to-matching sweep over the active vertical."
            action={
              <Link
                to="/runs"
                className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
              >
                All runs →
              </Link>
            }
          />
          <RunsTable
            runs={data.recent_runs}
            empty={
              <EmptyState
                compact
                title="No runs yet"
                description="A run is created by the backend API. Once one exists, its progress appears here."
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
  return (
    <PageHeader
      eyebrow="OpenCube Intel"
      title="Operational overview"
      subtitle="Evidence-grounded market intelligence for the active vertical. Every number here is derived from persisted evidence — nothing on this page is inferred by the interface."
      actions={
        generatedAt ? (
          <span
            className={cx(
              "inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium transition-colors",
              refreshing ? "text-blue-700" : "text-ink-muted",
            )}
            title={`Snapshot taken ${formatDateTime(generatedAt)}`}
          >
            <span
              aria-hidden="true"
              className={cx(
                "size-1.5 rounded-full",
                refreshing ? "live-dot bg-blue-700" : "bg-slate-400",
              )}
            />
            {refreshing ? "Refreshing" : `Updated ${formatRelative(generatedAt)}`}
          </span>
        ) : undefined
      }
    />
  );
}

function LiveRunBanner({ run }: { run: RunSummary }) {
  const done = run.investigations_completed + run.investigations_failed;
  const total = run.businesses_total ?? run.investigations_total;

  return (
    <Link
      to={`/runs/${encodeURIComponent(run.run_id)}`}
      className="card hover-lift mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-brand-200 bg-brand-50/40 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StatusBadge meta={RUN_STATUS[run.status]} live />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{run.run_id}</p>
          <p className="truncate text-xs text-ink-soft">
            {run.vertical} · {run.geography}
          </p>
        </div>
      </div>
      <div className="numerals flex items-center gap-6 text-sm">
        <span className="text-ink-soft">
          <span className="font-semibold text-ink">
            {done}
            {total ? `/${total}` : ""}
          </span>{" "}
          investigated
        </span>
        <span className="text-ink-soft">
          <span className="font-semibold text-ink">{run.matches_total}</span> matched so far
        </span>
      </div>
      <span className="text-sm font-medium text-brand-600">Open run →</span>
    </Link>
  );
}
