import React from 'react';
import { ImageIcon } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading daily dashboard">
      {/* 1. Day Selector Strip Skeleton */}
      <div className="mx-auto flex max-w-full gap-1.5 overflow-x-auto rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className={`flex min-w-[76px] flex-1 flex-col items-center justify-center rounded-2xl border px-4 py-3 gap-1.5 ${
              i === 0
                ? 'border-brand-green/30 bg-brand-green/10 dark:border-brand-accent/40 dark:bg-brand-accent/10'
                : 'border-brand-border/60 bg-brand-bgAlt/50 dark:border-transparent dark:bg-white/[0.02]'
            }`}
          >
            <Skeleton className="h-2.5 w-8 rounded" />
            <Skeleton className="h-5 w-6 rounded" />
          </div>
        ))}
      </div>

      {/* 2. Cockpit Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Calorie Ring & Macro Progress Skeleton */}
        <div className="flex flex-col items-center justify-between rounded-[28px] border border-brand-border/70 bg-brand-surface p-6 shadow-card lg:col-span-5">
          <div className="w-full flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>

          {/* SVG Ring circle placeholder */}
          <div className="my-6 flex h-48 w-48 items-center justify-center rounded-full border-8 border-brand-border/60 bg-brand-surface dark:border-brand-border/40">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-7 w-20 rounded" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
          </div>

          {/* Macro Progress Bars */}
          <div className="w-full flex flex-col gap-3 mt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Scheduled Meals & Habit Cards Skeleton */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {/* 3 Meal Cards */}
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <Skeleton className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                  <ImageIcon className="h-5 w-5 text-brand-muted/30 dark:text-white/20" aria-hidden="true" />
                </Skeleton>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-40 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-8 w-16 rounded-xl" />
              </div>
            </div>
          ))}

          {/* Water Tracker Skeleton */}
          <div className="flex items-center justify-between rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom 2 Cards Grid */}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-36 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded mb-2" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded mb-2" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
