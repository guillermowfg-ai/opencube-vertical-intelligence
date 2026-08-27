/**
 * What we look for -- the written definitions the pipeline assesses against.
 *
 * Served by the back end rather than restated here, so what someone reads is
 * literally what the model was asked to evaluate.
 */

import { api, useResource } from "../lib/api";
import { useI18n } from "../i18n";
import { Chip } from "../components/ui/StatusBadge";
import { Card, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import { ErrorState, SkeletonPanel } from "../components/ui/states";

export function CatalogPage() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useResource((signal) => api.catalog(signal), []);

  return (
    <>
      <PageHeader
        eyebrow={t.catalog.eyebrow}
        title={t.catalog.title}
        subtitle={t.catalog.subtitle}
        meta={
          data ? (
            <>
              <p className="text-sm text-ink-soft">
                {t.catalog.vertical}{" "}
                <span className="font-medium text-ink">{data.vertical}</span>
              </p>
              <p className="text-sm text-ink-soft">
                {t.catalog.geography}{" "}
                <span className="font-medium text-ink">{data.geography}</span>
              </p>
            </>
          ) : undefined
        }
      />

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} context={t.catalog.error} />
      ) : loading || !data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {data.opportunities.map((opportunity) => {
              const evaluated = data.evaluated_opportunity_ids.includes(
                opportunity.opportunity_id,
              );
              return (
                <Card
                  key={opportunity.opportunity_id}
                  className={cx(!evaluated && "opacity-75")}
                >
                  <SectionHeading
                    title={opportunity.name}
                    description={opportunity.description}
                    action={
                      <Chip
                        title={
                          evaluated ? t.catalog.evaluatedHelp : t.catalog.declaredOnlyHelp
                        }
                      >
                        {evaluated ? t.catalog.evaluated : t.catalog.declaredOnly}
                      </Chip>
                    }
                  />
                  <div className="grid gap-5 border-t border-hairline pt-4 sm:grid-cols-2">
                    <Signals
                      title={t.matchDetail.definition.evidenceSignals}
                      items={opportunity.evidence_signals}
                    />
                    <Signals
                      title={t.matchDetail.definition.contradictionSignals}
                      items={opportunity.contradiction_signals}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hairline pt-4">
                    <Chip>{opportunity.provider_capability}</Chip>
                    {opportunity.requires_independent_verification ? (
                      <Chip>{t.matchDetail.definition.requiresVerification}</Chip>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-6">
            <Card>
              <SectionHeading
                title={t.catalog.capabilities.title}
                description={t.catalog.capabilities.description}
              />
              <ul className="divide-y divide-hairline">
                {data.capabilities.map((capability) => (
                  <li key={capability.capability_id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm text-ink">{capability.label}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <SectionHeading
                title={t.catalog.defaults.title}
                description={t.catalog.defaults.description}
              />
              <div className="flex flex-wrap gap-1.5">
                {data.default_provider_capabilities.map((capability) => (
                  <Chip key={capability}>{capability}</Chip>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Signals({ title, items }: { title: string; items: string[] }) {
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
