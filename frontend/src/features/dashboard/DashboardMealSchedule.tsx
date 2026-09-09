import { AlertTriangle, Clock3, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import MealCard from '@/components/user/MealCard';
import PendingMealPreviewCard from '@/components/user/PendingMealPreviewCard';
import type { MealPlan } from '@/types';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';
import type { PendingReview } from './model';

type Props = {
  activeDate?: Date;
  approvedMeals: MealPlan[];
  onStatusToggle: (id: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void>;
  pendingReview: PendingReview | null;
};

export function DashboardMealSchedule({ activeDate, approvedMeals, onStatusToggle, pendingReview }: Props) {
  const router = useRouter();
  const pendingMeals =
    pendingReview?.meals.filter(
      (meal) => activeDate && getManilaDateKey(meal.scheduledDate) === getManilaDateKey(activeDate)
    ) ?? [];
  const mealCards = approvedMeals.map((meal) => (
    <MealCard
      key={meal.id}
      id={meal.id}
      mealName={meal.mealName}
      mealType={meal.mealType}
      description={meal.description || undefined}
      calories={meal.calories}
      proteinG={meal.proteinG}
      carbsG={meal.carbsG}
      fatG={meal.fatG}
      status={meal.status}
      aiConfidenceFlag={meal.aiConfidenceFlag}
      ingredients={meal.ingredients}
      mealLogs={meal.mealLogs}
      onStatusToggle={onStatusToggle}
      scheduledDate={meal.scheduledDate}
      verifier={meal.verifier}
      explanation={meal.explanation}
      image={meal.image}
      onCardClick={() => router.push(`/dashboard/${meal.id}`)}
    />
  ));

  if (pendingReview) {
    return (
      <section className="order-2 flex flex-col gap-6" aria-labelledby="pending-plan-heading">
        <div className="relative overflow-hidden rounded-[28px] border border-brand-green/20 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/10 p-5 text-left shadow-card md:p-6">
          <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-green">
                <Sparkles className="h-4 w-4" />
                AI plan generated
              </div>
              <h2
                id="pending-plan-heading"
                className="mt-2 font-display text-2xl font-black tracking-tight text-brand-text"
              >
                Review in progress
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Preview the {pendingMeals.length} meals scheduled for this date while a nutritionist reviews the
                remaining {pendingReview.mealCount} meal{pendingReview.mealCount === 1 ? '' : 's'} in your{' '}
                {pendingReview.planType === 'STARTER' ? 'starter' : 'weekly'} plan.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-status-pending-text/20 bg-status-pending-bg/40 px-4 py-3">
              <Clock3 className="h-4.5 w-4.5" />
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-status-pending-text">
                  Selected day
                </p>
                <p className="text-xs font-extrabold text-brand-text">
                  {activeDate && formatManilaDate(activeDate, { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          <div className="relative mt-4 flex items-start gap-2 border-t border-brand-border/50 pt-4 text-status-pending-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[11px] font-semibold leading-relaxed">
              Pending estimates are preview-only and excluded from verified calorie and macronutrient tracking.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pendingMeals.map((meal, index) => (
            <PendingMealPreviewCard key={`${meal.scheduledDate}-${meal.mealType}-${index}`} meal={meal} />
          ))}
        </div>
        {approvedMeals.length > 0 && (
          <div className="flex flex-col gap-4 text-left">
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-brand-text">
              Nutritionist-approved meals
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{mealCards}</div>
          </div>
        )}
      </section>
    );
  }

  const isToday = activeDate && getManilaDateKey(activeDate) === getManilaDateKey();
  return (
    <div className="order-2 flex flex-col gap-4 text-left">
      <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-brand-text">
        {isToday ? "Today's" : 'Scheduled'} Menu
      </h2>
      {approvedMeals.length === 0 ? (
        <Card className="border-brand-border/40 bg-brand-surface/20 p-8 text-center text-brand-muted">
          No meals scheduled for this day offset.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{mealCards}</div>
      )}
    </div>
  );
}
