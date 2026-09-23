import prisma from '@/lib/prisma';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { lockUserProfile } from './profile-revision.service';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import {
  getMealSlotCalorieRange,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import { rankLibraryMeals } from '@/domain/library-ranking.policy';
import { buildSwapShoppingDelta } from '@/domain/swap-shopping.policy';
import {
  HealthConditionType,
  MealPlanCycleStatus,
  MealType,
  Prisma,
  ProfileCycleAdaptationState,
  RecipeRiceRole,
  RicePreference,
  RiceRoleReviewStatus,
} from '@prisma/client';
import { GroceryService } from './grocery.service';
import {
  assertUserSwappableMealPlan,
  filterUserActionableMealPlans,
  getApprovedMealPlanStatusWhere,
  getOwnedMealPlanWhere,
  isApprovedMealLibraryStatus,
} from '@/domain/meal-actionability.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { resolvePlanTargetCalories } from '@/domain/plan-cycle-target.policy';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { toPublicMealImage } from '@/domain/meal-image.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  queryEligibleLibraryMeals,
  queryEligibleLibraryPage,
  type CertifiedLibraryMeal,
} from './meal-library-candidate-query.service';
import { composePlanWithPairedRice, replacePlanBaseServing } from './meal-plan-serving.service';
import { buildComposedServing } from '@/domain/composed-serving.policy';
import { chooseCookedRicePortionG } from '@/domain/upcoming-preparation.policy';
import { getLocalizedFoodConsumptionContext } from './food-consumption-context.service';
import { rankMealsByLocalizedFoodEvidence } from '@/domain/planning-location.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { recalculateDailyNutritionLog } from './meal-swap-nutrition.service';

type SwapMealReadClient = Pick<Prisma.TransactionClient, 'mealPlan' | 'mealPlanCycle'>;

type SwapRiceFood = {
  id: string;
  name: string;
  source: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function resolveReplacementServing(input: {
  meal: CertifiedLibraryMeal;
  mealType: MealType;
  dailyTarget: number;
  ricePreference: RicePreference;
  hasConditions: boolean;
  riceFood: SwapRiceFood | null;
}) {
  const { meal, mealType, dailyTarget, ricePreference, hasConditions, riceFood } = input;
  if (!isPrimaryMealType(mealType)) return null;
  let pairedRiceG: number | null = null;
  let nutrition = { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG };
  if (ricePreference === RicePreference.WITH_RICE && meal.riceRole === RecipeRiceRole.PAIR_WITH_RICE) {
    // The current condition clearances are scoped to the base serving. A rice
    // composition requires a separately reviewed composed serving signature.
    if (
      hasConditions ||
      meal.riceRoleReviewStatus !== RiceRoleReviewStatus.REVIEWED ||
      !riceFood ||
      !meal.recipeSignature
    )
      return null;
    const range = getMealSlotCalorieRange(dailyTarget, mealType);
    pairedRiceG = chooseCookedRicePortionG({
      baseCalories: meal.calories,
      riceCaloriesPer100G: riceFood.calories,
      slotTargetCalories: range.target,
      slotMinimumCalories: range.minimum,
      slotMaximumCalories: range.maximum,
    });
    if (!pairedRiceG) return null;
    nutrition = buildComposedServing({
      baseRecipeSignature: meal.recipeSignature,
      baseNutrition: nutrition,
      riceFood,
      cookedRiceG: pairedRiceG,
    }).total;
  }
  if (!isMealWithinSlotCalorieRange({ calories: nutrition.calories, mealType, dailyCalorieTarget: dailyTarget }))
    return null;
  return { ...nutrition, pairedRiceG };
}

async function loadActionableUnloggedMealPlan(client: SwapMealReadClient, userId: string, mealPlanId: string) {
  const mealPlan = await client.mealPlan.findFirst({
    where: getOwnedMealPlanWhere(userId, mealPlanId),
    include: { mealLogs: { where: { userId } }, cycle: true },
  });
  if (!mealPlan) throw new Error('Meal plan slot not found.');

  assertUserSwappableMealPlan(mealPlan);
  const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(userId, mealPlan.planGroupId, new Date(), client);
  if (!clearedIds.includes(mealPlan.id)) {
    throw new Error('This meal needs safety revalidation before it can be swapped.');
  }
  if (mealPlan.mealLogs.some((log) => log.status === 'DONE' || log.status === 'SKIPPED')) {
    throw new Error('Cannot swap a meal that has already been eaten or skipped.');
  }
  if (mealPlan.cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT) {
    throw new Error('This plan is waiting for profile review or safety revalidation.');
  }
  if (
    mealPlan.cycle.status === MealPlanCycleStatus.COMPLETED ||
    mealPlan.cycle.status === MealPlanCycleStatus.SUPERSEDED ||
    mealPlan.cycle.status === MealPlanCycleStatus.REVALIDATION_REQUIRED
  ) {
    throw new Error('This plan cycle is not open for meal swaps.');
  }
  return mealPlan;
}

const SWAP_PREVIEW_TTL_MS = 10 * 60 * 1000;

type SwapPreviewTokenPayload = { requestKey: string; snapshotHash: string; expiresAt: number };

function swapPreviewSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Swap previews are unavailable because the server signing secret is missing.');
  return secret;
}

