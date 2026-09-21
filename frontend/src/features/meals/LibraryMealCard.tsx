import type { MealPlan, PublicVerifier } from '@/types';
import type { SwapOption } from './useMealsWorkspace';
import MealImage from '@/components/user/MealImage';
import { formatManilaDate } from '@/lib/manila-date';

export default function LibraryMealCard({
  meal,
  meals,
  onSwap,
  onVerifier,
}: {
  meal: SwapOption;
  meals: MealPlan[];
  onSwap: (id: string, meal: SwapOption) => Promise<void>;
  onVerifier: (verifier: PublicVerifier) => void;
}) {
  const slots = meals.filter(
    (slot) =>
      slot.mealType === meal.mealType &&
      !slot.mealLogs?.some((log) => log.status === 'DONE' || log.status === 'SKIPPED')
  );
  return (
    <article className="flex flex-col gap-4 rounded-[22px] border border-brand-border bg-brand-surface p-5 shadow-sm">
      <MealImage
        image={meal.image}
        mealName={meal.mealName}
        mealType={meal.mealType}
        className="h-36 w-full"
        showAttributionLinks
      />
      <div className="flex justify-between text-xs font-bold text-brand-green">
        <span>{meal.mealType}</span>
        <span>{meal.calories} kcal</span>
      </div>
      <h3 className="text-sm font-bold text-brand-text">{meal.mealName}</h3>
      {meal.description && <p className="text-xs text-brand-muted">{meal.description}</p>}
      <p className="text-xs text-brand-muted">
        Protein {meal.proteinG} g · Carbs {meal.carbsG} g · Fat {meal.fatG} g
      </p>
      <label className="block text-xs font-semibold">
        Swap into your meal plan
        <select
          aria-label={'Choose slot for ' + meal.mealName}
          value=""
          onChange={(event) => onSwap(event.target.value, meal)}
          className="mt-1 w-full rounded-lg border border-brand-border bg-brand-surface p-2"
        >
          <option value="">Choose an uneaten meal to replace</option>
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {formatManilaDate(slot.scheduledDate, { month: 'short', day: 'numeric' })} · {slot.mealName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!meal.verifier}
        onClick={() => meal.verifier && onVerifier(meal.verifier)}
        className="text-left text-xs text-brand-green underline"
      >
        Verified by {meal.verifiedBy} · PRC {meal.prcLicenseNumber}
      </button>
    </article>
  );
}
