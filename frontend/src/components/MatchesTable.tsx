/**
 * The opportunity table.
 *
 * Three status columns, deliberately: what our research concluded, what an
 * outside source said, and whether we have something that fits. Collapsing
 * them into one column would hide exactly the disagreement this product exists
 * to surface.
 */

import type { ReactNode } from "react";
import { reasonCodeLabel, verificationStateOf } from "../lib/domain";
import { useStatus } from "../lib/useStatus";
import { fill, useI18n } from "../i18n";
import type { MatchRow } from "../lib/types";
import { DataTable, PrimaryCell, type Column } from "./ui/DataTable";
import { Chip, StatusBadge } from "./ui/StatusBadge";

export function MatchesTable({
  matches,
  empty,
  showRun = false,
}: {
  matches: MatchRow[];
  empty?: ReactNode;
  showRun?: boolean;
}) {
  const { t } = useI18n();
  const status = useStatus();
  const copy = t.matches.table;

  const columns: Column<MatchRow>[] = [
    {
      key: "business",
      header: copy.business,
      className: "max-w-[240px]",
      render: (match) => (
        <PrimaryCell
          title={match.business_display_name ?? match.business_id}
          subtitle={
            showRun ? (
              <span className="font-mono">{match.run_id}</span>
            ) : (
              (match.opportunity_name ?? match.opportunity_id)
            )
          }
        />
      ),
    },
    ...(showRun
      ? [
          {
            key: "opportunity",
            header: copy.opportunity,
            className: "max-w-[170px]",
            render: (match: MatchRow) => (
              <span className="text-ink">
                {match.opportunity_name ?? match.opportunity_id}
              </span>
            ),
          } satisfies Column<MatchRow>,
        ]
      : []),
    {
      key: "finding",
      header: copy.finding,
      render: (match) => <StatusBadge meta={status.finding(match.original_status)} />,
    },
    {
      key: "secondOpinion",
      header: copy.secondOpinion,
      render: (match) => (
        <StatusBadge meta={status.secondOpinion(verificationStateOf(match))} />
      ),
    },
    {
      key: "fit",
      header: copy.fit,
      render: (match) => <StatusBadge meta={status.fit(match.match_status)} />,
    },
    {
      key: "capability",
      header: copy.capability,
      render: (match) =>
        match.primary_capability_label ? (
          // Truncated to one line: a wrapping chip triples the row height and
          // this column is taxonomy, not the row's point.
          <Chip
            className="max-w-[140px]"
            title={fill(copy.capabilityNote, { label: match.primary_capability_label })}
          >
            <span className="truncate">{match.primary_capability_label}</span>
          </Chip>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: "reason",
      header: copy.reason,
      className: "max-w-[150px] min-w-[110px]",
      render: (match) => (
        <span className="block truncate text-xs text-ink-muted" title={match.reasoning}>
          {reasonCodeLabel(match.reason_code)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={matches}
      rowKey={(match) => match.match_id}
      rowHref={(match) => `/matches/${encodeURIComponent(match.match_id)}`}
      empty={empty}
      dense
    />
  );
}
