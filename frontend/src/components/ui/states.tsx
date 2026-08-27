/**
 * Loading, empty and error states.
 *
 * Each one says what is actually true. "No data" is never used where the real
 * message is "this run has not reached matching yet" — an operator watching a
 * live run needs to tell those apart.
 */

import type { ReactNode } from "react";
import { ApiError } from "../../lib/api";
import { Card } from "./primitives";
import { cx } from "../../lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-md", className)} />;
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function SkeletonPanel({ lines = 4 }: { lines?: number }) {
  return (
    <Card>
      <Skeleton className="h-3 w-24" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={index % 3 === 2 ? "h-4 w-2/3" : "h-4 w-full"} />
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-canvas text-center",
        compact ? "px-6 py-8" : "px-6 py-14",
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-canvas-alt text-ink-muted">
        {icon ?? (
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
            <path
              d="M3 5.5h14M3 10h14M3 14.5h9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  context,
}: {
  error: ApiError;
  onRetry?: () => void;
  context?: string;
}) {
  const offline = error.isOffline;
  const notFound = error.isNotFound;

  const title = offline
    ? "The intelligence API is unreachable"
    : notFound
      ? `${context ?? "That record"} was not found`
      : "This view could not be loaded";

  const description = offline
    ? "Nothing was retrieved, so nothing on this screen would be accurate. Check that the backend is running and reachable, then retry."
    : notFound
      ? "It may belong to a run that was never persisted, or the identifier may be wrong."
      : (error.detail ?? error.message);

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
          <path
            d="M10 6.5v4.2M10 13.8h.01M8.6 3.2 2.3 14.1A1.6 1.6 0 0 0 3.7 16.5h12.6a1.6 1.6 0 0 0 1.4-2.4L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-rose-900">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-rose-800/80">
        {description}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-50"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
