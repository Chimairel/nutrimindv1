import React from 'react';
import { ImageIcon } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

export function MealPlanSkeleton() {
  return (
    <div className="flex flex-col gap-5 text-left" aria-label="Loading meal plan schedule">
      {/* 1. Summary Metrics Strip */}
      <section className="grid grid-cols-2 gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface/85 p-3 shadow-card sm:grid-cols-4 sm:p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-4 w-8 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        ))}
      </section>

      {/* 2. Day Selector Strip */}
      <section className="rounded-[26px] border border-brand-border/70 bg-brand-surface/85 p-2 shadow-card">
        <div className="flex items-center gap-2">
          {/* Prev arrow button skeleton */}
          <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl sm:rounded-2xl border border-brand-border/70" />

          {/* 7-day pill skeletons */}
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={`flex min-w-[70px] sm:min-w-[88px] flex-1 flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-3 py-2 sm:py-2.5 gap-1.5 ${
                  i === 0
                    ? 'border-brand-green/30 bg-brand-green/10 dark:border-brand-accent/40 dark:bg-brand-accent/10'
                    : 'border-brand-border/60 bg-brand-bgAlt/50 dark:border-white/5 dark:bg-white/[0.02]'
                }`}
              >
                <Skeleton className="h-2.5 w-8 rounded" />
                <Skeleton className="h-5 w-6 rounded" />
                <Skeleton className="h-2 w-10 rounded" />
              </div>
            ))}
          </div>

          {/* Next arrow button skeleton */}
          <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl sm:rounded-2xl border border-brand-border/70" />
        </div>

        {/* Date footer sub-bar */}
        <div className="flex items-center justify-between px-3 pb-1 pt-2">
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-3 w-14 rounded" />
        </div>
      </section>

      {/* 3. Day Plan Card Container */}
      <section className="overflow-hidden rounded-[26px] border border-brand-border/70 bg-brand-surface shadow-sm">
        {/* Day Header with sum targets */}
        <div className="flex flex-col justify-between gap-3 border-b border-brand-border/60 bg-brand-bgAlt/35 px-4 py-4 md:flex-row md:items-center sm:px-5">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>

          {/* Macro pills */}
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* 3 Meal Cards Grid */}
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 sm:p-5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col justify-between rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-sm"
            >
              <div>
                {/* Image Placeholder */}
                <Skeleton className="mb-3.5 flex h-36 w-full items-center justify-center rounded-xl">
                  <ImageIcon className="h-7 w-7 text-brand-muted/30 dark:text-white/20" aria-hidden="true" />
                </Skeleton>

                {/* Card Top Row: Meal type label & status badge */}
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>

                {/* Meal Title */}
                <Skeleton className="h-4 w-4/5 rounded mb-1.5" />
                <Skeleton className="h-3.5 w-1/2 rounded" />
              </div>

              {/* Bottom Row: Macros & View Action */}
              <div className="mt-4 flex items-center justify-between border-t border-brand-border/40 pt-2.5">
                <Skeleton className="h-3 w-36 rounded" />
                <Skeleton className="h-3 w-10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default MealPlanSkeleton;
