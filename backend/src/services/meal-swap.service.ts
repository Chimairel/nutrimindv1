import prisma from '@/lib/prisma';
import { createHash } from 'node:crypto';
import { lockUserProfile } from './profile-revision.service';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { isMealWithinSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { rankLibraryMeals } from '@/domain/library-ranking.policy';
import { additionalShoppingNeeds } from '@/domain/swap-shopping.policy';
import { MealLibrarySafetyEvidenceStatus, MealType, Prisma } from '@prisma/client';
import { GroceryService } from './grocery.service';
import {
  assertUserActionableMealPlan,
  filterUserActionableMealPlans,
  getApprovedMealLibraryWhere,
  getApprovedMealPlanStatusWhere,
  getNutritionEligibleMealLogWhere,
  getOwnedMealPlanWhere,
  isApprovedMealLibraryStatus,
} from '@/domain/meal-actionability.policy';
import { evaluateMealLibrarySafetyEvidence } from '@/domain/meal-library-safety-evidence.policy';
import { evaluateMealGenerationLibraryCompatibility } from '@/domain/meal-generation-library-compatibility.adapter';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import {
  adaptUserSafetyRestrictions,
  type StructuredSafetyRestrictionEntry,
} from '@/domain/structured-restriction.adapter';
import { weeklySwapCapForTier } from '@/domain/billing-entitlement.policy';
import { resolveUserBillingEntitlement } from './user-entitlement-reader.service';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { toPublicMealImage } from '@/domain/meal-image.policy';

export class SwapLimitReachedError extends Error {
  readonly code = 'WEEKLY_SWAP_LIMIT_REACHED';

  constructor(readonly cap: number) {
    super(`Swap limit reached. Your current weekly limit is ${cap}.`);
    this.name = 'SwapLimitReachedError';
  }
}

type SwapReservationClient = Pick<Prisma.TransactionClient, 'planSwapTracker'>;
type SwapMealReadClient = Pick<Prisma.TransactionClient, 'mealPlan'>;

async function loadActionableUnloggedMealPlan(client: SwapMealReadClient, userId: string, mealPlanId: string) {
  const mealPlan = await client.mealPlan.findFirst({
    where: getOwnedMealPlanWhere(userId, mealPlanId),
    include: { mealLogs: { where: { userId } } },
  });
  if (!mealPlan) throw new Error('Meal plan slot not found.');

  assertUserActionableMealPlan(mealPlan);
  if (mealPlan.mealLogs.some((log) => log.status === 'DONE' || log.status === 'SKIPPED')) {
    throw new Error('Cannot swap a meal that has already been eaten or skipped.');
  }
  return mealPlan;
}

export async function reserveWeeklySwap(
  transaction: SwapReservationClient,
  input: { trackerId: string; userId: string; cap: number }
): Promise<number> {
  const reserved = await transaction.planSwapTracker.updateMany({
    where: { id: input.trackerId, userId: input.userId, swapsUsed: { lt: input.cap } },
    data: { swapsUsed: { increment: 1 } },
  });
  if (reserved.count !== 1) throw new SwapLimitReachedError(input.cap);
  const tracker = await transaction.planSwapTracker.findUniqueOrThrow({
    where: { id: input.trackerId },
    select: { swapsUsed: true },
  });
  return tracker.swapsUsed;
}

export const certifiedLibraryMealInclude = {
  ingredients: { orderBy: { position: 'asc' as const } },
  safetyDeclarations: true,
  safetyReviewedByNutritionist: {
    include: { user: { select: { role: true, name: true } } },
  },
  verifiedByNutritionist: {
    include: { user: { select: { name: true } } },
  },
} as const;

type CertifiedLibraryMeal = Prisma.MealLibraryGetPayload<{ include: typeof certifiedLibraryMealInclude }>;

export function toPublicSwapOption(meal: CertifiedLibraryMeal) {
  return {
    id: meal.id,
    mealName: meal.mealName,
    description: meal.description,
    mealType: meal.mealType,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    image: toPublicMealImage(meal),
    verifiedBy: meal.safetyReviewedByNutritionist?.user.name || 'System',
    prcLicenseNumber: meal.safetyReviewedByNutritionist?.prcLicenseNumber || 'N/A',
    verifier: meal.safetyReviewedByNutritionist
      ? {
          name: meal.safetyReviewedByNutritionist.user.name,
          prcLicenseNumber: meal.safetyReviewedByNutritionist.prcLicenseNumber,
          prcLicenseExpiry: meal.safetyReviewedByNutritionist.prcLicenseExpiry,
          specialization: meal.safetyReviewedByNutritionist.specialization,
          yearsOfExperience: meal.safetyReviewedByNutritionist.yearsOfExperience,
          university: meal.safetyReviewedByNutritionist.university,
          bio: meal.safetyReviewedByNutritionist.bio,
        }
      : null,
  };
}

export type UserCompatibilityProfile = {
  dietaryPreference: string | null;
  goal: string | null;
  otherConditions: string | null;
  otherAllergies: string | null;
  safetyEntries?: readonly StructuredSafetyRestrictionEntry[];
};

export function isCertifiedLibraryMealCompatible(
  meal: any,
  userConditions: readonly string[],
  userAllergens: readonly string[],
  profile: UserCompatibilityProfile
): boolean {
  const safety = evaluateMealLibrarySafetyEvidence({
    ...meal,
    reviewerEligible: meal.safetyReviewedByNutritionist
      ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      : false,
  });
  if (!safety.complete) return false;

  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  const compatibility = evaluateMealGenerationLibraryCompatibility({
    userRestrictions: restrictions.evaluationRestrictions,
    candidate: {
      status: meal.status,
      suitableConditions: safety.suitableConditions,
      allergenFree: safety.allergenFree,
      safetyEvidence: safety.adapterEvidence,
      ingredients: safety.ingredients,
    },
  });
  if (!compatibility.eligible) return false;

  const tags = Array.isArray(meal.dietaryTags) ? meal.dietaryTags : [];
  if (profile.dietaryPreference && !tags.includes(profile.dietaryPreference)) return false;
  if (profile.goal && !tags.includes(profile.goal)) return false;
  return true;
}

export class MealSwapService {
  /**
   * Returns a list of compatible verified replacement meals from MealLibrary.
   */
  static async getEligibleSwapOptions(userId: string, mealPlanId: string) {
    // 1. Fetch the target meal plan slot
    const mealPlan = await loadActionableUnloggedMealPlan(prisma, userId, mealPlanId);

    // 2. Fetch user profile, health conditions, and allergies
    const { user, profile: userProfile } = await loadUserNutritionContext(prisma, userId, 'User profile not found.');
    const { healthConditions, allergies } = user;
    const userConditions = healthConditions.map((c) => c.condition);
    const userAllergens = allergies.map((a) => a.allergen);

    // 3. Find or create the PlanSwapTracker for this planGroupId
    let swapTracker = await prisma.planSwapTracker.findUnique({
      where: { planGroupId: mealPlan.planGroupId },
    });

    if (!swapTracker) {
      swapTracker = await prisma.planSwapTracker.create({
        data: {
          planGroupId: mealPlan.planGroupId,
          userId,
          swapsUsed: 0,
        },
      });
    }
    const entitlement = await resolveUserBillingEntitlement(prisma, userId, new Date());
    const swapCap = weeklySwapCapForTier(entitlement.tier);

    // 4. Query APPROVED library meals matching this mealType
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        mealType: mealPlan.mealType,
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...getApprovedMealLibraryWhere(),
      },
      include: certifiedLibraryMealInclude,
    });

    const usedLibraryMeals = await prisma.mealPlan.findMany({
      where: {
        userId,
        planGroupId: mealPlan.planGroupId,
        id: { not: mealPlan.id },
        libraryMealId: { not: null },
      },
      select: { libraryMealId: true },
    });
    const usedLibraryMealIds = new Set(
      usedLibraryMeals.map((item) => item.libraryMealId).filter((id): id is string => Boolean(id))
    );

    // 5. Only first-class, current, independently reviewed evidence can authorize a swap.
    const eligibleMeals = libraryMeals.filter(
      (meal) =>
        meal.id !== mealPlan.libraryMealId &&
        !usedLibraryMealIds.has(meal.id) &&
        isCertifiedLibraryMealCompatible(meal, userConditions, userAllergens, {
          ...userProfile,
          safetyEntries: user.safetyProfileEntries,
        })
    );

    return {
      swapOptions: rankLibraryMeals(eligibleMeals, userProfile.dailyCalorieTarget ?? 2000, mealPlan.calories).map(
        toPublicSwapOption
      ),
      swapsUsed: swapTracker.swapsUsed,
      swapCap,
    };
  }

  /**
   * Generates a preview of the calorie delta and projected day total before confirming a swap.
   */
  static async getSwapPreview(
    userId: string,
    mealPlanId: string,
    libraryMealId: string,
    client: Prisma.TransactionClient = prisma
  ) {
    // 1. Fetch the current meal plan slot
    const mealPlan = await loadActionableUnloggedMealPlan(client, userId, mealPlanId);

    // 2. Fetch the proposed replacement library meal
    const libraryMeal = await client.mealLibrary.findUnique({
      where: { id: libraryMealId },
      include: certifiedLibraryMealInclude,
    });
    if (!libraryMeal) throw new Error('Library meal not found.');
    if (!isApprovedMealLibraryStatus(libraryMeal.status)) {
      throw new Error('Selected replacement meal is not available or approved.');
    }

    const { user, profile: userProfile } = await loadUserNutritionContext(client, userId, 'User profile not found.');
    if (
      !isCertifiedLibraryMealCompatible(
        libraryMeal,
        user.healthConditions.map((item) => item.condition),
        user.allergies.map((item) => item.allergen),
        { ...userProfile, safetyEntries: user.safetyProfileEntries }
      )
    ) {
      throw new Error('Selected replacement meal is not certified for your current health profile.');
    }

    if (libraryMeal.mealType !== mealPlan.mealType) throw new Error('Replacement must match the meal type.');
    if (
      !isMealWithinSlotCalorieRange({
        calories: libraryMeal.calories,
        mealType: libraryMeal.mealType,
        dailyCalorieTarget: userProfile.dailyCalorieTarget ?? 2000,
      })
    )
      throw new Error('This serving does not fit your current meal target.');
    // 3. Fetch all meals on the same day in the same planGroup
    const startOfDay = getStartOfManilaBusinessDay(mealPlan.scheduledDate);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

    const dayMealRows = await client.mealPlan.findMany({
      where: {
        planGroupId: mealPlan.planGroupId,
        userId,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        ...getApprovedMealPlanStatusWhere(),
      },
    });
    const dayMeals = filterUserActionableMealPlans(dayMealRows);

    // 4. Calculate projected day total (replace current meal's cals with new)
    let projectedDayTotal = 0;
    for (const meal of dayMeals) {
      if (meal.id === mealPlanId) {
        projectedDayTotal += libraryMeal.calories;
      } else {
        projectedDayTotal += meal.calories;
      }
    }

    // 5. Get daily target
    const profile = await client.userProfile.findUnique({ where: { userId } });
    const dailyTarget = profile?.dailyCalorieTarget || 2000;

    // 6. Determine if warning is needed (±15%)
    const lowerBound = dailyTarget * 0.85;
    const upperBound = dailyTarget * 1.15;
    const warningRequired = projectedDayTotal < lowerBound || projectedDayTotal > upperBound;

    const cycle = await client.mealPlan.findMany({
      where: { userId, planGroupId: mealPlan.planGroupId, ...getApprovedMealPlanStatusWhere() },
      include: { ingredients: true },
      orderBy: { id: 'asc' },
    });
    const list = await GroceryService.findCycleList(client, userId, mealPlan.planGroupId);
    const purchases = list?.groceryItems ?? [];
    const shoppingNeeds = additionalShoppingNeeds(
      cycle.flatMap((meal) => meal.ingredients),
      cycle.flatMap<{ ingredientName: string; quantity: number | null; unit: string | null }>((meal) =>
        meal.id === mealPlanId ? libraryMeal.ingredients : meal.ingredients
      ),
      purchases
    );
    // The token binds the confirmation to every input that could change its meaning.
    const previewToken = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          mealPlan,
          libraryMeal,
          revision: userProfile.revision,
          dailyTarget,
          dayMeals,
          cycle,
          purchases,
        })
      )
      .digest('hex');
    return {
      previewToken,
      shoppingNeeds,
      originalMealName: mealPlan.mealName,
      originalCalories: mealPlan.calories,
      newMealName: libraryMeal.mealName,
      newCalories: libraryMeal.calories,
      calorieDelta: libraryMeal.calories - mealPlan.calories,
      projectedDayTotal: Math.round(projectedDayTotal),
      dailyTarget,
      warningRequired,
    };
  }

  /**
   * Swaps a user's meal plan slot with a verified library meal.
   */
  static async swapMeal(
    userId: string,
    mealPlanId: string,
    newLibraryMealId: string,
    warningShown?: boolean,
    warningAcknowledged?: boolean,
    previewToken?: string,
    requestKey?: string
  ) {
    const swapResult = await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        if (!requestKey || !previewToken) throw new Error('Preview this swap before confirming.');
        const key = userId + ':' + requestKey;
        const previous = await tx.swapLog.findUnique({
          where: { requestKey: key },
          include: { planSwapTracker: true },
        });
        if (previous) {
          if (previous.mealPlanId !== mealPlanId || previous.newLibraryMealId !== newLibraryMealId)
            throw new Error('Request key already used for a different swap.');
          const entitlement = await resolveUserBillingEntitlement(tx, userId, new Date());
          return {
            success: true,
            swapsUsed: previous.planSwapTracker.swapsUsed,
            swapCap: weeklySwapCapForTier(entitlement.tier),
            updatedPlan: await tx.mealPlan.findUniqueOrThrow({ where: { id: mealPlanId } }),
          };
        }
        const preview = await this.getSwapPreview(userId, mealPlanId, newLibraryMealId, tx);
        if (preview.previewToken !== previewToken)
          throw new Error('Your plan, profile or shopping list changed. Review a fresh preview.');
        if (preview.warningRequired && !warningAcknowledged)
          throw new Error('Acknowledge the current calorie warning before swapping.');
        // 1. Fetch target meal plan slot
        const mealPlan = await loadActionableUnloggedMealPlan(tx, userId, mealPlanId);

        // 2. Fetch user profile, health conditions, and allergies
        const { user, profile: userProfile } = await loadUserNutritionContext(tx, userId, 'User profile not found.');
        const { healthConditions, allergies } = user;
        const userConditions = healthConditions.map((c) => c.condition);
        const userAllergens = allergies.map((a) => a.allergen);

        // 3. Find or create swap tracker
        const swapTracker = await tx.planSwapTracker.upsert({
          where: { planGroupId: mealPlan.planGroupId },
          update: {},
          create: { planGroupId: mealPlan.planGroupId, userId, swapsUsed: 0 },
        });
        if (swapTracker.userId !== userId) throw new Error('Swap tracker ownership mismatch.');
        const entitlement = await resolveUserBillingEntitlement(tx, userId, new Date());
        const swapCap = weeklySwapCapForTier(entitlement.tier);
        const swapsUsed = await reserveWeeklySwap(tx, { trackerId: swapTracker.id, userId, cap: swapCap });

        // 4. Fetch and verify replacement meal
        const libraryMeal = await tx.mealLibrary.findUnique({
          where: { id: newLibraryMealId },
          include: certifiedLibraryMealInclude,
        });

        if (!libraryMeal || !isApprovedMealLibraryStatus(libraryMeal.status)) {
          throw new Error('Selected replacement meal is not available or approved.');
        }

        if (libraryMeal.mealType !== mealPlan.mealType) {
          throw new Error('Selected replacement meal type does not match slot meal type.');
        }

        const alreadyUsedInPlan = await tx.mealPlan.findFirst({
          where: {
            userId,
            planGroupId: mealPlan.planGroupId,
            id: { not: mealPlan.id },
            libraryMealId: libraryMeal.id,
          },
          select: { id: true },
        });
        if (alreadyUsedInPlan) {
          throw new Error('Selected replacement meal is already used in this plan.');
        }

        if (
          !isCertifiedLibraryMealCompatible(libraryMeal, userConditions, userAllergens, {
            ...userProfile,
            safetyEntries: user.safetyProfileEntries,
          })
        ) {
          throw new Error('Selected meal is not certified for your current health profile.');
        }

        // 5. Update MealPlan row details
        const updatedPlan = await tx.mealPlan.update({
          where: { id: mealPlanId },
          data: {
            mealName: libraryMeal.mealName,
            description: libraryMeal.description,
            calories: libraryMeal.calories,
            proteinG: libraryMeal.proteinG,
            carbsG: libraryMeal.carbsG,
            fatG: libraryMeal.fatG,
            libraryMealId: libraryMeal.id,
            status: 'APPROVED',
            requiresSafetyRevalidation: false,
            safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            highRiskReviewRequired: false,
            reviewApprovalCount: 1,
            nutritionistId: libraryMeal.safetyReviewedByNutritionistId,
            reviewedAt: new Date(),
            // The original generation evidence no longer describes this
            // user-selected replacement. Do not retain a stale rationale.
            selectionEvidence: Prisma.DbNull,
          },
        });

        // 6. Copy the certified first-class library ingredients, including quantities.
        await tx.mealIngredient.deleteMany({
          where: { mealPlanId },
        });

        const ingredientsData = libraryMeal.ingredients.map((ing) => ({
          ingredientName: ing.ingredientName,
          category: ing.category,
          foodItemId: ing.foodItemId,
          dataSource: ing.dataSource,
          quantity: ing.quantity,
          unit: ing.unit,
        }));

        if (ingredientsData.length > 0) {
          await tx.mealIngredient.createMany({
            data: ingredientsData.map((ing) => ({
              mealPlanId,
              ingredientName: ing.ingredientName,
              category: ing.category,
              foodItemId: ing.foodItemId,
              dataSource: ing.dataSource,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
          });
        }

        // 7. Increment usageCount on newly selected library entry
        await tx.mealLibrary.update({
          where: { id: libraryMeal.id },
          data: {
            usageCount: { increment: 1 },
          },
        });

        // 8b. Create SwapLog entry for calorie tracking
        await tx.swapLog.create({
          data: {
            planSwapTrackerId: swapTracker.id,
            mealPlanId,
            originalMealName: mealPlan.mealName,
            originalCalories: mealPlan.calories,
            newMealName: libraryMeal.mealName,
            newCalories: libraryMeal.calories,
            calorieDelta: libraryMeal.calories - mealPlan.calories,
            requestKey: key,
            newLibraryMealId,
            warningShown: preview.warningRequired,
            warningAcknowledged: warningAcknowledged || false,
          },
        });

        // 8c. Create MealLog with USER_SWAPPED source
        await tx.mealLog.upsert({
          where: { mealPlanId },
          update: {
            source: 'USER_SWAPPED',
            mealName: libraryMeal.mealName,
            calories: libraryMeal.calories,
            proteinG: libraryMeal.proteinG,
            carbsG: libraryMeal.carbsG,
            fatG: libraryMeal.fatG,
            dataSource: 'FNRI',
            status: 'PENDING',
          },
          create: {
            userId,
            mealPlanId,
            source: 'USER_SWAPPED',
            mealName: libraryMeal.mealName,
            calories: libraryMeal.calories,
            proteinG: libraryMeal.proteinG,
            carbsG: libraryMeal.carbsG,
            fatG: libraryMeal.fatG,
            dataSource: 'FNRI',
            status: 'PENDING',
          },
        });

        await GroceryService.generateGroceryList(userId, tx, mealPlan.planGroupId);
        return {
          success: true,
          swapsUsed,
          swapCap,
          updatedPlan,
        };
      },
      { timeout: 30_000 }
    );

    // Recalculate daily nutrition logs for that slot's date if it has any logs
    try {
      await MealSwapService.recalculateDailyNutritionLog(userId, swapResult.updatedPlan.scheduledDate);
    } catch (nutritionErr) {
      console.error('[MealSwapService] Failed to recalculate nutrition log after swap:', nutritionErr);
    }

    return {
      success: true,
      swapsUsed: swapResult.swapsUsed,
      swapCap: swapResult.swapCap,
    };
  }

  /**
   * Recalculates DailyNutritionLog values if an upcoming meal on that day is swapped
   */
  static async recalculateDailyNutritionLog(userId: string, date: Date) {
    const startOfDay = getStartOfManilaBusinessDay(date);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

    // Find if a DailyNutritionLog exists for this day
    const existingLog = await prisma.dailyNutritionLog.findFirst({
      where: {
        userId,
        logDate: startOfDay,
      },
    });

    if (!existingLog) return; // If no log exists for this day yet, nothing to recalculate

    // Fetch all DONE meal logs for this day
    const mealLogs = await prisma.mealLog.findMany({
      where: {
        userId,
        status: 'DONE',
        ...getNutritionEligibleMealLogWhere(),
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const targetCalories = profile?.dailyCalorieTarget || 2000;

    let totalCalories = 0;
    let totalProteinG = 0;
    let totalCarbsG = 0;
    let totalFatG = 0;

    for (const log of mealLogs) {
      totalCalories += log.calories;
      totalProteinG += log.proteinG;
      totalCarbsG += log.carbsG;
      totalFatG += log.fatG;
    }

    let adherencePct = 0;
    if (totalCalories > 0) {
      const deviationPct = Math.abs((totalCalories - targetCalories) / targetCalories) * 100;
      adherencePct = Math.max(0, 100 - deviationPct);
    }

    await prisma.dailyNutritionLog.update({
      where: { id: existingLog.id },
      data: {
        totalCalories,
        totalProteinG,
        totalCarbsG,
        totalFatG,
        targetCalories,
        adherencePct,
      },
    });
  }

  /**
   * Returns all approved verified meals from MealLibrary that are clinically compatible with a user profile.
   */
  static async getCompatibleLibraryMeals(userId: string, mealType?: MealType, search?: string, date?: string) {
    // 1. Fetch user profile, health conditions, and allergies
    const { user, profile: userProfile } = await loadUserNutritionContext(prisma, userId, 'User profile not found.');
    const { healthConditions, allergies } = user;
    const userConditions = healthConditions.map((c) => c.condition);
    const userAllergens = allergies.map((a) => a.allergen);

    // 2. Query APPROVED library meals matching the optional mealType and search
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        ...getApprovedMealLibraryWhere(),
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...(mealType ? { mealType } : {}),
        ...(search
          ? {
              mealName: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: certifiedLibraryMealInclude,
    });

    // 3. Fail closed unless evidence is current, complete, and compatible.
    const eligibleMeals = libraryMeals.filter((meal) =>
      isCertifiedLibraryMealCompatible(meal, userConditions, userAllergens, {
        ...userProfile,
        safetyEntries: user.safetyProfileEntries,
      })
    );

    const start = date ? new Date(date + 'T00:00:00+08:00') : getStartOfManilaBusinessDay();
    const slots = await prisma.mealPlan.findMany({
      where: {
        userId,
        scheduledDate: { gte: start, lt: new Date(start.getTime() + 86400000) },
        ...getApprovedMealPlanStatusWhere(),
      },
      orderBy: { createdAt: 'desc' },
      select: { mealType: true, calories: true },
    });
    const targets: Record<string, number> = {};
    for (const slot of slots) targets[slot.mealType] ??= slot.calories;
    return rankLibraryMeals(eligibleMeals, userProfile.dailyCalorieTarget ?? 2000, targets).map(toPublicSwapOption);
  }
}
