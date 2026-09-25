import {
  MealIngredientDataSource,
  MealLibrarySafetyEvidenceOrigin,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyReviewOutcome,
  MealLibraryStatus,
  MealNutritionEvidenceSource,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';
import { persistDeterministicLibraryClassification } from './meal-library-publication.service';
import type { AdminMealInput, AdminMealUpdate } from '@/validation/admin-meal.schemas';

const ADMIN_DRAFT_REASON = 'ADMIN_AUTHORED_DRAFT';

function composedDescription(input: AdminMealInput): string {
  return `${input.summary}\n\nPreparation instructions:\n${input.instructions}`;
}

type NutritionValues = Omit<Pick<AdminMealInput,
  'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'sodiumMg' | 'sugarG' | 'fiberG' |
  'potassiumMg' | 'phosphorusMg' | 'saturatedFatG' | 'nutritionServingDescription'>,
  'nutritionServingDescription'> & { nutritionServingDescription: string | null };

function nutritionFields(input: NutritionValues) {
  return {
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    sodiumMg: input.sodiumMg,
    sugarG: input.sugarG,
    fiberG: input.fiberG,
    potassiumMg: input.potassiumMg,
    phosphorusMg: input.phosphorusMg,
    saturatedFatG: input.saturatedFatG,
    nutritionServingDescription: input.nutritionServingDescription,
  };
}

async function resolveIngredients(tx: Prisma.TransactionClient, input: AdminMealInput) {
  const ids = input.ingredients.map((ingredient) => ingredient.foodItemId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError('Combine repeated FNRI foods into one per-serving amount.', 400, 'DUPLICATE_INGREDIENT');
  }
  const foods = await tx.foodItem.findMany({
    where: { id: { in: ids }, source: 'FNRI' },
    select: { id: true, name: true, category: true },
  });
  const byId = new Map(foods.map((food) => [food.id, food]));
  if (byId.size !== ids.length) {
    throw new AppError('Each ingredient must be selected from the FNRI catalogue.', 422, 'FNRI_INGREDIENT_REQUIRED');
  }
  return input.ingredients.map((ingredient, position) => {
    const food = byId.get(ingredient.foodItemId)!;
    return {
      position,
      ingredientName: food.name,
      category: food.category,
      foodItemId: food.id,
      dataSource: MealIngredientDataSource.FNRI,
      quantity: ingredient.gramsPerServing,
      unit: 'g',
    };
  });
}

function recipeSignature(input: AdminMealInput, ingredients: Awaited<ReturnType<typeof resolveIngredients>>) {
  return buildMealLibraryRecipeSignature({
    mealName: input.mealName,
    mealType: input.mealType,
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    ingredients,
  });
}

function draftSnapshot(adminUserId: string, input: AdminMealInput): Prisma.InputJsonValue {
  return {
    authorRole: 'ADMIN',
    authorUserId: adminUserId,
    summary: input.summary,
    instructions: input.instructions,
    nutritionBasis: input.nutritionBasis,
    nutritionEvidence: 'ADMIN_ENTERED_UNREVIEWED',
    perServing: true,
    ingredientCount: input.ingredients.length,
  };
}

function translateUniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('This exact meal recipe already exists in the library.', 409, 'DUPLICATE_MEAL');
  }
  throw error;
}

