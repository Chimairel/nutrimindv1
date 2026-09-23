import {
  MealLogDataSource,
  MealLogSource,
  MealLogStatus,
  OutsideMealCompatibilityStatus,
  OutsideMealItemSource,
  OutsideMealNutritionStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import {
  assertValidOutsideMealMacros,
  summarizeOutsideMealNutrition,
  type OutsideMealMacros,
} from '@/domain/outside-meal.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { evaluateOutsideMealCompatibility } from '@/domain/outside-meal-safety.policy';
import { outsideReviewQueueReason } from '@/domain/outside-meal-review.policy';
import { queryEligibleLibraryPage } from './meal-library-candidate-query.service';
import { MealSwapService } from './meal-swap.service';
import { ObservedMealService } from './observed-meal.service';

type EditInput = {
  name: string;
  portionGrams?: number | null;
  reportedNutrition?: OutsideMealMacros;
  unresolved?: boolean;
  reason?: string;
};

function aggregateSource(
  items: Array<{ source: OutsideMealItemSource; includedInTotals: boolean }>
): MealLogDataSource {
  const sources = new Set(items.filter((item) => item.includedInTotals).map((item) => item.source));
  if (sources.size !== 1) return MealLogDataSource.MIXED;
  const source = [...sources][0];
  if (source === OutsideMealItemSource.VERIFIED_LIBRARY) return MealLogDataSource.VERIFIED_LIBRARY;
  if (source === OutsideMealItemSource.FNRI) return MealLogDataSource.FNRI;
  if (source === OutsideMealItemSource.GEMINI_ESTIMATED) return MealLogDataSource.GEMINI_ESTIMATED;
  if (source === OutsideMealItemSource.USER_ADJUSTED_LIBRARY) return MealLogDataSource.USER_ADJUSTED_LIBRARY;
  if (source === OutsideMealItemSource.USER_REPORTED) return MealLogDataSource.USER_REPORTED;
  if (source === OutsideMealItemSource.NUTRITIONIST_REVIEWED) return MealLogDataSource.NUTRITIONIST_REVIEWED;
  return MealLogDataSource.MIXED;
}

async function summarizeAndPersist(tx: Prisma.TransactionClient, logId: string) {
  const items = await tx.outsideMealLogItem.findMany({ where: { mealLogId: logId }, orderBy: { position: 'asc' } });
  const summary = summarizeOutsideMealNutrition(
    items.map((item) => ({
      source: item.source,
      nutritionStatus: item.nutritionStatus,
      includedInTotals: item.includedInTotals,
      calories: item.calories ?? 0,
      proteinG: item.proteinG ?? 0,
      carbsG: item.carbsG ?? 0,
      fatG: item.fatG ?? 0,
    }))
  );
  const compatibility = items.some(
    (item) => item.compatibilityStatus === OutsideMealCompatibilityStatus.CONFLICT_DETECTED
  )
    ? 'CONFLICT_DETECTED'
    : items.every((item) => item.compatibilityStatus === OutsideMealCompatibilityStatus.NO_KNOWN_CONFLICT)
      ? 'NO_KNOWN_CONFLICT'
      : 'INSUFFICIENT_EVIDENCE';
  const log = await tx.mealLog.update({
    where: { id: logId },
    data: {
      ...summary.totals,
      provisionalCalories: summary.provisionalCalories,
      nutritionCompleteness: summary.completeness,
      dataSource: aggregateSource(items),
      outsideSafetyFollowUp: {
        status: compatibility,
        messages:
          compatibility === 'NO_KNOWN_CONFLICT'
            ? []
            : [
                compatibility === 'CONFLICT_DETECTED'
                  ? 'A possible conflict was detected. Review the recorded ingredients and your health profile.'
                  : 'This entry has not been fully assessed for compatibility.',
              ],
      },
    },
  });
  return { log, summary };
}

export class OutsideMealCaptureService {
  static async suggestions(userId: string, search: string) {
    const query = search.trim();
    if (query.length < 2) return { eligible: [], otherKnown: [], custom: { name: query } };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
    });
    if (!user?.userProfile) throw new AppError('Complete your profile before logging meals.', 422, 'PROFILE_REQUIRED');
    const conditions = user.healthConditions.map((row) => row.condition);
    const allergens = user.allergies.map((row) => row.allergen);
    const eligiblePage = await queryEligibleLibraryPage({
      userId,
      userConditions: conditions,
      userAllergens: allergens,
      profile: { ...user.userProfile, userId, safetyEntries: user.safetyProfileEntries },
      search: query,
      limit: 8,
    });
    const eligible = eligiblePage.items.map((meal) => ({
      kind: 'ELIGIBLE_LIBRARY',
      id: meal.id,
      name: meal.mealName,
      serving: meal.nutritionServingDescription || 'One recipe serving',
      macros: { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG },
      label: 'Eligible certified recipe',
    }));
    const knownIds = eligible.map((meal) => meal.id);
    const [catalog, raw, fnri, observed] = await Promise.all([
      prisma.mealLibrary.findMany({
        where: { mealName: { contains: query, mode: 'insensitive' }, id: { notIn: knownIds } },
        select: {
          id: true,
          mealName: true,
          status: true,
          dietaryTags: true,
          safetyDeclarations: { select: { declarationType: true, canonicalKey: true } },
        },
        orderBy: { mealName: 'asc' },
        take: 8,
      }),
      prisma.rawRecipeCandidate.findMany({
        where: { recipeName: { contains: query, mode: 'insensitive' }, status: 'AVAILABLE' },
        select: { id: true, recipeName: true },
        orderBy: { recipeName: 'asc' },
        take: 6,
      }),
      prisma.foodItem.findMany({
        where: { name: { contains: query, mode: 'insensitive' }, source: 'FNRI' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 6,
      }),
      prisma.observedFoodReference.findMany({
        where: {
          name: { contains: query, mode: 'insensitive' },
          submissions: { some: { status: 'ADMITTED_REFERENCE' } },
        },
        select: { id: true, name: true, servingGrams: true, calories: true, proteinG: true, carbsG: true, fatG: true },
        orderBy: { name: 'asc' },
        take: 6,
      }),
    ]);
    const otherKnown = [
      ...catalog.map((meal) => {
        const flaggedAllergen = meal.safetyDeclarations.find(
          (declaration) =>
            declaration.declarationType === 'ALLERGEN_PRESENT' &&
            allergens.includes(declaration.canonicalKey as (typeof allergens)[number])
        );
        const tags = Array.isArray(meal.dietaryTags) ? meal.dietaryTags : [];
        const dietaryConflict =
          user.userProfile?.dietaryPreference && !tags.includes(user.userProfile.dietaryPreference);
        return {
          kind: 'KNOWN_CATALOG',
          id: meal.id,
          name: meal.mealName,
          label: flaggedAllergen?.canonicalKey
            ? `Possible ${flaggedAllergen.canonicalKey.toLowerCase()} conflict`
            : dietaryConflict
              ? 'Does not match your diet preference'
              : 'Safety or serving evidence is incomplete',
          compatibility: flaggedAllergen || dietaryConflict ? 'CONFLICT' : 'UNKNOWN',
        };
      }),
      ...raw.map((meal) => ({
        kind: 'RAW_RECIPE',
        id: meal.id,
        name: meal.recipeName,
        label: 'Known recipe; safety not reviewed',
        compatibility: 'UNKNOWN',
      })),
      ...fnri.map((food) => ({
        kind: 'FNRI_FOOD',
        id: food.id,
        name: food.name,
        label: 'FNRI food; enter consumed grams',
        compatibility: 'UNKNOWN',
      })),
      ...observed.map((food) => ({
        kind: 'OBSERVED_REFERENCE',
        id: food.id,
        name: food.name,
        serving: `${food.servingGrams} g`,
        macros: { calories: food.calories, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG },
        label: 'Observed food estimate; safety not reviewed',
        compatibility: 'UNKNOWN',
      })),
    ].filter(
      (entry, index, all) => all.findIndex((other) => other.name.toLowerCase() === entry.name.toLowerCase()) === index
    );
    return { eligible, otherKnown, custom: { name: query } };
  }

  static async editItem(userId: string, logId: string, itemId: string, input: EditInput) {
    if (input.reportedNutrition) assertValidOutsideMealMacros(input.reportedNutrition);
    if (!input.reportedNutrition && !input.unresolved)
      throw new AppError('Enter all macro values or mark the item unresolved.', 400, 'NUTRITION_INPUT_REQUIRED');
    return prisma.$transaction(
      async (tx) => {
        const item = await tx.outsideMealLogItem.findFirst({
          where: {
            id: itemId,
            mealLogId: logId,
            mealLog: { userId, source: MealLogSource.USER_LOGGED, status: MealLogStatus.DONE },
          },
          include: { mealLog: true, review: true },
        });
        if (!item) throw new AppError('Active outside-meal item not found.', 404, 'OUTSIDE_ITEM_NOT_FOUND');
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
        });
        if (!user?.userProfile) throw new AppError('Profile not found.', 422, 'PROFILE_REQUIRED');
        const restrictions = adaptUserSafetyRestrictions({
          safetyEntries: user.safetyProfileEntries,
          healthConditions: user.healthConditions.map((row) => row.condition),
          allergies: user.allergies.map((row) => row.allergen),
          otherConditions: user.userProfile.otherConditions,
          otherAllergies: user.userProfile.otherAllergies,
        });
        const ingredients =
          input.name === item.name && Array.isArray(item.ingredients)
            ? item.ingredients.filter((ingredient): ingredient is string => typeof ingredient === 'string')
            : [];
        const compatibilityStatus = evaluateOutsideMealCompatibility({
          name: input.name,
          ingredients,
          baselineStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
          restrictions,
        }).status;
        const includedInTotals = Boolean(input.reportedNutrition);
        const source =
          includedInTotals && item.mealLibraryId
            ? OutsideMealItemSource.USER_ADJUSTED_LIBRARY
            : includedInTotals
              ? OutsideMealItemSource.USER_REPORTED
              : OutsideMealItemSource.UNRESOLVED;
        const nutritionStatus = includedInTotals
          ? OutsideMealNutritionStatus.USER_REPORTED
          : OutsideMealNutritionStatus.UNRESOLVED;
        const next = {
          name: input.name,
          portionGrams: input.portionGrams ?? null,
          source,
          nutritionStatus,
          compatibilityStatus,
          ingredients,
          includedInTotals,
          calories: input.reportedNutrition?.calories ?? null,
          proteinG: input.reportedNutrition?.proteinG ?? null,
          carbsG: input.reportedNutrition?.carbsG ?? null,
          fatG: input.reportedNutrition?.fatG ?? null,
        };
        const revision = item.currentRevision + 1;
        const changed = await tx.outsideMealLogItem.updateMany({
          where: { id: item.id, currentRevision: item.currentRevision },
          data: { ...next, calorieLow: null, calorieHigh: null, currentRevision: revision },
        });
        if (changed.count !== 1)
          throw new AppError('This item changed. Reload before editing it.', 409, 'ITEM_REVISION_CHANGED');
        await ObservedMealService.invalidateSource(tx, item.id);
        await tx.outsideMealItemRevision.create({
          data: {
            outsideMealLogItemId: item.id,
            revision,
            source,
            nutritionStatus,
            calories: next.calories,
            proteinG: next.proteinG,
            carbsG: next.carbsG,
            fatG: next.fatG,
            reason: input.reason?.trim() || 'User corrected outside-meal details',
            editedByUserId: userId,
            snapshot: {
              ...next,
              servingDescription: input.portionGrams ? `${input.portionGrams} g consumed` : null,
            } as Prisma.InputJsonObject,
          },
        });
        if (item.review) {
          await tx.outsideMealReview.update({
            where: { outsideMealLogItemId: item.id },
            data: {
              status: 'PENDING',
              claimedByNutritionistId: null,
              claimedAt: null,
              claimedRevision: null,
              reviewedRevision: null,
              reviewedAt: null,
            },
          });
        } else {
          const queueReason = outsideReviewQueueReason({
            ...next,
            calorieLow: null,
            calorieHigh: null,
          });
          if (queueReason)
            await tx.outsideMealReview.create({
              data: {
                outsideMealLogItemId: item.id,
                queueReason,
                priority: compatibilityStatus === OutsideMealCompatibilityStatus.CONFLICT_DETECTED ? 80 : 30,
              },
            });
        }
        const result = await summarizeAndPersist(tx, logId);
        await MealSwapService.recalculateDailyNutritionLog(userId, item.mealLog.loggedAt, tx);
        await tx.auditEvent.create({
          data: {
            actorUserId: userId,
            action: 'OUTSIDE_MEAL_ITEM_USER_REVISED',
            entityType: 'OutsideMealLogItem',
            entityId: item.id,
            metadata: { previousRevision: item.currentRevision, revision, reason: input.reason?.trim() || null },
          },
        });
        return { ...result, itemId: item.id, revision };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 60_000 }
    );
  }

  static async voidLog(userId: string, logId: string, reason: string) {
    return prisma.$transaction(
      async (tx) => {
        const log = await tx.mealLog.findFirst({
          where: { id: logId, userId, source: MealLogSource.USER_LOGGED },
          include: { outsideItems: true },
        });
        if (!log) throw new AppError('Outside meal not found.', 404, 'OUTSIDE_LOG_NOT_FOUND');
        if (log.status === MealLogStatus.VOIDED) return { logId, voidedAt: log.voidedAt, replayed: true };
        if (log.status !== MealLogStatus.DONE)
          throw new AppError('This entry cannot be voided.', 409, 'OUTSIDE_LOG_NOT_ACTIVE');
        const now = new Date();
        for (const item of log.outsideItems) {
          await ObservedMealService.invalidateSource(tx, item.id);
          const revision = item.currentRevision + 1;
          await tx.outsideMealItemRevision.create({
            data: {
              outsideMealLogItemId: item.id,
              revision,
              source: item.source,
              nutritionStatus: OutsideMealNutritionStatus.VOIDED,
              calories: item.calories,
              proteinG: item.proteinG,
              carbsG: item.carbsG,
              fatG: item.fatG,
              reason,
              editedByUserId: userId,
              snapshot: {
                name: item.name,
                portionGrams: item.portionGrams,
                ingredients: item.ingredients ?? null,
                source: item.source,
                nutritionStatus: OutsideMealNutritionStatus.VOIDED,
                includedInTotals: false,
                calories: item.calories,
                proteinG: item.proteinG,
                carbsG: item.carbsG,
                fatG: item.fatG,
              } as Prisma.InputJsonObject,
            },
          });
          await tx.outsideMealLogItem.update({
            where: { id: item.id },
            data: {
              nutritionStatus: OutsideMealNutritionStatus.VOIDED,
              includedInTotals: false,
              calories: null,
              proteinG: null,
              carbsG: null,
              fatG: null,
              calorieLow: null,
              calorieHigh: null,
              currentRevision: revision,
            },
          });
        }
        await tx.mealLog.update({ where: { id: logId }, data: { status: MealLogStatus.VOIDED, voidedAt: now } });
        await MealSwapService.recalculateDailyNutritionLog(userId, log.loggedAt, tx);
        await tx.auditEvent.create({
          data: {
            actorUserId: userId,
            action: 'OUTSIDE_MEAL_VOIDED',
            entityType: 'MealLog',
            entityId: logId,
            metadata: { reason, previousCalories: log.calories, itemCount: log.outsideItems.length },
          },
        });
        return { logId, voidedAt: now, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 60_000 }
    );
  }

  static async attachImage(userId: string, logId: string, file: { buffer: Buffer; mimetype: string }) {
    if (file.buffer.length > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new AppError('Choose a JPG, PNG, or WebP image under 2 MB.', 400, 'INVALID_OUTSIDE_IMAGE');
    const updated = await prisma.mealLog.updateMany({
      where: { id: logId, userId, source: MealLogSource.USER_LOGGED, status: MealLogStatus.DONE },
      data: { outsideImage: file.buffer, outsideImageMime: file.mimetype },
    });
    if (updated.count !== 1) throw new AppError('Active outside meal not found.', 404, 'OUTSIDE_LOG_NOT_FOUND');
    return { logId, hasImage: true };
  }

  static async image(userId: string, logId: string) {
    const log = await prisma.mealLog.findFirst({
      where: { id: logId, userId, source: MealLogSource.USER_LOGGED },
      select: { outsideImage: true, outsideImageMime: true },
    });
    if (!log?.outsideImage || !log.outsideImageMime)
      throw new AppError('Image not found.', 404, 'OUTSIDE_IMAGE_NOT_FOUND');
    return { buffer: Buffer.from(log.outsideImage), mime: log.outsideImageMime };
  }
}
