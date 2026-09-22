import prisma from '@/lib/prisma';
import { assertGenerationIntegrity } from './generation-integrity.service';
import { updateGenerationProgress } from './generation-progress.service';
import { lockUserProfile } from './profile-revision.service';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset } from '@/lib/fnri';
import { getLocalizedFoodConsumptionContext } from '@/services/food-consumption-context.service';
import {
  MealType,
  MealPlanStatus,
  AIConfidenceFlag,
  HealthConditionType,
  NotificationType,
  PlanType,
  MealPlanGenerationJobStatus,
  MealPlanCycleDeadlineOutcome,
  MealPlanCycleStatus,
  AiUsageOperation,
  MealCandidateProvenance,
  AssuranceTier,
  RecipeRiceRole,
  RicePreference,
  RiceRoleReviewStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { buildMealGenerationResponseSchema } from '@/validation/meal-generation-response.schema';
import { assertMealSlotCalories, validateGeneratedDayCalories } from '@/domain/generated-plan-calories.policy';
import { runMealGenerationFallbackForUnmatchedSlots } from '@/domain/meal-generation-library-compatibility.adapter';
import {
  getCurrentWeeklyCycleWindow,
  getMealPlanCycleTiming,
  getManilaDateKey,
  getNextWeeklyCycleWindow,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
  type MealPlanGenerationWindow,
  type WeeklyCycleWindow,
} from '@/domain/meal-plan-cycle.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { buildMealGenerationPrompt } from '@/domain/meal-generation-cuisine.policy';
import {
  MEAL_PLAN_SAFETY_POLICY_VERSION,
  requiresEscalatedMealReview,
} from '@/domain/meal-plan-production-safety.policy';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import {
  getMealSlotCalorieRange,
  isPrimaryMealType,
  rankCalorieCompatibleMeals,
} from '@/domain/meal-calorie-allocation.policy';
import { formatMealLocalityPreference, rankMealsByLocalizedFoodEvidence } from '@/domain/planning-location.policy';
import type { MealSelectionEvidence } from '@/domain/meal-explanation.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  queryEligibleLibraryMeals,
} from './meal-library-candidate-query.service';
import { sourceRawRecipeCandidates } from './raw-recipe-candidate.service';
import { splitCustomRestrictions, validateGeneratedMealCandidate } from '@/domain/generated-meal-validation.policy';
import {
  prepareGeneratedMealIngredients,
  type GeneratedMeal,
  type GroundedFoodReference,
} from './meal-generation-ingredient-preparation.service';
import { buildBaseServingPersistence, composePlanWithPairedRice } from './meal-plan-serving.service';
import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';
import { GroceryService } from './grocery.service';
import {
  buildReviewWorkKey,
  chooseCookedRicePortionG,
  getPreparationLeadDays,
  scorePreparationCandidate,
  UPCOMING_PREPARATION_POLICY_VERSION,
} from '@/domain/upcoming-preparation.policy';

interface GeminiMealPlanResponse {
  meals: GeneratedMeal[];
}

export class MealGenerationService {
  private static readonly GENERATION_JOB_TTL_MS = 20 * 60 * 1000;
  private static readonly rolloverRequests = new Map<
    string,
    Promise<{
      rolledOver: boolean;
      planGroupId: string | null;
    }>
  >();

