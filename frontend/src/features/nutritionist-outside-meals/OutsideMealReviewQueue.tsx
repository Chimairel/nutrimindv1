'use client';

import { Eye } from 'lucide-react';

import { OutsideMealQueueSkeleton } from '@/features/nutritionist-reviews/OutsideMealsSkeleton';

import EmptyState from '@/components/shared/EmptyState';

import { getMealTypeTheme } from './OutsideMealReviewsPanel.shared';
import type { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';
type Model = Extract<ReturnType<typeof useOutsideMealReviewsPanelModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'isLoading' | 'rows' | 'selected' | 'busy' | 'claim'> };
export default function OutsideMealReviewQueue({ model }: SectionProps) {
  const { isLoading, rows, selected, busy, claim } = model;

  return (
    <>
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <OutsideMealQueueSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No outside-meal estimates waiting"
            description="Health Plan members’ requested estimate reviews appear here."
          />
        ) : (
          rows.map((row) => {
            const theme = getMealTypeTheme(row.outsideMealLogItem.mealLog.mealType);
            const MealIcon = theme.icon;
            const isSelected = selected?.id === row.id;

            return (
              <button
                key={row.id}
                type="button"
                disabled={row.claimStatus.claimedByOther || busy}
                onClick={() => void claim(row)}
                className={`group w-full text-left transition-all duration-200 outline-none ${
                  row.claimStatus.claimedByOther ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}
              >
                <div
                  className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                    isSelected
                      ? 'border-brand-green bg-brand-green/[0.05] shadow-md ring-1 ring-brand-green/30'
                      : 'border-brand-border/80 bg-brand-surface hover:border-brand-green/35 hover:shadow-card hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.badgeStyle} shadow-xs`}
                      >
                        <MealIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="truncate block font-display text-base font-bold text-brand-text group-hover:text-brand-green transition-colors">
                          {row.outsideMealLogItem.name}
                        </strong>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-muted">
                          <span className="font-semibold text-brand-text/80">{theme.label}</span>
                          <span>·</span>
                          <span>
                            {new Date(row.outsideMealLogItem.mealLog.loggedAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="rounded-full border border-brand-border/80 bg-brand-bgAlt/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                        {row.queueReason?.replaceAll('_', ' ').toLowerCase() ?? 'Review'}
                      </span>
                      <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-green">
                        priority {row.priority}
                      </span>
                    </div>
                  </div>

                  {/* Member UI Macro Pills */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5 sm:gap-2 border-t border-brand-border/40 pt-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-[11px] font-bold text-brand-text dark:border-white/10 dark:bg-white/[0.06]">
                      🔥 {Math.round(row.outsideMealLogItem.calories ?? 0)} kcal
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#08705b]/20 bg-[#08705b]/10 px-2.5 py-1 text-[11px] font-bold text-[#08705b] dark:border-[#10b981]/30 dark:bg-[#10b981]/15 dark:text-[#34d399]">
                      {row.outsideMealLogItem.proteinG ?? 0}g P
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#18b9d2]/20 bg-[#18b9d2]/10 px-2.5 py-1 text-[11px] font-bold text-[#0b7788] dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]">
                      {row.outsideMealLogItem.carbsG ?? 0}g C
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#eb6a38]/20 bg-[#eb6a38]/10 px-2.5 py-1 text-[11px] font-bold text-[#c74614] dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15 dark:text-[#f09e6c]">
                      {row.outsideMealLogItem.fatG ?? 0}g F
                    </span>
                  </div>

                  {row.claimStatus.claimedByOther && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      <span>Claimed by {row.claimStatus.claimedByName ?? 'another RND'}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
