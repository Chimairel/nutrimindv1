import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-6 text-left" aria-label="Loading progress data">
      {/* 1. Metric Cards Grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[20px] border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="mt-4 h-6 w-20 rounded" />
            <Skeleton className="mt-2 h-3 w-28 rounded" />
          </div>
        ))}
      </section>

      {/* 2. Weight Progress Graph Card */}
      <Card className="p-5 border border-brand-border/70 bg-brand-surface shadow-card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-36 rounded" />
          </div>
          <Skeleton className="h-8 w-36 rounded-xl border border-brand-border/60" />
        </div>

        {/* Chart Canvas Skeleton */}
        <div className="flex h-48 w-full flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 dark:bg-brand-surface/20 p-5">
          <div className="flex justify-between">
            <Skeleton className="h-2.5 w-12 rounded" />
            <Skeleton className="h-2.5 w-12 rounded" />
          </div>
          {/* Simulated chart line */}
          <div className="flex items-end justify-between gap-3 h-28 px-4">
            <Skeleton className="h-16 w-8 rounded-t-lg opacity-40" />
            <Skeleton className="h-20 w-8 rounded-t-lg opacity-50" />
            <Skeleton className="h-14 w-8 rounded-t-lg opacity-40" />
            <Skeleton className="h-24 w-8 rounded-t-lg opacity-60" />
            <Skeleton className="h-18 w-8 rounded-t-lg opacity-50" />
            <Skeleton className="h-28 w-8 rounded-t-lg opacity-70" />
            <Skeleton className="h-22 w-8 rounded-t-lg opacity-60" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-2 w-10 rounded" />
            <Skeleton className="h-2 w-10 rounded" />
            <Skeleton className="h-2 w-10 rounded" />
            <Skeleton className="h-2 w-10 rounded" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default ProgressSkeleton;
