import { z } from 'zod';

const boundedNote = z.string().trim().min(1).max(2000);
const nutritionNumber = z.number().finite().min(0).max(5000);

const ingredientSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    category: z.string().trim().max(80).optional(),
    dataSource: z.enum(['FNRI', 'GEMINI_ESTIMATED']).optional(),
  })
  .strict();

const reviewUpdatesSchema = z
  .object({
    mealName: z.string().trim().min(1).max(180).optional(),
    description: z.string().trim().max(2000).optional(),
    calories: nutritionNumber.max(3000).optional(),
    proteinG: nutritionNumber.max(500).optional(),
    carbsG: nutritionNumber.max(800).optional(),
    fatG: nutritionNumber.max(500).optional(),
    ingredients: z.array(ingredientSchema).min(1).max(50).optional(),
  })
  .strict();

export const nutritionistReviewActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('approve'),
      note: z.string().trim().max(2000).optional(),
      updates: reviewUpdatesSchema.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('reject'),
      note: boundedNote,
    })
    .strict(),
]);

export const regenerateCandidateSchema = z
  .object({
    reason: boundedNote,
  })
  .strict();

export const candidateMealSchema = z
  .object({
    mealName: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000).optional().default(''),
    calories: nutritionNumber.max(3000),
    proteinG: nutritionNumber.max(500),
    carbsG: nutritionNumber.max(800),
    fatG: nutritionNumber.max(500),
    sodiumMg: nutritionNumber.max(100000).nullable().optional(),
    sugarG: nutritionNumber.max(1000).nullable().optional(),
    fiberG: nutritionNumber.max(1000).nullable().optional(),
    potassiumMg: nutritionNumber.max(100000).nullable().optional(),
    phosphorusMg: nutritionNumber.max(100000).nullable().optional(),
    saturatedFatG: nutritionNumber.max(1000).nullable().optional(),
    nutritionServingDescription: z.string().trim().max(180).nullable().optional(),
    ingredients: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(180),
            category: z.string().trim().max(80).optional(),
            dataSource: z.enum(['FNRI', 'GEMINI_ESTIMATED']).optional(),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict();

export const replaceAndApproveSchema = z
  .object({
    reason: boundedNote,
    note: z.string().trim().max(2000).optional(),
    candidate: candidateMealSchema,
  })
  .strict();

export const libraryMealEditSchema = z
  .object({
    mealName: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000),
    calories: nutritionNumber.max(3000),
    proteinG: nutritionNumber.max(500),
    carbsG: nutritionNumber.max(800),
    fatG: nutritionNumber.max(500),
    dietaryTags: z.array(z.enum(['OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN'])).max(4),
    applicableMealTypes: z
      .array(z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']))
      .min(1)
      .max(4)
      .optional(),
    riceRole: z.enum(['PAIR_WITH_RICE', 'STANDALONE', 'INCLUDES_RICE']).optional(),
    includedRiceG: z.number().positive().max(1000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.includedRiceG && value.riceRole !== 'INCLUDES_RICE') {
      context.addIssue({
        code: 'custom',
        path: ['includedRiceG'],
        message: 'Rice grams only apply to recipes that include rice.',
      });
    }
  })
  .strict();

export const libraryMealFlagSchema = z.object({ reason: boundedNote }).strict();

export const libraryFlagResolutionSchema = z.discriminatedUnion('resolution', [
  z.object({ resolution: z.literal('dismiss') }).strict(),
  z.object({ resolution: z.literal('delete') }).strict(),
  z.object({ resolution: z.literal('edit'), updatedFields: libraryMealEditSchema }).strict(),
]);
