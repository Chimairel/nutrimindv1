import { OutsideMealCompatibilityStatus, OutsideMealItemSource } from '@prisma/client';

export type OutsideReviewQueueReason = 'USER_REQUEST' | 'SAFETY_CONFLICT' | 'LOW_CONFIDENCE' | 'IMPLAUSIBLE_VALUES';

export function outsideReviewQueueReason(
  item: {
    source: OutsideMealItemSource;
    compatibilityStatus: OutsideMealCompatibilityStatus;
    includedInTotals: boolean;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    calorieLow: number | null;
    calorieHigh: number | null;
  },
  _demoAllAi = false
): OutsideReviewQueueReason | null {
  if (item.compatibilityStatus === OutsideMealCompatibilityStatus.CONFLICT_DETECTED) return 'SAFETY_CONFLICT';
  if (
    item.includedInTotals &&
    item.calories !== null &&
    item.proteinG !== null &&
    item.carbsG !== null &&
    item.fatG !== null
  ) {
    const macroEnergy = item.proteinG * 4 + item.carbsG * 4 + item.fatG * 9;
    if (
      (item.calories === 0 && macroEnergy > 0) ||
      (item.calories > 0 && Math.abs(macroEnergy - item.calories) / item.calories > 0.5)
    )
      return 'IMPLAUSIBLE_VALUES';
    if (
      item.calories > 0 &&
      item.calorieLow !== null &&
      item.calorieHigh !== null &&
      (item.calorieHigh - item.calorieLow) / item.calories >= 0.45
    )
      return 'LOW_CONFIDENCE';
  }
  return null;
}
