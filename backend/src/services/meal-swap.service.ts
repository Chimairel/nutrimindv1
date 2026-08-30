import prisma from '@/lib/prisma';
import { MealLibrarySafetyEvidenceStatus, MealType } from '@prisma/client';
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
import {
  evaluateMealLibrarySafetyEvidence,
} from '@/domain/meal-library-safety-evidence.policy';
import {
  evaluateMealGenerationLibraryCompatibility,
} from '@/domain/meal-generation-library-compatibility.adapter';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';

export const certifiedLibraryMealInclude = {
  ingredients: { orderBy: { position: 'asc' as const } },
  safetyDeclarations: true,
  safetyReviewedByNutritionist: {
    include: { user: { select: { role: true } } },
  },
  verifiedByNutritionist: {
    include: { user: { select: { name: true } } },
  },
} as const;

export type UserCompatibilityProfile = {
  dietaryPreference: string | null;
  goal: string | null;
  otherConditions: string | null;
  otherAllergies: string | null;
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

  const compatibility = evaluateMealGenerationLibraryCompatibility({
    userRestrictions: {
      conditions: userConditions,
      allergies: userAllergens,
      customConditions: profile.otherConditions || '',
      customAllergies: profile.otherAllergies || '',
    },
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
    const mealPlan = await prisma.mealPlan.findFirst({
      where: getOwnedMealPlanWhere(userId, mealPlanId),
      include: {
        mealLogs: {
          where: { userId },
        },
      },
    });

    if (!mealPlan) {
      throw new Error('Meal plan slot not found.');
    }
    assertUserActionableMealPlan(mealPlan);

    // Check if slot has already been logged as DONE or SKIPPED
    const isLogged = mealPlan.mealLogs.some(
      (log) => log.status === 'DONE' || log.status === 'SKIPPED'
    );
    if (isLogged) {
      throw new Error('Cannot swap a meal that has already been eaten or skipped.');
    }

    // 2. Fetch user profile, health conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile not found.');
    }

    const { userProfile, healthConditions, allergies } = user;
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

    // 4. Query APPROVED library meals matching this mealType
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        mealType: mealPlan.mealType,
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...getApprovedMealLibraryWhere(),
      },
      include: certifiedLibraryMealInclude,
    });

    // 5. Only first-class, current, independently reviewed evidence can authorize a swap.
    const eligibleMeals = libraryMeals.filter((meal) =>
      isCertifiedLibraryMealCompatible(meal, userConditions, userAllergens, userProfile)
    );

    return {
      swapOptions: eligibleMeals.map((m) => ({
        id: m.id,
        mealName: m.mealName,
        description: m.description,
        mealType: m.mealType,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        verifiedBy: m.verifiedByNutritionist?.user.name || 'System',
        prcLicenseNumber: m.verifiedByNutritionist?.prcLicenseNumber || 'N/A',
      })),
      swapsUsed: swapTracker.swapsUsed,
      swapCap: 3,
    };
  }

  /**
   * Generates a preview of the calorie delta and projected day total before confirming a swap.
   */
  static async getSwapPreview(userId: string, mealPlanId: string, libraryMealId: string) {
    // 1. Fetch the current meal plan slot
    const mealPlan = await prisma.mealPlan.findFirst({
      where: getOwnedMealPlanWhere(userId, mealPlanId),
    });
    if (!mealPlan) throw new Error('Meal plan slot not found.');
    assertUserActionableMealPlan(mealPlan);

    // 2. Fetch the proposed replacement library meal
    const libraryMeal = await prisma.mealLibrary.findUnique({
      where: { id: libraryMealId },
      include: certifiedLibraryMealInclude,
    });
    if (!libraryMeal) throw new Error('Library meal not found.');
    if (!isApprovedMealLibraryStatus(libraryMeal.status)) {
      throw new Error('Selected replacement meal is not available or approved.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userProfile: true, healthConditions: true, allergies: true },
    });
    if (!user?.userProfile) throw new Error('User profile not found.');
    if (!isCertifiedLibraryMealCompatible(
      libraryMeal,
      user.healthConditions.map((item) => item.condition),
      user.allergies.map((item) => item.allergen),
      user.userProfile
    )) {
      throw new Error('Selected replacement meal is not certified for your current health profile.');
    }

    // 3. Fetch all meals on the same day in the same planGroup
    const startOfDay = new Date(mealPlan.scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealPlan.scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dayMealRows = await prisma.mealPlan.findMany({
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
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const dailyTarget = profile?.dailyCalorieTarget || 2000;

    // 6. Determine if warning is needed (±15%)
    const lowerBound = dailyTarget * 0.85;
    const upperBound = dailyTarget * 1.15;
    const warningRequired = projectedDayTotal < lowerBound || projectedDayTotal > upperBound;

    return {
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
    warningAcknowledged?: boolean
  ) {
    const swapResult = await prisma.$transaction(async (tx) => {
      // 1. Fetch target meal plan slot
      const mealPlan = await tx.mealPlan.findFirst({
        where: getOwnedMealPlanWhere(userId, mealPlanId),
        include: {
          mealLogs: {
            where: { userId },
          },
        },
      });

      if (!mealPlan) {
        throw new Error('Meal plan slot not found.');
      }
      assertUserActionableMealPlan(mealPlan);

      // Check if slot has already been logged as DONE or SKIPPED
      const isLogged = mealPlan.mealLogs.some(
        (log) => log.status === 'DONE' || log.status === 'SKIPPED'
      );
      if (isLogged) {
        throw new Error('Cannot swap a meal that has already been eaten or skipped.');
      }

      // 2. Fetch user profile, health conditions, and allergies
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          userProfile: true,
          healthConditions: true,
          allergies: true,
        },
      });

      if (!user || !user.userProfile) {
        throw new Error('User profile not found.');
      }

      const { userProfile, healthConditions, allergies } = user;
      const userConditions = healthConditions.map((c) => c.condition);
      const userAllergens = allergies.map((a) => a.allergen);

      // 3. Find or create swap tracker
      let swapTracker = await tx.planSwapTracker.findUnique({
        where: { planGroupId: mealPlan.planGroupId },
      });

      if (!swapTracker) {
        swapTracker = await tx.planSwapTracker.create({
          data: {
            planGroupId: mealPlan.planGroupId,
            userId,
            swapsUsed: 0,
          },
        });
      }

      // Check swap cap
      if (swapTracker.swapsUsed >= 3) {
        throw new Error('Swap limit reached. You can only perform 3 swaps per week.');
      }

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

      if (!isCertifiedLibraryMealCompatible(
        libraryMeal,
        userConditions,
        userAllergens,
        userProfile
      )) {
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
          nutritionistId: libraryMeal.verifiedByNutritionistId,
          reviewedAt: new Date(),
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

      // 7. Increment swap count in swapTracker
      const updatedTracker = await tx.planSwapTracker.update({
        where: { id: swapTracker.id },
        data: {
          swapsUsed: { increment: 1 },
        },
      });

      // 8. Increment usageCount on newly selected library entry
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
          warningShown: warningShown || false,
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

      return {
        success: true,
        swapsUsed: updatedTracker.swapsUsed,
        updatedPlan,
      };
    });

    // Recalculate grocery list after the transaction completes successfully
    try {
      await GroceryService.generateGroceryList(userId);
    } catch (groceryErr) {
      console.error('[MealSwapService] Failed to regenerate grocery list after swap:', groceryErr);
    }

    // Recalculate daily nutrition logs for that slot's date if it has any logs
    try {
      await MealSwapService.recalculateDailyNutritionLog(userId, swapResult.updatedPlan.scheduledDate);
    } catch (nutritionErr) {
      console.error('[MealSwapService] Failed to recalculate nutrition log after swap:', nutritionErr);
    }

    return {
      success: true,
      swapsUsed: swapResult.swapsUsed,
    };
  }

  /**
   * Recalculates DailyNutritionLog values if an upcoming meal on that day is swapped
   */
  static async recalculateDailyNutritionLog(userId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

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
  static async getCompatibleLibraryMeals(userId: string, mealType?: MealType, search?: string) {
    // 1. Fetch user profile, health conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile not found.');
    }

    const { userProfile, healthConditions, allergies } = user;
    const userConditions = healthConditions.map((c) => c.condition);
    const userAllergens = allergies.map((a) => a.allergen);

    // 2. Query APPROVED library meals matching the optional mealType and search
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        ...getApprovedMealLibraryWhere(),
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...(mealType ? { mealType } : {}),
        ...(search ? {
          mealName: {
            contains: search,
            mode: 'insensitive',
          },
        } : {}),
      },
      include: certifiedLibraryMealInclude,
    });

    // 3. Fail closed unless evidence is current, complete, and compatible.
    const eligibleMeals = libraryMeals.filter((meal) =>
      isCertifiedLibraryMealCompatible(meal, userConditions, userAllergens, userProfile)
    );

    return eligibleMeals.map((m) => ({
      id: m.id,
      mealName: m.mealName,
      description: m.description,
      mealType: m.mealType,
      calories: m.calories,
      proteinG: m.proteinG,
      carbsG: m.carbsG,
      fatG: m.fatG,
      verifiedBy: m.verifiedByNutritionist?.user.name || 'System',
      prcLicenseNumber: m.verifiedByNutritionist?.prcLicenseNumber || 'N/A',
    }));
  }
}
