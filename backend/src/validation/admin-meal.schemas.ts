import { z } from 'zod';

const nutrient = (maximum: number) => z.number().finite().min(0).max(maximum);

export const adminMealInputSchema = z.object({
  mealName: z.string().trim().min(3).max(240),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  summary: z.string().trim().min(10).max(1500),
  instructions: z.string().trim().min(20).max(6000),
  nutritionBasis: z.string().trim().min(10).max(1200),
  nutritionServingDescription: z.string().trim().min(3).max(180),
  calories: nutrient(3000).positive(),
  proteinG: nutrient(500),
  carbsG: nutrient(500),
  fatG: nutrient(500),
  sodiumMg: nutrient(10000).nullable(),
  sugarG: nutrient(500).nullable(),
  fiberG: nutrient(200).nullable(),
  potassiumMg: nutrient(10000).nullable(),
  phosphorusMg: nutrient(5000).nullable(),
  saturatedFatG: nutrient(200).nullable(),
  ingredients: z.array(z.object({
    foodItemId: z.string().trim().min(1).max(191),
    gramsPerServing: z.number().finite().positive().max(5000),
  }).strict()).min(1).max(40),
}).strict();

export const adminMealUpdateSchema = adminMealInputSchema.extend({
  expectedRevision: z.number().int().positive(),
});

export type AdminMealInput = z.infer<typeof adminMealInputSchema>;
export type AdminMealUpdate = z.infer<typeof adminMealUpdateSchema>;
