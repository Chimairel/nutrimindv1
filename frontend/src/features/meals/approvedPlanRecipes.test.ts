import { describe, expect, it } from 'vitest';
import type { MealPlan } from '@/types';
import { groupApprovedPlanRecipes } from './approvedPlanRecipes';

describe('approved plan recipe grouping', () => {
  it('keeps recipe variants and unidentifiable legacy slots separate', () => {
    const base = {
      status: 'APPROVED', mealName: 'Chicken Adobo Fried Rice', mealType: 'BREAKFAST',
      calories: 721, proteinG: 17, carbsG: 62, fatG: 45,
    } as MealPlan;
    const meals = [
      { ...base, id: 'first', composedServingSignature: 'recipe-a' },
      { ...base, id: 'repeat', composedServingSignature: 'recipe-a' },
      { ...base, id: 'variant', composedServingSignature: 'recipe-b' },
      { ...base, id: 'legacy-one' },
      { ...base, id: 'legacy-two' },
    ];

    expect(groupApprovedPlanRecipes(meals).map(({ occurrences }) => occurrences.map(({ id }) => id))).toEqual([
      ['first', 'repeat'], ['variant'], ['legacy-one'], ['legacy-two'],
    ]);
  });
});
