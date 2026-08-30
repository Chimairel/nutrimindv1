import { z } from 'zod';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/domain/onboarding.policy';

const goalSchema = z.enum(['LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE']);
const activitySchema = z.enum(['SEDENTARY', 'LIGHTLY_ACTIVE', 'ACTIVE', 'VERY_ACTIVE']);
const dietarySchema = z.enum(['OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN']);
const carbSchema = z.enum(['LOW', 'MODERATE', 'HIGH']);
const sexSchema = z.enum(['MALE', 'FEMALE']);
const conditionSchema = z.enum(['DIABETES', 'HYPERTENSION', 'KIDNEY_DISEASE', 'HEART_CONDITION', 'PREGNANT', 'NONE']);
const allergySchema = z.enum(['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS', 'NONE']);

export const onboardingProfileSchema = z.object({
  age: z.coerce.number().int().min(18).max(100).optional(),
  biologicalSex: sexSchema.optional(),
  heightCm: z.coerce.number().min(100).max(250).optional(),
  weightKg: z.coerce.number().min(30).max(300).optional(),
  targetWeightKg: z.coerce.number().min(30).max(300).optional(),
  goal: goalSchema.optional(),
  activityLevel: activitySchema.optional(),
  dietaryPreference: dietarySchema.optional(),
  carbPreference: carbSchema.optional(),
  foodCulture: z.string().trim().min(1).max(80).optional(),
}).strict().superRefine((data, ctx) => {
  if (Object.keys(data).length === 0) {
    ctx.addIssue({ code: 'custom', message: 'At least one supported profile field is required.' });
  }
  if (data.weightKg === undefined || data.targetWeightKg === undefined || !data.goal) return;

  if ((data.goal === 'GAIN_WEIGHT' || data.goal === 'BUILD_MUSCLE') && data.targetWeightKg < data.weightKg) {
    ctx.addIssue({ code: 'custom', path: ['targetWeightKg'], message: 'Target weight must be at least the current weight for this goal.' });
  }
  if (data.goal === 'LOSE_WEIGHT' && data.targetWeightKg > data.weightKg) {
    ctx.addIssue({ code: 'custom', path: ['targetWeightKg'], message: 'Target weight must not exceed the current weight for this goal.' });
  }
  if (data.goal === 'MAINTAIN' && data.targetWeightKg !== data.weightKg) {
    ctx.addIssue({ code: 'custom', path: ['targetWeightKg'], message: 'Target weight must equal current weight for a maintain goal.' });
  }
});

function rejectNoneContradictions(values: readonly string[], ctx: z.RefinementCtx) {
  if (values.includes('NONE') && values.length > 1) {
    ctx.addIssue({ code: 'custom', message: 'NONE cannot be combined with another selection.' });
  }
}

export const onboardingConditionsSchema = z.object({
  conditions: z.array(conditionSchema).min(1).max(6),
  otherConditions: z.string().trim().max(500).optional(),
}).strict().superRefine((data, ctx) => {
  rejectNoneContradictions(data.conditions, ctx);
  if (data.conditions.includes('NONE') && data.otherConditions) {
    ctx.addIssue({ code: 'custom', path: ['otherConditions'], message: 'Custom conditions cannot be combined with NONE.' });
  }
});

export const onboardingAllergiesSchema = z.object({
  allergies: z.array(allergySchema).min(1).max(6),
  otherAllergies: z.string().trim().max(500).optional(),
}).strict().superRefine((data, ctx) => {
  rejectNoneContradictions(data.allergies, ctx);
  if (data.allergies.includes('NONE') && data.otherAllergies) {
    ctx.addIssue({ code: 'custom', path: ['otherAllergies'], message: 'Custom allergies cannot be combined with NONE.' });
  }
});

export const shoppingDaySchema = z.object({
  shoppingDayGroup: z.enum(['WEEKEND', 'WEEKDAY']),
}).strict();

export const consentSchema = z.object({
  termsVersion: z.literal(CURRENT_TERMS_VERSION),
  privacyVersion: z.literal(CURRENT_PRIVACY_VERSION),
  medicalDisclaimerAccepted: z.literal(true),
  privacyPolicyAccepted: z.literal(true),
  healthDataProcessingAccepted: z.literal(true),
}).strict();

export const emptyBodySchema = z.object({}).strict();

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type OnboardingConditionsInput = z.infer<typeof onboardingConditionsSchema>;
export type OnboardingAllergiesInput = z.infer<typeof onboardingAllergiesSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
