/**
 * Catalog — the declarative vocabulary the pipeline reasons over.
 *
 * Served by the backend rather than restated here, so what an operator reads
 * is literally what the model was asked to evaluate.
 */

import { api, useResource } from "../lib/api";
import { opportunityTypeLabel } from "../lib/domain";
import { Chip } from "../components/ui/StatusBadge";
import { Card, PageHeader, SectionHeading } from "../components/ui/primitives";
import { cx } from "../lib/cx";
import { ErrorState, SkeletonPanel } from "../components/ui/states";

export function CatalogPage() {
  const { data, error, loading, reload } = useResource((signal) => api.catalog(signal), []);

  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Catalog"
        subtitle="Opportunities are evaluated from declarative definitions — the model does not invent categories — and each is mapped to an OpenCube capability by a fixed taxonomy."
        meta={
          data ? (
            <>
              <p className="text-sm text-ink-soft">
                Vertical <span className="font-medium text-ink">{data.vertical}</span>
              </p>
              <p className="text-sm text-ink-soft">
                Geography <span className="font-medium text-ink">{data.geography}</span>
              </p>
            </>
          ) : undefined
        }
      />

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} context="The catalog" />
      ) : loading || !data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {data.opportunities.map((opportunity) => {
              const evaluated = data.evaluated_opportunity_ids.includes(
                opportunity.opportunity_id,
              );
              return (
                <Card key={opportunity.opportunity_id} className={cx(!evaluated && "opacity-75")}>
                  <SectionHeading
                    eyebrow={opportunityTypeLabel(opportunity.opportunity_type)}
                    title={opportunity.name}
                    description={opportunity.description}
                    action={
                      <Chip
                        title={
                          evaluated
                            ? "Evaluated by Business Investigator V1."
                            : "Declared in the catalog but not evaluated in V1."
                        }
                      >
                        {evaluated ? "Evaluated in V1" : "Declared only"}
                      </Chip>
                    }
                  />
                  <div className="grid gap-5 border-t border-hairline pt-4 sm:grid-cols-2">
                    <Signals title="Evidence signals" items={opportunity.evidence_signals} />
                    <Signals
                      title="Contradiction signals"
                      items={opportunity.contradiction_signals}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-hairline pt-4">
                    <Chip>{opportunity.provider_capability}</Chip>
                    {opportunity.requires_independent_verification ? (
                      <Chip>Requires independent verification</Chip>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-6">
            <Card>
              <SectionHeading
                title="OpenCube capabilities"
                description="The commercial catalog. A capability appearing on a match is taxonomy, never evidence that a business needs it."
              />
              <ul className="divide-y divide-hairline">
                {data.capabilities.map((capability) => (
                  <li key={capability.capability_id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm text-ink">{capability.label}</p>
                    <p className="font-mono text-[0.6875rem] text-ink-muted">
                      {capability.capability_id}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <SectionHeading
                title="Run defaults"
                description="The provider capabilities a run is created with."
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
            <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-muted" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
