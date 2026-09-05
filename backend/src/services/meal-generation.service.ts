import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset, lookupIngredient } from '@/lib/fnri';
import { 
  MealType, 
  MealPlanStatus, 
  AIConfidenceFlag, 
  HealthConditionType, 
  NotificationType,
  PlanType,
  ShoppingDayGroup,
  MealIngredientDataSource,
  MealLibrarySafetyEvidenceStatus,
  MealPlanGenerationJobStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getApprovedMealLibraryWhere } from '@/domain/meal-actionability.policy';
import {
  filterEligibleMealGenerationLibraryCandidates,
  runMealGenerationFallbackForUnmatchedSlots,
} from '@/domain/meal-generation-library-compatibility.adapter';
import {
  getCurrentWeeklyCycleWindow,
  getManilaDateKey,
  getNextWeeklyCycleWindow,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
  type MealPlanGenerationWindow,
  type ShoppingSchedule,
  type WeeklyCycleWindow,
} from '@/domain/meal-plan-cycle.policy';
import { buildMealGenerationPrompt } from '@/domain/meal-generation-cuisine.policy';
import {
  evaluateMealLibrarySafetyEvidence,
} from '@/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import {
  MEAL_PLAN_SAFETY_POLICY_VERSION,
  requiresEscalatedMealReview,
} from '@/domain/meal-plan-production-safety.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';

interface GeneratedMeal {
  dayNumber: number;
  mealType: MealType;
  mealName: string;
  description: string;
  ingredients: { name: string; quantity?: number; unit?: string }[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface GeminiMealPlanResponse {
  meals: GeneratedMeal[];
}

export class MealGenerationService {
  private static readonly GENERATION_JOB_TTL_MS = 20 * 60 * 1000;
  private static readonly rolloverRequests = new Map<string, Promise<{
    rolledOver: boolean;
    planGroupId: string | null;
  }>>();

  /**
   * Determines whether to generate a STARTER plan (partial days until next
   * weekStartDay) or a full WEEKLY plan, based on the user's shoppingDayGroup.
   * Falls back to a 7-day WEEKLY plan for users without a shoppingDayGroup.
   */
  static async generatePlanForUser(userId: string, now: Date = new Date()): Promise<string> {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const window = getOnDemandMealPlanWindow({
      shoppingDayOfWeek: profile?.shoppingDayOfWeek,
      shoppingDayGroup: profile?.shoppingDayGroup,
    }, now);

    console.log(
      `[Meal Generation] Generating ${window.planType} plan: ${window.numDays} day(s) from ${getManilaDateKey(window.startDate)}.`
    );
    return MealGenerationService.generateWindowOnce(userId, window);
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
    window: MealPlanGenerationWindow
  ): Promise<string> {
    const endDate = getScheduledMealDate(window.startDate, Math.max(0, window.numDays - 1));
    const existing = await MealGenerationService.findExistingPlan(
      userId,
      window.planType,
      { startDate: window.startDate, endDate }
    );
    if (existing) return existing;

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
      const completedByPeer = await MealGenerationService.findExistingPlan(
        userId,
        window.planType,
        { startDate: window.startDate, endDate }
      );
      if (completedByPeer) return completedByPeer;

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

  static async generateNextWeeklyPlan(
    userId: string,
    schedule: ShoppingSchedule | ShoppingDayGroup | number,
    now: Date = new Date()
  ): Promise<string> {
    const window = getNextWeeklyCycleWindow(schedule, now);
    return MealGenerationService.generateWindowOnce(userId, {
      planType: PlanType.WEEKLY,
      numDays: 7,
      startDate: window.startDate,
    });
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

    // Catch-up is schedule-derived and idempotent. If the preparation cron was
    // missed, create only the remaining bridge to the next fixed cycle rather
    // than backdating a seven-day plan.
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
    generationJobId?: string,
  ): Promise<string> {
    await MealGenerationService.updateGenerationProgress(
      generationJobId,
      10,
      'PROFILE',
      'Applying your goals, preferences, and health safeguards.'
    );
    // 1. Fetch live user details, profile, conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
        safetyProfileEntries: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile must be initialized before generating a meal plan.');
    }

    const profile = user.userProfile;
    const safetyRestrictions = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
      otherConditions: profile.otherConditions,
      otherAllergies: profile.otherAllergies,
    });
    const userConditions = safetyRestrictions.conditions;
    const userAllergens = safetyRestrictions.allergies;
    const otherConditions = safetyRestrictions.customConditions.join(', ');
    const otherAllergies = safetyRestrictions.customFoodRestrictions.join(', ');
    const highRiskReviewRequired = requiresEscalatedMealReview(userConditions, otherConditions);

    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
      throw new Error('Please complete your onboarding profile statistics first.');
    }

