import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset, lookupIngredient } from '@/lib/fnri';
import { 
  MealType, 
  MealPlanStatus, 
  AIConfidenceFlag, 
  HealthConditionType, 
  AllergenType,
  NotificationType,
  PlanType,
  ShoppingDayGroup,
  MealLibraryStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const SYSTEM_CONTEXT = `
You are generating meal data for a system with this
EXACT JSON response shape. You MUST use these exact
field names and enum values — do not rename, do not
restructure, do not add extra fields.

Required response format:
{
  "meals": [
    {
      "dayNumber": number,
      "mealType": "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK",
      "mealName": string,
      "description": string,
      "calories": number,
      "proteinG": number,
      "carbsG": number,
      "fatG": number,
      "ingredients": string[]
    }
  ]
}

Rules:
- mealType must be EXACTLY one of the four values shown
  above, uppercase, no variations
- ingredients must be plain ingredient names only —
  no quantities, no units, no measurements, no cooking
  instructions
- Return ONLY valid JSON. No markdown formatting, no
  code fences, no backticks, no preamble, no explanation
  text before or after the JSON
`;

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
  /**
   * Determines whether to generate a STARTER plan (partial days until next
   * weekStartDay) or a full WEEKLY plan, based on the user's shoppingDayGroup.
   * Falls back to a 7-day WEEKLY plan for users without a shoppingDayGroup.
   */
  static async generatePlanForUser(userId: string): Promise<string> {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDow = today.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

    // Determine week start day from shoppingDayGroup (default WEEKLY if not set)
    const group = profile?.shoppingDayGroup;
    const weekStartDow = group === ShoppingDayGroup.WEEKDAY ? 1 : 0; // WEEKDAY→Mon(1), WEEKEND/default→Sun(0)

    if (!group || todayDow === weekStartDow) {
      // No shopping preference set, OR today is exactly the week start → full WEEKLY plan
      return MealGenerationService.generate7DayPlan(userId, PlanType.WEEKLY, 7, today);
    }

    // Calculate days remaining until next weekStartDay
    const daysUntilStart = (weekStartDow - todayDow + 7) % 7;
    if (daysUntilStart === 0) {
      // Should never reach here due to check above, but safety net
      return MealGenerationService.generate7DayPlan(userId, PlanType.WEEKLY, 7, today);
    }

    console.log(`[Meal Generation] Generating STARTER plan: ${daysUntilStart} day(s) until next cycle starts.`);
    return MealGenerationService.generate7DayPlan(userId, PlanType.STARTER, daysUntilStart, today);
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
        status: MealLibraryStatus.APPROVED, // Exclude FLAGGED meals per Addendum 4
      },
    });

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
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + day);
      scheduledDate.setHours(0, 0, 0, 0);

      const slots = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
      for (const slotType of slots) {
        // Filter in-memory verified library matches
        const matches = libraryMeals.filter((meal) => {
          if (meal.mealType !== slotType) return false;

          // 1. Check health conditions compatibility
          if (meal.suitableConditions) {
            const conditions = meal.suitableConditions as string[];
            const hasUnsuitableCondition = userConditions.some(
              (c) => c !== HealthConditionType.NONE && !conditions.includes(c)
            );
            if (hasUnsuitableCondition) return false;
          }

          // 2. Check allergen exclusions
          if (meal.allergenFree) {
            const freeFrom = meal.allergenFree as string[];
            const hasAllergenConflict = userAllergens.some(
              (a) => a !== AllergenType.NONE && !freeFrom.includes(a)
            );
            if (hasAllergenConflict) return false;
          }

          // 3. Check dietary preferences matching
          if (profile.dietaryPreference && meal.dietaryTags) {
            const tags = meal.dietaryTags as string[];
            if (!tags.includes(profile.dietaryPreference)) return false;
          }

          // 4. Check goal matching
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

    let aiMeals: GeneratedMeal[] = [];

    // --- STEP 2: Fallback/Generation for unmatched slots ---
    if (unmatchedSlots.length > 0) {
      const totalMeals = unmatchedSlots.length;
      console.log(`[Meal Generation] ${totalMeals} unmatched slots. Generating via Gemini AI...`);

      // Fetch local Filipino foods context subset to inject in context
      const localFoodsContext = await getFNRISubset();
      const formattedFoodsContext = localFoodsContext
        .map((f) => `- ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g)`)
        .slice(0, 100)
        .join('\n');

      const systemInstruction = 
        `You are a clinical database dietitian specialized in the Philippine Food Composition Table.\n` +
        SYSTEM_CONTEXT;

      const requestedSlotsStr = unmatchedSlots
        .map((s) => `- Day ${s.dayNumber}: ${s.mealType}`)
        .join('\n');

      const prompt = 
        `Generate exactly the following ${totalMeals} meals for the specified days and meal types:\n` +
        `${requestedSlotsStr}\n` +
        `\n` +
        `Enforce these constraints for the generated meals:\n` +
        `[PATIENT CLINICAL METRICS]\n` +
        `- Name: ${user.name}\n` +
        `- Daily Target Calories: ${dailyCalorieTarget} kcal/day (Enforce this budget across daily meals. breakfast ~30%, lunch ~40%, dinner ~30%)\n` +
        `- Goal Target: ${goal}\n` +
        `- Dietary Preference: ${profile.dietaryPreference || 'OMNIVORE'}\n` +
        `- Carb Intake Level: ${profile.carbPreference || 'MODERATE'}\n` +
        `- Cooking Culture Style: ${profile.foodCulture || 'Filipino'}\n` +
        `\n` +
        `[CLINICAL SAFE GUARDS]\n` +
        `- Medical Conditions: ${userConditions.join(', ') || 'NONE'}${otherConditions ? '; Additional: ' + otherConditions : ''}\n` +
        `- Allergens to EXCLUDE completely: ${userAllergens.join(', ') || 'NONE'}${otherAllergies ? '; Additional: ' + otherAllergies : ''}\n` +
        `\n` +
        `[NATIVE FILIPINO INGREDIENTS DICTIONARY]\n` +
        `${formattedFoodsContext}\n` +
        `\n` +
        `Hard Rules:\n` +
        `- Exclude all clinical allergy allergens entirely from all recipes.\n` +
        `- Filter out high sodium condiments if user has HYPERTENSION.\n` +
        `- Limit simple carbs, white rice portions, and sugars if user has DIABETES.\n` +
        `- Make sure the macronutrients are mathematically aligned with standard portion limits.\n` +
        `- Do not include markdown code block wraps. Return only the raw JSON.`;

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
          if (meals.length !== unmatchedSlots.length) return false;
          return unmatchedSlots.every((slot) =>
            meals.some((m) => m.dayNumber === slot.dayNumber && m.mealType === slot.mealType)
          );
        }, {
          message: `Must generate exactly the requested slots: ${JSON.stringify(unmatchedSlots.map(s => ({ day: s.dayNumber, type: s.mealType })))}`,
        }),
      });

      const aiResponse = await generateGenerativeJSON<GeminiMealPlanResponse>(
        prompt,
        systemInstruction,
        MealResponseSchema,
        0.2 // Enforce temperature 0.2
      );

      aiMeals = aiResponse.meals;
    }

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
          });
        } catch (lookupErr) {
          console.warn(`Ingredient lookup failed for: ${ingredientName}, using as estimated.`, lookupErr);
          hasEstimatedIngredient = true;
          ingredientsData.push({
            ingredientName,
            category: 'PANTRY',
            foodItemId: null,
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
          })) || [];

          // Create clone for this user (status: APPROVED, libraryMealId omitted to satisfy @unique constraint)
          const createdPlan = await tx.mealPlan.create({
            data: {
              planGroupId: newPlanGroupId,
              userId,
              status: MealPlanStatus.APPROVED, // Pre-verified items are automatically approved!
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

    // --- STEP 3: Create Nutritionist assignment notifications if NEEDS_REVIEW occurs ---
    const needsReview = createdPlansList.some((p) => p.aiConfidenceFlag === AIConfidenceFlag.NEEDS_REVIEW);
    if (needsReview) {
      console.log(`[Meal Generation] Clinical warning flagged (NEEDS_REVIEW). Creating nutritionist alert...`);
      
      const activeAssignment = await prisma.nutritionistAssignment.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { nutritionistProfile: true },
      });

      const notificationTitle = 'New Meal Plan Awaiting Verification';
      const notificationMsg = `AI-generated meal plan for patient ${user.name} requires verification due to estimated ingredients and active health restrictions.`;

      if (activeAssignment && activeAssignment.nutritionistProfile) {
        await prisma.notification.create({
          data: {
            userId: activeAssignment.nutritionistProfile.userId,
            title: notificationTitle,
            message: notificationMsg,
            type: NotificationType.REVIEW_REQUEST,
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            userId,
            title: notificationTitle,
            message: 'Your new AI meal plan contains clinical alerts and has been queued for Registered Dietitian review.',
            type: NotificationType.REVIEW_REQUEST,
          },
        });
      }
    }

    return newPlanGroupId;
  }
}

// Extend Prisma namespace helper using custom declaration to support transactional bulk creates
// We can declare a Prisma helper directly or run normal transactional loops. Let's do a transactional loop!
// Wait! Let's write the transaction logic explicitly inside the class instead of extending the Prisma namespace,
// since it is extremely reliable and avoids TS declaration merge errors! Let's update that.
