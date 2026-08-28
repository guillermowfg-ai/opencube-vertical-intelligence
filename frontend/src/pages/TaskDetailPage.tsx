/**
 * One analysis, explained.
 *
 * Three reads: the analysis itself (progress counted fresh at read time), its
 * businesses, and its opportunities. A running analysis polls; a finished one
 * does not, because a finished analysis cannot change.
 */

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, useResource } from "../lib/api";
import { isRunLive } from "../lib/domain";
import { fitSegments, toSegments } from "../lib/segments";
import { useStatus } from "../lib/useStatus";
import { fill, useI18n } from "../i18n";
import type { BusinessRow, MatchStatus } from "../lib/types";
import { MatchesTable } from "../components/MatchesTable";
import { TaskActivity } from "../components/TaskActivity";
import { TaskBrief } from "../components/TaskBrief";
import { DEFAULT_TEMPLATE } from "../product/tasks";
import { DataTable, PrimaryCell, type Column } from "../components/ui/DataTable";
import { Chip, StatusBadge } from "../components/ui/StatusBadge";
import { Distribution, MiniDistribution, ResultDonut, StatCard } from "../components/ui/metrics";
import {
  Card,
  ExternalLink,
  Mono,
  PageHeader,
  SectionHeading,
} from "../components/ui/primitives";
import { cx } from "../lib/cx";
import {
  EmptyState,
  ErrorState,
  SkeletonCards,
  SkeletonPanel,
  SkeletonRows,
} from "../components/ui/states";

type Tab = "businesses" | "opportunities";

