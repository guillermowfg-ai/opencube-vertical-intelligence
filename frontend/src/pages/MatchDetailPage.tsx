/**
 * Opportunity detail — the page that has to be trustworthy.
 *
 * It is laid out as the decision chain, in order: what was claimed, what was
 * observed, what an independent source said, and what the deterministic
 * reconciliation concluded. The reconciliation is shown as the three inputs
 * that produced it plus the backend's own reason code and sentence — the
 * interface never restates the logic in its own words, because a second
 * wording of a frozen matrix is a second matrix.
 */

import { Link, useParams } from "react-router-dom";
import { api, useResource } from "../lib/api";
import {
  MATCH_STATUS,
  OPPORTUNITY_STATUS,
  VERIFICATION_STATE,
  evidenceRoleMeta,
  opportunityTypeLabel,
  reasonCodeLabel,
  verificationStateOf,
} from "../lib/domain";
import { formatConfidence, formatDateTime, hostnameOf } from "../lib/format";
import type { EvidenceItem, MatchDetail } from "../lib/types";
import { Badge, Chip, StatusBadge } from "../components/ui/StatusBadge";
import { Card, ExternalLink, KeyValue, MetaItem, Mono, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import { EmptyState, ErrorState, SkeletonPanel } from "../components/ui/states";

export function MatchDetailPage() {
  const { matchId = "" } = useParams();
  const { data, error, loading, reload } = useResource(
    (signal) => api.match(matchId, signal),
    [matchId],
  );

  if (error && !data) {
    return (
      <>
        <PageHeader eyebrow="Opportunity" title="Opportunity" />
        <ErrorState error={error} onRetry={reload} context="This opportunity" />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <PageHeader eyebrow="Opportunity" title="Opportunity" />
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
  const verificationState = verificationStateOf(match);

  return (
    <>
      <PageHeader
        eyebrow="Opportunity"
        title={opportunity?.name ?? match.opportunity_id}
        subtitle={
          business ? (
            <>
              at <span className="font-medium text-ink">{business.display_name}</span>
              {business.formatted_address ? ` · ${business.formatted_address}` : null}
            </>
          ) : undefined
        }
        actions={<StatusBadge meta={MATCH_STATUS[match.match_status]} />}
        meta={
          <>
            <MetaItem label="Run">
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
            <MetaItem label="Opportunity type">
              {opportunityTypeLabel(match.opportunity_type)}
            </MetaItem>
            <MetaItem label="Decided">{formatDateTime(match.created_at)}</MetaItem>
            <MetaItem label="Match ID">
              <Mono>{match.match_id}</Mono>
            </MetaItem>
          </>
        }
      />

      <ReconciliationStrip detail={data} />

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <SectionHeading
              eyebrow="Step 1 · Investigator"
              title="The hypothesis"
              description="An interpretation of the evidence below. Always traceable to it, never asserted on its own."
              action={<StatusBadge meta={OPPORTUNITY_STATUS[match.original_status]} />}
            />
            {hypothesis ? (
              <>
                <blockquote className="border-l-2 border-brand-300 pl-4 text-[0.9375rem] leading-relaxed text-ink">
                  {hypothesis.statement}
                </blockquote>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
                  <KeyValue label="Model confidence">
                    <span className="numerals">{formatConfidence(hypothesis.confidence)}</span>
                  </KeyValue>
                  <KeyValue label="Supporting">
                    <span className="numerals">
                      {hypothesis.supporting_evidence_ids.length}
                    </span>
                  </KeyValue>
                  <KeyValue label="Contradicting">
                    <span className="numerals">
                      {hypothesis.contradicting_evidence_ids.length}
                    </span>
                  </KeyValue>
                  <KeyValue label="Hypothesis ID">
                    <Mono>{hypothesis.hypothesis_id}</Mono>
                  </KeyValue>
                </dl>
              </>
            ) : (
              <EmptyState
                compact
                title="The hypothesis record could not be read"
                description="The match still carries the evidence IDs it was built from, shown below."
              />
            )}
          </Card>

          <Card>
            <SectionHeading
              eyebrow="Step 2 · Evidence"
              title="What was observed"
              description="Factual, source-attributed observations from the business's own public surface. Never an interpretation."
            />
            <EvidenceList
              items={data.hypothesis_evidence}
              emptyTitle="No evidence was attached"
              emptyDescription="This hypothesis was recorded without citable observations — which is itself why a status like insufficient evidence exists."
            />
          </Card>

          <Card>
            <SectionHeading
              eyebrow="Step 3 · Verification loop"
              title="What an independent source said"
              description="Read only from sources outside the business's own control. The business's own site can never verify itself."
              action={<StatusBadge meta={VERIFICATION_STATE[verificationState]} />}
            />
            {verification ? (
              <VerificationPanel
                verification={verification}
                evidence={data.verification_evidence}
              />
            ) : (
              <EmptyState
                compact
                title="No verification was attempted"
                description="This hypothesis went to reconciliation on the Investigator's evidence alone, and the match reason code says so."
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeading
              eyebrow="Step 4 · Matcher"
              title="Why this outcome"
              description="Deterministic: the same three inputs always produce this same cell."
            />
            <div className="rounded-xl bg-canvas p-4">
              <p className="eyebrow">Reason code</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {reasonCodeLabel(match.reason_code)}
              </p>
              <Mono className="mt-2 inline-block">{match.reason_code}</Mono>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{match.reasoning}</p>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
              Match status carries commercial eligibility only. Whether to contact this
              business remains a human decision, made outside this system.
            </p>
          </Card>

          <Card>
            <SectionHeading
              title="OpenCube capability"
              description="Taxonomy: which capability corresponds to this opportunity type. Not a finding that this business needs it."
            />
            {data.primary_capability ? (
              <div>
                <p className="text-sm font-medium text-ink">
                  {data.primary_capability.label}
                </p>
                <Mono className="mt-1.5 inline-block">
                  {data.primary_capability.capability_id}
                </Mono>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No capability mapping recorded.</p>
            )}
            {data.supporting_capabilities.length > 0 ? (
              <div className="mt-4 border-t border-hairline pt-4">
                <p className="eyebrow mb-2">Supporting</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.supporting_capabilities.map((capability) => (
                    <Chip key={capability.capability_id}>{capability.label}</Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {business ? (
            <Card>
              <SectionHeading title="Business" />
              <dl className="divide-y divide-hairline">
                <KeyValue label="Name">{business.display_name}</KeyValue>
                {business.formatted_address ? (
                  <KeyValue label="Address">{business.formatted_address}</KeyValue>
                ) : null}
                <KeyValue label="Website">
                  {business.website_url ? (
                    <ExternalLink href={business.website_url}>
                      {hostnameOf(business.website_url)}
                    </ExternalLink>
                  ) : (
                    <span
                      className="text-ink-muted"
                      title="No website was found — itself a publicly observable fact."
                    >
                      None found
                    </span>
                  )}
                </KeyValue>
                {business.phone_number ? (
                  <KeyValue label="Phone">{business.phone_number}</KeyValue>
                ) : null}
                {business.maps_url ? (
                  <KeyValue label="Maps">
                    <ExternalLink href={business.maps_url}>Open listing</ExternalLink>
                  </KeyValue>
                ) : null}
                <KeyValue label="Business ID">
                  <Mono>{business.business_id}</Mono>
                </KeyValue>
              </dl>
            </Card>
          ) : null}

          {opportunity ? (
            <Card>
              <SectionHeading
                title="Catalog definition"
                description="The declarative definition the model was asked to evaluate. It does not invent opportunity categories."
              />
              <p className="text-sm leading-relaxed text-ink-soft">
                {opportunity.description}
              </p>
              <div className="mt-4 space-y-4 border-t border-hairline pt-4">
                <SignalList title="Evidence signals" items={opportunity.evidence_signals} />
                <SignalList
                  title="Contradiction signals"
                  items={opportunity.contradiction_signals}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hairline pt-4">
                <Chip>
                  {opportunity.publicly_observable
                    ? "Publicly observable"
                    : "Not publicly observable"}
                </Chip>
                {opportunity.requires_independent_verification ? (
                  <Chip>Requires independent verification</Chip>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function ReconciliationStrip({ detail }: { detail: MatchDetail }) {
  const { match } = detail;
  const state = verificationStateOf(match);

  const steps = [
    {
      key: "investigator",
      caption: "Investigator concluded",
      meta: OPPORTUNITY_STATUS[match.original_status],
    },
    {
      key: "verification",
      caption: "Independent source",
      meta: VERIFICATION_STATE[state],
    },
    {
      key: "match",
      caption: "Commercial eligibility",
      meta: MATCH_STATUS[match.match_status],
    },
  ];

  return (
    <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-stretch sm:gap-0">
      {steps.map((step, index) => (
        <div
          key={step.key}
          className={cx(
            "flex flex-1 items-center gap-4",
            index > 0 && "sm:border-l sm:border-hairline sm:pl-6",
            index < steps.length - 1 && "sm:pr-6",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{step.caption}</p>
            <div className="mt-2">
              <StatusBadge meta={step.meta} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {step.meta.meaning}
            </p>
          </div>
          {index < steps.length - 1 ? (
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="hidden size-4 shrink-0 text-ink-muted sm:block"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      ))}
    </div>
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
  if (items.length === 0) {
    return <EmptyState compact title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const role = evidenceRoleMeta(item.role);
        return (
          <li key={item.evidence_id} className="rounded-xl border border-hairline bg-canvas p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Badge tone={role.tone} title={role.meaning} dot>
                {role.label}
              </Badge>
              <Chip title={`Source type: ${item.source_type}`}>{item.source_type}</Chip>
              <span className="ml-auto text-xs text-ink-muted">
                {formatDateTime(item.retrieved_at)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink">{item.observation}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-3 text-xs">
              <ExternalLink href={item.source_url}>{hostnameOf(item.source_url)}</ExternalLink>
              <span className="text-ink-muted">
                collected by <span className="font-medium">{item.collected_by}</span>
              </span>
              <Mono className="ml-auto">{item.evidence_id}</Mono>
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
  return (
    <>
      <div className="rounded-xl bg-canvas p-4">
        <p className="eyebrow">Question put to independent sources</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">
          {verification.verification_target}
        </p>
      </div>

      {verification.reasoning ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          {verification.reasoning}
        </p>
      ) : null}

      {verification.failure_reason ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50/60 px-3.5 py-3 text-sm leading-relaxed text-rose-900">
          {verification.failure_reason}
        </p>
      ) : null}

      {verification.no_independent_source_found ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
          No source independent of the business could be found. This is deliberately
          recorded as its own fact, not as inconclusive evidence.
        </p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
        <KeyValue label="Independent sources">
          <span className="numerals">{verification.independent_sources_fetched}</span>
        </KeyValue>
        <KeyValue label="Candidates found">
          <span className="numerals">{verification.candidate_source_urls.length}</span>
        </KeyValue>
        <KeyValue label="Rejected">
          <span className="numerals">{verification.rejected_sources.length}</span>
        </KeyValue>
        <KeyValue label="Confidence">
          <span className="numerals">{formatConfidence(verification.confidence)}</span>
        </KeyValue>
      </dl>

      {evidence.length > 0 ? (
        <div className="mt-5 border-t border-hairline pt-5">
          <p className="eyebrow mb-3">Independent evidence</p>
          <EvidenceList
            items={evidence}
            emptyTitle="No independent evidence"
            emptyDescription="Nothing was retained from this attempt."
          />
        </div>
      ) : null}

      {verification.executed_search_queries.length > 0 ? (
        <div className="mt-5 border-t border-hairline pt-5">
          <p className="eyebrow mb-2">Search queries executed</p>
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
            Sources rejected by the independence filter (
            {verification.rejected_sources.length})
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
            <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-muted" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
