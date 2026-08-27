/**
 * Businesses — the canonical records, aggregated across runs.
 *
 * A Business deliberately carries no run_id in the data model, so the run
 * linkage here is derived through Investigations by the backend. Ranked by
 * matched opportunities, because that is the only ordering an operator
 * actually wants.
 */

import { api, useResource } from "../lib/api";
import { formatRelative, pluralize } from "../lib/format";
import { hostnameOf } from "../lib/format";
import type { BusinessAggregate } from "../lib/types";
import { DataTable, PrimaryCell, type Column } from "../components/ui/DataTable";
import { ExternalLink, Card, PageHeader } from "../components/ui/primitives";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

export function BusinessesPage() {
  const { data, error, loading, reload } = useResource((signal) => api.businesses(signal), []);

  const columns: Column<BusinessAggregate>[] = [
    {
      key: "business",
      // Capped: real business names and full postal addresses are long enough
      // to push the right-hand columns behind an inner scrollbar.
      className: "max-w-[300px]",
      header: "Business",
      render: (row) => (
        <PrimaryCell title={row.display_name} subtitle={row.formatted_address ?? undefined} />
      ),
    },
    {
      key: "site",
      header: "Website",
      render: (row) =>
        row.website_url ? (
          <ExternalLink href={row.website_url}>{hostnameOf(row.website_url)}</ExternalLink>
        ) : (
          <span
            className="text-xs text-ink-muted"
            title="No website was found — itself a publicly observable fact."
          >
            None found
          </span>
        ),
    },
    {
      key: "runs",
      header: "Runs",
      numeric: true,
      render: (row) => (
        <span
          title={`${row.investigations_total} investigations, ${row.investigations_completed} completed`}
        >
          {row.runs_total}
        </span>
      ),
    },
    {
      key: "hypotheses",
      header: "Hypotheses",
      numeric: true,
      render: (row) => row.hypotheses_total,
    },
    {
      key: "matched",
      header: "Matched",
      numeric: true,
      render: (row) => (
        <span className={row.matches_matched > 0 ? "font-semibold text-teal-700" : "text-ink-muted"}>
          {row.matches_matched}
        </span>
      ),
    },
    {
      key: "unresolved",
      header: "To review",
      numeric: true,
      render: (row) => (
        <span className={row.matches_unresolved > 0 ? "font-semibold text-amber-700" : "text-ink-muted"}>
          {row.matches_unresolved}
        </span>
      ),
    },
    {
      key: "last",
      header: "Last investigated",
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-muted">
          {formatRelative(row.last_investigated_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Businesses"
        subtitle="Canonical business records. The same business can be investigated across several runs without being recreated, so the counts below span every run it appeared in."
        meta={
          data ? (
            <p className="text-sm text-ink-soft">
              <span className="numerals font-medium text-ink">{data.total}</span>{" "}
              {pluralize(data.total, "business", "businesses")} investigated
            </p>
          ) : undefined
        }
      />

      <Card>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} context="The business directory" />
        ) : loading || !data ? (
          <SkeletonRows rows={8} />
        ) : (
          <DataTable
            columns={columns}
            rows={data.businesses}
            rowKey={(row) => row.business_id}
            // The row itself opens the most recent run this business appeared
            // in, which is what the dropped "Latest run" column linked to.
            rowHref={(row) =>
              row.latest_run_id
                ? `/runs/${encodeURIComponent(row.latest_run_id)}`
                : "/businesses"
            }
            empty={
              <EmptyState
                title="No businesses yet"
                description="Businesses appear here once Market Scout discovers them and an investigation is created."
              />
            }
            dense
          />
        )}
      </Card>
    </>
  );
}
