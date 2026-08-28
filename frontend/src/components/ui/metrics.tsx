/**
 * Numbers and distributions.
 *
 * Every distribution here is a status distribution, so it uses the reserved
 * status palette and always ships the label and the count alongside the
 * colour -- identity is never carried by colour alone. Segments are separated
 * by a 2px surface gap, which is also the secondary encoding that keeps the
 * green/amber pair readable for a colour-blind reader.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TONE_CLASSES, type Tone } from "../../lib/domain";
import type { Segment } from "../../lib/segments";
import { formatNumber } from "../../lib/format";
import { useI18n } from "../../i18n";
import { cx } from "../../lib/cx";

export function StatCard({
  label,
  value,
  hint,
  tone,
  emphasis = false,
  to,
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  tone?: Tone;
  /** Reserved for the single number that matters most on a screen. */
  emphasis?: boolean;
  to?: string;
}) {
  const { locale } = useI18n();
  const display = typeof value === "number" ? formatNumber(locale, value) : (value ?? "—");
  const accent = tone ? TONE_CLASSES[tone].accentText : undefined;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {emphasis ? (
          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
        ) : null}
      </div>
      <p
        className={cx(
          "numerals mt-2 font-semibold",
          emphasis ? "text-[2rem] leading-9 text-brand-600" : "text-[1.75rem] leading-8",
          !emphasis && (accent ?? "text-ink"),
        )}
      >
        {display}
      </p>
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

  return <div className={cx("card p-5", emphasis && "ring-1 ring-brand-200")}>{body}</div>;
}

/** A stacked status bar with its own legend. The legend is the table view:
 * label, count and share are all present as text. */
export function Distribution({
  segments,
  total,
  emptyMessage,
  compact = false,
}: {
  segments: Segment[];
  total?: number;
  emptyMessage: string;
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
        aria-label={visible.map((s) => `${s.label}: ${s.count}`).join(", ")}
      >
        {visible.map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${segment.count} / ${sum}`}
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
              className={cx("size-2 shrink-0 rounded-[2px]", TONE_CLASSES[segment.tone].fill)}
            />
            <dt className="min-w-0 flex-1 truncate text-ink-soft">{segment.label}</dt>
            <dd className="numerals shrink-0 font-medium text-ink">{segment.count}</dd>
            <dd className="numerals w-11 shrink-0 text-right text-xs text-ink-muted">
              {`${Math.round((segment.count / sum) * 100)}%`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The headline result panel: a donut on the one dark surface a screen gets.
 *
 * The donut is the only place a proportion is drawn as an arc rather than a
 * bar. It earns that by being the screen's single most important number --
 * everywhere else, a bar compares more honestly.
 */
export function ResultDonut({
  title,
  segments,
  totalLabel,
  emptyMessage,
  headline,
  principle,
  children,
}: {
  title: string;
  segments: Segment[];
  totalLabel: string;
  emptyMessage: string;
  /** The conservative headline: how much was rejected, out of how much. Always
   * computed by the caller from the data, never a fixed string. */
  headline?: string;
  principle?: string;
  children?: ReactNode;
}) {
  const total = segments.reduce((acc, s) => acc + s.count, 0);
  const size = 132;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A 2px visual gap between arcs, expressed in path length.
  const gap = total > 1 ? 3 : 0;

  // Cumulative offsets built by reduce rather than by mutating a binding
  // during render.
  const arcs = segments
    .filter((s) => s.count > 0)
    .reduce<{ segment: Segment; dash: string; offset: number }[]>((acc, segment) => {
      const consumed = acc.reduce(
        (sum, arc) => sum + (arc.segment.count / total) * circumference,
        0,
      );
      const length = (segment.count / total) * circumference;
      acc.push({
        segment,
        dash: `${Math.max(length - gap, 0.001)} ${circumference}`,
        offset: -consumed,
      });
      return acc;
    }, []);

  return (
    <section className="vault p-5 sm:p-6">
      <h2 className="text-sm font-semibold tracking-tight text-vault-ink">{title}</h2>

      {total === 0 ? (
        <p className="mt-4 text-sm text-vault-ink-muted">{emptyMessage}</p>
      ) : (
        <>
        {headline ? (
          <p className="mt-3 text-lg leading-snug font-semibold text-vault-ink sm:text-xl">
            {headline}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-6">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90"
              width={size}
              height={size}
              role="img"
              aria-label={segments
                .filter((s) => s.count > 0)
                .map((s) => `${s.label}: ${s.count}`)
                .join(", ")}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--color-vault-soft)"
                strokeWidth={stroke}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.segment.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  className={TONE_CLASSES[arc.segment.tone].stroke}
                  strokeWidth={stroke}
                  strokeDasharray={arc.dash}
                  strokeDashoffset={arc.offset}
                  strokeLinecap="butt"
                >
                  <title>{`${arc.segment.label}: ${arc.segment.count}`}</title>
                </circle>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="numerals text-2xl font-semibold text-vault-ink">{total}</span>
              <span className="text-[0.625rem] tracking-[0.08em] text-vault-ink-muted uppercase">
                {totalLabel}
              </span>
            </div>
          </div>

          <dl className="w-full min-w-[180px] max-w-sm space-y-2.5 sm:flex-1">
            {segments.map((segment) => (
              <div
                key={segment.key}
                title={segment.meaning}
                className={cx(
                  "flex items-center gap-2.5 text-sm",
                  segment.count === 0 && "opacity-40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx("size-2 shrink-0 rounded-full", TONE_CLASSES[segment.tone].fill)}
                />
                <dt className="min-w-0 flex-1 truncate text-vault-ink-muted">{segment.label}</dt>
                <dd className="numerals shrink-0 font-semibold text-vault-ink">
                  {segment.count}
                </dd>
                <dd className="numerals w-11 shrink-0 text-right text-xs text-vault-ink-muted">
                  {total === 0 ? "—" : `${Math.round((segment.count / total) * 100)}%`}
                </dd>
              </div>
            ))}
          </dl>

          {children ? (
            <div className="min-w-[150px] border-t border-vault-line pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
              {children}
            </div>
          ) : null}
        </div>
        {principle ? (
          <p className="mt-5 border-t border-vault-line pt-4 text-sm leading-relaxed text-vault-ink-muted">
            {principle}
          </p>
        ) : null}
        </>
      )}
    </section>
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

/** Ranked horizontal bars -- used for service and opportunity frequency,
 * where the question is "which of these, and how many".
 *
 * These are magnitudes, not statuses, so they are deliberately painted in a
 * single recessive hue rather than in a status colour or the brand accent: a
 * reserved status colour must never mean "series", and an orange bar beside an
 * amber segment reads as a status the data does not carry. */
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
            <span className="numerals shrink-0 text-sm font-medium text-ink">{item.count}</span>
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
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">{label}</div>
      ) : null}
      <div
        className="h-1.5 w-full rounded-[3px] bg-canvas-alt"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cx(
            "h-full rounded-[3px] transition-[width] duration-500",
            TONE_CLASSES[tone].fill,
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}