export class AdminMealAuthoringService {
  static async searchFnriFoods(search: string) {
    if (search.trim().length < 2) return [];
    return prisma.foodItem.findMany({
      where: {
        source: 'FNRI',
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { aliases: { some: { alias: { contains: search.trim(), mode: 'insensitive' } } } },
        ],
      },
      select: { id: true, name: true, category: true },
      orderBy: { name: 'asc' },
      take: 12,
    });
  }

  static async list(page: number) {
    const limit = 20;
    const where: Prisma.MealLibraryWhereInput = {
      safetyReviews: { some: { reasonCode: ADMIN_DRAFT_REASON } },
    };
    const [total, rows] = await Promise.all([
      prisma.mealLibrary.count({ where }),
      prisma.mealLibrary.findMany({
        where,
        orderBy: { addedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ingredients: { orderBy: { position: 'asc' } },
          safetyReviews: {
            where: { reasonCode: ADMIN_DRAFT_REASON },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: { safetyReviews: { where: { outcome: { not: MealLibrarySafetyReviewOutcome.DRAFT_CREATED } } } },
          },
          safetyReviewedByNutritionist: { include: { user: { select: { name: true } } } },
        },
      }),
    ]);
    return {
      total,
      page,
      limit,
      items: rows.map((row) => {
        const snapshot = row.safetyReviews[0]?.evidenceSnapshot as { summary?: string; instructions?: string; nutritionBasis?: string } | undefined;
        return {
          id: row.id,
          mealName: row.mealName,
          mealType: row.mealType,
          summary: snapshot?.summary ?? row.description ?? '',
          instructions: snapshot?.instructions ?? '',
          nutritionBasis: snapshot?.nutritionBasis ?? '',
          ...nutritionFields(row),
          ingredients: row.ingredients.map((ingredient) => ({
            foodItemId: ingredient.foodItemId,
            name: ingredient.ingredientName,
            gramsPerServing: ingredient.quantity,
          })),
          safetyEvidenceStatus: row.safetyEvidenceStatus,
          safetyEvidenceRevision: row.safetyEvidenceRevision,
          status: row.status,
          reviewedBy: row.safetyReviewedByNutritionist?.user.name ?? null,
          canEdit: row.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.INCOMPLETE &&
            row.status === MealLibraryStatus.APPROVED && !row.safetyReviewedAt && row._count.safetyReviews === 0,
        };
      }),
    };
  }

  static async create(adminUserId: string, input: AdminMealInput) {
    try {
      return await prisma.$transaction(async (tx) => {
        const ingredients = await resolveIngredients(tx, input);
        const signature = recipeSignature(input, ingredients);
        if (await tx.mealLibrary.findUnique({ where: { recipeSignature: signature }, select: { id: true } })) {
          throw new AppError('This exact meal recipe already exists in the library.', 409, 'DUPLICATE_MEAL');
        }
        const meal = await tx.mealLibrary.create({
          data: {
            mealName: input.mealName,
            description: composedDescription(input),
            mealType: input.mealType,
            ...nutritionFields(input),
            nutritionEvidenceSource: MealNutritionEvidenceSource.UNKNOWN,
            status: MealLibraryStatus.APPROVED,
            safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.INCOMPLETE,
            safetyEvidenceOrigin: MealLibrarySafetyEvidenceOrigin.LEGACY_UNREVIEWED,
            safetyEvidenceRevision: 1,
            recipeSignature: signature,
            suitableConditions: [],
            allergenFree: [],
            dietaryTags: [],
            ingredients: { create: ingredients },
          },
        });
        await persistDeterministicLibraryClassification(tx, meal.id);
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: meal.id,
            outcome: MealLibrarySafetyReviewOutcome.DRAFT_CREATED,
            evidenceRevision: 1,
            reasonCode: ADMIN_DRAFT_REASON,
            evidenceSnapshot: draftSnapshot(adminUserId, input),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            action: 'ADMIN_MEAL_DRAFT_CREATED',
            entityType: 'MealLibrary',
            entityId: meal.id,
            metadata: { recipeSignature: signature, evidenceRevision: 1, ingredientCount: ingredients.length },
          },
        });
        return { id: meal.id, safetyEvidenceStatus: meal.safetyEvidenceStatus };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      translateUniqueConflict(error);
    }
  }

  static async update(adminUserId: string, mealId: string, input: AdminMealUpdate) {
    try {
      return await prisma.$transaction(async (tx) => {
        const meal = await tx.mealLibrary.findUnique({
          where: { id: mealId },
          include: { safetyReviews: { select: { outcome: true, reasonCode: true } } },
        });
        if (!meal || !meal.safetyReviews.some((review) => review.reasonCode === ADMIN_DRAFT_REASON)) {
          throw new AppError('Admin-authored meal draft not found.', 404, 'DRAFT_NOT_FOUND');
        }
        if (meal.status !== MealLibraryStatus.APPROVED ||
          meal.safetyEvidenceStatus !== MealLibrarySafetyEvidenceStatus.INCOMPLETE ||
          meal.safetyReviewedAt ||
          meal.safetyReviews.some((review) => review.outcome !== MealLibrarySafetyReviewOutcome.DRAFT_CREATED)
        ) {
          throw new AppError('This meal has entered nutritionist review and can no longer be edited here.', 409, 'DRAFT_LOCKED');
        }
        const ingredients = await resolveIngredients(tx, input);
        const signature = recipeSignature(input, ingredients);
        const claimed = await tx.mealLibrary.updateMany({
          where: {
            id: mealId,
            safetyEvidenceRevision: input.expectedRevision,
            safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.INCOMPLETE,
            status: MealLibraryStatus.APPROVED,
          },
          data: {
            mealName: input.mealName,
            description: composedDescription(input),
            mealType: input.mealType,
            ...nutritionFields(input),
            recipeSignature: signature,
            safetyEvidenceRevision: { increment: 1 },
          },
        });
        if (claimed.count !== 1) {
          throw new AppError('Draft changed while you were editing. Refresh and try again.', 409, 'REVISION_CONFLICT');
        }
        await tx.mealLibraryIngredient.deleteMany({ where: { mealLibraryId: mealId } });
        await tx.mealLibraryIngredient.createMany({ data: ingredients.map((ingredient) => ({ mealLibraryId: mealId, ...ingredient })) });
        await persistDeterministicLibraryClassification(tx, mealId);
        const revision = input.expectedRevision + 1;
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            outcome: MealLibrarySafetyReviewOutcome.DRAFT_CREATED,
            evidenceRevision: revision,
            reasonCode: ADMIN_DRAFT_REASON,
            evidenceSnapshot: draftSnapshot(adminUserId, input),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: adminUserId,
            action: 'ADMIN_MEAL_DRAFT_UPDATED',
            entityType: 'MealLibrary',
            entityId: mealId,
            metadata: { recipeSignature: signature, evidenceRevision: revision, ingredientCount: ingredients.length },
          },
        });
        return { id: mealId, safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.INCOMPLETE, revision };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      translateUniqueConflict(error);
    }
  }
}
