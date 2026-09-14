import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import MealCard from '@/components/user/MealCard';
import PendingMealPreviewCard from '@/components/user/PendingMealPreviewCard';
import ClinicalReviewBanner from '@/components/shared/ClinicalReviewBanner';
import type { MealPlan } from '@/types';
import { getManilaDateKey } from '@/lib/manila-date';
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
      <section className="order-2 flex flex-col gap-6" aria-label="Pending meal review">
        <ClinicalReviewBanner />
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
