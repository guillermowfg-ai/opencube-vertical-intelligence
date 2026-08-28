/**
 * Opportunity detail -- the page that has to be trustworthy.
 *
 * Laid out as the chain that produced the answer: what we concluded, what we
 * actually saw, what someone outside the business said, and why that adds up
 * to the outcome. The interface never restates the decision logic in its own
 * words -- it shows the reason code and the back end's own sentence, because a
 * second wording of a fixed rule is a second rule.
 */

import { Link, useParams } from "react-router-dom";
import { api, useResource } from "../lib/api";
import { verificationStateOf } from "../lib/domain";
import { useStatus } from "../lib/useStatus";
import { fill, useI18n } from "../i18n";
import { capabilityLabel, opportunityLabel } from "../product/labels";
import { formatConfidence, formatDateTime, hostnameOf } from "../lib/format";
import type { EvidenceItem, MatchDetail } from "../lib/types";
import { Badge, Chip, StatusBadge } from "../components/ui/StatusBadge";
import { ActionVerdict, ChainStep } from "../components/DecisionChain";
import {
  Card,
  ExternalLink,
  KeyValue,
  MetaItem,
  Mono,
  PageHeader,
  SectionHeading,
} from "../components/ui/primitives";
import { EmptyState, ErrorState, SkeletonPanel } from "../components/ui/states";
import type { Dictionary } from "../i18n";

/** Looks up the plain-language reading of a reason code. Returns undefined for
 * a code this build has no wording for, so the stored sentence is shown
 * instead of nothing. */
function plainReason(t: Dictionary, code: string): string | undefined {
  return (t.reasons as Record<string, string | undefined>)[code];
}

