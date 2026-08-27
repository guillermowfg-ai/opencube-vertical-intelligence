/**
 * Numbers and distributions.
 *
 * Every distribution here is a status distribution, so it uses the reserved
 * status palette and always ships the label and the count alongside the
 * colour — identity is never carried by colour alone. Segments are separated
 * by a 2px surface gap, which is also the secondary encoding that keeps the
 * teal/rose pair readable for a colour-blind reader.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TONE_CLASSES, type Tone } from "../../lib/domain";
import type { Segment } from "../../lib/segments";
import { formatNumber } from "../../lib/format";
import { cx } from "../../lib/cx";

export function StatCard({
  label,
  value,
  hint,
  tone,
  emphasis = false,
  to,
  loading = false,
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  tone?: Tone;
  /** Reserved for the single number that matters most on a screen. */
  emphasis?: boolean;
  to?: string;
  loading?: boolean;
}) {
  const display = typeof value === "number" ? formatNumber(value) : (value ?? "—");
  const accent = tone ? TONE_CLASSES[tone].accentText : undefined;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {emphasis ? (
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
        ) : null}
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-16 rounded-md" />
      ) : (
        <p
          className={cx(
            "numerals mt-2 font-semibold",
            emphasis ? "text-[2rem] leading-9 text-brand-600" : "text-[1.75rem] leading-8",
            !emphasis && (accent ?? "text-ink"),
          )}
        >
          {display}
        </p>
      )}
      {hint ? <p className="mt-1.5 text-xs leading-snug text-ink-muted">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cx(
          "card hover-lift block p-5 focus-visible:outline-none",
          emphasis && "ring-1 ring-brand-200",
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={cx("card p-5", emphasis && "ring-1 ring-brand-200")}>{body}</div>
  );
}

/** A stacked status bar with its own legend. The legend is the table view:
 * label, count and share are all present as text. */
export function Distribution({
  segments,
  total,
  emptyMessage = "Nothing recorded yet.",
  compact = false,
}: {
  segments: Segment[];
  total?: number;
  emptyMessage?: string;
  compact?: boolean;
}) {
  const sum = total ?? segments.reduce((acc, s) => acc + s.count, 0);

  if (sum === 0) {
    return <p className="text-sm text-ink-muted">{emptyMessage}</p>;
  }

  const visible = segments.filter((segment) => segment.count > 0);

  return (
    <div>
      <div
        className={cx("flex w-full gap-[2px] overflow-hidden", compact ? "h-2" : "h-2.5")}
        role="img"
        aria-label={visible
          .map((segment) => `${segment.label}: ${segment.count}`)
          .join(", ")}
      >
        {visible.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${segment.count} of ${sum}`}
            style={{ width: `${(segment.count / sum) * 100}%` }}
            className={cx("rounded-[3px]", TONE_CLASSES[segment.tone].fill)}
          />
        ))}
      </div>

      <dl className={cx("mt-3", compact ? "space-y-1" : "space-y-1.5")}>
        {segments.map((segment) => (
          <div
            key={segment.key}
            title={segment.meaning}
            className={cx(
              "flex items-center gap-2.5 text-sm",
              segment.count === 0 && "opacity-45",
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "size-2 shrink-0 rounded-[2px]",
                TONE_CLASSES[segment.tone].fill,
              )}
            />
            <dt className="min-w-0 flex-1 truncate text-ink-soft">{segment.label}</dt>
            <dd className="numerals shrink-0 font-medium text-ink">{segment.count}</dd>
            <dd className="numerals w-11 shrink-0 text-right text-xs text-ink-muted">
              {sum === 0 ? "—" : `${Math.round((segment.count / sum) * 100)}%`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Inline, label-free version for a table cell. The counts are rendered
 * beside it by the caller, so this stays purely a shape cue. */
export function MiniDistribution({ segments }: { segments: Segment[] }) {
  const sum = segments.reduce((acc, s) => acc + s.count, 0);
  if (sum === 0) {
    return <span className="text-xs text-ink-muted">—</span>;
  }
  return (
    <div
      className="flex h-1.5 w-24 gap-[2px]"
      title={segments
        .filter((s) => s.count > 0)
        .map((s) => `${s.label}: ${s.count}`)
        .join(" · ")}
    >
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${(segment.count / sum) * 100}%` }}
            className={cx("rounded-[2px]", TONE_CLASSES[segment.tone].fill)}
          />
        ))}
    </div>
  );
}

/** Ranked horizontal bars — used for capability and opportunity frequency,
 * where the question is "which of these, and how many".
 *
 * These are magnitudes, not statuses, so they are deliberately painted in a
 * single recessive hue rather than in a status colour or the brand accent:
 * a reserved status colour must never mean "series", and an orange bar beside
 * an amber "unresolved" segment reads as a status the data does not carry.
 */
export function RankedBars({
  items,
  fill = "bg-slate-600",
  emptyMessage,
}: {
  items: { key: string; label: string; count: number }[];
  fill?: string;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyMessage}</p>;
  }
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink">{item.label}</span>
            <span className="numerals shrink-0 text-sm font-medium text-ink">
              {item.count}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-[3px] bg-canvas-alt">
            <div
              className={cx("h-full rounded-[3px]", fill)}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "info",
  label,
}: {
  value: number;
  max: number;
  tone?: Tone;
  label?: ReactNode;
}) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          {label}
        </div>
      ) : null}
      <div
        className="h-1.5 w-full rounded-[3px] bg-canvas-alt"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cx("h-full rounded-[3px] transition-[width] duration-500", TONE_CLASSES[tone].fill)}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}
