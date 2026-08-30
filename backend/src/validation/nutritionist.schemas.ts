import { z } from 'zod';

const boundedNote = z.string().trim().min(1).max(2000);
const nutritionNumber = z.number().finite().min(0).max(5000);

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(180),
  category: z.string().trim().max(80).optional(),
  dataSource: z.enum(['FNRI', 'GEMINI_ESTIMATED']).optional(),
}).strict();

const reviewUpdatesSchema = z.object({
  mealName: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(2000).optional(),
  calories: nutritionNumber.max(3000).optional(),
  proteinG: nutritionNumber.max(500).optional(),
  carbsG: nutritionNumber.max(800).optional(),
  fatG: nutritionNumber.max(500).optional(),
  ingredients: z.array(ingredientSchema).min(1).max(50).optional(),
}).strict();

export const nutritionistReviewActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    note: z.string().trim().max(2000).optional(),
    updates: reviewUpdatesSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('reject'),
    note: boundedNote,
  }).strict(),
]);

export const libraryMealEditSchema = z.object({
  mealName: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000),
  calories: nutritionNumber.max(3000),
  proteinG: nutritionNumber.max(500),
  carbsG: nutritionNumber.max(800),
  fatG: nutritionNumber.max(500),
  dietaryTags: z.array(z.enum([
    'OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN',
    'LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE',
  ])).max(8),
}).strict();

export const libraryMealFlagSchema = z.object({ reason: boundedNote }).strict();

export const libraryFlagResolutionSchema = z.discriminatedUnion('resolution', [
  z.object({ resolution: z.literal('dismiss') }).strict(),
  z.object({ resolution: z.literal('delete') }).strict(),
  z.object({ resolution: z.literal('edit'), updatedFields: libraryMealEditSchema }).strict(),
]);