export function MatchDetailPage() {
  const { matchId = "" } = useParams();
  const { t, locale } = useI18n();
  const status = useStatus();
  const { data, error, loading, reload } = useResource(
    (signal) => api.match(matchId, signal),
    [matchId],
  );

  if (error && !data) {
    return (
      <>
        <PageHeader eyebrow={t.matchDetail.eyebrow} title={t.common.opportunity} />
        <ErrorState error={error} onRetry={reload} context={t.matchDetail.error} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <PageHeader eyebrow={t.matchDetail.eyebrow} title={t.common.opportunity} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <SkeletonPanel lines={3} />
            <SkeletonPanel lines={6} />
          </div>
          <SkeletonPanel lines={8} />
        </div>
      </>
    );
  }

  const { match, business, opportunity, hypothesis, verification } = data;
  const secondOpinionState = verificationStateOf(match);

  return (
    <>
      <PageHeader
        eyebrow={t.matchDetail.eyebrow}
        title={opportunityLabel(t, match.opportunity_id, opportunity?.name)}
        subtitle={
          business ? (
            <>
              {t.matchDetail.at}{" "}
              <span className="font-medium text-ink">{business.display_name}</span>
              {business.formatted_address ? ` · ${business.formatted_address}` : null}
            </>
          ) : undefined
        }
        actions={<StatusBadge meta={status.fit(match.match_status)} />}
        meta={
          <>
            <MetaItem label={t.matchDetail.meta.run}>
              {data.run ? (
                <Link
                  to={`/runs/${encodeURIComponent(data.run.run_id)}`}
                  className="font-mono text-brand-600 transition hover:text-brand-700"
                >
                  {data.run.run_id}
                </Link>
              ) : (
                "—"
              )}
            </MetaItem>
            <MetaItem label={t.matchDetail.meta.decided}>
              {formatDateTime(locale, match.created_at)}
            </MetaItem>
            <MetaItem label={t.matchDetail.meta.id}>
              <Mono>{match.match_id}</Mono>
            </MetaItem>
          </>
        }
      />

      {/* The conclusion leads: someone scanning this page must be able to see
          what to do about this reason before reading any of the evidence. */}
      <div className="mb-6">
        <ActionVerdict status={match.match_status} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <SectionHeading title={t.chain.title} description={t.chain.subtitle} />
          <ol className="mt-2">
            <ChainStep
              index={1}
              label={t.chain.observation}
              help={t.chain.observationHelp}
            >
              <p className="eyebrow">{t.chain.firstParty}</p>
              <p className="mb-3 text-xs text-ink-muted">{t.chain.firstPartyHelp}</p>
              <EvidenceList
                items={data.hypothesis_evidence}
                emptyTitle={t.matchDetail.step2.empty}
                emptyDescription={
                  data.verification_evidence.length > 0
                    ? t.chain.noFirstPartyWithOutside
                    : t.chain.noFirstParty
                }
              />
            </ChainStep>

            <ChainStep
              index={2}
              label={t.chain.problem}
              help={t.chain.problemHelp}
              action={<StatusBadge meta={status.finding(match.original_status)} />}
            >
              {hypothesis ? (
                <>
                  <blockquote className="border-l-2 border-brand-300 pl-4 text-[0.9375rem] leading-relaxed text-ink">
                    {hypothesis.statement}
                  </blockquote>
                  <dl className="mt-3 grid grid-cols-3 gap-4">
                    <KeyValue label={t.matchDetail.step1.confidence}>
                      <span className="numerals">{formatConfidence(hypothesis.confidence)}</span>
                    </KeyValue>
                    <KeyValue label={t.matchDetail.step1.supporting}>
                      <span className="numerals">
                        {hypothesis.supporting_evidence_ids.length}
                      </span>
                    </KeyValue>
                    <KeyValue label={t.matchDetail.step1.contradicting}>
                      <span className="numerals">
                        {hypothesis.contradicting_evidence_ids.length}
                      </span>
                    </KeyValue>
                  </dl>
                </>
              ) : (
                <EmptyState
                  compact
                  title={t.matchDetail.step1.empty}
                  description={t.matchDetail.step1.emptyHelp}
                />
              )}
            </ChainStep>

            <ChainStep
              index={3}
              label={t.chain.check}
              help={t.chain.checkHelp}
              action={<StatusBadge meta={status.secondOpinion(secondOpinionState)} />}
            >
              <p className="eyebrow">{t.chain.outside}</p>
              <p className="mb-3 text-xs text-ink-muted">{t.chain.outsideHelp}</p>
              {verification ? (
                <VerificationPanel
                  verification={verification}
                  evidence={data.verification_evidence}
                />
              ) : (
                <EmptyState
                  compact
                  title={t.matchDetail.step3.empty}
                  description={t.matchDetail.step3.emptyHelp}
                />
              )}
            </ChainStep>

            <ChainStep
              index={4}
              label={t.chain.decision}
              action={<StatusBadge meta={status.fit(match.match_status)} />}
              last
            >
              <div className="rounded-xl bg-canvas p-4">
                <p className="text-sm leading-relaxed text-ink">
                  {plainReason(t, match.reason_code) ?? match.reasoning}
                </p>
                {/* The stored sentence is kept verbatim and never edited. The
                    plain reading above is a translation of the same fixed cell
                    -- and the only way a Spanish screen can explain the
                    decision, since the stored wording is English-only. */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-ink-muted transition hover:text-ink-soft">
                    {t.matchDetail.step4.exactWording}
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    {match.reasoning}
                  </p>
                  <Mono className="mt-2 inline-block">{match.reason_code}</Mono>
                </details>
              </div>
            </ChainStep>
          </ol>
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionHeading
              title={t.matchDetail.capability.title}
              description={t.matchDetail.capability.description}
            />
            {data.primary_capability ? (
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
                >
                  <CubeGlyph />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {capabilityLabel(
                      t,
                      data.primary_capability.capability_id,
                      data.primary_capability.label,
                    )}
                  </p>
                  <Mono className="mt-1 inline-block">
                    {data.primary_capability.capability_id}
                  </Mono>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{t.matchDetail.capability.empty}</p>
            )}
            {data.supporting_capabilities.length > 0 ? (
              <div className="mt-4 border-t border-hairline pt-4">
                <p className="eyebrow mb-2">{t.matchDetail.capability.supporting}</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.supporting_capabilities.map((capability) => (
                    <Chip key={capability.capability_id}>
                      {capabilityLabel(t, capability.capability_id, capability.label)}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {business ? (
            <Card>
              <SectionHeading title={t.matchDetail.business.title} />
              <dl className="divide-y divide-hairline">
                <KeyValue label={t.matchDetail.business.name}>{business.display_name}</KeyValue>
                {business.formatted_address ? (
                  <KeyValue label={t.matchDetail.business.address}>
                    {business.formatted_address}
                  </KeyValue>
                ) : null}
                <KeyValue label={t.matchDetail.business.website}>
                  {business.website_url ? (
                    <ExternalLink href={business.website_url}>
                      {hostnameOf(business.website_url)}
                    </ExternalLink>
                  ) : (
                    <span className="text-ink-muted" title={t.common.noWebsiteHelp}>
                      {t.common.noWebsite}
                    </span>
                  )}
                </KeyValue>
                {business.phone_number ? (
                  <KeyValue label={t.matchDetail.business.phone}>
                    {business.phone_number}
                  </KeyValue>
                ) : null}
                {business.maps_url ? (
                  <KeyValue label={t.matchDetail.business.maps}>
                    <ExternalLink href={business.maps_url}>{t.common.openListing}</ExternalLink>
                  </KeyValue>
                ) : null}
              </dl>
            </Card>
          ) : null}

          {opportunity ? (
            <Card>
              <SectionHeading
                title={t.matchDetail.definition.title}
                description={t.matchDetail.definition.description}
              />
              <p className="text-sm leading-relaxed text-ink-soft">{opportunity.description}</p>
              <div className="mt-4 space-y-4 border-t border-hairline pt-4">
                <SignalList
                  title={t.matchDetail.definition.evidenceSignals}
                  items={opportunity.evidence_signals}
                />
                <SignalList
                  title={t.matchDetail.definition.contradictionSignals}
                  items={opportunity.contradiction_signals}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hairline pt-4">
                <Chip>
                  {opportunity.publicly_observable
                    ? t.matchDetail.definition.publiclyObservable
                    : t.matchDetail.definition.notPubliclyObservable}
                </Chip>
                {opportunity.requires_independent_verification ? (
                  <Chip>{t.matchDetail.definition.requiresVerification}</Chip>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function EvidenceList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: EvidenceItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { t, locale } = useI18n();
  const status = useStatus();

  if (items.length === 0) {
    return <EmptyState compact title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const role = status.evidenceRole(item.role);
        return (
          <li key={item.evidence_id} className="rounded-xl border border-hairline bg-canvas p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Badge tone={role.tone} title={role.meaning} dot>
                {role.label}
              </Badge>
              <Chip title={`${t.common.sourceType}: ${item.source_type}`}>
                {item.source_type}
              </Chip>
              <span className="ml-auto text-xs text-ink-muted">
                {formatDateTime(locale, item.retrieved_at)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink">{item.observation}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-3 text-xs">
              <ExternalLink href={item.source_url}>{hostnameOf(item.source_url)}</ExternalLink>
              <span className="text-ink-muted">
                {t.common.collectedBy} <span className="font-medium">{item.collected_by}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function VerificationPanel({
  verification,
  evidence,
}: {
  verification: NonNullable<MatchDetail["verification"]>;
  evidence: EvidenceItem[];
}) {
  const { t } = useI18n();
  const copy = t.matchDetail.step3;

  return (
    <>
      <div className="rounded-xl bg-canvas p-4">
        <p className="eyebrow">{copy.question}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">
          {verification.verification_target}
        </p>
      </div>

      {verification.reasoning ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">{verification.reasoning}</p>
      ) : null}

      {verification.failure_reason ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50/60 px-3.5 py-3 text-sm leading-relaxed text-rose-900">
          {verification.failure_reason}
        </p>
      ) : null}

      {verification.no_independent_source_found ? (
        <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 px-3.5 py-3 text-sm leading-relaxed text-violet-900">
          {copy.noSource}
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
        <KeyValue label={copy.sources}>
          <span className="numerals">{verification.independent_sources_fetched}</span>
        </KeyValue>
        <KeyValue label={copy.candidates}>
          <span className="numerals">{verification.candidate_source_urls.length}</span>
        </KeyValue>
        <KeyValue label={copy.rejected}>
          <span className="numerals">{verification.rejected_sources.length}</span>
        </KeyValue>
        <KeyValue label={copy.confidence}>
          <span className="numerals">{formatConfidence(verification.confidence)}</span>
        </KeyValue>
      </dl>

      {evidence.length > 0 ? (
        <div className="mt-5 border-t border-hairline pt-5">
          <p className="eyebrow mb-3">{copy.independentEvidence}</p>
          <EvidenceList
            items={evidence}
            emptyTitle={copy.empty}
            emptyDescription={copy.emptyHelp}
          />
        </div>
      ) : null}

      {verification.executed_search_queries.length > 0 ? (
        <div className="mt-5 border-t border-hairline pt-5">
          <p className="eyebrow mb-2">{copy.queries}</p>
          <ul className="flex flex-wrap gap-1.5">
            {verification.executed_search_queries.map((query) => (
              <li key={query}>
                <Mono>{query}</Mono>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {verification.rejected_sources.length > 0 ? (
        <details className="mt-5 border-t border-hairline pt-5">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft transition hover:text-ink">
            {fill(copy.rejectedTitle, { count: verification.rejected_sources.length })}
          </summary>
          <ul className="mt-3 space-y-2">
            {verification.rejected_sources.map((source) => (
              <li
                key={source.url}
                className="rounded-lg border border-hairline bg-canvas px-3.5 py-2.5 text-xs"
              >
                <p className="truncate font-medium text-ink-soft">{source.url}</p>
                <p className="mt-0.5 text-ink-muted">{source.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-muted"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        d="M12 3.4 20 7.7v8.6L12 20.6 4 16.3V7.7zM4 7.7l8 4.3 8-4.3M12 12v8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
