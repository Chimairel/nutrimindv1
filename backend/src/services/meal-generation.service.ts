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
  AiUsageOperation,
  MealCandidateProvenance,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { buildMealGenerationResponseSchema } from '@/validation/meal-generation-response.schema';
import { assertMealSlotCalories, validateGeneratedDayCalories } from '@/domain/generated-plan-calories.policy';
import { runMealGenerationFallbackForUnmatchedSlots } from '@/domain/meal-generation-library-compatibility.adapter';
import {
  getCurrentWeeklyCycleWindow,
  getManilaDateKey,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
  type MealPlanGenerationWindow,
  type WeeklyCycleWindow,
} from '@/domain/meal-plan-cycle.policy';
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
    const existingPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        planType,
        status: { in: [MealPlanStatus.PENDING_REVIEW, MealPlanStatus.APPROVED] },
        scheduledDate: { gte: window.startDate, lte: window.endDate },
      },
      orderBy: { createdAt: 'desc' },
      select: { planGroupId: true },
    });

    return existingPlan?.planGroupId ?? null;
  }

  private static async generateWindowOnce(
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
          if (meal.mealType !== slotType) return false;

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
        const selected = rankMealsByLocalizedFoodEvidence(
          calorieEligibleMatches,
          localizedFoodIds,
          localizedFoodGroupScores
        )[0];

        if (selected) {
          selectedLibraryMealIds.add(selected.id);

          matchedSlots.push({
            dayNumber: day + 1,
            mealType: slotType,
            scheduledDate,
            libraryMeal: selected,
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
            carbPreference: profile.carbPreference || 'MODERATE',
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
      mealType: MealType
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
        capturedAt: evidenceCapturedAt,
      };
    };
    const targetPlanEndDate = getScheduledMealDate(startDate, Math.max(0, numDays - 1));
    const userHasConditions = userConditions.length > 0 && !userConditions.includes(HealthConditionType.NONE);
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
    for (const meal of preparedAiMeals) assertMealSlotCalories(meal.calories, dailyCalorieTarget, meal.mealType);
    const finalCalorieIssues = validateGeneratedDayCalories(
      [
        ...matchedSlots.map((slot) => ({
          dayNumber: slot.dayNumber,
          mealType: slot.mealType,
          calories: slot.libraryMeal.calories,
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

    // Save plans atomically in a Prisma Transaction (with a 30-second timeout to support sequential batch inserts)
    await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const currentProfileRevision = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
        if (currentProfileRevision.revision !== profile.revision)
          throw new Error('Profile changed during generation. Please retry.');
        await assertGenerationIntegrity(tx, userId, startDate, targetPlanEndDate, compositionRevisions);
        await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
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
                selectionEvidence: selectionEvidenceFor(
                  'VERIFIED_LIBRARY',
                  slot.mealType
                ) as unknown as Prisma.InputJsonValue,
                ingredients: {
                  create: ingredientsData,
                },
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
                };
              });
              await tx.mealPlanClearanceUsage.createMany({ data: clearanceUsages });
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
              selectionEvidence: selectionEvidenceFor(
                meal.candidateProvenance === MealCandidateProvenance.RAW_RECIPE_CORPUS
                  ? 'RAW_RECIPE_CORPUS'
                  : 'AI_GENERATED',
                meal.mealType
              ) as unknown as Prisma.InputJsonValue,
              ingredients: {
                create: meal.ingredientsData,
              },
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
