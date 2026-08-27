/** Opportunities across every run, filterable by commercial eligibility. */

import { useSearchParams } from "react-router-dom";
import { api, useResource } from "../lib/api";
import { MATCH_STATUS } from "../lib/domain";
import type { MatchStatus } from "../lib/types";
import { MatchesTable } from "../components/MatchesTable";
import { Card, PageHeader } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

const STATUSES = Object.keys(MATCH_STATUS) as MatchStatus[];

export function MatchesPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const active = STATUSES.includes(raw as MatchStatus) ? (raw as MatchStatus) : null;

  const { data, error, loading, reload } = useResource(
    (signal) => api.matches({ limit: 500 }, signal),
    [],
  );

  const all = data?.matches ?? [];
  const shown = active ? all.filter((match) => match.match_status === active) : all;

  const select = (status: MatchStatus | null) => {
    if (status) params.set("status", status);
    else params.delete("status");
    setParams(params, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Results"
        title="Opportunities"
        subtitle="Every hypothesis the platform reconciled, across every run. Matched, not matched and unresolved are all first-class output — rejected opportunities are kept, never filtered away."
      />

      <Card>
        <div className="mb-5 border-b border-hairline pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter
              label="All"
              count={all.length}
              active={active === null}
              onClick={() => select(null)}
            />
            {STATUSES.map((status) => (
              <Filter
                key={status}
                label={MATCH_STATUS[status].label}
                title={MATCH_STATUS[status].meaning}
                count={all.filter((m) => m.match_status === status).length}
                active={active === status}
                onClick={() => select(status)}
              />
            ))}
          </div>
        </div>

        {error && !data ? (
          <ErrorState error={error} onRetry={reload} context="The opportunity list" />
        ) : loading || !data ? (
          <SkeletonRows rows={8} />
        ) : (
          <MatchesTable
            matches={shown}
            showRun
            empty={
              <EmptyState
                title={
                  active
                    ? `No ${MATCH_STATUS[active].label.toLowerCase()} opportunities`
                    : "No opportunities yet"
                }
                description={
                  active
                    ? "Try another filter — every reconciled opportunity lands in exactly one of these three buckets."
                    : "Opportunities appear once a run reaches verification and matching."
                }
              />
            }
          />
        )}
      </Card>

    </>
  );
}

function Filter({
  label,
  count,
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
        {count}
      </span>
    </button>
  );
}
