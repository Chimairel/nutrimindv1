import { z } from 'zod';
import { isMealWithinSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { reconcileFnriMealTotals } from '@/domain/fnri-meal-totals.policy';
import { validateGeneratedDayCalories } from '@/domain/generated-plan-calories.policy';

type Slot = { dayNumber: number; mealType: string };
type Food = { id: string; source: string; calories: number; proteinG: number; carbsG: number; fatG: number };
export function buildMealGenerationResponseSchema(
  slots: readonly Slot[],
  dailyCalorieTarget: number,
  foods: readonly Food[],
  matched: readonly (Slot & { calories: number })[] = []
) {
  const ingredientSchema = z.object({
    foodItemId: z.string().trim().min(1).nullable(),
    name: z.string().trim().min(1),
    quantity: z.number().positive().max(10_000),
    unit: z.enum(['g', 'mL', 'piece', 'tbsp', 'tsp', 'cup', 'can', 'pack']),
  });
  const base = z.preprocess(
    (value) => {
      const envelope = Array.isArray(value) ? { meals: value } : value;
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return envelope;
      const record = envelope as Record<string, unknown>;
      if (!Array.isArray(record.meals)) return envelope;
      return {
        ...record,
        meals: record.meals.map((meal) => {
          if (!meal || typeof meal !== 'object' || Array.isArray(meal)) return meal;
          const mealRecord = meal as Record<string, unknown>;
          if (!Array.isArray(mealRecord.ingredients)) return meal;
          return {
            ...mealRecord,
            ingredients: mealRecord.ingredients.filter((ingredient) => {
              if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return false;
              const name = (ingredient as Record<string, unknown>).name;
              return typeof name === 'string' && name.trim().length > 0;
            }),
          };
        }),
      };
    },
    z.object({
      meals: z
        .array(
          z.object({
            dayNumber: z.number(),
            mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
            mealName: z.string(),
            description: z.string(),
            calories: z.number().positive(),
            proteinG: z.number().nonnegative(),
            carbsG: z.number().nonnegative(),
            fatG: z.number().nonnegative(),
            ingredients: z.array(ingredientSchema).min(1),
          })
        )
        .refine(
          (meals) => {
            if (meals.length !== slots.length) return false;
            return slots.every((slot) =>
              meals.some((m) => m.dayNumber === slot.dayNumber && m.mealType === slot.mealType)
            );
          },
          {
            message: `Must generate exactly the requested slots: ${JSON.stringify(slots.map((s) => ({ day: s.dayNumber, type: s.mealType })))}`,
          }
        )
        .refine(
          (meals) =>
            meals.every((meal) =>
              isMealWithinSlotCalorieRange({
                calories: meal.calories,
                dailyCalorieTarget,
                mealType: meal.mealType,
              })
            ),
          {
            message: 'Every generated meal must satisfy its allocated daily-calorie range.',
          }
        ),
    })
  );
  return base.superRefine(({ meals }, context) => {
    const finalMeals = meals.map((meal, index) => {
      for (const ingredient of meal.ingredients) {
        if (ingredient.foodItemId && !foods.some((food) => food.id === ingredient.foodItemId && food.source === 'FNRI'))
          context.addIssue({
            code: 'custom',
            path: ['meals', index, 'ingredients'],
            message: 'Use only supplied FNRI IDs or null.',
          });
      }
      const resolved = reconcileFnriMealTotals(meal.ingredients, foods);
      const calories = resolved.complete ? resolved.totals.calories : meal.calories;
      if (!isMealWithinSlotCalorieRange({ calories, dailyCalorieTarget, mealType: meal.mealType }))
        context.addIssue({
          code: 'custom',
          path: ['meals', index, 'calories'],
          message:
            'FNRI ingredient portions fall outside the allocated calorie range. Adjust portions, not the declared total.',
        });
      return { ...meal, calories };
    });
    for (const issue of validateGeneratedDayCalories([...matched, ...finalMeals], dailyCalorieTarget))
      context.addIssue({ code: 'custom', message: issue });
  });
}
