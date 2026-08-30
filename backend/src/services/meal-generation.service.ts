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
  getDayBefore,
  getManilaDateKey,
  getNextWeeklyCycleWindow,
  getOnDemandMealPlanWindow,
  getScheduledMealDate,
  type WeeklyCycleWindow,
} from '@/domain/meal-plan-cycle.policy';
import { buildMealGenerationPrompt } from '@/domain/meal-generation-cuisine.policy';

interface GeneratedMeal {
  dayNumber: number;
  mealType: MealType;
  mealName: string;
  description: string;
  ingredients: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface GeminiMealPlanResponse {
  meals: GeneratedMeal[];
}

export class MealGenerationService {
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
    const window = getOnDemandMealPlanWindow(profile?.shoppingDayGroup, now);

    console.log(
      `[Meal Generation] Generating ${window.planType} plan: ${window.numDays} day(s) from ${getManilaDateKey(window.startDate)}.`
    );
    return MealGenerationService.generate7DayPlan(
      userId,
      window.planType,
      window.numDays,
      window.startDate
    );
  }

  private static async findExistingWeeklyPlan(
    userId: string,
    window: WeeklyCycleWindow
  ): Promise<string | null> {
    const existingPlan = await prisma.mealPlan.findFirst({
      where: {
        userId,
        planType: PlanType.WEEKLY,
        status: { in: [MealPlanStatus.PENDING_REVIEW, MealPlanStatus.APPROVED] },
        scheduledDate: { gte: window.startDate, lte: window.endDate },
      },
      orderBy: { createdAt: 'desc' },
      select: { planGroupId: true },
    });

    return existingPlan?.planGroupId ?? null;
  }

  static async generateNextWeeklyPlan(
    userId: string,
    group: ShoppingDayGroup,
    now: Date = new Date()
  ): Promise<string> {
    const window = getNextWeeklyCycleWindow(group, now);
    const existingPlanGroupId = await MealGenerationService.findExistingWeeklyPlan(userId, window);
    if (existingPlanGroupId) return existingPlanGroupId;

    return MealGenerationService.generate7DayPlan(
      userId,
      PlanType.WEEKLY,
      7,
      window.startDate
    );
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
      select: { shoppingDayGroup: true },
    });
    const group = profile?.shoppingDayGroup;
    if (!group) return { rolledOver: false, planGroupId: null };

    const window = getCurrentWeeklyCycleWindow(group, now);
    const existingPlanGroupId = await MealGenerationService.findExistingWeeklyPlan(userId, window);
    if (existingPlanGroupId) {
      return { rolledOver: false, planGroupId: existingPlanGroupId };
    }

    const latestStarterMeal = await prisma.mealPlan.findFirst({
      where: { userId, planType: PlanType.STARTER },
      orderBy: { scheduledDate: 'desc' },
      select: { scheduledDate: true },
    });
    const expectedBridgeEnd = getDayBefore(window.startDate);
    if (
      !latestStarterMeal ||
      getManilaDateKey(latestStarterMeal.scheduledDate) !== getManilaDateKey(expectedBridgeEnd)
    ) {
      return { rolledOver: false, planGroupId: null };
    }

    const planGroupId = await MealGenerationService.generate7DayPlan(
      userId,
      PlanType.WEEKLY,
      7,
      window.startDate
    );
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
  ): Promise<string> {
    // 1. Fetch live user details, profile, conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile must be initialized before generating a meal plan.');
    }

    const profile = user.userProfile;
    const userConditions = user.healthConditions.map((c) => c.condition);
    const userAllergens = user.allergies.map((a) => a.allergen);
    const otherConditions = profile.otherConditions || '';
    const otherAllergies = profile.otherAllergies || '';

    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
      throw new Error('Please complete your onboarding profile statistics first.');
    }

    // --- STEP 1: Check MealLibrary for pre-verified clinical matches ---
    console.log(`[Meal Generation] Step 1: Checking MealLibrary for pre-verified clinical matches...`);
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        verifiedByNutritionistId: { not: null }, // Only nutritionist-verified meals
        ...getApprovedMealLibraryWhere(), // Exclude FLAGGED meals per Addendum 4
      },
      include: {
        mealPlans: {
          select: {
            ingredients: {
              select: {
                dataSource: true,
                foodItemId: true,
              },
            },
          },
        },
      },
    });

    const eligibleLibraryMeals = filterEligibleMealGenerationLibraryCandidates(
      libraryMeals,
      {
        conditions: userConditions,
        allergies: userAllergens,
        customConditions: otherConditions,
        customAllergies: otherAllergies,
      },
      (meal) => ({
        status: meal.status,
        suitableConditions: meal.suitableConditions,
        allergenFree: meal.allergenFree,
        // The current schema has no explicit safety-completeness/allergen evidence marker.
        // Omitting safetyEvidence makes the adapter conservatively exclude legacy rows.
        ingredients: meal.mealPlans.flatMap((plan) => plan.ingredients),
      })
    );

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

    // Evaluate each individual slot independently
    for (let day = 0; day < numDays; day++) {
      const scheduledDate = getScheduledMealDate(startDate, day);

      const slots = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
      for (const slotType of slots) {
        // Filter in-memory verified library matches
        const matches = eligibleLibraryMeals.filter((meal) => {
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
            ingredients: z.array(z.string()),
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
      }[] = [];

      for (const ingredientName of rawMeal.ingredients) {
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
          });
        } catch (lookupErr) {
          console.warn(`Ingredient lookup failed for: ${ingredientName}, using as estimated.`, lookupErr);
          hasEstimatedIngredient = true;
          ingredientsData.push({
            ingredientName,
            category: 'PANTRY',
            foodItemId: null,
            dataSource: MealIngredientDataSource.GEMINI_ESTIMATED,
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

    // Save plans atomically in a Prisma Transaction (with a 30-second timeout to support sequential batch inserts)
    await prisma.$transaction(async (tx) => {
      // 1. Cancel previous active/pending plan items atomically
      await tx.mealPlan.updateMany({
        where: { userId, status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] } },
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

      // 2. Create matched library meals copying ingredients from original approved plans
      if (matchedSlots.length > 0) {
        const libraryMealIds = matchedSlots.map((s) => s.libraryMeal.id);
        const originalPlans = await tx.mealPlan.findMany({
          where: { libraryMealId: { in: libraryMealIds } },
          include: { ingredients: true },
        });

        for (const slot of matchedSlots) {
          const originalPlan = originalPlans.find((p) => p.libraryMealId === slot.libraryMeal.id);
          const ingredientsData = originalPlan?.ingredients.map((ing) => ({
            ingredientName: ing.ingredientName,
            category: ing.category,
            foodItemId: ing.foodItemId,
            dataSource: ing.dataSource,
          })) || [];

          // Create clone for this user (status: PENDING_REVIEW, libraryMealId omitted to satisfy @unique constraint)
          const createdPlan = await tx.mealPlan.create({
            data: {
              planGroupId: newPlanGroupId,
              userId,
              status: MealPlanStatus.PENDING_REVIEW, // Every generated meal goes to nutritionist queue for verification
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
            ingredients: {
              create: meal.ingredientsData,
            },
          },
        });
        createdPlansList.push(createdPlan);
      }
    }, { timeout: 30000 });

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
}

// Extend Prisma namespace helper using custom declaration to support transactional bulk creates
// We can declare a Prisma helper directly or run normal transactional loops. Let's do a transactional loop!
// Wait! Let's write the transaction logic explicitly inside the class instead of extending the Prisma namespace,
// since it is extremely reliable and avoids TS declaration merge errors! Let's update that.
