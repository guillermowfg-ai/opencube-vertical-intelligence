/**
 * What the team is doing, right now.
 *
 * Every state here is derived from persisted progress -- Run.status,
 * businesses_total, and the counts of investigations, verifications and
 * matches. Nothing is invented.
 *
 * One honest limitation is stated on screen rather than papered over: the back
 * end runs verification and matching inside a single FINALIZING phase, so
 * there is no persisted moment at which the Verification Agent is finished and
 * the Opportunity Matcher has not started. Rather than fake a hand-off, both
 * are shown as working together and finishing together.
 */

import { isRunLive } from "../lib/domain";
import { TEAM, type TeamMember } from "../product/team";
import { memberState, type MemberState } from "../product/activity";
import { fill, useI18n } from "../i18n";
import type { RunStatusResponse } from "../lib/types";
import { cx } from "../lib/cx";

export function TaskActivity({ run }: { run: RunStatusResponse }) {
  const { t } = useI18n();
  const copy = t.taskActivity;
  const live = isRunLive(run.status);

  return (
    <section className={cx("card p-5 sm:p-6", live && "border-brand-200 bg-brand-50/30")}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            {run.status === "FAILED"
              ? copy.titleFailed
              : live
                ? copy.title
                : copy.titleDone}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {live ? copy.subtitle : copy.subtitleDone}
          </p>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface px-3 py-1.5 text-xs font-medium text-brand-700">
            <span aria-hidden="true" className="live-dot size-1.5 rounded-full bg-brand-500" />
            {copy.working}
          </span>
        ) : null}
      </div>

      <ol className="space-y-2.5">
        {TEAM.map((member) => (
          <MemberRow key={member.id} member={member} run={run} />
        ))}
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        {copy.memberDetail.combinedNote}
      </p>
    </section>
  );
}

const STATE_STYLES: Record<MemberState, { dot: string; label: string }> = {
  waiting: { dot: "bg-slate-300", label: "text-ink-muted" },
  working: { dot: "bg-brand-500 live-dot", label: "text-brand-700" },
  done: { dot: "bg-green-600", label: "text-green-700" },
  problem: { dot: "bg-rose-600", label: "text-rose-700" },
};

function MemberRow({ member, run }: { member: TeamMember; run: RunStatusResponse }) {
  const { t } = useI18n();
  const state = memberState(member, run);
  const styles = STATE_STYLES[state];
  const copy = t.taskActivity;

  const stateLabel =
    state === "waiting"
      ? copy.waiting
      : state === "working"
        ? copy.working
        : state === "done"
          ? copy.done
          : copy.problem;

  return (
    <li
      className={cx(
        "flex items-center gap-3 rounded-xl border bg-surface px-4 py-3",
        state === "working" ? "border-brand-200" : "border-hairline",
      )}
    >
      <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", styles.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {t.team.members[member.id].name}
        </p>
        <p className="truncate text-xs text-ink-muted">{detailFor(member, run, t)}</p>
      </div>
      <span className={cx("shrink-0 text-xs font-medium", styles.label)}>{stateLabel}</span>
    </li>
  );
}

function detailFor(
  member: TeamMember,
  run: RunStatusResponse,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const copy = t.taskActivity.memberDetail;
  const state = memberState(member, run);
  const settled = run.investigations_completed + run.investigations_failed;
  const total = run.businesses_total ?? run.investigations_total;

  switch (member.id) {
    case "market_scout":
      if (state === "done") {
        return run.discovery_raw_candidate_count
          ? fill(copy.scoutDone, { count: run.discovery_raw_candidate_count })
          : copy.scoutDoneNoCount;
      }
      return copy.scoutWorking;
    case "business_investigator":
      if (state === "done") return fill(copy.investigatorDone, { count: settled });
      if (state === "waiting") return "—";
      return fill(copy.investigatorWorking, { done: settled, total });
    case "verification_agent":
      if (state === "done") {
        return fill(copy.verifierDone, { count: run.verifications_completed });
      }
      if (state === "waiting") return "—";
      return copy.verifierWorking;
    case "opportunity_matcher":
      if (state === "done") return fill(copy.matcherDone, { count: run.matches_total });
      if (state === "waiting") return "—";
      return copy.matcherWorking;
    default:
      return "—";
  }
}
