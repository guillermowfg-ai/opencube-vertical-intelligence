/**
 * Shared surface primitives. Small on purpose: a card, a section, a header.
 * Anything that carries meaning (a status, a distribution) lives in its own
 * file so its vocabulary is reviewable in one place.
 */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("card", padded && "p-5 sm:p-6", className)}>{children}</section>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="relative mb-7 overflow-hidden border-b border-hairline pb-6">
      {/* Decorative isometric lattice, fading out to the left so it never
          competes with the title. Carries no data. */}
      <span
        aria-hidden="true"
        className="lattice pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 [mask-image:linear-gradient(to_left,black,transparent)] sm:block"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-[0.9375rem] leading-relaxed text-ink-soft">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? (
        <div className="relative mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">{meta}</div>
      ) : null}
    </header>
  );
}

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <div className="mt-0.5 truncate text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

export function KeyValue({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="eyebrow" title={hint}>
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "rounded-md bg-canvas-alt px-1.5 py-0.5 font-mono text-[0.75rem] break-all text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 transition hover:text-brand-700 hover:decoration-brand-400"
    >
      {children}
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0">
        <path
          d="M4 2h6v6M10 2 3 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
