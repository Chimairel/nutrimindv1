'use client';

import { useState } from 'react';
import { WorkspaceListPane } from '@/components/shared/SplitWorkspace';
import { QueueHeader, QueueList, QueueRow, QueueSkeleton, queueLabel } from '@/components/shared/WorkspaceQueue';
import Button from '@/components/ui/Button';
import { formatPhilippineDate, formatPhilippineDateTime } from '@/lib/formatters';
import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';

type Props = { review: ReturnType<typeof useNutritionistReviews>; caseFilter: string; expanded: boolean };

function recordedDate(value: string | null | undefined) {
  return value && Number.isFinite(new Date(value).getTime()) ? formatPhilippineDate(value) : 'not recorded';
}

export default function CaseReviewQueue({ review, expanded }: Props) {
  const { queue, queueError, fetchQueue, isLoading, selectedMealId, errorMsg, handleSelectMeal } = review;
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visibleQueue = queue.filter((meal) =>
    [meal.mealName, meal.user.name, meal.mealType].some((value) => queueLabel(value).includes(query))
  );

  return (
    <WorkspaceListPane visible={!selectedMealId} className={expanded ? '!hidden' : ''}>
      <QueueHeader
        title="Case queue"
        count={queue.length}
        search={search}
        onSearch={setSearch}
        searchLabel="Search meals or members"
        description="Select a meal to preview its evidence. Claim it when ready to decide."
      />
      {queueError && (
        <div role="alert" className="my-3 space-y-3 rounded-xl border border-amber-500/30 bg-brand-surface p-4 text-sm">
          <p>{queueError}</p>
          {queue.length > 0 && (
            <p className="text-xs text-brand-muted">Showing the last loaded queue. Refresh before choosing new work.</p>
          )}
          <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => void fetchQueue()}>
            Retry queue
          </Button>
        </div>
      )}
      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <QueueSkeleton />
        </div>
      ) : queueError && queue.length === 0 ? null : !visibleQueue.length ? (
        <div className="p-4 text-sm text-brand-muted">
          {queue.length ? (
            <p role="status">No cases match your search.</p>
          ) : (
            <>
              <p className="font-semibold text-brand-text">Queue clear</p>
              <p role={errorMsg ? 'alert' : 'status'} className="mt-1 text-xs">
                {errorMsg || 'No meals awaiting review in this queue.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <QueueList label="Meals awaiting case approval">
          {visibleQueue.map((meal) => (
            <QueueRow
              key={meal.id}
              title={meal.mealName}
              selected={selectedMealId === meal.id}
              disabled={meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe}
              onSelect={() => {
                if (!meal.claimStatus.claimedByOther && !meal.claimStatus.coolingDownForMe) handleSelectMeal(meal.id);
              }}
            >
              <span className="block break-words text-brand-muted">
                {meal.user.name} · {queueLabel(meal.mealType)} · {recordedDate(meal.scheduledDate)}
              </span>
              <span className="block font-semibold text-[#8c3b00] dark:text-[#ff8a3d]">
                {meal.requiresSafetyRevalidation ? 'Updated review needed' : 'Awaiting review'}
                {meal.highRiskReviewRequired && <span className="block">Review health context</span>}
              </span>
              <span className="block text-brand-text">
                Shop by {recordedDate(meal.shoppingDeadlineAt)} · Cook {recordedDate(meal.cookDeadlineAt)}
              </span>
              <span className="block text-brand-muted">
                {meal.calories != null ? `${Math.round(meal.calories)} kcal · ` : ''}
                {queueLabel(meal.sourceProvenance)}
                {meal.coalescedDependentCount > 1 ? ` · ${meal.coalescedDependentCount} matching slots` : ''}
              </span>
              <span className="block text-[11px] text-brand-muted">One RND approval required</span>
              <span className="block text-[11px] text-brand-muted">
                {queueLabel(meal.assuranceTier)} assurance · {meal.remainingReviewers} review
                {meal.remainingReviewers === 1 ? '' : 's'} remaining
              </span>
              {meal.claimStatus.claimedByMe && (
                <span className="block font-semibold text-brand-green">Claimed by you</span>
              )}
              {meal.claimStatus.claimedByOther && (
                <span className="block font-semibold text-brand-muted">Being reviewed</span>
              )}
              {meal.claimStatus.coolingDownForMe && (
                <span className="block text-[#8c3b00] dark:text-[#ff8a3d]">
                  Your claim expired. Available to other RNDs; you can retry after{' '}
                  {meal.claimStatus.cooldownUntil && Number.isFinite(new Date(meal.claimStatus.cooldownUntil).getTime())
                    ? formatPhilippineDateTime(meal.claimStatus.cooldownUntil)
                    : 'the cooldown'}
                  .
                </span>
              )}
            </QueueRow>
          ))}
        </QueueList>
      )}
    </WorkspaceListPane>
  );
}
