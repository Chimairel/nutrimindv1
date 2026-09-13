'use client';

import React, { useState } from 'react';
import { Egg, Flame, Apple, UtensilsCrossed, Check, X, Clock3, Loader2 } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { MealPlan } from '@/types';
import Button from '@/components/ui/Button';

interface UnloggedMealCatchUpCardProps {
  meal: MealPlan;
  onStatusToggle: (mealPlanId: string, status: 'DONE' | 'SKIPPED') => Promise<void>;
  className?: string;
}

export default function UnloggedMealCatchUpCard({
  meal,
  onStatusToggle,
  className = '',
}: UnloggedMealCatchUpCardProps) {
  const [isUpdating, setIsUpdating] = useState<'DONE' | 'SKIPPED' | null>(null);

  const mealType = meal.mealType || 'LUNCH';

  const mealTypeConfigs: Record<
    string,
    {
      label: string;
      icon: React.ComponentType<LucideProps>;
      iconColor: string;
      glowSurface: string;
    }
  > = {
    BREAKFAST: {
      label: 'Breakfast',
      icon: Egg,
      iconColor: 'text-amber-700 dark:text-amber-400',
      glowSurface:
        'bg-gradient-to-br from-amber-100/90 via-amber-50 to-white/90 border border-amber-200/80 shadow-[0_4px_14px_rgba(245,158,11,0.1)] dark:from-amber-950/30 dark:via-amber-900/10 dark:to-transparent dark:border-amber-700/25',
    },
    LUNCH: {
      label: 'Lunch',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400',
      glowSurface:
        'bg-gradient-to-br from-rose-100/90 via-rose-50 to-white/90 border border-rose-200/80 shadow-[0_4px_14px_rgba(244,63,94,0.1)] dark:from-rose-950/30 dark:via-rose-900/10 dark:to-transparent dark:border-rose-700/25',
    },
    DINNER: {
      label: 'Dinner',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400',
      glowSurface:
        'bg-gradient-to-br from-rose-100/90 via-rose-50 to-white/90 border border-rose-200/80 shadow-[0_4px_14px_rgba(244,63,94,0.1)] dark:from-rose-950/30 dark:via-rose-900/10 dark:to-transparent dark:border-rose-700/25',
    },
    SNACK: {
      label: 'Snack',
      icon: Apple,
      iconColor: 'text-brand-green dark:text-brand-accent',
      glowSurface:
        'bg-gradient-to-br from-emerald-100/90 via-emerald-50 to-white/90 border border-emerald-200/80 shadow-[0_4px_14px_rgba(16,185,129,0.1)] dark:from-emerald-950/30 dark:via-emerald-900/10 dark:to-transparent dark:border-emerald-700/25',
    },
  };

  const config = mealTypeConfigs[mealType] || {
    label: 'Meal',
    icon: UtensilsCrossed,
    iconColor: 'text-brand-green',
    glowSurface: 'bg-brand-bgAlt border border-brand-border',
  };

  const IconComponent = config.icon;

  const handleAction = async (status: 'DONE' | 'SKIPPED') => {
    if (isUpdating) return;
    setIsUpdating(status);
    try {
      await onStatusToggle(meal.id, status);
    } catch (err) {
      console.error('[UnloggedMealCatchUpCard] Failed to toggle status:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[22px] border border-dashed border-amber-500/30 bg-brand-surface/90 p-4 transition-all hover:border-amber-500/50 hover:shadow-sm dark:border-amber-500/25 dark:bg-white/[0.03] ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.glowSurface}`}
        >
          <IconComponent className={`h-6 w-6 ${config.iconColor} stroke-[2]`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-extrabold text-brand-green dark:text-brand-accent tracking-wide uppercase">
              {config.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Clock3 className="h-2.5 w-2.5" />
              Unlogged
            </span>
          </div>

          <h4 className="font-display text-sm font-black text-brand-text dark:text-white truncate mt-0.5">
            {meal.mealName}
          </h4>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-brand-muted dark:text-white/40">
            <span className="font-mono text-brand-text dark:text-white/70">
              {Math.round(meal.calories)} kcal
            </span>
            <span>·</span>
            <span>{Math.round(meal.proteinG)}g P</span>
            <span>·</span>
            <span>{Math.round(meal.carbsG)}g C</span>
            <span>·</span>
            <span>{Math.round(meal.fatG)}g F</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-brand-border/40 sm:border-t-0">
        <Button
          variant="primary"
          onClick={() => handleAction('DONE')}
          disabled={isUpdating !== null}
          className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-bold gap-1.5 shadow-sm"
        >
          {isUpdating === 'DONE' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          )}
          <span>Mark as Eaten</span>
        </Button>

        <Button
          variant="ghost"
          onClick={() => handleAction('SKIPPED')}
          disabled={isUpdating !== null}
          className="flex-1 sm:flex-initial h-9 px-3 text-xs font-bold gap-1 text-red-600 hover:bg-red-500/10 border border-red-500/20 dark:text-red-400 dark:border-red-500/30"
        >
          {isUpdating === 'SKIPPED' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5 stroke-[2.5]" />
          )}
          <span>Skip</span>
        </Button>
      </div>
    </div>
  );
}
