import { lockUserProfile } from './profile-revision.service';
import { admitOutsideMealReview, isOutsideReviewWriteConflict } from './outside-meal-review-admission.service';
import { normalizeFoodName, selectStrongFNRIMatch } from '@/domain/fnri-match.policy';
import { getNutritionEligibleMealLogWhere } from '@/domain/meal-actionability.policy';
import { getManilaDateKey, getManilaMidnight, getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';
import { evaluateOutsideMealCompatibility } from '@/domain/outside-meal-safety.policy';
import {
  assertValidOutsideMealMacros,
  parseOutsideMealItems,
  resolveOutsideMealAiAllowance,
  resolveOutsideMealAiLimits,
  scalePer100GramMacros,
  summarizeOutsideMealNutrition,
  type OutsideMealMacros,
} from '@/domain/outside-meal.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { AppError } from '@/errors/AppError';
import { generateGenerativeJSON } from '@/lib/gemini';
import prisma from '@/lib/prisma';
import {
  MealLibrarySafetyEvidenceStatus,
  MealLogDataSource,
  MealLogSource,
  MealLogStatus,
  MealType,
  OutsideMealCompatibilityStatus,
  OutsideMealItemSource,
  OutsideMealNutritionStatus,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { MembershipService } from './membership.service';
import { setMealLogAuditContext } from './meal-log-audit-context.service';
import { recalculateDailyNutritionLog } from './meal-swap-nutrition.service';
import { membershipEnabled } from '@/domain/membership.policy';
import { z } from 'zod';
import {
  buildOutsideMealAiPrompt,
  buildOutsideMealAiSchema,
  outsideMealAiItemSchema as aiItemSchema,
} from '@/domain/outside-meal-ai.policy';
import { certifiedLibraryMealInclude, isCertifiedLibraryMealCompatible } from './meal-library-candidate-query.service';

type InputItem = { name: string; portionGrams?: number; mealLibraryId?: string; reportedNutrition?: OutsideMealMacros };

interface LogOutsideMealInput {
  userId: string;
  mealName?: string;
  items?: InputItem[];
  mealType: MealType;
  useAiEstimate?: boolean;
  requestKey?: string;
  warningAcknowledged?: boolean;
  requestRndReview?: boolean;
  confirmationId?: string;
  notes?: string;
  estimationContext?: string;
  consumedAt?: string;
}

type ResolvedItem = {
  name: string;
  portionGrams: number | null;
  servingDescription: string | null;
  source: OutsideMealItemSource;
  nutritionStatus: OutsideMealNutritionStatus;
  compatibilityStatus: OutsideMealCompatibilityStatus;
  includedInTotals: boolean;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  calorieLow: number | null;
  calorieHigh: number | null;
  foodItemId: string | null;
  mealLibraryId: string | null;
  ingredients: string[];
  warnings: string[];
};

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toInputItems(input: LogOutsideMealInput): InputItem[] {
  if (input.items?.length) return input.items;
  return parseOutsideMealItems(input.mealName || '').map((item) => ({
    name: item.name,
    portionGrams: item.portionGrams ?? undefined,
  }));
}

function dataSourceFor(items: ResolvedItem[]): MealLogDataSource {
  const sources = new Set(items.filter((item) => item.includedInTotals).map((item) => item.source));
  if (sources.size !== 1) return MealLogDataSource.MIXED;
  const source = [...sources][0];
  if (source === OutsideMealItemSource.FNRI) return MealLogDataSource.FNRI;
  if (source === OutsideMealItemSource.GEMINI_ESTIMATED) return MealLogDataSource.GEMINI_ESTIMATED;
  if (source === OutsideMealItemSource.VERIFIED_LIBRARY) return MealLogDataSource.VERIFIED_LIBRARY;
  if (source === OutsideMealItemSource.USER_REPORTED) return MealLogDataSource.USER_REPORTED;
  if (source === OutsideMealItemSource.USER_ADJUSTED_LIBRARY) return MealLogDataSource.USER_ADJUSTED_LIBRARY;
  if (source === OutsideMealItemSource.NUTRITIONIST_REVIEWED) return MealLogDataSource.NUTRITIONIST_REVIEWED;
  return MealLogDataSource.MIXED;
}

function requestedPayloadHash(input: LogOutsideMealInput, items: InputItem[]): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        items,
        mealType: input.mealType,
        useAiEstimate: Boolean(input.useAiEstimate),
        consumedAt: input.consumedAt ?? null,
        estimationContext: input.estimationContext?.trim() ?? '',
        notes: input.notes?.trim() ?? '',
      })
    )
    .digest('hex');
}

