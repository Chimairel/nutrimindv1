/**
 * This version identifies the exact calculation policy presented for external
 * clinical approval. Changing any value requires a new version and sign-off.
 */
export const CLINICAL_NUTRITION_POLICY_VERSION = 'NUTRIMIND_CLINICAL_DRAFT_V1';

export const CLINICAL_NUTRITION_POLICY = Object.freeze({
  minimumDailyCalories: 500,
  goalAdjustmentsKcal: Object.freeze({
    LOSE_WEIGHT: -500,
    GAIN_WEIGHT: 500,
    MAINTAIN: 0,
    BUILD_MUSCLE: 300,
  }),
});
