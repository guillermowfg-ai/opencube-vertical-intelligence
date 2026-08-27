/** Opportunities across every analysis, filtered by whether we can help. */

import { useSearchParams } from "react-router-dom";
import { api, useResource } from "../lib/api";
import { useStatus } from "../lib/useStatus";
import { useI18n } from "../i18n";
import type { MatchStatus } from "../lib/types";
import { MatchesTable } from "../components/MatchesTable";
import { Card, PageHeader } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui/states";

const STATUSES: MatchStatus[] = ["MATCHED", "UNRESOLVED", "NOT_MATCHED"];

export function MatchesPage() {
  const { t } = useI18n();
  const status = useStatus();
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const active = STATUSES.includes(raw as MatchStatus) ? (raw as MatchStatus) : null;

  const { data, error, loading, reload } = useResource(
    (signal) => api.matches({ limit: 500 }, signal),
    [],
  );

  const all = data?.matches ?? [];
  const shown = active ? all.filter((match) => match.match_status === active) : all;

  const select = (next: MatchStatus | null) => {
    if (next) params.set("status", next);
    else params.delete("status");
    setParams(params, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow={t.matches.eyebrow}
        title={t.matches.title}
        subtitle={t.matches.subtitle}
      />

      <Card>
        <div className="mb-5 border-b border-hairline pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter
              label={t.common.all}
              count={all.length}
              active={active === null}
              onClick={() => select(null)}
            />
            {STATUSES.map((value) => {
              const meta = status.fit(value);
              return (
                <Filter
                  key={value}
                  label={meta.label}
                  title={meta.meaning}
                  count={all.filter((m) => m.match_status === value).length}
                  active={active === value}
                  onClick={() => select(value)}
                />
              );
            })}
          </div>
        </div>

        {error && !data ? (
          <ErrorState error={error} onRetry={reload} context={t.matches.error} />
        ) : loading || !data ? (
          <SkeletonRows rows={8} />
        ) : (
          <MatchesTable
            matches={shown}
            showRun
            empty={
              <EmptyState
                title={active ? t.matches.filteredEmpty : t.matches.empty}
                description={active ? t.matches.filteredHelp : t.matches.emptyHelp}
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
