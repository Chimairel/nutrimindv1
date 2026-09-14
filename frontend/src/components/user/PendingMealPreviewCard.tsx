'use client';

import React, { useState } from 'react';
import { Apple, CalendarDays, Clock3, Coffee, MoonStar, ShieldAlert, SunMedium, Soup } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import MealImage from './MealImage';
import type { PublicMealImage } from '@/types';

export interface PendingMealPreview {
  mealName: string;
  mealType: string;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scheduledDate: string;
  ingredients: { ingredientName: string; category: string }[];
  image?: PublicMealImage | null;
}

export default function PendingMealPreviewCard({ meal }: { meal: PendingMealPreview }) {
  const [isOpen, setIsOpen] = useState(false);

  const mealTypeStyles: Record<
    string,
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      iconClassName: string;
      iconSurfaceClassName: string;
    }
  > = {
    BREAKFAST: {
      label: 'Breakfast',
      icon: Coffee,
      iconClassName: 'text-brand-green',
      iconSurfaceClassName: 'border-brand-accent/45 bg-brand-accent/15',
    },
    LUNCH: {
      label: 'Lunch',
      icon: SunMedium,
      iconClassName: 'text-brand-green',
      iconSurfaceClassName: 'border-brand-green/20 bg-brand-green/10',
    },
    DINNER: {
      label: 'Dinner',
      icon: MoonStar,
      iconClassName: 'text-brand-violet',
      iconSurfaceClassName: 'border-brand-violet/25 bg-brand-violet/10',
    },
    SNACK: {
      label: 'Snack',
      icon: Apple,
      iconClassName: 'text-brand-green dark:text-brand-cyan',
      iconSurfaceClassName: 'border-brand-cyan/25 bg-brand-cyan/10',
    },
  };

  const typeStyle = mealTypeStyles[meal.mealType] ?? {
    label: meal.mealType.toLowerCase(),
    icon: Soup,
    iconClassName: 'text-brand-green',
    iconSurfaceClassName: 'border-brand-green/20 bg-brand-green/10',
  };
  const MealTypeIcon = typeStyle.icon;
  const scheduledDate = new Date(meal.scheduledDate).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Open ${meal.mealName} details`}
        className="block h-full w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg"
      >
        <Card
          interactive
          className="border border-brand-border/70 bg-brand-surface h-full transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green/30 hover:shadow-card-hover"
          contentClassName="flex h-full flex-col justify-between p-4 sm:p-5"
        >
          {/* Card Top: Image */}
          <MealImage
            image={meal.image}
            mealName={meal.mealName}
            mealType={meal.mealType}
            className="mb-3.5 h-36 w-full"
            variant="compact"
            ingredients={meal.ingredients}
          />

          {/* Card Meta Row: Meal Type & Pending Badge */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <MealTypeIcon className={`h-4 w-4 ${typeStyle.iconClassName}`} />
              <span className="text-[10px] font-extrabold tracking-wider text-brand-muted uppercase">
                {typeStyle.label}
              </span>
            </div>

            <Badge
              variant="pending"
              showIcon={false}
              className="text-[9px] font-extrabold py-0.5 px-2 bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-1 uppercase"
            >
              <Clock3 className="h-2.5 w-2.5" /> Pending
            </Badge>
          </div>

          {/* Card Body: Meal Title & Compact Nutrition */}
          <div className="flex-1 flex flex-col justify-between">
            <h3 className="text-sm font-extrabold font-display tracking-tight leading-snug mb-1 text-brand-text line-clamp-2">
              {meal.mealName}
            </h3>

            <div className="mt-3 flex items-center justify-between border-t border-brand-border/40 pt-2.5">
              <span className="text-[11px] font-bold text-brand-muted">
                {Math.round(meal.calories)} kcal · {Math.round(meal.proteinG)}g P · {Math.round(meal.carbsG)}g C · {Math.round(meal.fatG)}g F
              </span>
              <span className="text-[11px] font-extrabold text-brand-green">View &rarr;</span>
            </div>
          </div>
        </Card>
      </button>

      {/* Detailed Info Modal (Slug) */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`${typeStyle.label} Details`} size="md">
        <div className="flex flex-col gap-5 text-left select-none p-1">
          <MealImage
            image={meal.image}
            mealName={meal.mealName}
            mealType={meal.mealType}
            className="h-48 sm:h-56 w-full rounded-2xl"
            variant="hero"
            ingredients={meal.ingredients}
          />

          {/* Title & Metadata */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <MealTypeIcon className={`h-4 w-4 ${typeStyle.iconClassName}`} />
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand-muted">
                  {typeStyle.label}
                </span>
                <span className="text-xs text-brand-muted">·</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-brand-muted">
                  <CalendarDays className="h-3 w-3" />
                  {scheduledDate}
                </span>
              </div>
              <h3 className="text-xl font-black font-display text-brand-text tracking-tight">{meal.mealName}</h3>
            </div>
            <Badge variant="pending" className="px-3 py-1 text-[10px] font-bold shrink-0">
              Pending review
            </Badge>
          </div>

          {meal.description && (
            <p className="text-sm text-brand-muted leading-relaxed">{meal.description}</p>
          )}

          {/* Energy & Macro Breakdown Box */}
          <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/55 p-4">
            <div className="flex items-end justify-between gap-3 border-b border-brand-border/50 pb-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">Estimated energy</p>
                <p className="mt-1 font-display text-2xl font-black leading-none text-brand-text">
                  {Math.round(meal.calories)}
                  <span className="ml-1 text-xs font-bold uppercase tracking-wider text-brand-muted">kcal</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <Clock3 className="h-4 w-4" />
                Awaiting RND review
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div
                className="rounded-xl border p-2.5 text-center"
                style={{ backgroundColor: 'var(--macro-protein-bg)', borderColor: 'var(--macro-protein-border)' }}
              >
                <span className="block font-display text-base font-black" style={{ color: 'var(--macro-protein)' }}>
                  {Math.round(meal.proteinG)}g
                </span>
                <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                  Protein
                </span>
              </div>
              <div
                className="rounded-xl border p-2.5 text-center"
                style={{ backgroundColor: 'var(--macro-carbs-bg)', borderColor: 'var(--macro-carbs-border)' }}
              >
                <span className="block font-display text-base font-black" style={{ color: 'var(--macro-carbs)' }}>
                  {Math.round(meal.carbsG)}g
                </span>
                <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                  Carbs
                </span>
              </div>
              <div
                className="rounded-xl border p-2.5 text-center"
                style={{ backgroundColor: 'var(--macro-fat-bg)', borderColor: 'var(--macro-fat-border)' }}
              >
                <span className="block font-display text-base font-black" style={{ color: 'var(--macro-fat)' }}>
                  {Math.round(meal.fatG)}g
                </span>
                <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                  Fat
                </span>
              </div>
            </div>
          </div>

          {/* Proposed Ingredients */}
          {meal.ingredients && meal.ingredients.length > 0 && (
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-muted mb-2.5">
                Proposed Ingredients ({meal.ingredients.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {meal.ingredients.map((ing, idx) => (
                  <span
                    key={`${ing.ingredientName}-${idx}`}
                    className="rounded-full border border-brand-border/70 bg-brand-surface px-3 py-1 text-xs font-semibold text-brand-text"
                  >
                    {ing.ingredientName}
                    {ing.category ? (
                      <span className="ml-1 text-[10px] text-brand-muted font-normal">({ing.category})</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Review Notice Banner */}
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 flex items-start gap-3 text-xs text-brand-muted">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-brand-text block mb-0.5">Clinical Review in Progress</strong>
              This recommendation is generated by NutriMind AI and is currently in preview while a PRC-licensed nutritionist verifies it. Logging, meal swaps, and groceries become active once approved.
            </div>
          </div>

          <div className="mt-1 flex justify-end">
            <Button variant="secondary" onClick={() => setIsOpen(false)} className="text-xs font-bold">
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