function signSwapPreview(payload: SwapPreviewTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', swapPreviewSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySwapPreview(token: string): SwapPreviewTokenPayload {
  const [encoded, supplied] = token.split('.');
  if (!encoded || !supplied) throw new Error('Swap preview is invalid. Request a fresh preview.');
  const expected = createHmac('sha256', swapPreviewSecret()).update(encoded).digest();
  const suppliedBuffer = Buffer.from(supplied, 'base64url');
  if (expected.length !== suppliedBuffer.length || !timingSafeEqual(expected, suppliedBuffer)) {
    throw new Error('Swap preview is invalid. Request a fresh preview.');
  }
  let payload: SwapPreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SwapPreviewTokenPayload;
  } catch {
    throw new Error('Swap preview is invalid. Request a fresh preview.');
  }
  if (!payload.requestKey || !payload.snapshotHash || payload.expiresAt <= Date.now()) {
    throw new Error('Swap preview expired. Request a fresh preview.');
  }
  return payload;
}

export { certifiedLibraryMealInclude, isCertifiedLibraryMealCompatible };

export function toPublicSwapOption(
  meal: CertifiedLibraryMeal & { isFavorite?: boolean; alreadyPlannedInCycle?: boolean }
) {
  return {
    id: meal.id,
    mealName: meal.mealName,
    description: meal.description,
    mealType: meal.mealType,
    mealTypes: meal.applicableMealTypes.map((entry) => entry.mealType),
    riceRole: meal.riceRoleReviewStatus === 'REVIEWED' ? meal.riceRole : null,
    riceRoleReviewStatus: meal.riceRoleReviewStatus,
    includedRiceG: meal.riceRole === 'INCLUDES_RICE' ? meal.includedRiceG : null,
    servingDescription: meal.nutritionServingDescription || 'One recipe serving',
    isFavorite: 'isFavorite' in meal ? Boolean(meal.isFavorite) : false,
    alreadyPlannedInCycle: 'alreadyPlannedInCycle' in meal ? Boolean(meal.alreadyPlannedInCycle) : false,
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
          image: meal.safetyReviewedByNutritionist.user.image || null,
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

    // 3. Query APPROVED library meals matching this mealType
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

    const [cycleSnapshot, riceFood] = await Promise.all([
      prisma.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: mealPlan.planGroupId } }),
      userProfile.ricePreference === RicePreference.WITH_RICE &&
      !userConditions.some((condition) => condition !== HealthConditionType.NONE)
        ? prisma.foodItem.findFirst({
            where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
          })
        : Promise.resolve(null),
    ]);
    const dailyTarget = resolvePlanTargetCalories(
      cycleSnapshot?.dailyCalorieTarget,
      userProfile.dailyCalorieTarget,
      2000
    );
    const libraryMeals = await queryEligibleLibraryMeals({
      mealType: mealPlan.mealType,
      dailyCalorieTarget: dailyTarget,
      skipCalorieFilter: true,
      userConditions,
      userAllergens,
      profile: { ...userProfile, safetyEntries: user.safetyProfileEntries },
      excludeIds: [mealPlan.libraryMealId].filter((id): id is string => Boolean(id)),
      limit: 120,
    });

    const [favoriteRows, favoritePage, localizedConsumption] = await Promise.all([
      prisma.mealFavorite.findMany({
        where: { userId, mealLibraryId: { in: libraryMeals.map((meal) => meal.id) } },
        select: { mealLibraryId: true },
      }),
      queryEligibleLibraryPage({
        userId,
        mealType: mealPlan.mealType,
        userConditions,
        userAllergens,
        profile: { ...userProfile, safetyEntries: user.safetyProfileEntries },
        favoriteOnly: true,
        limit: 60,
      }),
      getLocalizedFoodConsumptionContext(userProfile),
    ]);
    const favorites = new Set(favoriteRows.map((row) => row.mealLibraryId));
    const candidateById = new Map(libraryMeals.map((meal) => [meal.id, meal]));
    for (const meal of favoritePage.items) {
      favorites.add(meal.id);
      candidateById.set(meal.id, meal);
    }
    if (favoritePage.nextCursor) {
      const secondFavoritePage = await queryEligibleLibraryPage({
        userId,
        mealType: mealPlan.mealType,
        userConditions,
        userAllergens,
        profile: { ...userProfile, safetyEntries: user.safetyProfileEntries },
        favoriteOnly: true,
        cursor: favoritePage.nextCursor,
        limit: 60,
      });
      for (const meal of secondFavoritePage.items) {
        favorites.add(meal.id);
        candidateById.set(meal.id, meal);
      }
    }
    const candidates = [...candidateById.values()];
    const localized = rankMealsByLocalizedFoodEvidence(
      candidates,
      new Set(localizedConsumption.items.map((food) => food.id)),
      new Map(localizedConsumption.foodGroups.map((group) => [group.code, group.score] as const))
    );
    const localityRank = new Map(localized.map((meal, index) => [meal.id, index]));
    const ricePreferenceScore = (riceRole: RecipeRiceRole | null) => {
      if (userProfile.ricePreference === RicePreference.NO_RICE) return riceRole === RecipeRiceRole.STANDALONE ? 1 : 0;
      if (userProfile.ricePreference === RicePreference.WITH_RICE)
        return riceRole === RecipeRiceRole.PAIR_WITH_RICE || riceRole === RecipeRiceRole.INCLUDES_RICE ? 1 : 0;
      return 0;
    };

    // Safety eligibility has already been enforced. Ranking may use preference
    // and variety facts but never promote a meal across a hard filter.
    const eligibleMeals = candidates
      .filter((meal) => meal.id !== mealPlan.libraryMealId)
      .flatMap((meal) => {
        const serving = resolveReplacementServing({
          meal,
          mealType: mealPlan.mealType,
          dailyTarget,
          ricePreference: userProfile.ricePreference,
          hasConditions: userConditions.some((condition) => condition !== HealthConditionType.NONE),
          riceFood,
        });
        if (!serving) return [];
        return [
          {
            ...meal,
            ...serving,
            mealTypes: meal.applicableMealTypes.map((entry) => entry.mealType),
            isFavorite: favorites.has(meal.id),
            alreadyPlannedInCycle: usedLibraryMealIds.has(meal.id),
            localityRank: localityRank.get(meal.id),
            ricePreferenceScore: ricePreferenceScore(meal.riceRole),
            pairedRiceG: serving.pairedRiceG,
            nutritionServingDescription: serving.pairedRiceG
              ? `${meal.nutritionServingDescription || 'One recipe serving'} with ${serving.pairedRiceG} g cooked rice`
              : meal.nutritionServingDescription,
          },
        ];
      });

    return {
      swapOptions: rankLibraryMeals(eligibleMeals, dailyTarget, mealPlan.calories, mealPlan.mealType, {
        proteinG: mealPlan.proteinG,
        carbsG: mealPlan.carbsG,
        fatG: mealPlan.fatG,
      }).map(toPublicSwapOption),
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

    if (!libraryMeal.applicableMealTypes.some((entry) => entry.mealType === mealPlan.mealType)) {
      throw new Error('Replacement must match the meal type.');
    }
    const [cycleSnapshot, riceFood] = await Promise.all([
      client.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: mealPlan.planGroupId } }),
      userProfile.ricePreference === RicePreference.WITH_RICE
        ? client.foodItem.findFirst({
            where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
          })
        : Promise.resolve(null),
    ]);
    const dailyTarget = resolvePlanTargetCalories(
      cycleSnapshot?.dailyCalorieTarget,
      userProfile.dailyCalorieTarget,
      2000
    );
    const serving = resolveReplacementServing({
      meal: libraryMeal,
      mealType: mealPlan.mealType,
      dailyTarget,
      ricePreference: userProfile.ricePreference,
      hasConditions: user.healthConditions.some((item) => item.condition !== HealthConditionType.NONE),
      riceFood,
    });
    if (!serving) throw new Error('This serving does not fit your current meal target or rice preference.');
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
        projectedDayTotal += serving.calories;
      } else {
        projectedDayTotal += meal.calories;
      }
    }

    // 5. Get daily target
    // 6. Determine if warning is needed (±15%)
    const lowerBound = dailyTarget * 0.85;
    const upperBound = dailyTarget * 1.15;
    const warningRequired = projectedDayTotal < lowerBound || projectedDayTotal > upperBound;

    const cycleMeals = await client.mealPlan.findMany({
      where: { userId, planGroupId: mealPlan.planGroupId, ...getApprovedMealPlanStatusWhere() },
      include: {
        ingredients: true,
        servingComponents: { where: { componentType: 'COOKED_RICE' }, include: { foodItem: true } },
      },
      orderBy: { id: 'asc' },
    });
    const list = await GroceryService.findCycleList(client, userId, mealPlan.planGroupId);
    const purchases = list?.groceryItems ?? [];
    const ingredientProjection = (meal: (typeof cycleMeals)[number]) => [
      ...meal.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      ...meal.servingComponents.flatMap((component) =>
        component.foodItem && component.quantityG
          ? [{ ingredientName: component.foodItem.name, quantity: component.quantityG, unit: 'g' }]
          : []
      ),
    ];
    const replacementIngredients = [
      ...libraryMeal.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
      ...(serving.pairedRiceG && riceFood
        ? [{ ingredientName: riceFood.name, quantity: serving.pairedRiceG, unit: 'g' }]
        : []),
    ];
    const shoppingDelta = buildSwapShoppingDelta(
      cycleMeals.flatMap(ingredientProjection),
      cycleMeals.flatMap((meal) => (meal.id === mealPlanId ? replacementIngredients : ingredientProjection(meal))),
      purchases
    );
    const alreadyPlannedInCycle = cycleMeals.some(
      (candidate) => candidate.id !== mealPlanId && candidate.libraryMealId === libraryMeal.id
    );
    // The signed, expiring token binds confirmation to every input that could
    // change its safety, nutrition, or grocery meaning.
    const snapshotHash = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          mealPlan,
          libraryMeal,
          revision: userProfile.revision,
          dailyTarget,
          dayMeals,
          cycleMeals,
          purchases,
          riceFood,
          serving,
        })
      )
      .digest('hex');
    const requestKey = randomUUID();
    const expiresAt = Date.now() + SWAP_PREVIEW_TTL_MS;
    const previewToken = signSwapPreview({ requestKey, snapshotHash, expiresAt });
    return {
      previewToken,
      requestKey,
      expiresAt: new Date(expiresAt).toISOString(),
      snapshotHash,
      shoppingNeeds: shoppingDelta.additions,
      shoppingRemovals: shoppingDelta.removals,
      shoppingStarted: Boolean(mealPlan.cycle.shoppingStartedAt),
      groceryDeltaAcknowledgmentRequired: Boolean(mealPlan.cycle.shoppingStartedAt),
      alreadyPlannedInCycle,
      pairedRiceG: serving.pairedRiceG,
      riceFoodItemId: serving.pairedRiceG ? riceFood?.id : null,
      originalMealName: mealPlan.mealName,
      originalCalories: mealPlan.calories,
      newMealName: libraryMeal.mealName,
      newCalories: serving.calories,
      calorieDelta: serving.calories - mealPlan.calories,
      projectedDayTotal: Math.round(projectedDayTotal),
      dailyTarget,
      warningRequired,
      replacement: toPublicSwapOption({
        ...libraryMeal,
        ...serving,
        alreadyPlannedInCycle,
        nutritionServingDescription: serving.pairedRiceG
          ? `${libraryMeal.nutritionServingDescription || 'One recipe serving'} with ${serving.pairedRiceG} g cooked rice`
          : libraryMeal.nutritionServingDescription,
      }),
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
    requestKey?: string,
    groceryDeltaAcknowledged?: boolean
  ) {
    await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        if (!requestKey || !previewToken) throw new Error('Preview this swap before confirming.');
        const key = userId + ':' + requestKey;
        const previous = await tx.swapLog.findUnique({ where: { requestKey: key } });
        if (previous) {
          if (previous.mealPlanId !== mealPlanId || previous.newLibraryMealId !== newLibraryMealId)
            throw new Error('Request key already used for a different swap.');
          return {
            success: true,
            updatedPlan: await tx.mealPlan.findUniqueOrThrow({ where: { id: mealPlanId } }),
          };
        }
        const previewProof = verifySwapPreview(previewToken);
        if (previewProof.requestKey !== requestKey) throw new Error('Swap request key does not match its preview.');
        const preview = await this.getSwapPreview(userId, mealPlanId, newLibraryMealId, tx);
        if (preview.snapshotHash !== previewProof.snapshotHash)
          throw new Error('Your plan, profile or shopping list changed. Review a fresh preview.');
        if (preview.warningRequired && !warningAcknowledged)
          throw new Error('Acknowledge the current calorie warning before swapping.');
        if (preview.groceryDeltaAcknowledgmentRequired && !groceryDeltaAcknowledged)
          throw new Error('Shopping has started. Acknowledge the grocery additions and removals before swapping.');
        // 1. Fetch target meal plan slot
        const mealPlan = await loadActionableUnloggedMealPlan(tx, userId, mealPlanId);

        // 2. Fetch user profile, health conditions, and allergies
        const { user, profile: userProfile } = await loadUserNutritionContext(tx, userId, 'User profile not found.');
        const { healthConditions, allergies } = user;
        const userConditions = healthConditions.map((c) => c.condition);
        const userAllergens = allergies.map((a) => a.allergen);

        // 3. Fetch and verify replacement meal
        const libraryMeal = await tx.mealLibrary.findUnique({
          where: { id: newLibraryMealId },
          include: certifiedLibraryMealInclude,
        });

        if (!libraryMeal || !isApprovedMealLibraryStatus(libraryMeal.status)) {
          throw new Error('Selected replacement meal is not available or approved.');
        }

        if (!libraryMeal.applicableMealTypes.some((entry) => entry.mealType === mealPlan.mealType)) {
          throw new Error('Selected replacement meal type does not match slot meal type.');
        }

        if (
          !isCertifiedLibraryMealCompatible(libraryMeal, userConditions, userAllergens, {
            ...userProfile,
            safetyEntries: user.safetyProfileEntries,
          })
        ) {
          throw new Error('Selected meal is not certified for your current health profile.');
        }

        // A user-selected upcoming slot wins over ordinary pending candidates.
        // Cancel them in the same transaction so a later review or deadline
        // fallback cannot publish a competing meal for this date and type.
        await tx.mealPlan.updateMany({
          where: {
            userId,
            planGroupId: mealPlan.planGroupId,
            scheduledDate: mealPlan.scheduledDate,
            mealType: mealPlan.mealType,
            id: { not: mealPlan.id },
            status: { in: ['APPROVED', 'PENDING_REVIEW'] },
          },
          data: { status: 'CANCELLED' },
        });

        // 4. Update MealPlan row details
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
            userSelectionPinnedAt: new Date(),
            selectionEvidence: {
              source: 'USER_SWAP',
              pinned: true,
              libraryMealId: libraryMeal.id,
              evidenceRevision: libraryMeal.safetyEvidenceRevision,
              policyVersion: libraryMeal.safetyPolicyVersion,
            },
          },
        });

        // 5. Copy the certified first-class library ingredients, including quantities.
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
        const serving = await replacePlanBaseServing(tx, mealPlanId, {
          ...libraryMeal,
          mealType: mealPlan.mealType,
          recipeSignature: libraryMeal.recipeSignature,
          ingredients: ingredientsData,
          evidenceSource: 'CERTIFIED_LIBRARY_SWAP',
        });
        await tx.mealPlanClearanceUsage.deleteMany({ where: { mealPlanId } });
        const requiredConditions = userConditions.filter(
          (condition): condition is HealthConditionType => condition !== HealthConditionType.NONE
        );
        if (requiredConditions.length) {
          const usages = requiredConditions.map((condition) => {
            const clearance = libraryMeal.conditionClearances.find(
              (candidate) =>
                candidate.condition === condition &&
                candidate.state === 'ACTIVE' &&
                candidate.recipeSignature === libraryMeal.recipeSignature &&
                candidate.evidenceRevision === libraryMeal.safetyEvidenceRevision &&
                (!candidate.userScopeId || candidate.userScopeId === userId)
            );
            if (!clearance) throw new Error('Condition clearance changed during swap. Please retry.');
            return {
              mealPlanId,
              clearanceId: clearance.id,
              condition,
              composedServingSignature: serving.composedServingSignature,
            };
          });
          await tx.mealPlanClearanceUsage.createMany({ data: usages });
        }
        if (preview.pairedRiceG && preview.riceFoodItemId) {
          await composePlanWithPairedRice(tx, {
            mealPlanId,
            cookedRiceG: preview.pairedRiceG,
            fnriRiceFoodItemId: preview.riceFoodItemId,
          });
        }

        // 6. Increment usageCount on newly selected library entry
        await tx.mealLibrary.update({
          where: { id: libraryMeal.id },
          data: {
            usageCount: { increment: 1 },
          },
        });

        // 7. Create the idempotent SwapLog audit entry.
        await tx.swapLog.create({
          data: {
            mealPlanId,
            originalMealName: mealPlan.mealName,
            originalCalories: mealPlan.calories,
            newMealName: libraryMeal.mealName,
            newCalories: preview.newCalories,
            calorieDelta: preview.calorieDelta,
            requestKey: key,
            newLibraryMealId,
            warningShown: preview.warningRequired,
            warningAcknowledged: warningAcknowledged || false,
            groceryDeltaAcknowledged: groceryDeltaAcknowledged || false,
          },
        });

        // 8. Create MealLog with USER_SWAPPED source
        await tx.mealLog.upsert({
          where: { mealPlanId },
          update: {
            source: 'USER_SWAPPED',
            mealName: libraryMeal.mealName,
            calories: preview.replacement.calories,
            proteinG: preview.replacement.proteinG,
            carbsG: preview.replacement.carbsG,
            fatG: preview.replacement.fatG,
            dataSource: 'FNRI',
            status: 'PENDING',
          },
          create: {
            userId,
            mealPlanId,
            source: 'USER_SWAPPED',
            mealName: libraryMeal.mealName,
            calories: preview.replacement.calories,
            proteinG: preview.replacement.proteinG,
            carbsG: preview.replacement.carbsG,
            fatG: preview.replacement.fatG,
            dataSource: 'FNRI',
            status: 'PENDING',
          },
        });

        await GroceryService.generateGroceryList(userId, tx, mealPlan.planGroupId, 'EXPLICIT');
        await MealSwapService.recalculateDailyNutritionLog(userId, updatedPlan.scheduledDate, tx);
        return {
          success: true,
          updatedPlan,
        };
      },
      { timeout: 30_000 }
    );

    return {
      success: true,
    };
  }

  /**
   * Recalculates DailyNutritionLog values if an upcoming meal on that day is swapped
   */
  static recalculateDailyNutritionLog = recalculateDailyNutritionLog;

  /**
   * Returns all approved verified meals from MealLibrary that are clinically compatible with a user profile.
   */
  static async getCompatibleLibraryMeals(
    userId: string,
    input: {
      mealType?: MealType;
      search?: string;
      date?: string;
      favoriteOnly?: boolean;
      riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE';
      cursor?: string;
      limit?: number;
    }
  ) {
    // 1. Fetch user profile, health conditions, and allergies
    const { user, profile: userProfile } = await loadUserNutritionContext(prisma, userId, 'User profile not found.');
    const { healthConditions, allergies } = user;
    const userConditions = healthConditions.map((c) => c.condition);
    const userAllergens = allergies.map((a) => a.allergen);

    // 2. Query APPROVED library meals matching the optional mealType and search
    const page = await queryEligibleLibraryPage({
      userId,
      mealType: input.mealType,
      userConditions,
      userAllergens,
      profile: { ...userProfile, safetyEntries: user.safetyProfileEntries },
      search: input.search,
      favoriteOnly: input.favoriteOnly,
      riceRole: input.riceRole,
      cursor: input.cursor,
      limit: input.limit,
    });

    return {
      items: page.items.map(toPublicSwapOption),
      nextCursor: page.nextCursor,
      total: page.total,
    };
  }
}
