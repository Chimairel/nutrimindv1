export const NUTRITION_REFERENCE_CALCULATION_VERSION = 'NUTRITION_REFERENCE_DRAFT_V1';

export const NUTRITION_REFERENCE_SOURCES = Object.freeze({
  PDRI_2015_REVISED_2018: 'DOST_FNRI_PDRI_2015_REV_2018',
  ADA_FIBER_2026: 'ADA_STANDARDS_2026_FIBER',
  AHA_SATURATED_FAT: 'AHA_SATURATED_FAT_6_PERCENT',
  KDIGO_CKD_2024: 'KDIGO_CKD_2024',
});

interface Range {
  minimum: number;
  maximum: number;
  unit: string;
}

export interface NutritionReferenceCalculation {
  policyVersion: string;
  dailyCalories: number;
  filipinoAdultAmdr: {
    proteinG: Range;
    fatG: Range;
    carbohydrateG: Range;
    sourceId: string;
  };
  diabetesReviewFiberG: {
    value: number;
    coefficientPer1000Kcal: number;
    sourceId: string;
    authority: 'REVIEW_ASSISTANCE_ONLY';
  };
  cardiovascularReviewSaturatedFatG: {
    value: number;
    percentOfEnergy: number;
    sourceId: string;
    authority: 'REVIEW_ASSISTANCE_ONLY';
  };
  ckdReviewProteinG?: {
    value: number;
    coefficientPerKg: number;
    bodyWeightKg: number;
    sourceId: string;
    authority: 'REVIEW_ASSISTANCE_ONLY';
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function energyPercentRange(dailyCalories: number, minimumPercent: number, maximumPercent: number, kcalPerGram: 4 | 9) {
  return {
    minimum: round((dailyCalories * (minimumPercent / 100)) / kcalPerGram),
    maximum: round((dailyCalories * (maximumPercent / 100)) / kcalPerGram),
    unit: 'g/day',
  };
}

/**
 * Calculates source-backed reference values from the user's current energy
 * and weight. These values support explanation and RND review. They do not
 * create condition clearance on their own.
 */
export function calculateNutritionReferences(input: {
  dailyCalories: number;
  bodyWeightKg?: number | null;
}): NutritionReferenceCalculation {
  if (!Number.isFinite(input.dailyCalories) || input.dailyCalories <= 0) {
    throw new Error('A positive daily calorie target is required.');
  }
  if (input.bodyWeightKg !== null && input.bodyWeightKg !== undefined) {
    if (!Number.isFinite(input.bodyWeightKg) || input.bodyWeightKg <= 0)
      throw new Error('Body weight must be a positive finite value when provided.');
  }

  const ckdReviewProteinG = input.bodyWeightKg
    ? {
        value: round(input.bodyWeightKg * 0.8),
        coefficientPerKg: 0.8,
        bodyWeightKg: input.bodyWeightKg,
        sourceId: NUTRITION_REFERENCE_SOURCES.KDIGO_CKD_2024,
        authority: 'REVIEW_ASSISTANCE_ONLY' as const,
      }
    : undefined;

  return {
    policyVersion: NUTRITION_REFERENCE_CALCULATION_VERSION,
    dailyCalories: input.dailyCalories,
    filipinoAdultAmdr: {
      proteinG: energyPercentRange(input.dailyCalories, 10, 15, 4),
      fatG: energyPercentRange(input.dailyCalories, 15, 30, 9),
      carbohydrateG: energyPercentRange(input.dailyCalories, 55, 75, 4),
      sourceId: NUTRITION_REFERENCE_SOURCES.PDRI_2015_REVISED_2018,
    },
    diabetesReviewFiberG: {
      value: round((input.dailyCalories / 1000) * 14),
      coefficientPer1000Kcal: 14,
      sourceId: NUTRITION_REFERENCE_SOURCES.ADA_FIBER_2026,
      authority: 'REVIEW_ASSISTANCE_ONLY',
    },
    cardiovascularReviewSaturatedFatG: {
      value: round((input.dailyCalories * 0.06) / 9),
      percentOfEnergy: 6,
      sourceId: NUTRITION_REFERENCE_SOURCES.AHA_SATURATED_FAT,
      authority: 'REVIEW_ASSISTANCE_ONLY',
    },
    ckdReviewProteinG,
  };
}
