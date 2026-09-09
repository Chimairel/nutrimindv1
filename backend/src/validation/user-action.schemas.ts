import { MealType } from '@prisma/client';
import { z } from 'zod';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '@/policies/weight-entry.policy';

const boundedId = z.string().trim().min(1, 'A resource ID is required.').max(128, 'Resource ID is too long.');

export const resourceIdParamsSchema = z.object({ id: boundedId }).strict();

export const mealStatusBodySchema = z.object({ status: z.enum(['DONE', 'SKIPPED', 'PENDING']) }).strict();

export const mealGenerationBodySchema = z.object({ replaceExisting: z.boolean().optional() }).strict();

const outsideMealNutritionSchema = z
  .object({
    calories: z.number().min(0).max(10_000),
    proteinG: z.number().min(0).max(1_000),
    carbsG: z.number().min(0).max(2_000),
    fatG: z.number().min(0).max(1_000),
  })
  .strict();

const outsideMealItemSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    portionGrams: z.number().positive().max(5_000).optional(),
    reportedNutrition: outsideMealNutritionSchema.optional(),
  })
  .strict();

export const outsideMealBodySchema = z
  .object({
    mealName: z.string().trim().min(1).max(1_000).optional(),
    items: z.array(outsideMealItemSchema).min(1).max(10).optional(),
    mealType: z.enum(MealType),
    useAiEstimate: z.boolean().optional(),
    requestKey: z.string().trim().min(8).max(128).optional(),
    warningAcknowledged: z.boolean().optional(),
    confirmationId: z.string().trim().min(1).max(128).optional(),
    notes: z.string().trim().max(1_000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.mealName && !value.items) {
      ctx.addIssue({ code: 'custom', message: 'Provide mealName or items.', path: ['mealName'] });
    }
    if (value.items && value.items.map((item) => item.name).join(', ').length > 1_000) {
      ctx.addIssue({
        code: 'custom',
        message: 'Combined food names must be 1,000 characters or fewer.',
        path: ['items'],
      });
    }
    if (value.warningAcknowledged && !value.confirmationId) {
      ctx.addIssue({
        code: 'custom',
        message: 'confirmationId is required when confirming a preview.',
        path: ['confirmationId'],
      });
    }
  });

export const outsideMealReviewParamsSchema = z.object({ id: boundedId }).strict();

export const outsideMealReviewBodySchema = z
  .object({
    action: z.enum(['VERIFY', 'CORRECT', 'NEEDS_MORE_INFO']),
    calories: z.number().min(0).max(10_000).optional(),
    proteinG: z.number().min(0).max(1_000).optional(),
    carbsG: z.number().min(0).max(2_000).optional(),
    fatG: z.number().min(0).max(1_000).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action !== 'CORRECT') return;
    for (const key of ['calories', 'proteinG', 'carbsG', 'fatG'] as const) {
      if (value[key] === undefined) {
        ctx.addIssue({ code: 'custom', message: `${key} is required for a correction.`, path: [key] });
      }
    }
  });

export const swapMealBodySchema = z
  .object({
    newLibraryMealId: boundedId,
    warningShown: z.boolean().optional(),
    warningAcknowledged: z.boolean().optional(),
  })
  .strict();

export const swapPreviewQuerySchema = z.object({ libraryMealId: boundedId }).strict();

export const compatibleLibraryQuerySchema = z
  .object({
    mealType: z.enum(MealType).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();

export const weightEntryBodySchema = z
  .object({
    weightKg: z.coerce.number().min(MIN_WEIGHT_KG).max(MAX_WEIGHT_KG),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const fnriLookupQuerySchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
