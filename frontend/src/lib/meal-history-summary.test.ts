import { describe, expect, it } from 'vitest';
import { summarizeMealIntake } from './meal-history-summary';

describe('consumed meal history totals', () => {
  const eaten = { status: 'DONE', calories: 520, proteinG: 28, carbsG: 65, fatG: 14 };

  it('counts only DONE meals without removing skipped or pending logs', () => {
    const logs = [eaten, { ...eaten, status: 'SKIPPED' }, { ...eaten, status: 'PENDING' }];
    expect(summarizeMealIntake(logs)).toEqual({
      totalCalories: 520,
      totalProtein: 28,
      totalCarbs: 65,
      totalFat: 14,
    });
    expect(logs.map((log) => log.status)).toEqual(['DONE', 'SKIPPED', 'PENDING']);
  });

  it('reports zero consumed nutrients when every meal was skipped', () => {
    expect(summarizeMealIntake([{ ...eaten, status: 'SKIPPED' }])).toEqual({
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    });
  });
});