export function TaskDetailPage() {
  const { runId = "" } = useParams();
  const [search] = useSearchParams();
  const { t } = useI18n();
  const status = useStatus();
  // A link that carries a fit filter is asking for the opportunities tab;
  // landing on Businesses would silently drop the filter.
  const [tab, setTab] = useState<Tab>(
    search.get("status") ? "opportunities" : "businesses",
  );

  const catalog = useResource((signal) => api.catalog(signal), []);
  // Someone watching a task they just launched needs a faster cadence than a
  // background dashboard; a finished task cannot change, so it stops entirely
  // rather than re-fetching a static record forever.
  const [live, setLive] = useState(true);
  const run = useResource((signal) => api.run(runId, signal), [runId], {
    pollMs: live ? 5_000 : null,
  });

  const businesses = useResource(
    (signal) => api.runBusinesses(runId, signal),
    [runId, live ? run.data?.investigations_completed : "final"],
  );
  const matches = useResource(
    (signal) => api.matches({ runId, limit: 500 }, signal),
    [runId, live ? run.data?.matches_total : "final"],
  );

  const runLive = run.data ? isRunLive(run.data.status) : true;
  if (runLive !== live) setLive(runLive);

  if (run.error && !run.data) {
    return (
      <>
        <PageHeader eyebrow={t.runDetail.eyebrow} title={runId || t.common.run} />
        <ErrorState error={run.error} onRetry={run.reload} context={t.runDetail.error} />
      </>
    );
  }

  if (run.loading || !run.data) {
    return (
      <>
        <PageHeader eyebrow={t.runDetail.eyebrow} title={runId || t.common.run} />
        <SkeletonCards count={6} />
        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <SkeletonPanel />
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
      </>
    );
  }

  const data = run.data;
  const totalBusinesses = data.businesses_total ?? data.investigations_total;
  const evaluatedCount = matches.data?.matches.length ?? 0;
  const fitCounts = {
    matches_matched: count(matches.data?.matches ?? [], "MATCHED"),
    matches_not_matched: count(matches.data?.matches ?? [], "NOT_MATCHED"),
    matches_unresolved: count(matches.data?.matches ?? [], "UNRESOLVED"),
  };

  return (
    <>
      <PageHeader
        eyebrow={t.runDetail.eyebrow}
        title={t.taskTemplates[DEFAULT_TEMPLATE.id].name}
        subtitle={
          data.failure_message
            ? undefined
            : fill(t.runDetail.subtitle, {
                vertical: data.vertical,
                geography: data.geography,
              })
        }
        actions={<StatusBadge meta={status.run(data.status)} live={isRunLive(data.status)} />}
      />

      {data.failure_message ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/60 p-5">
          <p className="text-sm font-semibold text-rose-900">{t.runDetail.failedTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-rose-800/85">{data.failure_message}</p>
          <p className="mt-2 text-sm leading-relaxed text-rose-800/70">
            {t.runDetail.failedHelp}
          </p>
        </div>
      ) : null}

      <div className="mb-6 space-y-6">
        <TaskBrief run={data} execution={catalog.data?.execution ?? null} />
        <TaskActivity run={data} />
      </div>

      <section aria-label={t.runDetail.kpi.opportunities}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label={t.runDetail.kpi.businesses}
            value={totalBusinesses}
            hint={fill(t.runDetail.kpi.businessesHint, {
              count: data.investigations_completed,
            })}
          />
          <StatCard
            label={t.runDetail.kpi.inProgress}
            value={data.investigations_in_progress}
            tone={data.investigations_in_progress > 0 ? "info" : undefined}
            hint={
              data.investigations_in_progress > 0 ? t.runDetail.kpi.inProgressHint : t.common.none
            }
          />
          <StatCard
            label={t.runDetail.kpi.failed}
            value={data.investigations_failed}
            tone={data.investigations_failed > 0 ? "negative" : undefined}
            hint={data.investigations_failed > 0 ? t.runDetail.kpi.failedHint : t.common.none}
          />
          <StatCard
            label={t.runDetail.kpi.findings}
            value={data.hypotheses_total}
            hint={t.runDetail.kpi.findingsHint}
          />
          <StatCard
            label={t.runDetail.kpi.secondOpinions}
            value={data.verifications_completed}
            hint={fill(t.runDetail.kpi.secondOpinionsHint, { count: data.verifications_total })}
          />
          <StatCard
            label={t.runDetail.kpi.opportunities}
            value={data.matches_total}
            hint={t.runDetail.kpi.opportunitiesHint}
            emphasis
          />
        </div>
      </section>

      <section className="mt-6">
        <ResultDonut
          title={t.runDetail.fit.title}
          segments={fitSegments(fitCounts, status)}
          totalLabel={t.conservative.evaluated}
          emptyMessage={live ? t.runDetail.fit.emptyLive : t.runDetail.fit.emptyDone}
          headline={
            evaluatedCount > 0
              ? fill(t.conservative.headline, {
                  rejected: fitCounts.matches_not_matched,
                  total: evaluatedCount,
                })
              : undefined
          }
          principle={evaluatedCount > 0 ? t.conservative.principle : undefined}
        />
      </section>

      <section className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading title={t.runDetail.findings.title} />
          {businesses.data ? (
            <Distribution
              segments={toSegments(
                aggregateFindingCounts(businesses.data.businesses),
                "finding",
                status,
              )}
              emptyMessage={
                live ? t.runDetail.findings.emptyLive : t.runDetail.findings.emptyDone
              }
            />
          ) : (
            <SkeletonRows rows={4} />
          )}
        </Card>

        <Card>
          <SectionHeading title={t.runDetail.discovery.title} />
          <dl className="divide-y divide-hairline text-sm">
            <div className="pb-3">
              <dt className="eyebrow">{t.runDetail.discovery.queries}</dt>
              <dd className="mt-1.5">
                {data.discovery_queries && data.discovery_queries.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.discovery_queries.map((query) => (
                      <li key={query} className="text-ink-soft">
                        <Mono>{query}</Mono>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-ink-muted">{t.runDetail.discovery.queriesEmpty}</span>
                )}
              </dd>
            </div>
            <div className="py-3">
              <dt className="eyebrow">{t.runDetail.discovery.capabilities}</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {data.provider_capabilities.length > 0 ? (
                  data.provider_capabilities.map((capability) => (
                    <Chip key={capability}>{capability}</Chip>
                  ))
                ) : (
                  <span className="text-ink-muted">
                    {t.runDetail.discovery.capabilitiesEmpty}
                  </span>
                )}
              </dd>
            </div>
            {data.investigation_count !== null ? (
              <div className="pt-3">
                <dt className="eyebrow">{t.runDetail.discovery.finalCounts}</dt>
                <dd className="numerals mt-1.5 text-ink-soft">
                  {fill(t.runDetail.discovery.finalCountsValue, {
                    done: data.completed_investigation_count ?? 0,
                    failed: data.failed_investigation_count ?? 0,
                    total: data.investigation_count,
                  })}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <div
              role="tablist"
              aria-label={t.runDetail.tabs.label}
              className="inline-flex rounded-lg bg-canvas-alt p-1"
            >
              {(
                [
                  ["businesses", t.runDetail.tabs.businesses, businesses.data?.businesses.length],
                  ["opportunities", t.runDetail.tabs.opportunities, matches.data?.matches.length],
                ] as const
              ).map(([key, label, total]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cx(
                    "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                    tab === key
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-soft hover:text-ink",
                  )}
                >
                  {label}
                  {total !== undefined ? (
                    <span className="numerals ml-1.5 text-xs text-ink-muted">{total}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {tab === "businesses" ? (
            <BusinessesPanel resource={businesses} runLive={live} />
          ) : (
            <OpportunitiesPanel resource={matches} runLive={live} />
          )}
        </Card>
      </section>
    </>
  );
}

function count(matches: { match_status: MatchStatus }[], value: MatchStatus): number {
  return matches.filter((match) => match.match_status === value).length;
}

function aggregateFindingCounts(rows: BusinessRow[]) {
  const totals = new Map<string, { key: string; label: string; count: number }>();
  for (const row of rows) {
    for (const entry of row.hypothesis_status_counts) {
      const existing = totals.get(entry.key) ?? { key: entry.key, label: entry.label, count: 0 };
      existing.count += entry.count;
      totals.set(entry.key, existing);
    }
  }
  return [...totals.values()];
}

function BusinessesPanel({
  resource,
  runLive,
}: {
  resource: ReturnType<typeof useResource<Awaited<ReturnType<typeof api.runBusinesses>>>>;
  runLive: boolean;
}) {
  const { t } = useI18n();
  const status = useStatus();
  const copy = t.runDetail.businessesTable;

  const columns: Column<BusinessRow>[] = useMemo(
    () => [
      {
        key: "business",
        header: copy.business,
        className: "max-w-[300px]",
        render: (row) => (
          <PrimaryCell title={row.display_name} subtitle={row.formatted_address ?? undefined} />
        ),
      },
      {
        key: "status",
        header: copy.status,
        render: (row) => (
          <StatusBadge
            meta={status.research(row.investigation_status)}
            live={row.investigation_status === "IN_PROGRESS"}
          />
        ),
      },
      {
        key: "sources",
        header: copy.sources,
        numeric: true,
        render: (row) => <ZeroAware value={row.source_count} row={row} />,
      },
      {
        key: "evidence",
        header: copy.evidence,
        numeric: true,
        render: (row) => <ZeroAware value={row.evidence_count} row={row} />,
      },
      {
        key: "findings",
        header: copy.findings,
        className: "min-w-[150px]",
        render: (row) =>
          row.hypotheses_total === 0 ? (
            <span className="text-xs text-ink-muted">—</span>
          ) : (
            <div>
              <MiniDistribution
                segments={toSegments(row.hypothesis_status_counts, "finding", status)}
              />
              <p className="numerals mt-1.5 text-xs text-ink-soft">
                {fill(copy.findingsCount, { count: row.hypotheses_total })}
              </p>
            </div>
          ),
      },
      {
        key: "matches",
        header: copy.opportunities,
        className: "min-w-[150px]",
        render: (row) =>
          row.matches_total === 0 ? (
            <span className="text-xs text-ink-muted">
              {runLive ? copy.notYet : t.common.none}
            </span>
          ) : (
            <div>
              <MiniDistribution segments={fitSegments(row, status)} />
              <p className="numerals mt-1.5 text-xs text-ink-soft">
                <span className="font-medium text-green-700">
                  {fill(copy.goodFit, { count: row.matches_matched })}
                </span>
              </p>
            </div>
          ),
      },
      {
        key: "site",
        header: copy.site,
        render: (row) =>
          row.website_url ? (
            <ExternalLink href={row.website_url}>{t.common.visitSite}</ExternalLink>
          ) : (
            <span className="text-xs text-ink-muted" title={t.common.noWebsiteHelp}>
              {t.common.noWebsite}
            </span>
          ),
      },
    ],
    [copy, runLive, status, t],
  );

  if (resource.error && !resource.data) {
    return <ErrorState error={resource.error} onRetry={resource.reload} context={copy.error} />;
  }
  if (resource.loading || !resource.data) {
    return <SkeletonRows rows={6} />;
  }

  return (
    <DataTable
      columns={columns}
      rows={resource.data.businesses}
      rowKey={(row) => row.investigation_id}
      empty={<EmptyState title={copy.empty} description={copy.emptyHelp} />}
      dense
    />
  );
}

/**
 * A zero here means "we could not read this business's own site", which is a
 * finding, not a gap in the data. It says so on hover, and notes that outside
 * sources were checked separately when they were.
 */
function ZeroAware({ value, row }: { value: number; row: BusinessRow }) {
  const { t } = useI18n();
  if (value > 0) return <>{value}</>;
  const help =
    row.verifications_total > 0 ? t.chain.noFirstPartyWithOutside : t.chain.noFirstParty;
  return (
    <span className="cursor-help text-ink-muted underline decoration-dotted underline-offset-2" title={help}>
      0
    </span>
  );
}

function OpportunitiesPanel({
  resource,
  runLive,
}: {
  resource: ReturnType<typeof useResource<Awaited<ReturnType<typeof api.matches>>>>;
  runLive: boolean;
}) {
  const { t } = useI18n();
  const status = useStatus();
  const [params, setParams] = useSearchParams();
  const active = (params.get("status") as MatchStatus | null) ?? null;

  if (resource.error && !resource.data) {
    return (
      <ErrorState
        error={resource.error}
        onRetry={resource.reload}
        context={t.runDetail.opportunitiesError}
      />
    );
  }
  if (resource.loading || !resource.data) {
    return <SkeletonRows rows={6} />;
  }

  const all = resource.data.matches;
  const shown = active ? all.filter((match) => match.match_status === active) : all;

  const select = (next: MatchStatus | null) => {
    if (next) params.set("status", next);
    else params.delete("status");
    setParams(params, { replace: true });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPill
          label={t.common.all}
          count={all.length}
          active={active === null}
          onClick={() => select(null)}
        />
        {(["MATCHED", "UNRESOLVED", "NOT_MATCHED"] as MatchStatus[]).map((value) => {
          const meta = status.fit(value);
          return (
            <FilterPill
              key={value}
              label={meta.label}
              title={meta.meaning}
              count={count(all, value)}
              active={active === value}
              onClick={() => select(value)}
            />
          );
        })}
      </div>

      <MatchesTable
        matches={shown}
        empty={
          <EmptyState
            compact
            title={
              active ? t.runDetail.opportunitiesFilteredEmpty : t.runDetail.opportunitiesEmpty
            }
            description={
              active
                ? t.runDetail.opportunitiesFilteredHelp
                : runLive
                  ? t.runDetail.opportunitiesEmptyLive
                  : t.runDetail.opportunitiesEmptyDone
            }
          />
        }
      />
    </>
  );
}

function FilterPill({
  label,
  count: value,
  active,
  onClick,
  title,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-hairline bg-surface text-ink-soft hover:border-slate-300 hover:text-ink",
      )}
    >
      {label}
      <span className={cx("numerals text-xs", active ? "text-brand-600" : "text-ink-muted")}>
        {value}
      </span>
    </button>
  );
}
