/**
 * The status badge is the highest-traffic element in the product, so it
 * carries its own meaning: hovering any badge explains what the status means
 * rather than assuming the reader already knows the pipeline's vocabulary.
 */

import type { ReactNode } from "react";
import { TONE_CLASSES, type StatusMeta, type Tone } from "../../lib/domain";
import { cx } from "../../lib/cx";

export function Badge({
  tone = "neutral",
  children,
  title,
  className,
  dot = false,
  live = false,
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
  className?: string;
  dot?: boolean;
  live?: boolean;
}) {
  const classes = TONE_CLASSES[tone];
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        classes.badge,
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cx("size-1.5 rounded-full", classes.dot, live && "live-dot")}
        />
      ) : null}
      {children}
    </span>
  );
}

export function StatusBadge({
  meta,
  dot = true,
  live = false,
  className,
}: {
  meta: StatusMeta;
  dot?: boolean;
  live?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={meta.tone} title={meta.meaning} dot={dot} live={live} className={className}>
      {meta.label}
    </Badge>
  );
}

/** A quieter chip for taxonomy — capabilities, opportunity types, IDs. It is
 * deliberately colourless: capability fit is not evidence of need. */
export function Chip({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs font-medium text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
