/**
 * Run detail — one sweep, explained.
 *
 * Three reads, each from a route that already existed or was added read-only:
 * the run itself (progress derived at read time), its businesses, and its
 * opportunities. A live run polls; a terminal run does not, because a
 * finished run cannot change.
 */

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, useResource } from "../lib/api";
import {
  INVESTIGATION_STATUS,
  MATCH_STATUS,
  OPPORTUNITY_STATUS,
  RUN_STATUS,
  isRunLive,
} from "../lib/domain";
import { formatDateTime, formatDuration, formatRelative } from "../lib/format";
import { matchSegments, toSegments } from "../lib/segments";
import type { BusinessRow, MatchStatus } from "../lib/types";
import { MatchesTable } from "../components/MatchesTable";
import { PhaseTrack } from "../components/PhaseTrack";
import { DataTable, PrimaryCell, type Column } from "../components/ui/DataTable";
import { Chip, StatusBadge } from "../components/ui/StatusBadge";
import { Distribution, MiniDistribution, StatCard } from "../components/ui/metrics";
import { Card, ExternalLink, MetaItem, Mono, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import {
  EmptyState,
  ErrorState,
  SkeletonCards,
  SkeletonPanel,
  SkeletonRows,
} from "../components/ui/states";

type Tab = "businesses" | "opportunities";

export function RunDetailPage() {
  const { runId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("businesses");

  const run = useResource((signal) => api.run(runId, signal), [runId], {
    pollMs: 15_000,
  });
  const live = run.data ? isRunLive(run.data.status) : false;

  const businesses = useResource(
    (signal) => api.runBusinesses(runId, signal),
    [runId, live ? run.data?.investigations_completed : "final"],
  );
  const matches = useResource(
    (signal) => api.matches({ runId, limit: 500 }, signal),
    [runId, live ? run.data?.matches_total : "final"],
  );

  if (run.error && !run.data) {
    return (
      <>
        <PageHeader eyebrow="Run" title={runId || "Run"} />
        <ErrorState error={run.error} onRetry={run.reload} context="This run" />
      </>
    );
  }

  if (run.loading || !run.data) {
    return (
      <>
        <PageHeader eyebrow="Run" title={runId || "Run"} />
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
  const settled = data.investigations_completed + data.investigations_failed;

  return (
    <>
      <PageHeader
        eyebrow="Run"
        title={<span className="font-mono text-xl sm:text-2xl">{data.run_id}</span>}
        subtitle={
          data.failure_message ? undefined : (
            <>
              {data.vertical} in {data.geography}. Progress below is counted at read
              time from persisted records, never from a stored counter.
            </>
          )
        }
        actions={
          <StatusBadge meta={RUN_STATUS[data.status]} live={isRunLive(data.status)} />
        }
        meta={
          <>
            <MetaItem label="Created">{formatDateTime(data.created_at)}</MetaItem>
            <MetaItem label="Started">{formatDateTime(data.started_at)}</MetaItem>
            <MetaItem label="Completed">{formatDateTime(data.completed_at)}</MetaItem>
            <MetaItem label="Duration">
              {formatDuration(data.started_at ?? data.created_at, data.completed_at)}
            </MetaItem>
            <MetaItem label="Candidates screened">
              {data.discovery_raw_candidate_count ?? "—"}
            </MetaItem>
          </>
        }
      />

      {data.failure_message ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/60 p-5">
          <p className="text-sm font-semibold text-rose-900">
            This run is recorded as failed
          </p>
          <p className="mt-1 text-sm leading-relaxed text-rose-800/85">
            {data.failure_message}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-rose-800/70">
            A failed run still produces results. Every investigation that completed was
            verified and matched, and those findings below are valid.
          </p>
        </div>
      ) : null}

      <Card className="mb-8">
        <SectionHeading
          eyebrow="Lifecycle"
          title="Where this run is"
          description="The phase reported by the backend, not inferred from counts."
        />
        <PhaseTrack
          status={data.status}
          detail={{
            QUEUED: `Accepted ${formatRelative(data.created_at)}`,
            DISCOVERING: data.discovery_raw_candidate_count
              ? `${data.discovery_raw_candidate_count} candidates screened`
              : undefined,
            INVESTIGATING: totalBusinesses
              ? `${settled}/${totalBusinesses} businesses settled`
              : undefined,
            FINALIZING: data.verifications_total
              ? `${data.verifications_completed}/${data.verifications_total} verifications complete`
              : undefined,
            COMPLETED: data.completed_at
              ? formatDateTime(data.completed_at)
              : undefined,
          }}
        />
      </Card>

      <section aria-label="Run totals">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Businesses"
            value={totalBusinesses}
            hint={`${data.investigations_completed} completed`}
          />
          <StatCard
            label="In progress"
            value={data.investigations_in_progress}
            tone={data.investigations_in_progress > 0 ? "info" : undefined}
            hint={data.investigations_in_progress > 0 ? "Workers running" : "None"}
          />
          <StatCard
            label="Failed"
            value={data.investigations_failed}
            tone={data.investigations_failed > 0 ? "negative" : undefined}
            hint={data.investigations_failed > 0 ? "Investigations" : "None"}
          />
          <StatCard
            label="Hypotheses"
            value={data.hypotheses_total}
            hint="Formed from evidence"
          />
          <StatCard
            label="Verifications"
            value={data.verifications_completed}
            hint={`of ${data.verifications_total} attempted`}
          />
          <StatCard
            label="Opportunities"
            value={data.matches_total}
            hint="Reconciled"
            emphasis
          />
        </div>
      </section>

      <section className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <SectionHeading eyebrow="Investigator" title="Hypothesis outcomes" />
          {businesses.data ? (
            <Distribution
              segments={toSegments(
                aggregateHypothesisCounts(businesses.data.businesses),
                "hypothesis",
              )}
              emptyMessage="No hypotheses yet — investigations are still running."
            />
          ) : (
            <SkeletonRows rows={4} />
          )}
        </Card>

        <Card>
          <SectionHeading eyebrow="Matcher" title="Commercial eligibility" />
          {matches.data ? (
            <Distribution
              segments={matchSegments({
                matches_matched: count(matches.data.matches, "MATCHED"),
                matches_not_matched: count(matches.data.matches, "NOT_MATCHED"),
                matches_unresolved: count(matches.data.matches, "UNRESOLVED"),
              })}
              emptyMessage="This run has not reached the matching phase yet."
            />
          ) : (
            <SkeletonRows rows={3} />
          )}
        </Card>

        <Card>
          <SectionHeading eyebrow="Discovery" title="How these businesses were found" />
          <dl className="divide-y divide-hairline text-sm">
            <div className="pb-3">
              <dt className="eyebrow">Submarket queries</dt>
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
                  <span className="text-ink-muted">Not recorded for this run.</span>
                )}
              </dd>
            </div>
            <div className="py-3">
              <dt className="eyebrow">Provider capabilities in scope</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {data.provider_capabilities.length > 0 ? (
                  data.provider_capabilities.map((capability) => (
                    <Chip key={capability}>{capability}</Chip>
                  ))
                ) : (
                  <span className="text-ink-muted">None recorded.</span>
                )}
              </dd>
            </div>
            {data.investigation_count !== null ? (
              <div className="pt-3">
                <dt className="eyebrow">Finalised counts</dt>
                <dd className="numerals mt-1.5 text-ink-soft">
                  {data.completed_investigation_count} completed ·{" "}
                  {data.failed_investigation_count} failed of {data.investigation_count}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <div
              role="tablist"
              aria-label="Run detail sections"
              className="inline-flex rounded-lg bg-canvas-alt p-1"
            >
              {(
                [
                  ["businesses", "Businesses", businesses.data?.businesses.length],
                  ["opportunities", "Opportunities", matches.data?.matches.length],
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

function count(matches: { match_status: MatchStatus }[], status: MatchStatus): number {
  return matches.filter((match) => match.match_status === status).length;
}

function aggregateHypothesisCounts(rows: BusinessRow[]) {
  const totals = new Map<string, { key: string; label: string; count: number }>();
  for (const key of Object.keys(OPPORTUNITY_STATUS)) {
    totals.set(key, { key, label: key, count: 0 });
  }
  for (const row of rows) {
    for (const entry of row.hypothesis_status_counts) {
      const existing = totals.get(entry.key) ?? {
        key: entry.key,
        label: entry.label,
        count: 0,
      };
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
  const columns: Column<BusinessRow>[] = useMemo(
    () => [
      {
        key: "business",
        header: "Business",
        render: (row) => (
          <PrimaryCell title={row.display_name} subtitle={row.formatted_address ?? undefined} />
        ),
      },
      {
        key: "status",
        header: "Investigation",
        render: (row) => (
          <StatusBadge
            meta={INVESTIGATION_STATUS[row.investigation_status]}
            live={row.investigation_status === "IN_PROGRESS"}
          />
        ),
      },
      {
        key: "sources",
        header: "Sources",
        numeric: true,
        render: (row) => row.source_count,
      },
      {
        key: "evidence",
        header: "Evidence",
        numeric: true,
        render: (row) => row.evidence_count,
      },
      {
        key: "hypotheses",
        header: "Hypotheses",
        className: "min-w-[150px]",
        render: (row) =>
          row.hypotheses_total === 0 ? (
            <span className="text-xs text-ink-muted">—</span>
          ) : (
            <div>
              <MiniDistribution
                segments={toSegments(row.hypothesis_status_counts, "hypothesis")}
              />
              <p className="numerals mt-1.5 text-xs text-ink-soft">
                {row.hypotheses_total} formed
              </p>
            </div>
          ),
      },
      {
        key: "matches",
        header: "Opportunities",
        className: "min-w-[150px]",
        render: (row) =>
          row.matches_total === 0 ? (
            <span className="text-xs text-ink-muted">
              {runLive ? "Not yet matched" : "None"}
            </span>
          ) : (
            <div>
              <MiniDistribution segments={matchSegments(row)} />
              <p className="numerals mt-1.5 text-xs text-ink-soft">
                <span className="font-medium text-teal-700">{row.matches_matched}</span>{" "}
                matched
              </p>
            </div>
          ),
      },
      {
        key: "site",
        header: "Site",
        render: (row) =>
          row.website_url ? (
            <ExternalLink href={row.website_url}>Visit</ExternalLink>
          ) : (
            <span
              className="text-xs text-ink-muted"
              title="No website was found for this business — itself an observable fact."
            >
              None found
            </span>
          ),
      },
    ],
    [runLive],
  );

  if (resource.error && !resource.data) {
    return (
      <ErrorState
        error={resource.error}
        onRetry={resource.reload}
        context="This run's businesses"
      />
    );
  }
  if (resource.loading || !resource.data) {
    return <SkeletonRows rows={6} />;
  }

  return (
    <DataTable
      columns={columns}
      rows={resource.data.businesses}
      rowKey={(row) => row.investigation_id}
      empty={
        <EmptyState
          title="No businesses yet"
          description="Market Scout has not committed this run's business set. Once discovery finishes, one row appears here per business."
        />
      }
      dense
    />
  );
}

function OpportunitiesPanel({
  resource,
  runLive,
}: {
  resource: ReturnType<typeof useResource<Awaited<ReturnType<typeof api.matches>>>>;
  runLive: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const active = (params.get("status") as MatchStatus | null) ?? null;

  if (resource.error && !resource.data) {
    return (
      <ErrorState
        error={resource.error}
        onRetry={resource.reload}
        context="This run's opportunities"
      />
    );
  }
  if (resource.loading || !resource.data) {
    return <SkeletonRows rows={6} />;
  }

  const all = resource.data.matches;
  const shown = active ? all.filter((match) => match.match_status === active) : all;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPill
          label="All"
          count={all.length}
          active={active === null}
          onClick={() => {
            params.delete("status");
            setParams(params, { replace: true });
          }}
        />
        {(Object.keys(MATCH_STATUS) as MatchStatus[]).map((status) => (
          <FilterPill
            key={status}
            label={MATCH_STATUS[status].label}
            title={MATCH_STATUS[status].meaning}
            count={count(all, status)}
            active={active === status}
            onClick={() => {
              params.set("status", status);
              setParams(params, { replace: true });
            }}
          />
        ))}
      </div>

      <MatchesTable
        matches={shown}
        empty={
          <EmptyState
            compact
            title={active ? `No ${MATCH_STATUS[active].label.toLowerCase()} opportunities` : "No opportunities yet"}
            description={
              active
                ? "Every opportunity in this run landed in a different bucket."
                : runLive
                  ? "This run has not reached verification and matching yet. Opportunities appear once finalisation runs."
                  : "This run produced no hypotheses to reconcile."
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