    // --- STEP 1: Check MealLibrary for pre-verified clinical matches ---
    console.log(`[Meal Generation] Step 1: Checking MealLibrary for pre-verified clinical matches...`);
    await MealGenerationService.updateGenerationProgress(
      generationJobId,
      25,
      'LIBRARY_MATCH',
      'Screening nutritionist-certified meals for safe matches.'
    );
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        verifiedByNutritionistId: { not: null }, // Only nutritionist-verified meals
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...getApprovedMealLibraryWhere(), // Exclude FLAGGED meals per Addendum 4
      },
      include: {
        ingredients: {
          orderBy: { position: 'asc' },
        },
        safetyDeclarations: true,
        safetyReviewedByNutritionist: {
          include: { user: { select: { role: true } } },
        },
      },
    });

    const evaluatedLibraryMeals = libraryMeals.map((meal) => ({
      meal,
      safety: evaluateMealLibrarySafetyEvidence({
        ...meal,
        reviewerEligible: meal.safetyReviewedByNutritionist
          ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
          : false,
      }),
    }));

    const eligibleLibraryMeals = filterEligibleMealGenerationLibraryCandidates(
      evaluatedLibraryMeals,
      safetyRestrictions.evaluationRestrictions,
      ({ meal, safety }) => ({
        status: meal.status,
        suitableConditions: safety.suitableConditions,
        allergenFree: safety.allergenFree,
        safetyEvidence: safety.adapterEvidence,
        ingredients: safety.ingredients,
      })
    ).map(({ meal }) => meal);

    const matchedSlots: {
      dayNumber: number;
      mealType: MealType;
      scheduledDate: Date;
      libraryMeal: typeof libraryMeals[0];
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

          // 1. Check dietary preferences matching
          if (profile.dietaryPreference && meal.dietaryTags) {
            const tags = meal.dietaryTags as string[];
            if (!tags.includes(profile.dietaryPreference)) return false;
          }

          // 2. Check goal matching
          if (profile.goal && meal.dietaryTags) {
            const tags = meal.dietaryTags as string[];
            if (!tags.includes(profile.goal)) return false;
          }

          return true;
        });

        if (matches.length > 0) {
          // Variant rotation (by usageCount ascending, then random selection from those with min usage)
          const minUsage = Math.min(...matches.map((m) => m.usageCount));
          const candidates = matches.filter((m) => m.usageCount === minUsage);
          const selected = candidates[Math.floor(Math.random() * candidates.length)];
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

    // --- STEP 2: Fallback/Generation for unmatched slots ---
    const aiMeals = await runMealGenerationFallbackForUnmatchedSlots(
      unmatchedSlots,
      async (fallbackSlots): Promise<GeneratedMeal[]> => {
      await MealGenerationService.updateGenerationProgress(
        generationJobId,
        45,
        'AI_GENERATION',
        'Preparing safe options for unmatched meal slots.'
      );
      const totalMeals = fallbackSlots.length;
      console.log(`[Meal Generation] ${totalMeals} unmatched slots. Generating via Gemini AI...`);

      // Fetch a balanced FNRI reference across common food categories.
      const localFoodsContext = await getFNRISubset();
      const formattedFoodsContext = localFoodsContext
        .map((f) => `- ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g)`)
        .join('\n');

      const { prompt, systemInstruction } = buildMealGenerationPrompt({
        slots: fallbackSlots,
        dailyCalorieTarget,
        goal,
        dietaryPreference: profile.dietaryPreference || 'OMNIVORE',
        carbPreference: profile.carbPreference || 'MODERATE',
        foodCulture: profile.foodCulture || 'Filipino',
        conditions: userConditions,
        allergens: userAllergens,
        otherConditions,
        otherAllergies,
        foodReference: formattedFoodsContext,
      });

      // Define Zod response schema with refinement to guarantee exact slot matching
      const MealResponseSchema = z.object({
        meals: z.array(
          z.object({
            dayNumber: z.number(),
            mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
            mealName: z.string(),
            description: z.string(),
            calories: z.number(),
            proteinG: z.number(),
            carbsG: z.number(),
            fatG: z.number(),
            ingredients: z.array(z.object({
              name: z.string().trim().min(1),
              quantity: z.number().positive().max(10_000),
              unit: z.enum(['g', 'mL', 'piece', 'tbsp', 'tsp', 'cup', 'can', 'pack']),
            })).min(1),
          })
        ).refine((meals) => {
          if (meals.length !== fallbackSlots.length) return false;
          return fallbackSlots.every((slot) =>
            meals.some((m) => m.dayNumber === slot.dayNumber && m.mealType === slot.mealType)
          );
        }, {
          message: `Must generate exactly the requested slots: ${JSON.stringify(fallbackSlots.map(s => ({ day: s.dayNumber, type: s.mealType })))}`,
        }),
      });

      const aiResponse = await generateGenerativeJSON<GeminiMealPlanResponse>(
        prompt,
        systemInstruction,
        MealResponseSchema,
        0.2 // Enforce temperature 0.2
      );

      return aiResponse.meals;
    });

    const newPlanGroupId = randomUUID();
    const targetPlanEndDate = getScheduledMealDate(startDate, Math.max(0, numDays - 1));
    const userHasConditions = userConditions.length > 0 && !userConditions.includes(HealthConditionType.NONE);
    const createdPlansList: any[] = [];

    // Pre-resolve ingredient lookups outside the transaction to prevent database timeouts
    const preparedAiMeals: {
      mealType: MealType;
      mealName: string;
      description: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      scheduledDate: Date;
      aiConfidenceFlag: AIConfidenceFlag;
      ingredientsData: {
        ingredientName: string;
        category: string;
        foodItemId: string | null;
        dataSource: MealIngredientDataSource;
        quantity?: number;
        unit?: string;
      }[];
    }[] = [];

    for (const rawMeal of aiMeals) {
      const slot = unmatchedSlots.find(
        (s) => s.dayNumber === rawMeal.dayNumber && s.mealType === rawMeal.mealType
      );
      const scheduledDate = slot ? slot.scheduledDate : new Date(startDate);

      let hasEstimatedIngredient = false;
      const ingredientsData: {
        ingredientName: string;
        category: string;
        foodItemId: string | null;
        dataSource: MealIngredientDataSource;
        quantity?: number;
        unit?: string;
      }[] = [];

      for (const ingredient of rawMeal.ingredients) {
        const ingredientName = ingredient.name;
        try {
          const lookup = await lookupIngredient(ingredientName);
          if (lookup.source === 'ESTIMATED') {
            hasEstimatedIngredient = true;
          }
          ingredientsData.push({
            ingredientName: lookup.food.name || ingredientName,
            category: lookup.food.category || 'PANTRY',
            foodItemId: lookup.food.id || null,
            dataSource: lookup.source === 'ESTIMATED' ? MealIngredientDataSource.GEMINI_ESTIMATED : MealIngredientDataSource.FNRI,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        } catch (lookupErr) {
          console.warn(`Ingredient lookup failed for: ${ingredientName}, using as estimated.`, lookupErr);
          hasEstimatedIngredient = true;
          ingredientsData.push({
            ingredientName,
            category: 'PANTRY',
            foodItemId: null,
            dataSource: MealIngredientDataSource.GEMINI_ESTIMATED,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        }
      }

      let flag: AIConfidenceFlag = AIConfidenceFlag.SAFE;
      if (userHasConditions) {
        if (hasEstimatedIngredient) {
          flag = AIConfidenceFlag.NEEDS_REVIEW; // Unverified items + clinical conditions = NEEDS_REVIEW!
        } else {
          flag = AIConfidenceFlag.CAUTION; // Verified database items + clinical conditions = CAUTION!
        }
      }

      preparedAiMeals.push({
        mealType: rawMeal.mealType,
        mealName: rawMeal.mealName,
        description: rawMeal.description,
        calories: parseFloat(rawMeal.calories as any || 0),
        proteinG: parseFloat(rawMeal.proteinG as any || 0),
        carbsG: parseFloat(rawMeal.carbsG as any || 0),
        fatG: parseFloat(rawMeal.fatG as any || 0),
        scheduledDate,
        aiConfidenceFlag: flag,
        ingredientsData,
      });
    }

    await MealGenerationService.updateGenerationProgress(
      generationJobId,
      72,
      'INGREDIENT_VALIDATION',
      'Validating ingredient evidence and grocery quantities.'
    );

    // Save plans atomically in a Prisma Transaction (with a 30-second timeout to support sequential batch inserts)
    await prisma.$transaction(async (tx) => {
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

      // 1b. Create swap tracker row for this new planGroupId
      await tx.planSwapTracker.create({
        data: {
          planGroupId: newPlanGroupId,
          userId,
          swapsUsed: 0,
        },
      });

      // 2. Create matched library meals from the exact certified library snapshot.
      if (matchedSlots.length > 0) {
        for (const slot of matchedSlots) {
          const ingredientsData = slot.libraryMeal.ingredients.map((ing) => ({
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
              libraryMealId: slot.libraryMeal.id,
              nutritionistId: slot.libraryMeal.safetyReviewedByNutritionistId,
              planType,
              mealType: slot.mealType,
              mealName: slot.libraryMeal.mealName,
              description: slot.libraryMeal.description,
              calories: slot.libraryMeal.calories,
              proteinG: slot.libraryMeal.proteinG,
              carbsG: slot.libraryMeal.carbsG,
              fatG: slot.libraryMeal.fatG,
              aiConfidenceFlag: AIConfidenceFlag.SAFE,
              scheduledDate: slot.scheduledDate,
            reviewedAt: slot.libraryMeal.safetyReviewedAt,
            requiresSafetyRevalidation: false,
            safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            highRiskReviewRequired,
            reviewApprovalCount: highRiskReviewRequired ? 2 : 1,
              ingredients: {
                create: ingredientsData,
              },
            },
          });
          createdPlansList.push(createdPlan);

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
            ingredients: {
              create: meal.ingredientsData,
            },
          },
        });
        createdPlansList.push(createdPlan);
      }
    }, { timeout: 30000 });

    await MealGenerationService.updateGenerationProgress(
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
          message: 'Your new AI meal plan contains clinical alerts and has been queued for Registered Dietitian review.',
          type: NotificationType.REVIEW_REQUEST,
        },
      });
    }

    return newPlanGroupId;
  }

  private static async updateGenerationProgress(
    jobId: string | undefined,
    progressPct: number,
    stageCode: string,
    stageMessage: string
  ) {
    if (!jobId) return;
    await prisma.mealPlanGenerationJob.updateMany({
      where: { id: jobId, status: MealPlanGenerationJobStatus.GENERATING },
      data: { progressPct, stageCode, stageMessage },
    });
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
