/**
 * The opportunity table.
 *
 * Three status columns, deliberately: what the Investigator concluded, what
 * an independent source said, and what the Matcher decided. Collapsing them
 * into one column would hide exactly the disagreement this product exists to
 * surface.
 */

import type { ReactNode } from "react";
import {
  MATCH_STATUS,
  OPPORTUNITY_STATUS,
  VERIFICATION_STATE,
  reasonCodeLabel,
  verificationStateOf,
} from "../lib/domain";
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
  const columns: Column<MatchRow>[] = [
    {
      key: "business",
      header: "Business",
      className: "max-w-[240px]",
      render: (match) => (
        <PrimaryCell
          title={match.business_display_name ?? match.business_id}
          subtitle={
            showRun ? match.run_id : (match.opportunity_name ?? match.opportunity_id)
          }
        />
      ),
    },
    ...(showRun
      ? [
          {
            key: "opportunity",
            header: "Opportunity",
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
      key: "original",
      header: "Investigator",
      render: (match) => <StatusBadge meta={OPPORTUNITY_STATUS[match.original_status]} />,
    },
    {
      key: "verification",
      header: "Verification",
      render: (match) => (
        <StatusBadge meta={VERIFICATION_STATE[verificationStateOf(match)]} />
      ),
    },
    {
      key: "match",
      header: "Match",
      render: (match) => <StatusBadge meta={MATCH_STATUS[match.match_status]} />,
    },
    {
      key: "capability",
      header: "Capability",
      render: (match) =>
        match.primary_capability_label ? (
          // Truncated to one line: a wrapping chip triples the row height and
          // this column is taxonomy, not the row's point.
          <Chip
            className="max-w-[140px]"
            title={`${match.primary_capability_label} — taxonomy only; capability fit is never evidence of need.`}
          >
            <span className="truncate">{match.primary_capability_label}</span>
          </Chip>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: "reason",
      header: "Reason",
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
