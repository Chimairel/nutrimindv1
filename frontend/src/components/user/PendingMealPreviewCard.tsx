import React from 'react';
import {
  Apple,
  CalendarDays,
  Clock3,
  Coffee,
  MoonStar,
  ShieldAlert,
  SunMedium,
  UtensilsCrossed,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';

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
}

export default function PendingMealPreviewCard({ meal }: { meal: PendingMealPreview }) {
  const mealTypeStyles: Record<string, {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClassName: string;
    iconSurfaceClassName: string;
  }> = {
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
    icon: UtensilsCrossed,
    iconClassName: 'text-brand-green',
    iconSurfaceClassName: 'border-brand-green/20 bg-brand-green/10',
  };
  const MealTypeIcon = typeStyle.icon;
  const scheduledDate = new Date(meal.scheduledDate).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const visibleIngredients = meal.ingredients.slice(0, 5);
  const remainingIngredientCount = Math.max(0, meal.ingredients.length - visibleIngredients.length);

  return (
    <article className="group relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface text-left shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-green/30 hover:shadow-card-hover">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-accent via-brand-green to-brand-green/30" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${typeStyle.iconSurfaceClassName}`}>
            <MealTypeIcon className={`h-5 w-5 ${typeStyle.iconClassName}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-muted">
              {typeStyle.label}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-brand-muted">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{scheduledDate}</span>
            </div>
          </div>
        </div>
        <Badge variant="pending" className="shrink-0 px-2.5 py-1 text-[10px] font-bold">
          Pending
        </Badge>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        <h3 className="font-display text-xl font-black leading-tight tracking-tight text-brand-text">
          {meal.mealName}
        </h3>

        {meal.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-brand-muted">
            {meal.description}
          </p>
        )}

        <div className="mt-5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/55 p-3.5">
          <div className="flex items-end justify-between gap-3 border-b border-brand-border/50 pb-3">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
                Estimated energy
              </p>
              <p className="mt-1 font-display text-2xl font-black leading-none text-brand-text">
                {Math.round(meal.calories)}
                <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-brand-muted">kcal</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-status-pending-text">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Unverified
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border px-2 py-2 text-center" style={{ backgroundColor: 'var(--macro-protein-bg)', borderColor: 'var(--macro-protein-border)' }}>
              <span className="block font-display text-sm font-black" style={{ color: 'var(--macro-protein)' }}>{Math.round(meal.proteinG)}g</span>
              <span className="mt-0.5 block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">Protein</span>
            </div>
            <div className="rounded-xl border px-2 py-2 text-center" style={{ backgroundColor: 'var(--macro-carbs-bg)', borderColor: 'var(--macro-carbs-border)' }}>
              <span className="block font-display text-sm font-black" style={{ color: 'var(--macro-carbs)' }}>{Math.round(meal.carbsG)}g</span>
              <span className="mt-0.5 block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">Carbs</span>
            </div>
            <div className="rounded-xl border px-2 py-2 text-center" style={{ backgroundColor: 'var(--macro-fat-bg)', borderColor: 'var(--macro-fat-border)' }}>
              <span className="block font-display text-sm font-black" style={{ color: 'var(--macro-fat)' }}>{Math.round(meal.fatG)}g</span>
              <span className="mt-0.5 block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">Fat</span>
            </div>
          </div>
        </div>

        {visibleIngredients.length > 0 && (
          <div className="mt-4">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
              Proposed ingredients
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleIngredients.map((ingredient, index) => (
                <span
                  key={`${ingredient.ingredientName}-${index}`}
                  className="max-w-full truncate rounded-full border border-brand-border/60 bg-brand-bg px-2.5 py-1 text-[10px] font-semibold text-brand-muted"
                  title={ingredient.ingredientName}
                >
                  {ingredient.ingredientName}
                </span>
              ))}
              {remainingIngredientCount > 0 && (
                <span className="rounded-full border border-brand-green/20 bg-brand-green/5 px-2.5 py-1 text-[10px] font-bold text-brand-green">
                  +{remainingIngredientCount} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-start gap-2.5 border-t border-status-pending-text/15 bg-status-pending-bg/35 px-5 py-3.5 text-status-pending-text">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-[10px] font-semibold leading-relaxed">
          <span className="font-extrabold">Not nutritionist verified.</span>{' '}
          Logging, swaps, nutrition totals, and groceries stay disabled until approval.
        </p>
      </div>
    </article>
  );
}
