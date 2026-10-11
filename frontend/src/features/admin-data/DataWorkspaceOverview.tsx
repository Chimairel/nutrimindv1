'use client';

import { CalendarClock, ChevronDown, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import DataSummary from './DataSummary';
import PublishingChecklist from './PublishingChecklist';
import type { AdminDataSection, DataRelease, ReferenceDataDomain, WorkspaceSummary } from './types';

const domainLabels: Record<ReferenceDataDomain, string> = {
  FOOD_COMPOSITION: 'Food composition',
  FOOD_CONSUMPTION: 'Food consumption',
  INGREDIENT_PRICE: 'Ingredient prices',
  MEAL_CATALOGUE: 'Meal catalogue',
  MEAL_MEDIA: 'Meal media',
};

function retrievedLabel(date: string) {
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return 'Not recorded';
  const days = Math.floor((Date.now() - time) / 86_400_000);
  if (days < 0) return new Date(date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
  if (days === 0) return 'Today';
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

interface DataWorkspaceOverviewProps {
  summary: WorkspaceSummary;
  releaseCount: number;
  releases: DataRelease[];
  onNavigate: (section: AdminDataSection) => void;
}

export default function DataWorkspaceOverview({
  summary,
  releaseCount,
  releases,
  onNavigate,
}: DataWorkspaceOverviewProps) {
  const activeReleases = releases.filter((release) => release.status === 'ACTIVE');
  return (
    <div className="space-y-6">
      <DataSummary summary={summary} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="active-evidence-title" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="active-evidence-title"
              className="flex items-center gap-2 font-display text-lg font-bold text-brand-text"
            >
              <CalendarClock className="h-5 w-5 text-brand-green" aria-hidden="true" /> Active evidence freshness
            </h2>
            <Button variant="secondary" size="sm" onClick={() => onNavigate('sources')}>
              View releases
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-brand-muted">
            Operational age and the source-defined review cadence; this is not a clinical-validity claim.
          </p>
          <WorkspaceTable
            label="Active evidence freshness"
            rows={activeReleases}
            rowKey={(release) => release.id}
            emptyMessage="No active reference-data release is recorded in this workspace."
            columns={[
              {
                key: 'release',
                header: 'Release',
                cellClassName: 'min-w-[220px] max-w-sm',
                cell: (release) => (
                  <div className="space-y-1">
                    <strong className="block text-sm">{release.source.name}</strong>
                    <span className="block text-brand-muted">
                      {domainLabels[release.source.domain] ?? release.source.domain}
                    </span>
                    <span className="block [overflow-wrap:anywhere]">
                      {release.source.code} · {release.versionLabel}
                    </span>
                  </div>
                ),
              },
              {
                key: 'age',
                header: 'Retrieved',
                cellClassName: 'min-w-[100px]',
                cell: (release) => retrievedLabel(release.retrievedAt),
              },
              {
                key: 'cadence',
                header: 'Review cadence',
                cellClassName: 'min-w-[150px]',
                cell: (release) => release.source.updateCadence || 'Not recorded',
              },
            ]}
          />
        </section>
        <PublishingChecklist
          summary={summary}
          releaseCount={releaseCount}
          releases={releases}
          onNavigate={onNavigate}
        />
      </div>
      <div className="border-t border-brand-border pt-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-brand-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
          Admins govern sources, aggregate survey releases, and FNRI aliases. RNDs remain the only role that can
          clinically approve meals.
        </p>
        <details className="group mt-2">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg text-xs font-semibold text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
            Who controls what? <ChevronDown className="h-4 w-4 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-2 max-w-prose text-xs leading-relaxed text-brand-muted">
            Food composition corrections require a source and reason and retain a revision history. Publishing a
            reference release retains its audit history; meal approval remains a separate RND decision.
          </p>
        </details>
      </div>
    </div>
  );
}
