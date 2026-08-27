/**
 * Businesses -- the canonical records, added up across analyses.
 *
 * A business deliberately carries no analysis id in the data model, so the
 * link back to an analysis is worked out by the back end, never stored.
 * Ranked by good-fit opportunities, because that is the only ordering someone
 * actually wants.
 */

import { api, useResource } from "../lib/api";
import { formatRelative, hostnameOf } from "../lib/format";
import { fill, useI18n } from "../i18n";
import type { BusinessAggregate } from "../lib/types";
import { DataTable, PrimaryCell, type Column } from "../components/ui/DataTable";
import { Card, ExternalLink, PageHeader } from "../components/ui/primitives";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

export function BusinessesPage() {
  const { t, locale } = useI18n();
  const { data, error, loading, reload } = useResource((signal) => api.businesses(signal), []);
  const copy = t.businesses.table;

  const columns: Column<BusinessAggregate>[] = [
    {
      key: "business",
      // Capped: real business names and full postal addresses are long enough
      // to push the right-hand columns behind an inner scrollbar.
      className: "max-w-[300px]",
      header: copy.business,
      render: (row) => (
        <PrimaryCell title={row.display_name} subtitle={row.formatted_address ?? undefined} />
      ),
    },
    {
      key: "site",
      header: copy.website,
      render: (row) =>
        row.website_url ? (
          <ExternalLink href={row.website_url}>{hostnameOf(row.website_url)}</ExternalLink>
        ) : (
          <span className="text-xs text-ink-muted" title={t.common.noWebsiteHelp}>
            {t.common.noWebsite}
          </span>
        ),
    },
    {
      key: "runs",
      header: copy.runs,
      numeric: true,
      render: (row) => (
        <span
          title={fill(copy.runsTitle, {
            total: row.investigations_total,
            done: row.investigations_completed,
          })}
        >
          {row.runs_total}
        </span>
      ),
    },
    {
      key: "findings",
      header: copy.findings,
      numeric: true,
      render: (row) => row.hypotheses_total,
    },
    {
      key: "matched",
      header: copy.goodFit,
      numeric: true,
      render: (row) => (
        <span
          className={row.matches_matched > 0 ? "font-semibold text-green-700" : "text-ink-muted"}
        >
          {row.matches_matched}
        </span>
      ),
    },
    {
      key: "unresolved",
      header: copy.toReview,
      numeric: true,
      render: (row) => (
        <span
          className={
            row.matches_unresolved > 0 ? "font-semibold text-amber-700" : "text-ink-muted"
          }
        >
          {row.matches_unresolved}
        </span>
      ),
    },
    {
      key: "last",
      header: copy.lastLooked,
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-muted">
          {formatRelative(locale, row.last_investigated_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t.businesses.eyebrow}
        title={t.businesses.title}
        subtitle={t.businesses.subtitle}
        meta={
          data ? (
            <p className="text-sm text-ink-soft">
              <span className="numerals font-medium text-ink">
                {data.total === 1
                  ? t.businesses.countOne
                  : fill(t.businesses.count, { count: data.total })}
              </span>
            </p>
          ) : undefined
        }
      />

      <Card>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} context={t.businesses.error} />
        ) : loading || !data ? (
          <SkeletonRows rows={8} />
        ) : (
          <DataTable
            columns={columns}
            rows={data.businesses}
            rowKey={(row) => row.business_id}
            // The row itself opens the most recent analysis this business
            // appeared in.
            rowHref={(row) =>
              row.latest_run_id
                ? `/runs/${encodeURIComponent(row.latest_run_id)}`
                : "/businesses"
            }
            empty={
              <EmptyState title={t.businesses.empty} description={t.businesses.emptyHelp} />
            }
            dense
          />
        )}
      </Card>
    </>
  );
}
