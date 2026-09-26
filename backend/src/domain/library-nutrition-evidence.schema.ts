import { z } from 'zod';

export const prepareLibraryNutritionEvidenceSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    portionBasis: z.string().trim().min(20).max(1000),
    ingredients: z
      .array(
        z
          .object({
            id: z.string().min(1),
            foodItemId: z.string().min(1),
            gramsPerServing: z.number().finite().positive().max(5000),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.ingredients.map((ingredient) => ingredient.id)).size !== value.ingredients.length) {
      context.addIssue({ code: 'custom', path: ['ingredients'], message: 'Each ingredient must appear once.' });
    }
  });

export type PrepareLibraryNutritionEvidenceInput = z.infer<typeof prepareLibraryNutritionEvidenceSchema>;
