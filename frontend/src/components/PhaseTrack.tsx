/**
 * The run spine: Discovery → Investigation → Verification & matching.
 *
 * It renders the phase the backend's RunStatus already reports. It never
 * infers a phase from counts, because a run that failed still produced real
 * output and must not be drawn as if it stopped early.
 */

import { PHASE_LABELS, RUN_STATUS, runPhaseStates, type PhaseState } from "../lib/domain";
import type { RunStatus } from "../lib/types";
import { cx } from "../lib/cx";

const PHASE_ORDER = ["QUEUED", "DISCOVERING", "INVESTIGATING", "FINALIZING", "COMPLETED"];

const DOT: Record<PhaseState, string> = {
  done: "bg-teal-600 text-white",
  active: "bg-blue-700 text-white",
  pending: "bg-canvas-alt text-ink-muted ring-1 ring-inset ring-hairline",
  failed: "bg-rose-700 text-white",
};

const LINE: Record<PhaseState, string> = {
  done: "bg-teal-600",
  active: "bg-blue-700",
  pending: "bg-hairline",
  failed: "bg-rose-700",
};

export function PhaseTrack({
  status,
  detail,
}: {
  status: RunStatus;
  detail: Partial<Record<string, string>>;
}) {
  const states = runPhaseStates(status);

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
      {PHASE_ORDER.map((phase, index) => {
        const state = states[phase] ?? "pending";
        const isLast = index === PHASE_ORDER.length - 1;
        const label =
          phase === "COMPLETED" && status === "FAILED"
            ? RUN_STATUS.FAILED.label
            : PHASE_LABELS[phase];

        return (
          <li key={phase} className="flex flex-1 gap-3 sm:block">
            <div className="flex flex-col items-center sm:flex-row">
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold transition-colors",
                  DOT[state],
                )}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
                    <path
                      d="m2.5 6.2 2.3 2.3 4.7-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : state === "failed" ? (
                  "!"
                ) : (
                  index + 1
                )}
              </span>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cx(
                    "w-px flex-1 sm:mx-3 sm:h-px sm:w-auto sm:flex-1",
                    LINE[states[PHASE_ORDER[index + 1]] === "pending" ? state : state],
                  )}
                />
              ) : null}
            </div>
            <div className="pb-6 sm:pt-3 sm:pb-0 sm:pr-6">
              <p
                className={cx(
                  "text-sm font-medium",
                  state === "pending" ? "text-ink-muted" : "text-ink",
                )}
              >
                {label}
              </p>
              {detail[phase] ? (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {detail[phase]}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
