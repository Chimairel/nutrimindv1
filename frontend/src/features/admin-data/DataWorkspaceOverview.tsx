'use client';

import { CheckCircle2, CircleDashed, Database, FileInput, FilePlus2, RadioTower } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DataSummary from './DataSummary';
import type { AdminDataSection, WorkspaceSummary } from './types';

interface DataWorkspaceOverviewProps {
  summary: WorkspaceSummary;
  releaseCount: number;
  onNavigate: (section: AdminDataSection) => void;
}

export default function DataWorkspaceOverview({ summary, releaseCount, onNavigate }: DataWorkspaceOverviewProps) {
  const steps = [
    {
      title: 'Register a source',
      description: 'Record the official agency, ownership, terms, and update schedule.',
      complete: summary.dataSources > 0,
      icon: Database,
    },
    {
      title: 'Create a release',
      description: 'Give every official file a traceable version before importing it.',
      complete: releaseCount > 0,
      icon: FilePlus2,
    },
    {
      title: 'Import and reconcile',
      description: 'Load aggregate CSV rows and deliberately resolve unmatched FNRI labels.',
      complete: summary.consumptionStats > 0,
      icon: FileInput,
    },
    {
      title: 'Publish an active version',
      description: 'Stage the reviewed release, then publish it for meal-planning evidence.',
      complete: summary.activeReleases > 0,
      icon: RadioTower,
    },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;
  const nextSection: AdminDataSection =
    summary.dataSources === 0 || releaseCount === 0
      ? 'sources'
      : summary.activeReleases === 0
        ? 'imports'
        : 'catalogue';
  const nextLabel =
    summary.dataSources === 0
      ? 'Register the first source'
      : releaseCount === 0
        ? 'Create the first release'
        : summary.activeReleases === 0
          ? 'Continue import and review'
          : 'Browse the FNRI catalogue';

  return (
    <div className="space-y-5">
      <DataSummary summary={summary} />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Card
          header={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-black">Four-step publishing workflow</h2>
                <p className="text-xs text-brand-muted">Work from verified provenance to one active release.</p>
              </div>
              <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 font-mono text-[10px] font-bold text-brand-green">
                {completedSteps}/4 complete
              </span>
            </div>
          }
        >
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map(({ title, description, complete, icon: Icon }, index) => (
              <li key={title} className="rounded-2xl border border-brand-border/55 bg-brand-bgAlt/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">
                        Step {index + 1}
                      </span>
                      {complete ? (
                        <CheckCircle2 aria-label="Complete" className="h-4 w-4 text-brand-green" />
                      ) : (
                        <CircleDashed aria-label="Not complete" className="h-4 w-4 text-brand-muted" />
                      )}
                    </div>
                    <p className="mt-1 text-sm font-black text-brand-text">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-muted">{description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Button className="mt-5 w-full sm:w-auto" onClick={() => onNavigate(nextSection)}>
            {nextLabel}
          </Button>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/10 p-5">
          <p className="font-display text-sm font-black text-amber-900 dark:text-amber-100">Who controls what?</p>
          <p className="mt-3 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            Admins govern sources, aggregate survey releases, and FNRI aliases. Nutritionists remain the only role that
            can clinically approve meals.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Raw FNRI nutrient values stay read-only. Publishing changes which supporting evidence is active; it never
            rewrites the canonical food composition records.
          </p>
        </Card>
      </div>
    </div>
  );
}
