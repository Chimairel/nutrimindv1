'use client';

import type { OutsideMealModalProps as Props } from '../outside-meal-modal.types';
import Button from '@/components/ui/Button';

import RiceAccompanimentSelect from '@/components/user/RiceAccompanimentSelect';

import type { MealType } from '@/types';

import { mealLabels } from '@/features/dashboard/outside-meal/OutsideMealForm.shared';

import { useOutsideMealFormModel } from '@/features/dashboard/outside-meal/useOutsideMealFormModel';
import OutsideMealSearchSection from '@/features/dashboard/outside-meal/OutsideMealSearchSection';
import OutsideMealNutritionSection from '@/features/dashboard/outside-meal/OutsideMealNutritionSection';
import OutsideMealPhotoSection from '@/features/dashboard/outside-meal/OutsideMealPhotoSection';
import OutsideMealConfirmationSection from '@/features/dashboard/outside-meal/OutsideMealConfirmationSection';
export default function OutsideMealForm(props: Props) {
  const model = useOutsideMealFormModel(props);

  const {
    handleSubmit,
    setRiceGrams,
    selectedSuggestion,
    baseNutrition,
    portionGrams,
    riceReference,
    selectedRicePairing,
    riceGrams,
    ricePlatePreview,
    imageError,
  } = model;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
      className="text-left"
    >
      <fieldset disabled={props.isLoading} className="flex min-w-0 flex-col gap-3.5">
        {/* 1. Meal Category Segmented Control */}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-semibold text-brand-muted">
            When did you eat it? <span className="text-brand-muted/60 text-[11px] font-normal">(required)</span>
          </legend>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border border-brand-border/70 bg-brand-bgAlt/50 text-center text-xs font-semibold">
            {(Object.keys(mealLabels) as MealType[]).map((type) => {
              const isSelected = props.mealType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => props.onMealTypeChange(type)}
                  className={`rounded-lg py-1.5 px-1 text-xs font-bold outline-none transition-all duration-150 ${
                    isSelected
                      ? 'bg-brand-green text-white shadow-xs dark:bg-brand-accent dark:text-[#07100d]'
                      : 'text-brand-muted hover:text-brand-text hover:bg-brand-surface/70'
                  }`}
                >
                  {mealLabels[type]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Food or Meal Eaten with Autocomplete + Inline Portion */}
        <OutsideMealSearchSection model={model} />

        {/* 3. Nutritional Values (Estimated) */}
        <OutsideMealNutritionSection model={model} />

        {riceReference && baseNutrition && (
          <div className="space-y-1.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/30 p-2.5">
            {selectedRicePairing === 'RICE_INCLUDED' && (
              <p className="text-[11px] text-brand-muted">
                The recipe estimate already includes its listed rice. If your rice portion differs, edit the nutrition
                estimate above. Use this field only for rice added beyond the recipe serving.
              </p>
            )}
            <RiceAccompanimentSelect
              id="outside-meal-rice"
              grams={riceGrams}
              onChange={setRiceGrams}
              rice={riceReference}
              extra={selectedRicePairing === 'RICE_INCLUDED'}
            />
            {ricePlatePreview && (
              <p className="text-xs font-semibold text-brand-text">
                Plate preview: {Math.round(ricePlatePreview.calories)} kcal ·{' '}
                {Math.round(ricePlatePreview.carbsG * 10) / 10}g carbs. Rice appears as its own FNRI item in the
                confirmation.
              </p>
            )}
          </div>
        )}

        {/* 4. Side-by-Side Reference Block: Photo Upload on Left, Notes on Right */}
        <OutsideMealPhotoSection model={model} />

        {/* 5. AI Assistant Fallback */}
        <OutsideMealConfirmationSection model={model} />

        {/* 6. Primary action: preview recorded values (Sticky Bottom on Mobile & Small Screens) */}
        <div className="sticky bottom-0 -mx-6 -mb-6 bg-brand-surface/95 backdrop-blur-md px-6 py-3 border-t border-brand-border/60 z-20 flex flex-col gap-2">
          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-xs font-black uppercase tracking-wider rounded-xl shadow-neon"
            disabled={
              props.isLoading ||
              !props.mealName.trim() ||
              Boolean(imageError) ||
              (selectedSuggestion?.kind === 'FNRI_FOOD' && !(Number(portionGrams) > 0))
            }
          >
            Preview nutrition
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