function emptyResolved(item: InputItem): ResolvedItem {
  return {
    name: item.name,
    portionGrams: item.portionGrams ?? null,
    servingDescription: item.portionGrams ? `${item.portionGrams} g consumed` : null,
    source: OutsideMealItemSource.UNRESOLVED,
    nutritionStatus: OutsideMealNutritionStatus.UNRESOLVED,
    compatibilityStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
    includedInTotals: false,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    calorieLow: null,
    calorieHigh: null,
    foodItemId: null,
    mealLibraryId: null,
    ingredients: [],
    warnings: ['Nutrition could not be resolved. This item is excluded from the displayed totals.'],
  };
}

function applySafetyWarnings(
  item: ResolvedItem,
  restrictions: ReturnType<typeof adaptUserSafetyRestrictions>
): ResolvedItem {
  const result = evaluateOutsideMealCompatibility({
    name: item.name,
    ingredients: item.ingredients,
    baselineStatus: item.compatibilityStatus,
    restrictions,
  });
  return {
    ...item,
    compatibilityStatus: result.status,
    warnings: [...new Set([...item.warnings, ...result.warnings])],
  };
}

export class MealLogService {
  static async logOutsideMeal(input: LogOutsideMealInput) {
    if (input.warningAcknowledged) return this.commitPreview(input);

    const requested = toInputItems(input);
    const payloadHash = requestedPayloadHash(input, requested);
    const consumedAt = input.consumedAt ? new Date(input.consumedAt) : new Date();
    if (!Number.isFinite(consumedAt.getTime()) || consumedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new AppError('Choose a valid time when the food was eaten.', 400, 'INVALID_CONSUMED_AT');
    }

    if (input.requestKey) {
      const prior = await prisma.outsideMealPreview.findUnique({ where: { requestKey: input.requestKey } });
      if (prior) {
        const requestedName = requested.map((item) => item.name).join(', ');
        if (
          prior.userId !== input.userId ||
          prior.mealName !== requestedName ||
          prior.mealType !== input.mealType ||
          (prior.requestPayloadHash !== null && prior.requestPayloadHash !== payloadHash)
        ) {
          throw new AppError(
            'This request key was already used for different meal details.',
            409,
            'REQUEST_KEY_COLLISION'
          );
        }
        if (prior.consumedAt) {
          return this.commitPreview({ ...input, confirmationId: prior.id, warningAcknowledged: true });
        }
        if (prior.expiresAt <= new Date())
          throw new AppError('This preview expired. Start a new log request.', 409, 'PREVIEW_EXPIRED_OR_USED');
        return this.serializePreview(prior);
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
    });
    if (!user?.userProfile) throw new AppError('Complete your profile before logging meals.', 422, 'PROFILE_REQUIRED');

    const restrictions = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((row) => row.condition),
      allergies: user.allergies.map((row) => row.allergen),
      otherConditions: user.userProfile.otherConditions,
      otherAllergies: user.userProfile.otherAllergies,
    });
    let membershipReservation: { id: string; replayed: boolean } | null = null;
    let aiUsageId: string | null = null;
    try {
      let resolved = await Promise.all(requested.map((item) => this.resolveFreeItem(item, user, restrictions)));
      const unresolvedIndexes = resolved.flatMap((item, index) =>
        item.source === OutsideMealItemSource.UNRESOLVED ? [index] : []
      );

      if (input.useAiEstimate && unresolvedIndexes.length > 0) {
        const now = new Date();
        const dayStart = getManilaMidnight(getManilaDateKey(now));
        const tomorrow = getScheduledMealDate(dayStart, 1);
        const rollingStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const limits = resolveOutsideMealAiLimits();
        const usageReservation = await prisma.$transaction(
          async (tx) => {
            membershipReservation = await MembershipService.reserve(
              input.userId,
              'AI_ESTIMATE',
              input.requestKey ?? randomUUID(),
              payloadHash,
              tx
            );
            const [today, rolling] = await Promise.all([
              tx.outsideMealAiUsage.aggregate({
                where: { userId: input.userId, createdAt: { gte: dayStart, lt: tomorrow } },
                _sum: { itemCount: true },
              }),
              tx.outsideMealAiUsage.aggregate({
                where: { userId: input.userId, createdAt: { gte: rollingStart, lte: now } },
                _sum: { itemCount: true },
              }),
            ]);
            const allowance = resolveOutsideMealAiAllowance({
              requestedItems: unresolvedIndexes.length,
              usedToday: today._sum.itemCount ?? 0,
              usedRolling30Days: rolling._sum.itemCount ?? 0,
              dailyCap: limits.dailyCap,
              rolling30DayCap: limits.rolling30DayCap,
            });
            if (!membershipEnabled() && !allowance.allowed) {
              throw new AppError(
                'Your AI estimate limit has been reached. Use nutrition-label values or try again when the quota resets.',
                429,
                allowance.reason
              );
            }
            return tx.outsideMealAiUsage.create({
              data: { userId: input.userId, itemCount: unresolvedIndexes.length },
            });
          },
          {
            maxWait: 10_000,
            timeout: 30_000,
            isolationLevel: membershipEnabled()
              ? Prisma.TransactionIsolationLevel.ReadCommitted
              : Prisma.TransactionIsolationLevel.Serializable,
          }
        );
        aiUsageId = usageReservation.id;
        let aiRows: z.infer<typeof aiItemSchema>[];
        try {
          aiRows = await this.estimateWithAi(
            unresolvedIndexes.map((index) => requested[index]),
            input.estimationContext?.trim() ?? ''
          );
        } catch (error) {
          await prisma.outsideMealAiUsage.deleteMany({ where: { id: usageReservation.id, userId: input.userId } });
          throw error;
        }
        resolved = resolved.map((item, index) => {
          const aiPosition = unresolvedIndexes.indexOf(index);
          if (aiPosition < 0) return item;
          const ai = aiRows[aiPosition];
          return applySafetyWarnings(
            {
              ...item,
              name: ai.name || item.name,
              source: OutsideMealItemSource.GEMINI_ESTIMATED,
              nutritionStatus: OutsideMealNutritionStatus.PENDING_REVIEW,
              compatibilityStatus: OutsideMealCompatibilityStatus.REVIEW_REQUIRED,
              includedInTotals: true,
              calories: ai.calories,
              proteinG: ai.proteinG,
              carbsG: ai.carbsG,
              fatG: ai.fatG,
              calorieLow: Math.min(ai.calorieLow, ai.calories),
              calorieHigh: Math.max(ai.calorieHigh, ai.calories),
              ingredients: ai.ingredients,
              warnings: [
                item.portionGrams === null || item.portionGrams === undefined
                  ? 'AI assumed a typical serving because grams were not provided. This is an uncertain estimate pending nutritionist review.'
                  : 'AI estimate — counted as estimated nutrition; it may be eligible for nutritionist review.',
              ],
            },
            restrictions
          );
        });
      }

      resolved = resolved.map((item) => applySafetyWarnings(item, restrictions));
      const summary = summarizeOutsideMealNutrition(resolved);
      const dayStart = getManilaMidnight(getManilaDateKey(consumedAt));
      const tomorrow = getScheduledMealDate(dayStart, 1);
      const existingLogs = await prisma.mealLog.findMany({
        where: {
          userId: input.userId,
          status: MealLogStatus.DONE,
          ...getNutritionEligibleMealLogWhere(),
          loggedAt: { gte: dayStart, lt: tomorrow },
        },
        select: { calories: true },
      });
      const projectedCalories = existingLogs.reduce((total, row) => total + row.calories, 0) + summary.totals.calories;
      const warnings = resolved.flatMap((item) => item.warnings);
      if (projectedCalories > (user.userProfile.dailyCalorieTarget ?? 2_000)) {
        warnings.push(
          `This would bring today's recorded intake to ${Math.round(projectedCalories)} kcal, above the current ${user.userProfile.dailyCalorieTarget ?? 2_000} kcal target.`
        );
      }
      const preview = await prisma.$transaction(
        async (tx) => {
          const saved = await tx.outsideMealPreview.create({
            data: {
              userId: input.userId,
              mealName: requested.map((item) => item.name).join(', '),
              mealType: input.mealType,
              estimate: summary.totals,
              items: resolved as unknown as Prisma.InputJsonValue,
              warnings,
              reasons: warnings,
              notes: input.notes,
              estimationContext: input.estimationContext?.trim() || null,
              loggedForAt: consumedAt,
              requestPayloadHash: payloadHash,
              requestKey: input.requestKey,
              usedAi: resolved.some((item) => item.source === OutsideMealItemSource.GEMINI_ESTIMATED),
              expiresAt: new Date(Date.now() + 20 * 60 * 1000),
            },
          });
          if (membershipReservation && !membershipReservation.replayed)
            await MembershipService.complete(membershipReservation.id, tx);
          return saved;
        },
        { maxWait: 10_000, timeout: 30_000 }
      );
      return this.serializePreview(preview);
    } catch (error) {
      await MembershipService.release((membershipReservation as { id: string } | null)?.id);
      if (aiUsageId) await prisma.outsideMealAiUsage.deleteMany({ where: { id: aiUsageId, userId: input.userId } });
      if (input.requestKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const prior = await prisma.outsideMealPreview.findUnique({ where: { requestKey: input.requestKey } });
        if (prior?.userId === input.userId && prior.requestPayloadHash === payloadHash) {
          if (prior.consumedAt)
            return this.commitPreview({ ...input, confirmationId: prior.id, warningAcknowledged: true });
          if (prior.expiresAt > new Date()) return this.serializePreview(prior);
        }
      }
      throw error;
    }
  }

  private static async resolveFreeItem(item: InputItem, user: any, restrictions: any): Promise<ResolvedItem> {
    const library =
      item.portionGrams && !item.mealLibraryId
        ? null
        : await prisma.mealLibrary.findFirst({
            where: {
              ...(item.mealLibraryId
                ? { id: item.mealLibraryId, mealName: { equals: item.name, mode: 'insensitive' } }
                : {
                    mealName: { equals: item.name, mode: 'insensitive' },
                    status: 'APPROVED',
                    verifiedByNutritionistId: { not: null },
                    safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
                  }),
            },
            include: certifiedLibraryMealInclude,
          });
    const eligibleLibrary =
      library &&
      isCertifiedLibraryMealCompatible(
        library,
        user.healthConditions.map((row: any) => row.condition),
        user.allergies.map((row: any) => row.allergen),
        {
          userId: user.id,
          dietaryPreference: user.userProfile.dietaryPreference,
          goal: null,
          otherConditions: user.userProfile.otherConditions,
          otherAllergies: user.userProfile.otherAllergies,
          safetyEntries: user.safetyProfileEntries,
        }
      );
    if (item.reportedNutrition) {
      assertValidOutsideMealMacros(item.reportedNutrition);
      return applySafetyWarnings(
        {
          ...emptyResolved(item),
          ...item.reportedNutrition,
          source:
            eligibleLibrary && item.mealLibraryId
              ? OutsideMealItemSource.USER_ADJUSTED_LIBRARY
              : OutsideMealItemSource.USER_REPORTED,
          nutritionStatus: OutsideMealNutritionStatus.USER_REPORTED,
          compatibilityStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
          includedInTotals: true,
          mealLibraryId: item.mealLibraryId && library ? library.id : null,
          servingDescription:
            item.mealLibraryId && library
              ? library.nutritionServingDescription || 'One recipe serving'
              : item.portionGrams
                ? `${item.portionGrams} g consumed`
                : null,
          ingredients: item.mealLibraryId && library ? library.ingredients.map((row) => row.ingredientName) : [],
          warnings: [
            eligibleLibrary && item.mealLibraryId
              ? 'You adjusted the library serving or macros; these values are user-reported.'
              : 'User-reported nutrition-label or menu values; KAINARA has not independently verified them.',
          ],
        },
        restrictions
      );
    }
    if (library && item.portionGrams) {
      return applySafetyWarnings(
        {
          ...emptyResolved(item),
          mealLibraryId: library.id,
          ingredients: library.ingredients.map((row) => row.ingredientName),
          warnings: [
            'A measured recipe portion needs nutrition for that amount. The saved recipe has no measured serving weight; its full-serving values cannot be used for these grams.',
          ],
        },
        restrictions
      );
    }
    if (eligibleLibrary) {
      return {
        ...emptyResolved(item),
        source: OutsideMealItemSource.VERIFIED_LIBRARY,
        nutritionStatus: OutsideMealNutritionStatus.REFERENCE_RESOLVED,
        compatibilityStatus: OutsideMealCompatibilityStatus.NO_KNOWN_CONFLICT,
        includedInTotals: true,
        calories: library.calories,
        proteinG: library.proteinG,
        carbsG: library.carbsG,
        fatG: library.fatG,
        mealLibraryId: library.id,
        servingDescription: library.nutritionServingDescription || 'One recipe serving',
        ingredients: library.ingredients.map((row) => row.ingredientName),
        warnings: [],
      };
    }

    if (!item.portionGrams)
      return applySafetyWarnings(
        {
          ...emptyResolved(item),
          mealLibraryId: item.mealLibraryId && library ? library.id : null,
          ingredients: item.mealLibraryId && library ? library.ingredients.map((row) => row.ingredientName) : [],
        },
        restrictions
      );
    const exact = await prisma.foodItem.findFirst({
      where: { source: 'FNRI', name: { equals: item.name, mode: 'insensitive' } },
    });
    const alias = exact
      ? null
      : await prisma.foodAlias.findFirst({
          where: {
            foodItem: { source: 'FNRI' },
            OR: [
              { normalizedAlias: normalizeFoodName(item.name) },
              { alias: { equals: item.name, mode: 'insensitive' } },
            ],
          },
          include: { foodItem: true },
        });
    const trustedAlias =
      alias?.foodItem && (alias.verifiedAt !== null || selectStrongFNRIMatch(item.name, [alias.foodItem]));
    let food = exact ?? (trustedAlias ? alias.foodItem : null);
    if (!food) {
      const firstToken = normalize(item.name).split(/\s+/)[0];
      const candidates = await prisma.foodItem.findMany({
        where: { source: 'FNRI', name: { contains: firstToken, mode: 'insensitive' } },
        take: 30,
      });
      food = selectStrongFNRIMatch(item.name, candidates);
    }
    if (!food)
      return applySafetyWarnings(
        {
          ...emptyResolved(item),
          mealLibraryId: item.mealLibraryId && library ? library.id : null,
          ingredients: item.mealLibraryId && library ? library.ingredients.map((row) => row.ingredientName) : [],
        },
        restrictions
      );
    const macros = scalePer100GramMacros(food, item.portionGrams);
    return applySafetyWarnings(
      {
        ...emptyResolved(item),
        ...macros,
        name: food.name,
        source: OutsideMealItemSource.FNRI,
        nutritionStatus: OutsideMealNutritionStatus.REFERENCE_RESOLVED,
        compatibilityStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
        includedInTotals: true,
        foodItemId: food.id,
        warnings: ['FNRI composition scaled from per-100 g data. Ingredient-level compatibility is not established.'],
      },
      restrictions
    );
  }

  private static async estimateWithAi(items: InputItem[], estimationContext: string) {
    const { prompt, systemInstruction } = buildOutsideMealAiPrompt(items, estimationContext);
    const response = await generateGenerativeJSON(prompt, systemInstruction, buildOutsideMealAiSchema(items.length), {
      operation: 'OUTSIDE_MEAL_ESTIMATE',
      purpose: 'OUTSIDE_MEAL_ITEM_ESTIMATION',
    });
    return response.items;
  }

  private static serializePreview(preview: {
    id: string;
    estimate: unknown;
    items: unknown;
    warnings: unknown;
    reasons: unknown;
    usedAi: boolean;
    expiresAt: Date;
  }) {
    const items = Array.isArray(preview.items) ? (preview.items as ResolvedItem[]) : [];
    return {
      warningRequired: true,
      previewRequired: true,
      confirmationId: preview.id,
      warnings: Array.isArray(preview.warnings) ? preview.warnings : [],
      reasons: Array.isArray(preview.reasons) ? preview.reasons : [],
      estimate: preview.estimate,
      items,
      summary: summarizeOutsideMealNutrition(items),
      usedAi: preview.usedAi,
      expiresAt: preview.expiresAt,
    };
  }

  private static async commitPreview(
    input: LogOutsideMealInput,
    attempt = 0
  ): Promise<{
    warningRequired: false;
    log: Prisma.MealLogGetPayload<{ include: { outsideItems: true } }>;
    summary: ReturnType<typeof summarizeOutsideMealNutrition>;
    safetyFollowUp: unknown;
    replayed: boolean;
  }> {
    if (!input.confirmationId) throw new AppError('Preview confirmation is required.', 400, 'PREVIEW_REQUIRED');
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Lock before FK inserts; upgrading a later shared User lock can deadlock concurrent saves.
          await lockUserProfile(tx, input.userId);
          const previous = await tx.mealLog.findFirst({
            where: { userId: input.userId, outsidePreviewId: input.confirmationId, source: MealLogSource.USER_LOGGED },
            include: { outsideItems: true },
          });
          if (previous) {
            if (input.requestRndReview && previous.outsideItems[0])
              await admitOutsideMealReview(tx, input.userId, previous.id, previous.outsideItems[0].id);
            return {
              warningRequired: false,
              log: previous,
              summary: summarizeOutsideMealNutrition(
                previous.outsideItems.map((item) => ({
                  source: item.source,
                  nutritionStatus: item.nutritionStatus,
                  includedInTotals: item.includedInTotals,
                  calories: item.calories ?? 0,
                  proteinG: item.proteinG ?? 0,
                  carbsG: item.carbsG ?? 0,
                  fatG: item.fatG ?? 0,
                }))
              ),
              safetyFollowUp: previous.outsideSafetyFollowUp,
              replayed: true,
            };
          }
          const preview = await tx.outsideMealPreview.findFirst({
            where: { id: input.confirmationId, userId: input.userId, consumedAt: null, expiresAt: { gt: new Date() } },
          });
          if (!preview) throw new AppError('This preview expired or was already used.', 409, 'PREVIEW_EXPIRED_OR_USED');
          if (input.requestKey && preview.requestKey !== input.requestKey)
            throw new AppError('The confirmation does not match this preview.', 409, 'PREVIEW_KEY_MISMATCH');
          const items = Array.isArray(preview.items) ? (preview.items as unknown as ResolvedItem[]) : [];
          if (items.length === 0) throw new AppError('This preview has no item data.', 409, 'INVALID_PREVIEW');
          const user = await tx.user.findUnique({
            where: { id: input.userId },
            include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true },
          });
          if (!user?.userProfile)
            throw new AppError('Complete your profile before logging meals.', 422, 'PROFILE_REQUIRED');
          const restrictions = adaptUserSafetyRestrictions({
            safetyEntries: user.safetyProfileEntries,
            healthConditions: user.healthConditions.map((row) => row.condition),
            allergies: user.allergies.map((row) => row.allergen),
            otherConditions: user.userProfile.otherConditions,
            otherAllergies: user.userProfile.otherAllergies,
          });
          const committedItems = items.map((item) => applySafetyWarnings(item, restrictions));
          const summary = summarizeOutsideMealNutrition(committedItems);
          const conflicts = committedItems.filter(
            (item) => item.compatibilityStatus === OutsideMealCompatibilityStatus.CONFLICT_DETECTED
          );
          const uncertain = committedItems.some(
            (item) => item.compatibilityStatus !== OutsideMealCompatibilityStatus.NO_KNOWN_CONFLICT
          );
          const safetyFollowUp = {
            status: conflicts.length ? 'CONFLICT_DETECTED' : uncertain ? 'INSUFFICIENT_EVIDENCE' : 'NO_KNOWN_CONFLICT',
            messages: [...new Set(committedItems.flatMap((item) => item.warnings))],
          };
          const warnings = safetyFollowUp.messages;
          await setMealLogAuditContext(tx, input.userId, 'Member recorded outside meal');
          const log = await tx.mealLog.create({
            data: {
              userId: input.userId,
              outsidePreviewId: preview.id,
              outsideSafetyFollowUp: safetyFollowUp,
              source: MealLogSource.USER_LOGGED,
              mealName: preview.mealName,
              mealType: preview.mealType,
              calories: summary.totals.calories,
              proteinG: summary.totals.proteinG,
              carbsG: summary.totals.carbsG,
              fatG: summary.totals.fatG,
              provisionalCalories: summary.provisionalCalories,
              nutritionCompleteness: summary.completeness,
              dataSource: dataSourceFor(items),
              status: MealLogStatus.DONE,
              warningType: warnings.length ? 'OUTSIDE_MEAL_REVIEW' : null,
              warningShown: false,
              warningAcknowledged: false,
              notes: preview.notes,
              estimationContext: preview.estimationContext,
              loggedAt: preview.loggedForAt ?? new Date(),
              outsideItems: {
                create: committedItems.map((item, position) => ({
                  position,
                  name: item.name,
                  portionGrams: item.portionGrams,
                  source: item.source,
                  nutritionStatus: item.nutritionStatus,
                  compatibilityStatus: item.compatibilityStatus,
                  includedInTotals: item.includedInTotals,
                  calories: item.includedInTotals ? item.calories : null,
                  proteinG: item.includedInTotals ? item.proteinG : null,
                  carbsG: item.includedInTotals ? item.carbsG : null,
                  fatG: item.includedInTotals ? item.fatG : null,
                  calorieLow: item.calorieLow,
                  calorieHigh: item.calorieHigh,
                  foodItemId: item.foodItemId,
                  mealLibraryId: item.mealLibraryId,
                  ingredients: item.ingredients,
                  revisions: {
                    create: {
                      revision: 0,
                      source: item.source,
                      nutritionStatus: item.nutritionStatus,
                      calories: item.includedInTotals ? item.calories : null,
                      proteinG: item.includedInTotals ? item.proteinG : null,
                      carbsG: item.includedInTotals ? item.carbsG : null,
                      fatG: item.includedInTotals ? item.fatG : null,
                      calorieLow: item.calorieLow,
                      calorieHigh: item.calorieHigh,
                      reason: 'Initial outside-meal record',
                      snapshot: item as unknown as Prisma.InputJsonValue,
                    },
                  },
                })),
              },
            },
            include: { outsideItems: true },
          });
          if (input.requestRndReview) await admitOutsideMealReview(tx, input.userId, log.id, log.outsideItems[0].id);
          await recalculateDailyNutritionLog(input.userId, log.loggedAt, tx);
          await tx.outsideMealPreview.update({ where: { id: preview.id }, data: { consumedAt: new Date() } });
          return { warningRequired: false, log, summary, safetyFollowUp, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 60_000 }
      );
    } catch (error) {
      if (attempt < 2 && isOutsideReviewWriteConflict(error)) {
        return this.commitPreview(input, attempt + 1);
      }
      throw error;
    }
  }
}
