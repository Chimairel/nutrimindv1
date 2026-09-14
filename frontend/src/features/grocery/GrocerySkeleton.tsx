import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export function GrocerySkeleton() {
  return (
    <div className="flex flex-col gap-5 text-left" aria-label="Loading grocery checklist">
      {/* 1. Header Summary Status */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>

      {/* 2. Search & Filter Bar Skeleton */}
      <section className="rounded-[24px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Skeleton className="h-11 w-full flex-1 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60" />
          <div className="flex min-w-0 items-center gap-1 rounded-2xl bg-brand-bgAlt/70 p-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-16 rounded-xl" />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Category Groups Skeletons */}
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, groupIndex) => (
          <div
            key={groupIndex}
            className="overflow-hidden rounded-[24px] border border-brand-border/70 bg-brand-surface shadow-sm"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between border-b border-brand-border/50 bg-brand-bgAlt/30 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>

            {/* Checklist Items */}
            <div className="divide-y divide-brand-border/40 p-2">
              {[...Array(3)].map((_, itemIndex) => (
                <div key={itemIndex} className="flex items-center justify-between px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-lg" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-36 rounded" />
                      <Skeleton className="h-2.5 w-20 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GrocerySkeleton;
