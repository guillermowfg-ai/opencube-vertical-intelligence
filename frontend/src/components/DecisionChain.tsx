/**
 * The decision chain, top to bottom, readable without narration:
 *
 *   what we saw -> what it might mean -> what the evidence said ->
 *   what we concluded -> what happens next
 *
 * The last step is the one that matters commercially, and it is deliberately
 * phrased as an instruction about *this reason*, never as a verdict on the
 * business, and never as permission to contact anyone.
 */

import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { useStatus } from "../lib/useStatus";
import type { MatchStatus } from "../lib/types";
import { cx } from "../lib/cx";

export function ChainStep({
  index,
  label,
  help,
  action,
  children,
  last = false,
}: {
  index: number;
  label: string;
  help?: string;
  action?: ReactNode;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last ? (
        <span
          aria-hidden="true"
          className="absolute top-9 bottom-0 left-[15px] w-px bg-hairline"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="numerals relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-xs font-semibold text-ink-muted"
      >
        {index}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-ink">{label}</h3>
            {help ? <p className="mt-0.5 text-xs text-ink-muted">{help}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </div>
    </li>
  );
}

/**
 * The conclusion, stated as what to do about this one reason.
 *
 * `MATCHED` never reads as authorisation: the human-approval sentence is part
 * of the component, not an optional caption a future edit could drop.
 */
export function ActionVerdict({ status }: { status: MatchStatus }) {
  const { t } = useI18n();
  const statusText = useStatus();
  const copy = t.action[status];
  const meta = statusText.fit(status);

  const tone =
    status === "MATCHED"
      ? "border-green-200 bg-green-50/70 text-green-900"
      : status === "UNRESOLVED"
        ? "border-amber-200 bg-amber-50/70 text-amber-900"
        : "border-violet-200 bg-violet-50/70 text-violet-900";

  return (
    <div className={cx("rounded-xl border px-4 py-3.5", tone)}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          {status === "MATCHED" ? <IconCheck /> : status === "UNRESOLVED" ? <IconPause /> : <IconStop />}
        </span>
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold">{copy.label}</p>
          <p className="mt-1 text-sm leading-relaxed opacity-85">{copy.detail}</p>
          <p className="mt-2 text-xs leading-relaxed opacity-70">{meta.meaning}</p>
        </div>
      </div>
    </div>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
      <circle cx="10" cy="10" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.6 6.6l6.8 6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
      <circle cx="10" cy="10" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.4 7.4v5.2M11.6 7.4v5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
      <circle cx="10" cy="10" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m6.6 10.2 2.4 2.4 4.4-4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
