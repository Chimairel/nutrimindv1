'use client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import { reviewStateLabel } from './MealReviewTimeline';
export default function MealReviewQueue({
  isAdmin,
  active,
  openMeal,
}: {
  isAdmin: boolean;
  active: boolean;
  openMeal: (meal: { id: string }) => Promise<void>;
}) {
  const ownerId = useAuth().user?.userId;
  const base = isAdmin ? '/admin' : '/nutritionist';
  const query = useSessionQuery<{ id: string; mealName: string; state: string; incidentCount: number }[]>({
    ownerId,
    enabled: active,
    resource: `recipe-review-queue:${base}`,
    fetcher: async () => (await api.get(`${base}/meal-review-cases`)).data.data,
    errorMessage: 'Re-review queue could not be loaded.',
  });
  if (!active) return null;
  return (
    <section
      className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-4"
      aria-label="Flagged recipes"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Flagged recipes</h2>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Refresh cases
        </Button>
      </div>
      {query.error && (
        <p role="alert" className="text-sm text-status-error-text">
          {query.error}
        </p>
      )}
      {query.isLoading && !query.data && <p role="status">Loading cases…</p>}
      {query.data && (
        <WorkspaceTable
          label="Held recipe cases"
          rows={query.data}
          rowKey={(row) => row.id}
          emptyMessage="No held recipes await re-review."
          columns={[
            { key: 'meal', header: 'Meal', cell: (row) => <strong>{row.mealName}</strong> },
            { key: 'state', header: 'Review state', cell: (row) => reviewStateLabel(row.state) },
            { key: 'incident', header: 'Incident', cell: (row) => row.incidentCount },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) => (
                <Button variant="secondary" size="sm" onClick={() => void openMeal(row)}>
                  Review case
                </Button>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}
