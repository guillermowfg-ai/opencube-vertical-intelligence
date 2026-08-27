/**
 * A scan-friendly table.
 *
 * Wide content scrolls inside the card rather than pushing the page sideways,
 * a row can be a link without nesting anchors, and numeric columns are right
 * aligned with tabular figures so a column of counts reads as a column.
 */

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cx } from "../../lib/cx";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Right-aligns and applies tabular figures. */
  numeric?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  empty?: ReactNode;
  dense?: boolean;
}) {
  const navigate = useNavigate();

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <div className="inline-block min-w-full align-middle px-5 sm:px-6">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    "border-b border-hairline pb-2.5 text-left text-[0.6875rem] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-muted uppercase",
                    dense ? "pr-4" : "pr-5",
                    // Numeric headers need the same left gutter their cells get,
                    // or two right-aligned labels run into each other.
                    column.numeric && "pl-4 text-right",
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  onClick={href ? () => navigate(href) : undefined}
                  className={cx(
                    "group border-b border-hairline/70 transition-colors last:border-0",
                    href && "cursor-pointer hover:bg-canvas",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cx(
                        "border-b border-hairline/70 align-middle text-sm text-ink",
                        dense ? "py-2.5 pr-4" : "py-3.5 pr-5",
                        column.numeric && "numerals pl-4 text-right",
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The primary identity cell of a row: a strong name over a quiet detail. */
export function PrimaryCell({
  title,
  subtitle,
  accessory,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  accessory?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {accessory}
      <div className="min-w-0">
        <div className="truncate font-medium text-ink group-hover:text-brand-700">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
