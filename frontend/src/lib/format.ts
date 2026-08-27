/**
 * Display formatting. Never rounds a number that a reader might compare.
 *
 * Every function takes a locale, because the language switcher has to change
 * dates and relative times too — a Spanish screen showing "3 days ago" is a
 * half-translated screen.
 */

export function formatDateTime(locale: string, value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDate(locale: string, value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
}

export function formatRelative(
  locale: string,
  value: string | null | undefined,
  now = Date.now(),
): string {
  if (!value) return "—";
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return value;

  const seconds = Math.round((parsed - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.348],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];

  let amount = seconds;
  for (const [unit, step] of units) {
    if (Math.abs(amount) < step || unit === "year") {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        Math.round(amount),
        unit,
      );
    }
    amount /= step;
  }
  return formatDate(locale, value);
}

/**
 * Elapsed time between two timestamps.
 *
 * The unit suffixes are intentionally not translated: h/m/s read the same in
 * both supported languages, and a localised "1h 14m" gains nothing while
 * risking a wider string in a fixed table column.
 */
export function formatDuration(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (!from || !to) return "—";
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";

  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatNumber(locale: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

/** Confidence is model output; showing decimals implies a precision it does
 * not have, so it renders as a whole percentage. */
export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export function hostnameOf(url: string | null | undefined): string {
  if (!url) return "—";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Trims an ID for a chip while keeping both ends, which is what makes two
 * near-identical IDs distinguishable at a glance. */
export function shortId(value: string | null | undefined, keep = 8): string {
  if (!value) return "—";
  if (value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
