/**
 * The team page.
 *
 * Shows the four real members and nothing else. No placeholder agents, no
 * "coming soon" cards standing in for capabilities that do not exist.
 */

import { Link } from "react-router-dom";
import { TEAM, type TeamMember } from "../product/team";
import { DEFAULT_TEMPLATE } from "../product/tasks";
import { useI18n, fill } from "../i18n";
import { MemberGlyph } from "../components/MemberGlyph";
import { Chip } from "../components/ui/StatusBadge";
import { Card, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";

export function TeamPage() {
  const { t } = useI18n();
  const copy = t.team.page;

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />

      <Card className="mb-6">
        <SectionHeading title={copy.workflowTitle} description={copy.workflowSubtitle} />
        <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
          {TEAM.map((member, index) => (
            <li key={member.id} className="flex flex-1 gap-3 sm:block">
              <div className="flex flex-col items-center sm:flex-row">
                <span className="numerals flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 text-xs font-semibold text-brand-700">
                  {member.step}
                </span>
                {index < TEAM.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="w-px flex-1 bg-hairline sm:mx-2 sm:h-0.5 sm:w-auto sm:flex-1 sm:rounded-full"
                  />
                ) : null}
              </div>
              <div className="pb-6 sm:pt-3 sm:pr-6 sm:pb-0">
                <p className="text-sm font-medium text-ink">{t.team.members[member.id].name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {t.team.members[member.id].role}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {TEAM.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      <Card className="mt-6">
        <SectionHeading title={copy.futureTitle} description={copy.futureBody} />
      </Card>
    </>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const { t } = useI18n();
  const info = t.team.members[member.id];
  const engine = member.kind === "engine";

  return (
    <Card className="h-full">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            engine ? "bg-slate-100 text-slate-600" : "bg-brand-50 text-brand-600",
          )}
        >
          <MemberGlyph kind={member.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-ink">{info.name}</h3>
            <Chip title={t.team.kindHelp[member.kind]}>{t.team.kind[member.kind]}</Chip>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{info.role}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">{info.detail}</p>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        {t.team.kindHelp[member.kind]}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 text-sm">
        <div>
          <dt className="eyebrow">{fill(t.team.step, { step: member.step })}</dt>
          <dd className="mt-1 text-ink">{t.team.members[member.id].name}</dd>
        </div>
        <div>
          <dt className="eyebrow">{t.team.usedBy}</dt>
          <dd className="mt-1">
            <Link
              to="/tasks/new"
              className="text-brand-600 transition hover:text-brand-700"
            >
              {t.taskTemplates[DEFAULT_TEMPLATE.id].name}
            </Link>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
