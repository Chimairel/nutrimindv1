'use client';

import React from 'react';
import { Calendar, Compass, Flame, ShieldCheck, Sparkles, Target } from 'lucide-react';
import Button from '@/components/ui/Button';

type DashboardHeroProps = {
  userName?: string;
  dailyCalorieTarget?: number | null;
  goal?: string | null;
  locality?: string | null;
  planType?: 'STARTER' | 'WEEKLY' | null;
  isPendingReview?: boolean;
  onOpenWeeklyPlan: () => void;
};

export function DashboardHero({
  userName = 'Friend',
  dailyCalorieTarget,
  goal,
  locality,
  planType,
  isPendingReview,
  onOpenWeeklyPlan,
}: DashboardHeroProps) {
  const firstName = userName.split(' ')[0] || 'Friend';
  const formatGoal = (g?: string | null) => {
    if (!g) return 'Balanced Health';
    return g
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-brand-border/80 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/10 p-6 text-left shadow-card">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand-accent/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-green">
            <Sparkles className="h-4 w-4" />
            <span>Daily Nutrition Cockpit</span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-brand-text md:text-3xl">
            Mabuhay, {firstName}.
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-brand-muted md:text-sm">
            Culturally tailored, FNRI-referenced meal plans aligned with your daily targets and clinical oversight.
          </p>

          {/* Quick info chip bar */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {dailyCalorieTarget ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 font-bold text-brand-green">
                <Flame className="h-3.5 w-3.5" />
                <span>{Math.round(dailyCalorieTarget)} kcal target</span>
              </span>
            ) : null}

            {goal ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 font-semibold text-brand-text">
                <Target className="h-3.5 w-3.5 text-brand-muted" />
                <span>{formatGoal(goal)}</span>
              </span>
            ) : null}

            {locality ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 font-semibold text-brand-text">
                <Compass className="h-3.5 w-3.5 text-brand-muted" />
                <span>{locality}</span>
              </span>
            ) : null}

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                isPendingReview
                  ? 'border-status-pending-text/30 bg-status-pending-bg/30 text-status-pending-text'
                  : 'border-brand-green/30 bg-brand-green/10 text-brand-green'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {isPendingReview
                  ? 'RND Review Pending'
                  : planType === 'STARTER'
                    ? 'Starter Kickoff Active'
                    : 'PRC RND Verified'}
              </span>
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0">
          <Button
            variant="primary"
            onClick={onOpenWeeklyPlan}
            className="flex w-full items-center justify-center gap-2 px-5 py-3 text-xs font-bold md:w-auto shadow-md shadow-brand-green/10"
          >
            <Calendar className="h-4 w-4" />
            <span>Open Weekly Plan</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
