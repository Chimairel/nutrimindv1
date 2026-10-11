import { CheckCircle2, ChevronDown, CircleDashed } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { AdminDataSection, DataRelease, WorkspaceSummary } from './types';

export default function PublishingChecklist({
  summary,
  releaseCount,
  releases,
  onNavigate,
}: {
  summary: WorkspaceSummary;
  releaseCount: number;
  releases: DataRelease[];
  onNavigate: (section: AdminDataSection) => void;
}) {
  const steps: Array<{
    title: string;
    description: string;
    complete: boolean;
    section: AdminDataSection;
    action: string;
  }> = [
    {
      title: 'Register a source',
      description: 'Record the official agency, ownership, terms, and update schedule.',
      complete: summary.dataSources > 0,
      section: 'sources',
      action: 'Register the first source',
    },
    {
      title: 'Create a release',
      description: 'Give every official file a traceable version before importing it.',
      complete: releaseCount > 0,
      section: 'sources',
      action: 'Create the first release',
    },
    {
      title: 'Import and reconcile',
      description: 'Load aggregate CSV rows and deliberately resolve unmatched FNRI labels.',
      complete: summary.consumptionStats > 0,
      section: 'imports',
      action: 'Continue import and review',
    },
    {
      title: 'Publish an active version',
      description: 'Stage the reviewed release, then publish a traceable version.',
      complete: summary.activeReleases > 0,
      section: 'imports',
      action: 'Continue import and review',
    },
  ];
  const completed = steps.filter((step) => step.complete).length;
  const next = steps.find((step) => !step.complete);
  const draftCount = releases.filter((release) => release.status === 'DRAFT').length;
  const stagedCount = releases.filter((release) => release.status === 'STAGED').length;

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold">Publishing workspace</h2>
      <p className="mt-1 text-xs leading-relaxed text-brand-muted">
        Work from verified provenance to one active release.
      </p>
      <dl className="mt-4 flex gap-6 border-y border-brand-border/60 py-3">
        <div>
          <dt className="text-xs text-brand-muted">Draft releases</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{draftCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-brand-muted">Staged releases</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{stagedCount}</dd>
        </div>
      </dl>
      {next && <p className="mt-4 text-sm font-semibold">Next: {next.title}</p>}
      <Button className="mt-4 w-full" onClick={() => onNavigate(next?.section ?? 'imports')}>
        {next?.action ?? 'Manage imports & publishing'}
      </Button>
      <details
        key={next ? 'incomplete' : 'complete'}
        open={next ? true : undefined}
        className="group mt-4 border-t border-brand-border/60 pt-1"
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
          <span>
            Four-step publishing workflow{' '}
            <span className="block mt-1 font-normal text-brand-muted">{completed}/4 complete · setup checklist</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-brand-muted group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ol className="mt-3 space-y-4">
          {steps.map(({ title, description, complete }, index) => (
            <li key={title} className="flex items-start gap-2.5">
              {complete ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-label="Complete" />
              ) : (
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-brand-muted" aria-label="Not complete" />
              )}
              <div>
                <p className="text-xs font-bold">
                  {index + 1}. {title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}
