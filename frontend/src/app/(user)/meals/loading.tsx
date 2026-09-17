import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';

export default function MealsLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <MealPlanSkeleton />
      </div>
    </div>
  );
}