  /**
   * Determines whether to generate a STARTER plan (partial days until next
   * weekStartDay) or a full WEEKLY plan, based on the user's shoppingDayGroup.
   * Falls back to a 7-day WEEKLY plan for users without a shoppingDayGroup.
   */
  static async generatePlanForUser(
    userId: string,
    now: Date = new Date(),
    options: { replaceExisting?: boolean } = {}
  ): Promise<string> {
    const currentCycle = await MealPlanCycleService.getCurrentCycle(userId, now);
    if (currentCycle) {
      if (!options.replaceExisting) return currentCycle.id;
      const numDays = Math.round((currentCycle.endDate.getTime() - currentCycle.startDate.getTime()) / 86_400_000) + 1;
      return MealGenerationService.generateWindowOnce(
        userId,
        { planType: currentCycle.planType, numDays, startDate: currentCycle.startDate },
        true
      );
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const window = getOnDemandMealPlanWindow(
      {
        shoppingDayOfWeek: profile?.shoppingDayOfWeek,
        shoppingDayGroup: profile?.shoppingDayGroup,
      },
      now
    );

    console.log(
      `[Meal Generation] Generating ${window.planType} plan: ${window.numDays} day(s) from ${getManilaDateKey(window.startDate)}.`
    );
    return MealGenerationService.generateWindowOnce(userId, window, options.replaceExisting === true);
  }

  private static async findExistingPlan(
    userId: string,
    planType: PlanType,
    window: WeeklyCycleWindow
  ): Promise<string | null> {
    const existingCycle = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        planType,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
        startDate: window.startDate,
        endDate: window.endDate,
      },
      orderBy: { cycleRevision: 'desc' },
      select: { id: true },
    });

    return existingCycle?.id ?? null;
  }

  /**
   * Idempotently prepares the next full cycle once its versioned Manila-time
   * window opens. The generation-job uniqueness constraint coalesces scheduler,
   * page recovery, and report-acknowledgment triggers.
   */
  static async ensureUpcomingPlanForUser(
    userId: string,
    now: Date = new Date()
  ): Promise<{ state: 'NOT_OPEN' | 'EXISTING' | 'PREPARED'; planGroupId: string | null }> {
    const context = await loadUserNutritionContext(
      prisma,
      userId,
      'User profile must be initialized before preparing an upcoming meal plan.'
    );
    const profile = context.profile;
    if (profile.shoppingDayOfWeek === null && !profile.shoppingDayGroup) {
      return { state: 'NOT_OPEN', planGroupId: null };
    }
    const window = getNextWeeklyCycleWindow(profile, now);
    const assuranceTier = getMaximumAssuranceTier(context.conditions);
    const timing = getMealPlanCycleTiming(
      PlanType.WEEKLY,
      window.startDate,
      7,
      getPreparationLeadDays(assuranceTier)
    );
    const existingCycle = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        planType: PlanType.WEEKLY,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
        startDate: window.startDate,
        endDate: window.endDate,
      },
      orderBy: { cycleRevision: 'desc' },
      select: {
        id: true,
        profileAdaptationState: true,
        acknowledgedProfileRevision: true,
        shoppingStartedAt: true,
      },
    });
    if (existingCycle) {
      const rebuildable =
        !existingCycle.shoppingStartedAt &&
        existingCycle.acknowledgedProfileRevision === profile.revision &&
        (existingCycle.profileAdaptationState === 'REBUILD_REQUIRED' ||
          existingCycle.profileAdaptationState === 'SAFETY_REVALIDATION_REQUIRED');
      if (!rebuildable) return { state: 'EXISTING', planGroupId: existingCycle.id };
      const planGroupId = await MealGenerationService.generateWindowOnce(
        userId,
        { planType: PlanType.WEEKLY, numDays: 7, startDate: window.startDate },
        true
      );
      return { state: 'PREPARED', planGroupId };
    }
    if (now.getTime() < timing.preparationOpensAt.getTime()) {
      return { state: 'NOT_OPEN', planGroupId: null };
    }
    const planGroupId = await MealGenerationService.generateWindowOnce(userId, {
      planType: PlanType.WEEKLY,
      numDays: 7,
      startDate: window.startDate,
    });
    return { state: 'PREPARED', planGroupId };
  }

  static async generateWindowOnce(
    userId: string,
    window: MealPlanGenerationWindow,
    replaceExisting = false
  ): Promise<string> {
    const endDate = getScheduledMealDate(window.startDate, Math.max(0, window.numDays - 1));
    const existing = await MealGenerationService.findExistingPlan(userId, window.planType, {
      startDate: window.startDate,
      endDate,
    });
    if (existing && !replaceExisting) return existing;

    let job = null;
    let claimedNewJob = false;
    try {
      job = await prisma.mealPlanGenerationJob.create({
        data: {
          userId,
          planType: window.planType,
          cycleStartDate: window.startDate,
          progressPct: 5,
          stageCode: 'PROFILE',
          stageMessage: 'Preparing your nutrition profile.',
        },
      });
      claimedNewJob = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      job = await prisma.mealPlanGenerationJob.findUnique({
        where: {
          userId_planType_cycleStartDate: {
            userId,
            planType: window.planType,
            cycleStartDate: window.startDate,
          },
        },
      });
    }
    if (!job) throw new Error('Unable to establish an idempotent meal-plan generation job.');

    if (!claimedNewJob) {
      const completedByPeer = await MealGenerationService.findExistingPlan(userId, window.planType, {
        startDate: window.startDate,
        endDate,
      });
      if (completedByPeer && !replaceExisting) return completedByPeer;

      const staleCutoff = new Date(Date.now() - MealGenerationService.GENERATION_JOB_TTL_MS);
      const reclaimed = await prisma.mealPlanGenerationJob.updateMany({
        where: {
          id: job.id,
          OR: [
            { status: MealPlanGenerationJobStatus.FAILED },
            { status: MealPlanGenerationJobStatus.COMPLETED },
            { status: MealPlanGenerationJobStatus.GENERATING, updatedAt: { lt: staleCutoff } },
          ],
        },
        data: {
          status: MealPlanGenerationJobStatus.GENERATING,
          attempts: { increment: 1 },
          planGroupId: null,
          lastErrorCode: null,
          progressPct: 5,
          stageCode: 'PROFILE',
          stageMessage: 'Preparing your nutrition profile.',
          startedAt: new Date(),
          completedAt: null,
        },
      });
      if (reclaimed.count !== 1) {
        throw new Error('Meal plan generation is already in progress for this cycle.');
      }
    }

    try {
      const planGroupId = await MealGenerationService.generate7DayPlan(
        userId,
        window.planType,
        window.numDays,
        window.startDate,
        job.id
      );
      await prisma.mealPlanGenerationJob.update({
        where: { id: job.id },
        data: {
          status: MealPlanGenerationJobStatus.COMPLETED,
          planGroupId,
          lastErrorCode: null,
          progressPct: 100,
          stageCode: 'COMPLETED',
          stageMessage: 'Your plan is ready for review.',
          completedAt: new Date(),
        },
      });
      return planGroupId;
    } catch (error) {
      await prisma.mealPlanGenerationJob.updateMany({
        where: { id: job.id, status: MealPlanGenerationJobStatus.GENERATING },
        data: {
          status: MealPlanGenerationJobStatus.FAILED,
          lastErrorCode: 'GENERATION_FAILED',
          stageCode: 'FAILED',
          stageMessage: 'Plan generation could not be completed.',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  static async ensureCurrentWeeklyRollover(
    userId: string,
    now: Date = new Date()
  ): Promise<{ rolledOver: boolean; planGroupId: string | null }> {
    const existingRequest = MealGenerationService.rolloverRequests.get(userId);
    if (existingRequest) return existingRequest;

    const request = MealGenerationService.performCurrentWeeklyRollover(userId, now);
    MealGenerationService.rolloverRequests.set(userId, request);

    try {
      return await request;
    } finally {
      MealGenerationService.rolloverRequests.delete(userId);
    }
  }

  private static async performCurrentWeeklyRollover(
    userId: string,
    now: Date
  ): Promise<{ rolledOver: boolean; planGroupId: string | null }> {
    const authoritativeCurrent = await MealPlanCycleService.getCurrentCycle(userId, now);
    if (authoritativeCurrent) {
      return { rolledOver: false, planGroupId: authoritativeCurrent.id };
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { shoppingDayGroup: true, shoppingDayOfWeek: true },
    });
    if (!profile || (profile.shoppingDayOfWeek === null && !profile.shoppingDayGroup)) {
      return { rolledOver: false, planGroupId: null };
    }

    const window = getCurrentWeeklyCycleWindow(profile, now);
    const existingPlanGroupId = await MealGenerationService.findExistingPlan(userId, PlanType.WEEKLY, window);
    if (existingPlanGroupId) {
      return { rolledOver: false, planGroupId: existingPlanGroupId };
    }

    // A brand-new user has no plan to roll over. Their first STARTER/WEEKLY
    // plan must be created by the explicit Generate Meal Plan action so the
    // dashboard can show its progress UI instead of blocking page hydration
    // on a long-running Gemini request.
    const previousPlan = await prisma.mealPlan.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!previousPlan) {
      return { rolledOver: false, planGroupId: null };
    }

    // Rollover is schedule-derived and idempotent. Create only the active
    // remainder of the cycle instead of backdating a seven-day plan.
    const catchUpWindow = getOnDemandMealPlanWindow(profile, now);
    const planGroupId = await MealGenerationService.generateWindowOnce(userId, catchUpWindow);
    return { rolledOver: true, planGroupId };
  }

  /**
   * Generates a meal plan for N days, customized to the user's macro metrics,
   * clinical restrictions, food preferences, and cultural style.
   * planType: STARTER (bridge plan) or WEEKLY (normal 7-day cycle).
   * numDays: number of days to cover (1-7).
   * startDate: the first day of the plan.
   */
  static async generate7DayPlan(
    userId: string,
    planType: PlanType = PlanType.WEEKLY,
    numDays: number = 7,
    startDate: Date = new Date(),
    generationJobId?: string
  ): Promise<string> {
    await updateGenerationProgress(
      generationJobId,
      10,
      'PROFILE',
      'Applying your goals, preferences, and health safeguards.'
    );
    // 1. Fetch live user details, profile, conditions, and allergies
    const {
      user,
      profile,
      conditions: userConditions,
      allergens: userAllergens,
      otherConditions,
      otherAllergies,
    } = await loadUserNutritionContext(
      prisma,
      userId,
      'User profile must be initialized before generating a meal plan.'
    );
    const highRiskReviewRequired = requiresEscalatedMealReview(userConditions, otherConditions);
    const assuranceTier = getMaximumAssuranceTier(userConditions);

    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
      throw new Error('Please complete your onboarding profile statistics first.');
    }

    const localizedConsumption = await getLocalizedFoodConsumptionContext(profile);
    const localizedFoodIds = new Set(localizedConsumption.items.map((food) => food.id));
    const localizedFoodGroupScores = new Map(
      localizedConsumption.foodGroups.map((group) => [group.code, group.score] as const)
    );

    // --- STEP 1: Check MealLibrary for pre-verified clinical matches ---
    console.log(`[Meal Generation] Step 1: Checking MealLibrary for pre-verified clinical matches...`);
    await updateGenerationProgress(
      generationJobId,
      25,
      'LIBRARY_MATCH',
      'Screening nutritionist-certified meals for safe matches.'
    );
    const slotTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER] as const;
    const libraryMeals = (
      await Promise.all(
        slotTypes.map((mealType) =>
          queryEligibleLibraryMeals({
            mealType,
            dailyCalorieTarget,
            userConditions,
            userAllergens,
            profile: { ...profile, userId, safetyEntries: user.safetyProfileEntries },
            limit: 120,
          })
        )
      )
    ).flat();
    const eligibleLibraryMeals = libraryMeals;
    const userHasConditions = userConditions.some((condition) => condition !== HealthConditionType.NONE);
    const cookedRiceFood =
      profile.ricePreference === RicePreference.WITH_RICE && !userHasConditions
        ? await prisma.foodItem.findFirst({
            where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
          })
        : null;
    const recentlyUsedLibraryIds = new Set(
      (
        await prisma.mealPlan.findMany({
          where: { userId, libraryMealId: { not: null }, status: MealPlanStatus.APPROVED },
          orderBy: { scheduledDate: 'desc' },
          take: 42,
          select: { libraryMealId: true },
        })
      ).flatMap((meal) => (meal.libraryMealId ? [meal.libraryMealId] : []))
    );
    const localizedCertifiedMealReference = rankMealsByLocalizedFoodEvidence(
      [...eligibleLibraryMeals].sort((left, right) => right.usageCount - left.usageCount),
      localizedFoodIds,
      localizedFoodGroupScores
    )
      .slice(0, 24)
      .map(
        (meal) =>
          `- [MEAL_LIBRARY_ID=${meal.id}] ${meal.mealName} (${meal.mealType}; ${meal.calories} kcal; ingredients: ${meal.ingredients.map((ingredient) => ingredient.ingredientName).join(', ')})`
      )
      .join('\n');

    const matchedSlots: {
      dayNumber: number;
      mealType: MealType;
      scheduledDate: Date;
      libraryMeal: (typeof libraryMeals)[0];
      candidateRank: number;
      rankingScore: number;
      rankingReasonCodes: string[];
      pairedRiceG: number | null;
      fallbackAvailable: boolean;
    }[] = [];

    const unmatchedSlots: {
      dayNumber: number;
      mealType: MealType;
      scheduledDate: Date;
    }[] = [];
    const selectedLibraryMealIds = new Set<string>();

    // Evaluate each individual slot independently
    for (let day = 0; day < numDays; day++) {
      const scheduledDate = getScheduledMealDate(startDate, day);

      const slots = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
      for (const slotType of slots) {
        // Filter in-memory verified library matches
        const matches = eligibleLibraryMeals.filter((meal) => {
          if (selectedLibraryMealIds.has(meal.id)) return false;
          if (!meal.applicableMealTypes.some((entry) => entry.mealType === slotType)) return false;

          // Dietary preference is a positive classification fact. User goals
          // influence serving allocation and ranking, never reusable diet tags.
          if (profile.dietaryPreference && meal.dietaryTags) {
            const tags = meal.dietaryTags as string[];
            if (!tags.includes(profile.dietaryPreference)) return false;
          }

          return true;
        });

        // A certified base recipe is reusable only when its reviewed serving
        // also fits this user's allocated meal target. Prefer the closest fit;
        // smaller recipes fall through to personalized generation.
        const calorieEligibleMatches = rankCalorieCompatibleMeals(matches, dailyCalorieTarget, slotType);
        const localityRanked = rankMealsByLocalizedFoodEvidence(
          calorieEligibleMatches,
          localizedFoodIds,
          localizedFoodGroupScores
        );
        const range = getMealSlotCalorieRange(dailyCalorieTarget, slotType);
        const ranked = localityRanked
          .map((meal, localityIndex) => ({
            meal,
            ranking: scorePreparationCandidate({
              activeClearanceCoverage: true,
              allergenDeclarationsComplete: true,
              ingredientsResolved: meal.ingredients.every((ingredient) => Boolean(ingredient.foodItemId)),
              nutrientsComplete: [meal.calories, meal.proteinG, meal.carbsG, meal.fatG].every(Number.isFinite),
              dietCompatible: true,
              remainingReviews: 0,
              calorieDeviationRatio: Math.abs(meal.calories - range.target) / range.target,
              mealTypeMatch: meal.applicableMealTypes.some((entry) => entry.mealType === slotType),
              ricePreference: profile.ricePreference,
              riceRole: meal.riceRole,
              riceRoleReviewStatus: meal.riceRoleReviewStatus,
              localityScore: localityIndex === 0 && localityRanked.length > 1 ? 1 : 0,
              usedInRecentCycle: recentlyUsedLibraryIds.has(meal.id),
            }),
          }))
          .sort(
            (left, right) =>
              right.ranking.score - left.ranking.score ||
              left.meal.usageCount - right.meal.usageCount ||
              left.meal.id.localeCompare(right.meal.id)
          );
        const selected = ranked[0];

        if (selected) {
          selectedLibraryMealIds.add(selected.meal.id);
          const pairedRiceG =
            cookedRiceFood &&
            selected.meal.riceRole === RecipeRiceRole.PAIR_WITH_RICE &&
            selected.meal.riceRoleReviewStatus === RiceRoleReviewStatus.REVIEWED
              ? chooseCookedRicePortionG({
                  baseCalories: selected.meal.calories,
                  riceCaloriesPer100G: cookedRiceFood.calories,
                  slotTargetCalories: range.target,
                  slotMinimumCalories: range.minimum,
                  slotMaximumCalories: range.maximum,
                })
              : null;

          matchedSlots.push({
            dayNumber: day + 1,
            mealType: slotType,
            scheduledDate,
            libraryMeal: selected.meal,
            candidateRank: 1,
            rankingScore: selected.ranking.score,
            rankingReasonCodes: selected.ranking.reasonCodes,
            pairedRiceG,
            fallbackAvailable: ranked.length > 1,
          });
        } else {
          unmatchedSlots.push({
            dayNumber: day + 1,
            mealType: slotType,
            scheduledDate,
          });
        }
      }
    }

    // --- STEP 2: Search the broader recipe corpus without granting it safety authority. ---
    const rawCorpusMeals: GeneratedMeal[] = [];
    const excludedRawCandidateIds = new Set<string>();
    let openCorpusSlots = [...unmatchedSlots];
    for (let attempt = 1; attempt <= 2 && openCorpusSlots.length; attempt += 1) {
      const rawCorpusResult = await sourceRawRecipeCandidates({
        slots: openCorpusSlots,
        dailyCalorieTarget,
        dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
        conditions: userConditions,
        allergens: userAllergens,
        otherConditions,
        otherAllergies,
        excludeCandidateIds: [...excludedRawCandidateIds],
        localityFoodGroupScores: localizedFoodGroupScores,
        localityEvidenceText: localizedConsumption.text,
      });
      const acceptedSlotKeys = new Set<string>();
      for (const meal of rawCorpusResult.meals) {
        const validation = validateGeneratedMealCandidate({
          ingredients: meal.ingredients,
          dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
          allergens: userAllergens,
          customAllergies: splitCustomRestrictions(otherAllergies),
        });
        if (!validation.accepted) {
          excludedRawCandidateIds.add(meal.rawCandidateId);
          continue;
        }
        acceptedSlotKeys.add(`${meal.dayNumber}:${meal.mealType}`);
        rawCorpusMeals.push({
          ...meal,
          candidateProvenance: MealCandidateProvenance.RAW_RECIPE_CORPUS,
        });
      }
      openCorpusSlots = openCorpusSlots.filter((slot) => !acceptedSlotKeys.has(`${slot.dayNumber}:${slot.mealType}`));
      if (!rawCorpusResult.meals.length) break;
    }
    const generationSlots = openCorpusSlots;

    // --- STEP 3: Bounded from-scratch generation only for still-empty slots. ---
    const groundedFoodById = new Map<string, GroundedFoodReference>();
    const generatedFromScratch = await runMealGenerationFallbackForUnmatchedSlots(
      generationSlots,
      async (fallbackSlots): Promise<GeneratedMeal[]> => {
        await updateGenerationProgress(
          generationJobId,
          45,
          'AI_GENERATION',
          'Preparing safe options for unmatched meal slots.'
        );
        const totalMeals = fallbackSlots.length;
        console.log(`[Meal Generation] ${totalMeals} unmatched slots. Generating via Gemini AI...`);

        // Fetch a balanced FNRI reference across common food categories.
        const localFoodsContext = await getFNRISubset();
        const retrievedFoods = [...localizedConsumption.items, ...localFoodsContext].filter((food) => {
          if (groundedFoodById.has(food.id)) return false;
          groundedFoodById.set(food.id, food);
          return true;
        });
        const formattedFoodsContext = retrievedFoods
          .map(
            (f) =>
              `- [FNRI_ID=${f.id}] ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g per 100g)`
          )
          .join('\n');

        const compositionForValidation = await prisma.foodItem.findMany({
          where: { id: { in: retrievedFoods.map((food) => food.id) }, source: 'FNRI' },
        });
        const accepted: GeneratedMeal[] = [];
        let pendingSlots = [...fallbackSlots];
        const validationFailures: string[] = [];
        for (let attempt = 1; attempt <= 3 && pendingSlots.length; attempt += 1) {
          const existingMeals = [
            ...matchedSlots.map((slot) => ({
              dayNumber: slot.dayNumber,
              mealType: slot.mealType,
              calories: slot.libraryMeal.calories,
            })),
            ...rawCorpusMeals.map((meal) => ({
              dayNumber: meal.dayNumber,
              mealType: meal.mealType,
              calories: meal.calories,
            })),
            ...accepted.map((meal) => ({
              dayNumber: meal.dayNumber,
              mealType: meal.mealType,
              calories: meal.calories,
            })),
          ];
          const { prompt, systemInstruction } = buildMealGenerationPrompt({
            slots: pendingSlots,
            existingMeals,
            dailyCalorieTarget,
            goal,
            dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
            ricePreference: profile.ricePreference,
            foodCulture: profile.foodCulture || 'Filipino',
            planningLocationLabel: formatMealLocalityPreference(profile),
            conditions: userConditions,
            allergens: userAllergens,
            otherConditions,
            otherAllergies,
            foodReference: formattedFoodsContext,
            certifiedMealReference: localizedCertifiedMealReference,
            popularFoodReference: localizedConsumption.text,
            consumptionEvidenceScope: localizedConsumption.matchedScope?.label,
          });
          const MealResponseSchema = buildMealGenerationResponseSchema(
            pendingSlots,
            dailyCalorieTarget,
            compositionForValidation,
            existingMeals
          );
          const aiResponse = await generateGenerativeJSON<GeminiMealPlanResponse>(
            validationFailures.length
              ? `${prompt}\nPrevious deterministic validation failures: ${validationFailures.join('; ')}`
              : prompt,
            systemInstruction,
            MealResponseSchema,
            { operation: AiUsageOperation.MEAL_PLAN_GENERATION, purpose: `UNMATCHED_SLOT_ATTEMPT_${attempt}` }
          );
          const rejectedKeys = new Set<string>();
          for (const meal of aiResponse.meals) {
            const validation = validateGeneratedMealCandidate({
              ingredients: meal.ingredients,
              dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
              allergens: userAllergens,
              customAllergies: splitCustomRestrictions(otherAllergies),
            });
            if (!validation.accepted) {
              rejectedKeys.add(`${meal.dayNumber}:${meal.mealType}`);
              validationFailures.push(...validation.definiteConflicts);
              continue;
            }
            accepted.push({ ...meal, candidateProvenance: MealCandidateProvenance.AI_FROM_SCRATCH });
          }
          pendingSlots = pendingSlots.filter((slot) => rejectedKeys.has(`${slot.dayNumber}:${slot.mealType}`));
        }
        if (pendingSlots.length) {
          throw new Error(`Deterministic validation rejected ${pendingSlots.length} meal slot(s) after 3 attempts.`);
        }
        return accepted;
      }
    );
    const aiMeals = [...rawCorpusMeals, ...generatedFromScratch];

    const newPlanGroupId = randomUUID();
    const evidenceCapturedAt = new Date().toISOString();
    const selectionEvidenceFor = (
      source: MealSelectionEvidence['source'],
      mealType: MealType,
      ranking?: { score?: number | null; reasonCodes?: readonly string[] }
    ): MealSelectionEvidence => {
      const range = isPrimaryMealType(mealType) ? getMealSlotCalorieRange(dailyCalorieTarget, mealType) : null;
      return {
        schemaVersion: 1,
        source,
        dailyCalorieTarget,
        slotCalorieTarget: range?.target ?? null,
        slotCalorieLower: range?.minimum ?? null,
        slotCalorieUpper: range?.maximum ?? null,
        localityPreference: profile.mealLocalityPreference,
        planningLocationLabel: formatMealLocalityPreference(profile),
        consumptionEvidenceScope: localizedConsumption.matchedScope?.label ?? null,
        consumptionEvidenceRelease: localizedConsumption.releaseLabel,
        rankingScore: ranking?.score ?? null,
        rankingReasonCodes: [...(ranking?.reasonCodes ?? [])],
        capturedAt: evidenceCapturedAt,
      };
    };
    const cycleTiming = getMealPlanCycleTiming(
      planType,
      startDate,
      numDays,
      getPreparationLeadDays(assuranceTier)
    );
    const targetPlanEndDate = cycleTiming.endDate;
    const planConditions = userConditions.filter((condition) => condition !== HealthConditionType.NONE);
    const createdPlansList: any[] = [];

    // Resolve ingredient identities and composition snapshots before opening the save transaction.
    const { preparedMeals: preparedAiMeals, compositionRevisions } = await prepareGeneratedMealIngredients({
      meals: aiMeals,
      unmatchedSlots,
      startDate,
      userHasConditions,
      groundedFoodById,
    });
    await updateGenerationProgress(
      generationJobId,
      72,
      'INGREDIENT_VALIDATION',
      'Validating ingredient evidence and grocery quantities.'
    );

    // Recheck authoritative totals after all FNRI lookups, before replacing any saved plans.
    for (const meal of preparedAiMeals) {
      assertMealSlotCalories(meal.calories, dailyCalorieTarget, meal.mealType);
      if (meal.rankingScore === undefined || !meal.rankingReasonCodes?.length) {
        if (!isPrimaryMealType(meal.mealType)) {
          throw new Error(`Unsupported generated meal slot: ${meal.mealType}`);
        }
        const range = getMealSlotCalorieRange(dailyCalorieTarget, meal.mealType);
        const ranking = scorePreparationCandidate({
          activeClearanceCoverage: false,
          allergenDeclarationsComplete: false,
          ingredientsResolved: meal.ingredientsData.every((ingredient) => Boolean(ingredient.foodItemId)),
          nutrientsComplete: [meal.calories, meal.proteinG, meal.carbsG, meal.fatG].every(Number.isFinite),
          dietCompatible: true,
          remainingReviews: assuranceTier === AssuranceTier.ENHANCED ? 2 : 1,
          calorieDeviationRatio: Math.abs(meal.calories - range.target) / range.target,
          mealTypeMatch: true,
          ricePreference: profile.ricePreference,
          usedInRecentCycle: false,
        });
        meal.candidateRank = meal.candidateRank ?? 1;
        meal.rankingScore = ranking.score;
        meal.rankingReasonCodes = ranking.reasonCodes;
      }
    }
    const finalCalorieIssues = validateGeneratedDayCalories(
      [
        ...matchedSlots.map((slot) => ({
          dayNumber: slot.dayNumber,
          mealType: slot.mealType,
          calories:
            slot.libraryMeal.calories +
            (slot.pairedRiceG && cookedRiceFood ? (cookedRiceFood.calories * slot.pairedRiceG) / 100 : 0),
        })),
        ...preparedAiMeals.map((meal) => ({
          dayNumber: unmatchedSlots.find(
            (slot) => slot.mealType === meal.mealType && slot.scheduledDate.getTime() === meal.scheduledDate.getTime()
          )!.dayNumber,
          mealType: meal.mealType,
          calories: meal.calories,
        })),
      ],
      dailyCalorieTarget
    );
    if (finalCalorieIssues.length) throw new Error(finalCalorieIssues.join(' '));

    const cycleMeals = [
      ...matchedSlots.map((slot) => ({
        scheduledDate: slot.scheduledDate,
        calories:
          slot.libraryMeal.calories +
          (slot.pairedRiceG && cookedRiceFood ? (cookedRiceFood.calories * slot.pairedRiceG) / 100 : 0),
        proteinG:
          slot.libraryMeal.proteinG +
          (slot.pairedRiceG && cookedRiceFood ? (cookedRiceFood.proteinG * slot.pairedRiceG) / 100 : 0),
        carbsG:
          slot.libraryMeal.carbsG +
          (slot.pairedRiceG && cookedRiceFood ? (cookedRiceFood.carbsG * slot.pairedRiceG) / 100 : 0),
        fatG:
          slot.libraryMeal.fatG +
          (slot.pairedRiceG && cookedRiceFood ? (cookedRiceFood.fatG * slot.pairedRiceG) / 100 : 0),
      })),
      ...preparedAiMeals.map((meal) => ({
        scheduledDate: meal.scheduledDate,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
      })),
    ];
    const dailyMacroTargets = cycleMeals.reduce<Record<string, { calories: number; proteinG: number; carbsG: number; fatG: number }>>(
      (days, meal) => {
        const key = getManilaDateKey(meal.scheduledDate);
        const current = days[key] ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
        days[key] = {
          calories: current.calories + meal.calories,
          proteinG: current.proteinG + meal.proteinG,
          carbsG: current.carbsG + meal.carbsG,
          fatG: current.fatG + meal.fatG,
        };
        return days;
      },
      {}
    );
    const now = new Date();
    const businessDay = MealPlanCycleService.getBusinessDay(now);
    const completeSlotSet = preparedAiMeals.length === 0 && matchedSlots.length >= cycleTiming.expectedSlotCount;
    const deadlinePassed = now.getTime() >= cycleTiming.shoppingDeadlineAt.getTime();
    const cycleStatus =
      cycleTiming.endDate < businessDay
        ? MealPlanCycleStatus.COMPLETED
        : cycleTiming.startDate <= businessDay
          ? MealPlanCycleStatus.ACTIVE
          : deadlinePassed
              ? MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE
              : MealPlanCycleStatus.UNDER_REVIEW;
    const deadlineOutcome = deadlinePassed ? MealPlanCycleDeadlineOutcome.INCOMPLETE : null;

    // Save plans atomically in a Prisma Transaction (with a 30-second timeout to support sequential batch inserts)
    await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const currentProfileRevision = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
        if (currentProfileRevision.revision !== profile.revision)
          throw new Error('Profile changed during generation. Please retry.');
        await assertGenerationIntegrity(tx, userId, startDate, targetPlanEndDate, compositionRevisions);
        await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
        const overlappingCycles = await tx.mealPlanCycle.findMany({
          where: {
            userId,
            status: { not: MealPlanCycleStatus.SUPERSEDED },
            startDate: { lte: targetPlanEndDate },
            endDate: { gte: cycleTiming.startDate },
          },
          select: { id: true },
        });
        const priorRevision = await tx.mealPlanCycle.aggregate({
          where: { userId, planType, startDate: cycleTiming.startDate },
          _max: { cycleRevision: true },
        });
        if (overlappingCycles.length) {
          await tx.mealPlanCycle.updateMany({
            where: { id: { in: overlappingCycles.map((cycle) => cycle.id) } },
            data: {
              status: MealPlanCycleStatus.SUPERSEDED,
              supersededAt: now,
              supersededById: null,
            },
          });
        }
        // 1. Replace only plans that overlap this exact target window. A future
        // pending plan must never cancel the user's currently active approved week.
        await tx.mealPlan.updateMany({
          where: {
            userId,
            status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
            scheduledDate: { gte: startDate, lte: targetPlanEndDate },
          },
          data: { status: MealPlanStatus.CANCELLED },
        });

        await tx.mealPlanCycle.create({
          data: {
            id: newPlanGroupId,
            userId,
            planType,
            cycleRevision: (priorRevision._max.cycleRevision ?? 0) + 1,
            startDate: cycleTiming.startDate,
            endDate: cycleTiming.endDate,
            preparationOpensAt: cycleTiming.preparationOpensAt,
            shoppingDeadlineAt: cycleTiming.shoppingDeadlineAt,
            preparationPolicyVersion: UPCOMING_PREPARATION_POLICY_VERSION,
            assuranceTier,
            preparationTriggeredAt: now,
            expectedSlotCount: cycleTiming.expectedSlotCount,
            status: cycleStatus,
            deadlineOutcome,
            readyAt: null,
            activatedAt: cycleStatus === MealPlanCycleStatus.ACTIVE ? now : null,
          },
        });
        if (overlappingCycles.length) {
          await tx.mealPlanCycle.updateMany({
            where: { id: { in: overlappingCycles.map((cycle) => cycle.id) } },
            data: { supersededById: newPlanGroupId },
          });
        }

        await tx.mealPlanCycleSnapshot.create({
          data: {
            planGroupId: newPlanGroupId,
            userId,
            profileRevision: profile.revision,
            safetyRevision: profile.safetyRevision,
            weightKg,
            activityLevel,
            goal,
            dailyCalorieTarget,
            dailyMacroTargets: dailyMacroTargets as Prisma.InputJsonObject,
            dietaryPreference: profile.dietaryPreference,
            ricePreference: profile.ricePreference,
            ricePreferenceProvenance: profile.ricePreferenceProvenance,
            foodCulture: profile.foodCulture,
            planningGeographyLevel: profile.planningGeographyLevel,
            planningRegionName: profile.planningRegionName,
            planningProvinceHucName: profile.planningProvinceHucName,
            mealLocalityPreference: profile.mealLocalityPreference,
            shoppingDayGroup: profile.shoppingDayGroup,
            shoppingDayOfWeek: profile.shoppingDayOfWeek,
          },
        });

        // 2. Create matched library meals from the exact certified library snapshot.
        if (matchedSlots.length > 0) {
          for (const slot of matchedSlots) {
            const latest = await tx.mealLibrary.findUniqueOrThrow({
              where: { id: slot.libraryMeal.id },
              include: certifiedLibraryMealInclude,
            });
            if (
              latest.safetyEvidenceRevision !== slot.libraryMeal.safetyEvidenceRevision ||
              latest.safetyEvidenceStatus !== 'COMPLETE' ||
              latest.status !== 'APPROVED' ||
              !isCertifiedLibraryMealCompatible(latest, userConditions, userAllergens, {
                ...profile,
                userId,
                safetyEntries: user.safetyProfileEntries,
              })
            )
              throw new Error('Recipe or clearance evidence changed during generation. Please retry.');
            const ingredientsData = latest.ingredients.map((ing) => ({
              ingredientName: ing.ingredientName,
              category: ing.category,
              foodItemId: ing.foodItemId,
              dataSource: ing.dataSource,
              quantity: ing.quantity,
              unit: ing.unit,
            }));
            const serving = buildBaseServingPersistence({
              ...latest,
              mealType: slot.mealType,
              recipeSignature: latest.recipeSignature,
              ingredients: ingredientsData,
              evidenceSource: 'CERTIFIED_LIBRARY',
            });

            // A currently certified library revision is already staff-reviewed,
            // so this clone is actionable without another queue round-trip.
            const createdPlan = await tx.mealPlan.create({
              data: {
                planGroupId: newPlanGroupId,
                userId,
                status: MealPlanStatus.APPROVED,
                candidateProvenance: MealCandidateProvenance.CERTIFIED_LIBRARY,
                libraryMealId: slot.libraryMeal.id,
                nutritionistId: latest.safetyReviewedByNutritionistId,
                planType,
                mealType: slot.mealType,
                mealName: latest.mealName,
                description: latest.description,
                calories: latest.calories,
                proteinG: latest.proteinG,
                carbsG: latest.carbsG,
                fatG: latest.fatG,
                aiConfidenceFlag: AIConfidenceFlag.SAFE,
                scheduledDate: slot.scheduledDate,
                reviewedAt: latest.safetyReviewedAt,
                requiresSafetyRevalidation: false,
                safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                highRiskReviewRequired,
                reviewApprovalCount: highRiskReviewRequired ? 2 : 1,
                candidateRank: slot.candidateRank,
                rankingScore: slot.rankingScore,
                rankingReasonCodes: slot.rankingReasonCodes,
                fallbackAvailable: slot.fallbackAvailable,
                selectionEvidence: selectionEvidenceFor(
                  'VERIFIED_LIBRARY',
                  slot.mealType,
                  { score: slot.rankingScore, reasonCodes: slot.rankingReasonCodes }
                ) as unknown as Prisma.InputJsonValue,
                ingredients: {
                  create: ingredientsData,
                },
                ...serving,
              },
            });
            createdPlansList.push(createdPlan);

            if (planConditions.length) {
              const clearanceUsages = planConditions.map((condition) => {
                const clearance = latest.conditionClearances.find(
                  (candidate) =>
                    candidate.condition === condition &&
                    candidate.state === 'ACTIVE' &&
                    candidate.recipeSignature === latest.recipeSignature &&
                    candidate.evidenceRevision === latest.safetyEvidenceRevision &&
                    (!candidate.userScopeId || candidate.userScopeId === userId) &&
                    (!candidate.expiresAt || candidate.expiresAt > new Date())
                );
                if (!clearance) throw new Error('Condition clearance changed during generation. Please retry.');
                return {
                  mealPlanId: createdPlan.id,
                  clearanceId: clearance.id,
                  condition: condition as HealthConditionType,
                  composedServingSignature: createdPlan.composedServingSignature,
                };
              });
              await tx.mealPlanClearanceUsage.createMany({ data: clearanceUsages });
            }

            if (slot.pairedRiceG && cookedRiceFood) {
              await composePlanWithPairedRice(tx, {
                mealPlanId: createdPlan.id,
                cookedRiceG: slot.pairedRiceG,
                fnriRiceFoodItemId: cookedRiceFood.id,
              });
            }

            // Increment library entry usage count
            await tx.mealLibrary.update({
              where: { id: slot.libraryMeal.id },
              data: { usageCount: { increment: 1 } },
            });
          }
        }

        // 3. Create newly AI generated meals using pre-resolved lookups
        for (const meal of preparedAiMeals) {
          const serving = buildBaseServingPersistence({
            ...meal,
            ingredients: meal.ingredientsData,
            evidenceSource:
              meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
                ? 'RAW_RECIPE_CORPUS_PENDING_REVIEW'
                : 'AI_GENERATED_PENDING_REVIEW',
          });
          const createdPlan = await tx.mealPlan.create({
            data: {
              planGroupId: newPlanGroupId,
              userId,
              status: MealPlanStatus.PENDING_REVIEW,
              candidateProvenance: meal.candidateProvenance,
              sourceRawRecipeCandidateId: meal.rawCandidateId,
              planType,
              mealType: meal.mealType,
              mealName: meal.mealName,
              description: meal.description,
              calories: meal.calories,
              proteinG: meal.proteinG,
              carbsG: meal.carbsG,
              fatG: meal.fatG,
              aiConfidenceFlag: meal.aiConfidenceFlag,
              scheduledDate: meal.scheduledDate,
              requiresSafetyRevalidation: true,
              safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              highRiskReviewRequired,
              reviewWorkKey: buildReviewWorkKey({
                recipeSignature: serving.baseRecipeSignature,
                evidenceRevision: 1,
                conditions: planConditions,
                allergens: userAllergens,
                policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                requiredReviewerCount: highRiskReviewRequired ? 2 : 1,
              }),
              candidateRank: meal.candidateRank ?? 1,
              rankingScore: meal.rankingScore ?? null,
              rankingReasonCodes: meal.rankingReasonCodes ?? [],
              fallbackAvailable: false,
              selectionEvidence: selectionEvidenceFor(
                meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
                  ? 'RAW_RECIPE_CORPUS'
                  : 'AI_GENERATED',
                meal.mealType,
                { score: meal.rankingScore, reasonCodes: meal.rankingReasonCodes }
              ) as unknown as Prisma.InputJsonValue,
              ingredients: {
                create: meal.ingredientsData,
              },
              ...serving,
            },
          });
          createdPlansList.push(createdPlan);
        }
      },
      { timeout: 30000 }
    );

    await updateGenerationProgress(
      generationJobId,
      92,
      'SAVING',
      'Saving the plan and preparing its professional review queue.'
    );

    if (completeSlotSet && cycleTiming.startDate > businessDay) {
      try {
        await GroceryService.generateGroceryList(userId, undefined, newPlanGroupId);
      } catch (error) {
        console.error('[Meal Generation] Upcoming grocery projection failed; cycle remains under review:', error);
      }
    }

    const needsReview = createdPlansList.some((p) => p.aiConfidenceFlag === AIConfidenceFlag.NEEDS_REVIEW);
    if (needsReview) {
      const notificationTitle = 'New Meal Plan Awaiting Verification';
      await prisma.notification.create({
        data: {
          userId,
          title: notificationTitle,
          message:
            'Your new AI meal plan contains clinical alerts and has been queued for Registered Dietitian review.',
          type: NotificationType.REVIEW_REQUEST,
        },
      });
    }

    return newPlanGroupId;
  }

  static async getLatestGenerationStatus(userId: string) {
    return prisma.mealPlanGenerationJob.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        progressPct: true,
        stageCode: true,
        stageMessage: true,
        planGroupId: true,
        lastErrorCode: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
  }
}
