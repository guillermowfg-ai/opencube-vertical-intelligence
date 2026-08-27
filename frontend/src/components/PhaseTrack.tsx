/**
 * How far an analysis got: Find -> Research -> Check -> Match.
 *
 * Circular nodes joined by a line, following the approved reference. It renders
 * the phase the back end reports and never infers one from the numbers,
 * because an analysis that ended with errors still produced real output and
 * must not be drawn as if it stopped early.
 */

import { RUN_PHASES, runPhaseStates, type PhaseState, type RunPhase } from "../lib/domain";
import { useI18n } from "../i18n";
import { useStatus } from "../lib/useStatus";
import type { RunStatus } from "../lib/types";
import { cx } from "../lib/cx";

const NODE: Record<PhaseState, string> = {
  done: "border-green-600 bg-green-600 text-white",
  active: "border-brand-500 bg-brand-50 text-brand-600",
  pending: "border-hairline bg-surface text-ink-muted",
  failed: "border-rose-600 bg-rose-600 text-white",
};

const LINE: Record<PhaseState, string> = {
  done: "bg-green-600",
  active: "bg-brand-400",
  pending: "bg-hairline",
  failed: "bg-rose-600",
};

export function PhaseTrack({
  status,
  detail,
}: {
  status: RunStatus;
  detail: Partial<Record<RunPhase, string>>;
}) {
  const { t } = useI18n();
  const statusText = useStatus();
  const states = runPhaseStates(status);

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
      {RUN_PHASES.map((phase, index) => {
        const state = states[phase];
        const isLast = index === RUN_PHASES.length - 1;
        const label =
          phase === "COMPLETED" && status === "FAILED"
            ? statusText.run("FAILED").label
            : t.runDetail.lifecycle.phases[phase];

        return (
          <li key={phase} className="flex flex-1 gap-3 sm:block">
            <div className="flex flex-col items-center sm:flex-row">
              <span
                className={cx(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  NODE[state],
                )}
              >
                <PhaseIcon phase={phase} state={state} />
              </span>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cx(
                    "w-px flex-1 sm:mx-2 sm:h-0.5 sm:w-auto sm:flex-1 sm:rounded-full",
                    LINE[state],
                  )}
                />
              ) : null}
            </div>
            <div className="pb-6 sm:pt-3 sm:pr-6 sm:pb-0">
              <p
                className={cx(
                  "text-sm font-medium",
                  state === "pending" ? "text-ink-muted" : "text-ink",
                )}
              >
                {label}
              </p>
              {detail[phase] ? (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{detail[phase]}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PhaseIcon({ phase, state }: { phase: RunPhase; state: PhaseState }) {
  if (state === "done") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
        <path
          d="m3.5 8.3 3 3 6-6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "failed") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
        <path
          d="M8 4.4v4M8 11.2h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const paths: Record<RunPhase, string> = {
    QUEUED: "M8 4.6v3.6l2.4 1.4",
    DISCOVERING: "M7.2 3.6a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2ZM10 10l2.6 2.6",
    INVESTIGATING: "M4.4 3.6h7.2v8.8H4.4zM6.4 6.2h3.2M6.4 8.6h3.2",
    FINALIZING: "M8 3.4 12.2 5v3.2c0 2.2-1.7 3.8-4.2 4.4-2.5-.6-4.2-2.2-4.2-4.4V5Z",
    COMPLETED: "M8 3.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm0 2.6v3.2",
  };

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
      <path
        d={paths[phase]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
