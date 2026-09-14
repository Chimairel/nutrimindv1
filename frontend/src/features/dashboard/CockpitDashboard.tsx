'use client';

import Link from 'next/link';
import { Calendar, Droplets, Scale, ClipboardCheck, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { formatManilaDate } from '@/lib/manila-date';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import type { UserProfileData } from '@/hooks/useProfile';
import { DailyIntakeDonut, AnimatedValue } from '@/components/watermelon/daily-intake-donut';
import { DashboardMealRow } from './DashboardMealRow';

export interface CockpitDashboardProps {
  activeDate: Date;
  meals: MealPlan[];
  pendingMeals?: PendingMealPreview[];
  metrics: {
    caloriesConsumed: number;
    caloriesTarget: number;
    proteinConsumed: number;
    proteinTarget: number;
    carbsConsumed: number;
    carbsTarget: number;
    fatConsumed: number;
    fatTarget: number;
    provisionalCalories: number;
    unresolvedMealCount: number;
  };
  profile: UserProfileData['userProfile'];
  waterIntake: number;
  checkinStreak: number;
  checkinDue: boolean;
  onAddWater: (amount: number) => void;
  onOpenCheckin: () => void;
  onMealClick: (mealId: string) => void;
  onStatusToggle?: (mealId: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void> | void;
  onOpenWeeklyPlan: () => void;
}

export function CockpitDashboard({
  activeDate,
  meals,
  pendingMeals = [],
  metrics,
  profile,
  waterIntake,
  checkinStreak,
  checkinDue,
  onAddWater,
  onOpenCheckin,
  onMealClick,
  onStatusToggle,
  onOpenWeeklyPlan,
}: CockpitDashboardProps) {
  const macros = [
    {
      label: 'Protein',
      consumed: metrics.proteinConsumed,
      target: metrics.proteinTarget,
      color: 'var(--macro-protein)',
    },
    { label: 'Carbs', consumed: metrics.carbsConsumed, target: metrics.carbsTarget, color: 'var(--macro-carbs)' },
    { label: 'Fat', consumed: metrics.fatConsumed, target: metrics.fatTarget, color: 'var(--macro-fat)' },
  ];
  return (
    <section aria-label="Daily nutrition" className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
        <section
          aria-label="Nutrition summary"
          className="daily-intake-card flex h-full flex-col justify-between rounded-3xl border p-5 sm:p-6"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-muted">Your daily intake</p>
              <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-green">
                Today
              </span>
            </div>

            {/* Donut Gauge & Calorie Telemetry */}
            <div className="my-6 flex items-center gap-5 sm:gap-6">
              <DailyIntakeDonut
                consumed={metrics.caloriesConsumed}
                target={metrics.caloriesTarget}
                provisional={metrics.provisionalCalories}
                size={152}
              />
              <div className="space-y-3">
                {/* Consumed Stat */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-green shadow-[0_0_8px_rgba(18,129,100,0.5)]" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Consumed</p>
                    <div className="flex items-baseline gap-1">
                      <AnimatedValue
                        value={Math.round(metrics.caloriesConsumed)}
                        className="font-display text-2xl font-bold tracking-tight text-brand-text leading-tight"
                      />
                      <span className="text-xs font-semibold text-brand-muted">kcal</span>
                    </div>
                  </div>
                </div>

                {/* Estimated Outside Meals Stat (if any) */}
                {metrics.provisionalCalories > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">
                        Estimated (Outside)
                      </p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedValue
                          value={Math.round(metrics.provisionalCalories)}
                          className="font-display text-lg font-bold tracking-tight text-amber-500 dark:text-amber-400 leading-tight"
                        />
                        <span className="text-xs font-semibold text-amber-500/70 dark:text-amber-400/70">kcal</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Daily Target Stat */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-border dark:bg-zinc-700" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Daily Target</p>
                    <div className="flex items-baseline gap-1">
                      <AnimatedValue
                        value={Math.round(metrics.caloriesTarget)}
                        className="font-display text-lg font-bold tracking-tight text-brand-muted leading-tight"
                      />
                      <span className="text-xs font-semibold text-brand-muted">kcal</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs font-medium text-brand-green">Logged for this day</p>
              </div>
            </div>

            {/* Macro rows with swatches, rolling numbers and spring progress bars */}
            <div className="space-y-4 border-t border-brand-border pt-5">
              {macros.map((macro) => (
                <div key={macro.label}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: macro.color }} />
                      <span className="font-medium text-brand-text">{macro.label}</span>
                    </div>
                    <span className="text-brand-muted font-mono text-xs flex items-center gap-1">
                      <strong className="text-brand-text font-bold">
                        <AnimatedValue
                          value={Math.round(macro.consumed)}
                          suffix="g"
                          className="font-bold text-brand-text"
                        />
                      </strong>{' '}
                      / <AnimatedValue value={Math.round(macro.target)} suffix="g" className="text-brand-muted" />
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-brand-border/60 dark:bg-zinc-800"
                    aria-hidden="true"
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: macro.color }}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.max(0, Math.min(100, (macro.consumed / Math.max(1, macro.target)) * 100))}%`,
                      }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {metrics.provisionalCalories > 0 && (
              <p className="rounded-xl bg-status-pending-bg p-3 text-xs leading-relaxed text-status-pending-text">
                Includes {Math.round(metrics.provisionalCalories)} provisional kcal from outside meals.
              </p>
            )}
            {metrics.unresolvedMealCount > 0 && (
              <p role="status" className="text-xs leading-relaxed text-status-pending-text">
                {metrics.unresolvedMealCount} outside meal{metrics.unresolvedMealCount === 1 ? '' : 's'} with incomplete
                nutrition. Unresolved items are excluded from totals.
              </p>
            )}
            <div className="flex items-center justify-between rounded-2xl bg-black/25 dark:bg-black/35 px-4 py-3 text-xs">
              <span className="font-medium text-brand-muted">Remaining budget</span>
              <span className="font-mono font-bold text-brand-green flex items-center gap-1">
                <AnimatedValue
                  value={Math.max(0, Math.round(metrics.caloriesTarget - metrics.caloriesConsumed))}
                  suffix=" kcal"
                  className="font-mono font-bold text-brand-green"
                />
              </span>
            </div>
          </div>
        </section>
        <section
          aria-label="Scheduled meals"
          className="dashboard-surface flex h-full min-w-0 flex-col rounded-3xl p-5 sm:p-6"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-brand-green">
                {formatManilaDate(activeDate, { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-brand-text">On your menu</h2>
            </div>
            <button
              type="button"
              onClick={onOpenWeeklyPlan}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-bgAlt px-3 text-xs font-bold text-brand-green"
            >
              <Calendar className="h-4 w-4" /> Weekly plan
            </button>
          </div>
          {pendingMeals.length > 0 && (
            <p className="mb-4 rounded-2xl bg-status-pending-bg/50 p-3.5 text-xs leading-relaxed text-status-pending-text">
              Awaiting review: pending meals are previews. Open a preview to see its ingredients; logging becomes
              available after approval.
            </p>
          )}
          <div className="space-y-3">
            {meals.map((meal) => (
              <DashboardMealRow
                key={meal.id}
                meal={meal}
                onOpen={() => onMealClick(meal.id)}
                onStatusToggle={onStatusToggle}
              />
            ))}
            {pendingMeals.map((meal, index) => (
              <DashboardMealRow key={`${meal.mealType}-${index}`} meal={meal} pending />
            ))}
          </div>
          {meals.length === 0 && pendingMeals.length === 0 && (
            <p className="rounded-2xl bg-brand-bgAlt p-5 text-sm text-brand-muted">
              No meals scheduled for this day. Open your weekly plan to view another day.
            </p>
          )}
        </section>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <section className="dashboard-surface dashboard-stat rounded-2xl p-5" aria-label="Water log">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <Droplets className="h-4 w-4 text-brand-green" /> Water log
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-brand-text">
            {waterIntake.toLocaleString()} <span className="text-sm font-medium text-brand-muted">mL</span>
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              aria-label="Remove 250 mL of water"
              disabled={waterIntake <= 0}
              onClick={() => onAddWater(-250)}
              className="min-h-11 flex-1 rounded-xl border border-brand-border text-sm font-semibold text-brand-text disabled:opacity-40"
            >
              −250 mL
            </button>
            <button
              type="button"
              aria-label="Add 250 mL of water"
              onClick={() => onAddWater(250)}
              className="dashboard-action min-h-11 flex-1 rounded-xl text-sm font-semibold"
            >
              +250 mL
            </button>
          </div>
        </section>
        <Link
          href="/progress"
          className="dashboard-surface dashboard-stat group rounded-2xl p-5 transition-colors hover:border-brand-green"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <Scale className="h-4 w-4 text-brand-green" /> Weight & progress{' '}
            <ArrowUpRight className="ml-auto h-4 w-4" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-brand-text">
            {profile?.weightKg ?? '—'} <span className="text-sm font-medium text-brand-muted">kg</span>
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            {profile?.targetWeightKg ? `Goal: ${profile.targetWeightKg} kg` : 'View your weight history and goals'}
          </p>
          <p className="mt-4 text-sm font-semibold text-brand-green">Record your progress →</p>
        </Link>
        <section className="dashboard-surface dashboard-stat rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <ClipboardCheck className="h-4 w-4 text-brand-green" /> Weekly check-in
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-brand-text">
            {checkinDue ? 'Ready for you' : 'Up to date'}
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            {checkinStreak} week{checkinStreak === 1 ? '' : 's'} in your check-in streak
          </p>
          {checkinDue ? (
            <button
              type="button"
              onClick={onOpenCheckin}
              className="mt-3 min-h-11 rounded-xl bg-brand-accent px-4 text-sm font-bold text-brand-black"
            >
              Start check-in →
            </button>
          ) : (
            <Link href="/profile/health" className="mt-4 inline-block text-sm font-semibold text-brand-green">
              Update health profile →
            </Link>
          )}
        </section>
      </div>
    </section>
  );
}
