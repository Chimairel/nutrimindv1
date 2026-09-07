import { MealType } from '@prisma/client';
import { z } from 'zod';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '@/policies/weight-entry.policy';

const boundedId = z.string().trim().min(1, 'A resource ID is required.').max(128, 'Resource ID is too long.');

export const resourceIdParamsSchema = z.object({ id: boundedId }).strict();

export const mealStatusBodySchema = z.object({ status: z.enum(['DONE', 'SKIPPED', 'PENDING']) }).strict();

export const mealGenerationBodySchema = z.object({ replaceExisting: z.boolean().optional() }).strict();

export const outsideMealBodySchema = z
  .object({
    mealName: z.string().trim().min(1).max(160),
    mealType: z.enum(MealType),
    warningAcknowledged: z.boolean().optional(),
    confirmationId: z.string().trim().min(1).max(128).optional(),
    notes: z.string().trim().max(1_000).optional(),
  })
  .strict();

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
