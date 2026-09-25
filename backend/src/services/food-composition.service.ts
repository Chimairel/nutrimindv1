import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { lockUserProfile } from './profile-revision.service';

const nutrient = z.number().finite().min(0).max(100000);
export const compositionValuesSchema = z
  .object({
    calories: nutrient.max(1000),
    proteinG: nutrient.max(100),
    carbsG: nutrient.max(100),
    fatG: nutrient.max(100),
    fiber: nutrient.nullable(),
    sodium: nutrient.nullable(),
    potassium: nutrient.nullable(),
    calcium: nutrient.nullable(),
    iron: nutrient.nullable(),
    vitaminA: nutrient.nullable(),
    vitaminC: nutrient.nullable(),
    vitaminB1: nutrient.nullable(),
    vitaminB2: nutrient.nullable(),
    niacin: nutrient.nullable(),
    water: nutrient.max(100).nullable(),
  })
  .strict();
export const compositionDraftSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    values: compositionValuesSchema,
    sourceUrl: z
      .string()
      .url()
      .max(500)
      .refine((value) => value.startsWith('https://'), 'Use an HTTPS source link.'),
    sourcePublishedAt: z
      .string()
      .datetime()
      .refine((value) => Date.parse(value) <= Date.now(), 'Publication cannot be in the future.'),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();

export class FoodCompositionService {
  static async history(foodItemId: string) {
    const food = await prisma.foodItem.findUniqueOrThrow({ where: { id: foodItemId } });
    const history = await prisma.foodCompositionRevision.findMany({
      where: { foodItemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { food, history };
  }
  static async draft(adminId: string, foodItemId: string, input: z.infer<typeof compositionDraftSchema>) {
    const food = await prisma.foodItem.findUniqueOrThrow({ where: { id: foodItemId } });
    if (food.source === 'USDA_FDC')
      throw new Error('USDA snapshot values are immutable; update the pinned source dataset instead.');
    if (food.compositionRevision !== input.expectedRevision)
      throw new Error('Composition changed. Reload the food record.');
    return prisma.foodCompositionRevision.create({
      data: {
        foodItemId,
        baseRevision: food.compositionRevision,
        previousValues: compositionValuesSchema.parse(
          Object.fromEntries(Object.keys(input.values).map((key) => [key, food[key as keyof typeof food]]))
        ),
        proposedValues: input.values,
        sourceUrl: input.sourceUrl,
        sourcePublishedAt: new Date(input.sourcePublishedAt),
        reason: input.reason,
        createdByAdminId: adminId,
      },
    });
  }
  static async publish(adminId: string, id: string) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
        const draft = await tx.foodCompositionRevision.findUniqueOrThrow({ where: { id } });
        if (draft.publishedAt) return draft;
        const draftFood = await tx.foodItem.findUniqueOrThrow({
          where: { id: draft.foodItemId },
          select: { source: true },
        });
        if (draftFood.source === 'USDA_FDC')
          throw new Error('USDA snapshot values are immutable; update the pinned source dataset instead.');
        const affected = await tx.mealPlan.findMany({
          where: {
            scheduledDate: { gte: getStartOfManilaBusinessDay() },
            status: { in: ['APPROVED', 'PENDING_REVIEW'] },
            mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
            OR: [
              { ingredients: { some: { foodItemId: draft.foodItemId } } },
              { libraryMeal: { ingredients: { some: { foodItemId: draft.foodItemId } } } },
            ],
          },
          select: { id: true, userId: true },
        });
        for (const userId of [...new Set(affected.map((meal) => meal.userId))].sort())
          await lockUserProfile(tx, userId);
        const changed = await tx.foodItem.updateMany({
          where: { id: draft.foodItemId, compositionRevision: draft.baseRevision },
          data: { ...compositionValuesSchema.parse(draft.proposedValues), compositionRevision: { increment: 1 } },
        });
        if (changed.count !== 1) throw new Error('A newer composition is already published. Create a fresh draft.');
        await tx.mealLibrary.updateMany({
          where: { ingredients: { some: { foodItemId: draft.foodItemId } } },
          data: {
            safetyEvidenceStatus: 'STALE',
            safetyEvidenceRevision: { increment: 1 },
            safetyInvalidatedAt: new Date(),
            safetyInvalidationReason: 'FOOD_COMPOSITION_CHANGED',
          },
        });
        await tx.mealPlan.updateMany({
          where: { id: { in: affected.map((meal) => meal.id) } },
          data: {
            status: 'PENDING_REVIEW',
            requiresSafetyRevalidation: true,
            reviewApprovalCount: 0,
            firstApprovedByNutritionistId: null,
            firstApprovedAt: null,
            claimedByNutritionistId: null,
            claimedAt: null,
            nutritionistId: null,
            reviewedAt: null,
          },
        });
        await tx.groceryList.updateMany({
          where: { userId: { in: affected.map((meal) => meal.userId) } },
          data: { isStale: true },
        });
        return tx.foodCompositionRevision.update({
          where: { id },
          data: { publishedAt: new Date(), publishedByAdminId: adminId },
        });
      },
      { isolationLevel: 'Serializable', timeout: 30_000 }
    );
  }
}
