/**
 * Start a task.
 *
 * One page, four visible sections: the work, the team, the settings, the
 * instruction. No wizard -- there is one template and mostly fixed settings,
 * so stepping through screens would add ceremony without adding a choice.
 *
 * Every control here maps to something `POST /runs` genuinely accepts. The
 * frozen values are shown as fixed rather than as inputs the API would reject,
 * and the one truly editable field says plainly that it is recorded with the
 * task rather than steering the work.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, useResource, ApiError } from "../lib/api";
import { TEAM } from "../product/team";
import { DEFAULT_TEMPLATE, buildTaskInstruction } from "../product/tasks";
import { capabilityLabel } from "../product/labels";
import { canLaunchTasks } from "../product/mode";
import { MemberGlyph } from "../components/MemberGlyph";
import { fill, useI18n } from "../i18n";
import { Chip } from "../components/ui/StatusBadge";
import { Card, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import { ErrorState, SkeletonPanel } from "../components/ui/states";

export function NewTaskPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const catalog = useResource((signal) => api.catalog(signal), []);
  const execution = catalog.data?.execution ?? null;

  // `null` means "the user has not touched this yet", so the published
  // defaults show through without an effect syncing two sources of truth.
  const [selected, setSelected] = useState<string[] | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<ApiError | null>(null);

  const capabilities = selected ?? catalog.data?.default_provider_capabilities ?? [];

  /**
   * `provider_capabilities` is free text on the API, and the published
   * defaults are not spelled identically to the service catalog -- "AI Voice
   * Reception" against "AI Voice Reception / Telephone Agent", for instance.
   * Offering only the catalog would silently drop two of the defaults, so the
   * options are the union, defaults first, matched on the exact string that
   * will be sent.
   */
  const options = useMemo(() => {
    if (!catalog.data) return [] as { value: string; label: string }[];
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    for (const value of catalog.data.default_provider_capabilities) {
      if (seen.has(value)) continue;
      seen.add(value);
      list.push({ value, label: value });
    }
    for (const capability of catalog.data.capabilities) {
      if (seen.has(capability.label)) continue;
      seen.add(capability.label);
      list.push({
        value: capability.label,
        label: capabilityLabel(t, capability.capability_id, capability.label) ?? capability.label,
      });
    }
    return list;
  }, [catalog.data, t]);
  const instruction = useMemo(
    () => (execution ? buildTaskInstruction(t, execution) : null),
    [execution, t],
  );

  const launch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const created = await api.createTask({ provider_capabilities: capabilities });
      navigate(`/tasks/${encodeURIComponent(created.run_id)}`);
    } catch (error) {
      setLaunchError(
        error instanceof ApiError
          ? error
          : new ApiError(0, "Could not start the task.", null),
      );
      setLaunching(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={t.newTask.eyebrow}
        title={t.newTask.title}
        subtitle={t.newTask.subtitle}
      />

      {catalog.error && !catalog.data ? (
        <ErrorState
          error={catalog.error}
          onRetry={catalog.reload}
          context={t.catalog.error}
        />
      ) : catalog.loading || !catalog.data || !execution ? (
        <div className="space-y-6">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={6} />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <SectionHeading
                eyebrow={t.newTask.steps.choose}
                title={t.taskTemplates[DEFAULT_TEMPLATE.id].name}
                description={t.taskTemplates[DEFAULT_TEMPLATE.id].description}
              />
              <p className="rounded-lg border border-hairline bg-canvas px-3.5 py-3 text-xs leading-relaxed text-ink-muted">
                <span className="font-medium text-ink-soft">{t.newTask.onlyTemplate}</span>{" "}
                {t.newTask.onlyTemplateHelp}
              </p>
            </Card>

            <Card>
              <SectionHeading
                eyebrow={t.newTask.steps.team}
                title={t.team.title}
                description={t.team.requiredHelp}
              />
              <ul className="grid gap-3 sm:grid-cols-2">
                {TEAM.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        member.kind === "engine"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-surface text-brand-600",
                      )}
                    >
                      <MemberGlyph kind={member.kind} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-ink">
                          {t.team.members[member.id].name}
                        </p>
                        <CheckMark />
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                        {t.team.members[member.id].role}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[0.6875rem] tracking-[0.06em] text-ink-muted uppercase">
                          {t.team.kind[member.kind]}
                        </span>
                        <span aria-hidden="true" className="text-ink-muted">
                          ·
                        </span>
                        <span className="text-[0.6875rem] text-ink-muted">
                          {fill(t.team.step, { step: member.step })}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {/* Presented as required members rather than toggles that would
                  pretend the back end can skip a stage. */}
              <p className="mt-3 text-xs text-ink-muted">{t.team.required}</p>
            </Card>

            <Card>
              <SectionHeading
                eyebrow={t.newTask.steps.configure}
                title={t.newTask.config.title}
                description={t.newTask.config.subtitle}
              />

              <dl className="grid gap-4 sm:grid-cols-3">
                <LockedField
                  label={t.newTask.config.market}
                  value={execution.vertical}
                  locked={execution.vertical_locked}
                  help={t.newTask.config.lockedHelp}
                  lockedLabel={t.newTask.config.locked}
                />
                <LockedField
                  label={t.newTask.config.area}
                  value={execution.geography}
                  locked={execution.geography_locked}
                  help={t.newTask.config.lockedHelp}
                  lockedLabel={t.newTask.config.locked}
                />
                <LockedField
                  label={t.newTask.config.businesses}
                  value={String(execution.target_business_count)}
                  locked={execution.target_business_count_locked}
                  help={fill(t.newTask.config.businessesLockedHelp, {
                    count: execution.target_business_count,
                  })}
                  lockedLabel={t.newTask.config.locked}
                />
              </dl>

              <div className="mt-5 border-t border-hairline pt-4">
                <p className="text-sm font-medium text-ink">
                  {t.newTask.config.capabilities}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {t.newTask.config.capabilitiesHelp}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {options.map((option) => {
                    const on = capabilities.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={on}
                        disabled={!execution.provider_capabilities_editable}
                        onClick={() =>
                          setSelected(
                            on
                              ? capabilities.filter((value) => value !== option.value)
                              : capabilities.length >= execution.provider_capabilities_max
                                ? capabilities
                                : [...capabilities, option.value],
                          )
                        }
                        className={cx(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          on
                            ? "border-brand-300 bg-brand-50 text-brand-700"
                            : "border-hairline bg-surface text-ink-soft hover:border-slate-300 hover:text-ink",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {capabilities.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    {t.newTask.config.capabilitiesEmpty}
                  </p>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <SectionHeading
                eyebrow={t.newTask.steps.review}
                title={t.newTask.instruction.title}
                description={t.newTask.instruction.subtitle}
              />
              <blockquote className="border-l-2 border-brand-300 pl-4 text-sm leading-relaxed text-ink">
                {instruction}
              </blockquote>

              <div className="mt-5 border-t border-hairline pt-4">
                {canLaunchTasks ? (
                  <>
                    <button
                      type="button"
                      onClick={launch}
                      disabled={launching || capabilities.length === 0}
                      className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {launching ? t.newTask.launching : t.newTask.launch}
                    </button>
                    <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                      {t.newTask.costNote}
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">
                    <p className="text-sm font-medium text-ink">{t.newTask.disabled}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {t.newTask.disabledHelp}
                    </p>
                  </div>
                )}
              </div>

              {launchError ? (
                <div className="mt-4">
                  <ErrorState error={launchError} context={t.newTask.error} />
                </div>
              ) : null}
            </Card>

            <Card>
              <SectionHeading title={t.newTask.steps.team} />
              <ul className="space-y-2">
                {TEAM.map((member) => (
                  <li key={member.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">{t.team.members[member.id].name}</span>
                    <span className="shrink-0 text-[0.6875rem] tracking-[0.06em] text-ink-muted uppercase">
                      {t.team.kind[member.kind]}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function LockedField({
  label,
  value,
  locked,
  help,
  lockedLabel,
}: {
  label: string;
  value: string;
  locked: boolean;
  help: string;
  lockedLabel: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-3.5">
      <dt className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {locked ? (
          <Chip title={help} className="gap-1">
            <LockGlyph />
            {lockedLabel}
          </Chip>
        ) : null}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0 text-green-600">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
      <path
        d="m4.6 8.2 2.2 2.2 4.6-4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
      <path
        d="M3.4 5.4V4a2.6 2.6 0 0 1 5.2 0v1.4M2.8 5.4h6.4v4.2H2.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
