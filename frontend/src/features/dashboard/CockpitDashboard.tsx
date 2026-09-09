'use client';

import React from 'react';
import { Calendar, Check, ChevronRight, Droplets, Flame, HeartPulse, Scale, X } from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';
import MealImage from '@/components/user/MealImage';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import type { UserProfileData } from '@/hooks/useProfile';

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
  const selectedDayLabel = formatManilaDate(activeDate, { weekday: 'long' });
  const selectedDateFormatted = formatManilaDate(activeDate, { month: 'short', day: 'numeric' });

  const caloriesTarget = Math.max(1, metrics.caloriesTarget);
  const caloriesConsumed = metrics.caloriesConsumed;
  const fuelPercent = Math.min(100, Math.round((caloriesConsumed / caloriesTarget) * 100));

  // Determine which meals to show: approved meals or pending preview meals
  const hasApprovedMeals = meals.length > 0;
  const hasPendingMeals = !hasApprovedMeals && pendingMeals.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-[960px] text-white">
      {/* Main Panel matching landing page hero styling */}
      <div className="surface-panel futuristic-grid relative overflow-hidden rounded-[36px] p-3 shadow-card-lg sm:p-5">
        <div className="scan-line" />
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07100d] p-4 text-white sm:p-6 md:p-8">
          {/* Cockpit Top Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
                {selectedDayLabel} · {selectedDateFormatted} · live plan
              </p>
              <h1 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">Your nutrition cockpit</h1>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Compact Health Sync Pill in Header */}
              <div className="hidden sm:flex items-center gap-2.5 rounded-2xl border border-brand-green/20 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-md">
                <HeartPulse className="h-3.5 w-3.5 text-brand-cyan shrink-0" />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-xs font-black text-white">
                      {Math.round(caloriesTarget).toLocaleString()}
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-wider text-white/40">kcal target</span>
                  </div>
                  <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-cyan"
                      style={{ width: `${fuelPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-accent shadow-[0_0_10px_rgba(184,244,95,0.85)] animate-pulse" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-white/60">Synced</span>
              </div>

              <button
                type="button"
                onClick={onOpenWeeklyPlan}
                className="flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1.5 text-[10px] font-bold text-brand-green hover:bg-brand-green/20 transition-colors"
                title="View 7-day plan workspace"
              >
                <Calendar className="h-3 w-3" />
                <span>Weekly Plan</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Split: Fuel Dial (Left) & Scheduled Meals with Images (Right) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-stretch">
            {/* Left: Fuel Dial & Macro Tiles */}
            <div className="md:col-span-5 flex flex-col justify-between rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-5 sm:p-6">
              {/* Daily Fuel Ring */}
              <div className="my-auto py-2">
                <div
                  className="mx-auto flex h-40 w-40 sm:h-44 sm:w-44 items-center justify-center rounded-full p-[10px] shadow-neon transition-all duration-1000"
                  style={{
                    background: `conic-gradient(#b8f45f 0% ${fuelPercent}%, rgba(255, 255, 255, 0.08) ${fuelPercent}% 100%)`,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#09110e]">
                    <span className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white">
                      {fuelPercent}%
                    </span>
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
                      daily fuel
                    </span>
                    <span className="mt-1 text-[10px] font-bold text-white/50">
                      {Math.round(caloriesConsumed)} / {Math.round(caloriesTarget)} kcal
                    </span>
                  </div>
                </div>

                {metrics.provisionalCalories > 0 && (
                  <div className="mt-3 text-center">
                    <span className="inline-block rounded-full bg-status-pending-bg/80 px-2.5 py-0.5 text-[9px] font-bold text-status-pending-text">
                      Includes {Math.round(metrics.provisionalCalories)} provisional kcal
                    </span>
                  </div>
                )}
              </div>

              {/* Macro Tiles */}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.04] py-2.5 border border-white/5">
                  <span className="block font-mono text-[8px] text-white/30">P</span>
                  <span
                    className="mt-0.5 block font-display text-xs font-black"
                    style={{ color: 'var(--macro-protein)' }}
                  >
                    {Math.round(metrics.proteinConsumed)}g
                  </span>
                  <span className="block text-[8px] text-white/30">/ {Math.round(metrics.proteinTarget)}g</span>
                </div>

                <div className="rounded-xl bg-white/[0.04] py-2.5 border border-white/5">
                  <span className="block font-mono text-[8px] text-white/30">C</span>
                  <span
                    className="mt-0.5 block font-display text-xs font-black"
                    style={{ color: 'var(--macro-carbs)' }}
                  >
                    {Math.round(metrics.carbsConsumed)}g
                  </span>
                  <span className="block text-[8px] text-white/30">/ {Math.round(metrics.carbsTarget)}g</span>
                </div>

                <div className="rounded-xl bg-white/[0.04] py-2.5 border border-white/5">
                  <span className="block font-mono text-[8px] text-white/30">F</span>
                  <span className="mt-0.5 block font-display text-xs font-black" style={{ color: 'var(--macro-fat)' }}>
                    {Math.round(metrics.fatConsumed)}g
                  </span>
                  <span className="block text-[8px] text-white/30">/ {Math.round(metrics.fatTarget)}g</span>
                </div>
              </div>
            </div>

            {/* Right: Scheduled Meals with ACTUAL IMAGES */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-2.5">
              {hasApprovedMeals ? (
                meals.map((meal) => {
                  const isCompleted = meal.mealLogs?.some((log) => log.status === 'DONE');
                  const isSkipped = meal.mealLogs?.some((log) => log.status === 'SKIPPED');

                  const statusBadge = isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-brand-accent border border-brand-accent/30">
                      <Check className="h-2.5 w-2.5 stroke-[3]" /> Eaten
                    </span>
                  ) : isSkipped ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-red-400 border border-red-500/30">
                      <X className="h-2.5 w-2.5 stroke-[3]" /> Skipped
                    </span>
                  ) : meal.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-brand-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Review
                    </span>
                  );

                  return (
                    <div
                      key={meal.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onMealClick(meal.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onMealClick(meal.id);
                        }
                      }}
                      className={`group flex w-full cursor-pointer items-center gap-3.5 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                        isCompleted ? 'opacity-80' : isSkipped ? 'opacity-55' : ''
                      }`}
                    >
                      {/* Actual Meal Image Thumbnail */}
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#09110e]">
                        <MealImage
                          image={meal.image}
                          mealName={meal.mealName}
                          mealType={meal.mealType}
                          ingredients={meal.ingredients}
                          className="h-full w-full"
                          variant="thumbnail"
                        />
                      </div>

                      {/* Meal Title & Metadata */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-display text-xs font-bold transition-colors group-hover:text-brand-accent ${
                            isCompleted ? 'line-through text-white/70' : 'text-white/95'
                          }`}
                        >
                          {meal.mealName}
                        </p>
                        <p className="mt-1 text-[10px] text-white/40">
                          {Math.round(meal.calories)} kcal · {Math.round(meal.proteinG)}g P ·{' '}
                          {meal.mealType.toLowerCase()}
                        </p>
                      </div>

                      {/* Status & Chevron */}
                      <div className="flex shrink-0 items-center gap-2">
                        {onStatusToggle && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onStatusToggle(meal.id, isCompleted ? 'PENDING' : 'DONE');
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-colors ${
                              isCompleted
                                ? 'border-brand-accent/40 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30'
                                : 'border-white/10 bg-white/5 text-white/40 hover:border-brand-accent/30 hover:bg-brand-accent/15 hover:text-brand-accent'
                            }`}
                            title={isCompleted ? 'Mark as not eaten' : 'Mark as eaten'}
                            aria-label={
                              isCompleted ? `Mark ${meal.mealName} as not eaten` : `Mark ${meal.mealName} as eaten`
                            }
                          >
                            <Check className={`h-3.5 w-3.5 ${isCompleted ? 'stroke-[3]' : 'stroke-[2]'}`} />
                          </button>
                        )}
                        <div className="text-right">
                          {statusBadge}
                          <ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/75" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : hasPendingMeals ? (
                pendingMeals.map((meal, index) => (
                  <div
                    key={`${meal.scheduledDate}-${meal.mealType}-${index}`}
                    className="flex w-full items-center gap-3.5 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3 text-left"
                  >
                    {/* Fallback Thumbnail */}
                    <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#09110e]">
                      <MealImage
                        mealName={meal.mealName}
                        mealType={meal.mealType}
                        ingredients={meal.ingredients}
                        className="h-full w-full"
                        variant="thumbnail"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-xs font-bold text-white/90">{meal.mealName}</p>
                      <p className="mt-1 text-[10px] text-white/40">
                        {Math.round(meal.calories)} kcal · {Math.round(meal.proteinG)}g P ·{' '}
                        {meal.mealType.toLowerCase()}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Review
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                  <p className="text-xs font-semibold text-white/50">No meals scheduled for this day offset.</p>
                  <button
                    type="button"
                    onClick={onOpenWeeklyPlan}
                    className="mt-3 text-xs font-bold text-brand-green hover:underline"
                  >
                    Browse full 7-day schedule &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Strip: 4 Live Metric Tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
            {/* 1. Hydration */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/35">Hydration</span>
                <Droplets className="h-3 w-3 text-brand-cyan" />
              </div>
              <p className="mt-1 text-xs font-bold text-white/90">{waterIntake} / 2500 mL</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onAddWater(-250)}
                  className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-white/70 hover:bg-white/10 transition-colors"
                >
                  -250
                </button>
                <button
                  type="button"
                  onClick={() => onAddWater(250)}
                  className="rounded border border-brand-green/30 bg-brand-green/15 px-2 py-0.5 text-[9px] font-bold text-brand-green hover:bg-brand-green/25 transition-colors"
                >
                  +250
                </button>
              </div>
            </div>

            {/* 2. Weight Goals */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/35">Weight Goal</span>
                <Scale className="h-3 w-3 text-brand-accent" />
              </div>
              <p className="mt-1 text-xs font-bold text-white/90">
                {profile?.weightKg ?? '--'} <span className="text-[10px] font-normal text-white/40">kg</span>
              </p>
              <p className="mt-1 text-[9px] text-white/40 truncate">
                {profile?.targetWeightKg ? `Target: ${profile.targetWeightKg} kg` : 'Maintenance goal'}
              </p>
            </div>

            {/* 3. Plan Streak */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/35">Plan Streak</span>
                <Flame className="h-3 w-3 text-amber-400" />
              </div>
              <p className="mt-1 text-xs font-bold text-white/90">
                {checkinStreak} {checkinStreak === 1 ? 'Week' : 'Weeks'}
              </p>
              <p className="mt-1 text-[9px] text-white/40">Streak active</p>
            </div>

            {/* 4. Check-in Status */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/35">Check-In</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${checkinDue ? 'bg-brand-accent animate-ping' : 'bg-white/40'}`}
                />
              </div>
              <p className="mt-1 text-xs font-bold text-white/90">{checkinDue ? 'Due Today' : 'Upcoming'}</p>
              {checkinDue ? (
                <button
                  type="button"
                  onClick={onOpenCheckin}
                  className="mt-1 text-[9px] font-bold text-brand-accent underline hover:text-brand-accent/80"
                >
                  Start check-in &rarr;
                </button>
              ) : (
                <p className="mt-1 text-[9px] text-white/40">Weekly audit</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
