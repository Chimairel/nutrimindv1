import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset, lookupIngredient } from '@/lib/fnri';
import { 
  MealType, 
  MealPlanStatus, 
  AIConfidenceFlag, 
  HealthConditionType, 
  AllergenType,
  NotificationType
} from '@prisma/client';
import { randomUUID } from 'crypto';

interface GeneratedIngredient {
  name: string;
  category?: string;
}

interface GeneratedMeal {
  dayNumber: number;
  mealType: MealType;
  mealName: string;
  description: string;
  ingredients: GeneratedIngredient[];
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
   * Generates a 7-day, 21-meal plan customized to the user's macro metrics,
   * clinical restrictions, food preferences, and cultural style.
   */
  static async generate7DayPlan(userId: string): Promise<string> {
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

    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
      throw new Error('Please complete your onboarding profile statistics first.');
    }

    // --- STEP 1: Check MealLibrary for pre-verified clinical matches ---
    console.log(`[Meal Generation] Step 1: Checking MealLibrary for pre-verified clinical matches...`);
    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        verifiedByNutritionistId: { not: null }, // Only nutritionist-verified meals
      },
    });

    // Filter library matches matching User constraints in Javascript memory
    const matchedLibraryMeals = libraryMeals.filter((meal) => {
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

      return true;
    });

    // Group matching verified meals by MealType
    const breakfasts = matchedLibraryMeals.filter((m) => m.mealType === MealType.BREAKFAST);
    const lunches = matchedLibraryMeals.filter((m) => m.mealType === MealType.LUNCH);
    const dinners = matchedLibraryMeals.filter((m) => m.mealType === MealType.DINNER);

    // If we have at least 7 verified meals in each category, serve from the Library!
    if (breakfasts.length >= 7 && lunches.length >= 7 && dinners.length >= 7) {
      console.log(`[Meal Generation] Sufficient pre-verified meals found in library. Constructing plan...`);
      const newPlanGroupId = randomUUID();
      const planMealsToCreate = [];

      // Cancel previous active/pending plan items atomically
      await prisma.mealPlan.updateMany({
        where: { userId, status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] } },
        data: { status: MealPlanStatus.CANCELLED },
      });

      for (let day = 0; day < 7; day++) {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + day);
        scheduledDate.setHours(0, 0, 0, 0);

        const dailyMeals = [
          { type: MealType.BREAKFAST, source: breakfasts[day % breakfasts.length] },
          { type: MealType.LUNCH, source: lunches[day % lunches.length] },
          { type: MealType.DINNER, source: dinners[day % dinners.length] },
        ];

        for (const m of dailyMeals) {
          planMealsToCreate.push({
            planGroupId: newPlanGroupId,
            userId,
            libraryMealId: m.source.id,
            status: MealPlanStatus.APPROVED, // Pre-verified items are automatically approved!
            mealType: m.type,
            mealName: m.source.mealName,
            description: m.source.description,
            calories: m.source.calories,
            proteinG: m.source.proteinG,
            carbsG: m.source.carbsG,
            fatG: m.source.fatG,
            aiConfidenceFlag: AIConfidenceFlag.SAFE,
            scheduledDate,
          });
        }
      }

      // Bulk write and increment usage counts
      await prisma.$transaction([
        prisma.mealPlan.createMany({ data: planMealsToCreate }),
        ...matchedLibraryMeals.map((m) =>
          prisma.mealLibrary.update({
            where: { id: m.id },
            data: { usageCount: { increment: 1 } },
          })
        ),
      ]);

      return newPlanGroupId;
    }

    // --- STEP 2: Fallback to Gemini AI meal plan generation ---
    console.log(`[Meal Generation] Insufficient verified meals in library. Cascading to Google Gemini AI...`);
    
    // Fetch local Filipino foods context subset to inject in context
    const localFoodsContext = await getFNRISubset();
    const formattedFoodsContext = localFoodsContext
      .map((f) => `- ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g)`)
      .slice(0, 100)
      .join('\n');

    const systemInstruction = 
      "You are a clinical database dietitian specialized in the Philippine Food Composition Table. " +
      "You generate customized 7-day meal plans (Breakfast, Lunch, Dinner per day = 21 meals) for young urban Filipinos. " +
      "Prioritize native, cost-effective Filipino dishes and fresh market items (e.g. tinola, sinigang, nilaga, adobong kangkong, galunggong) " +
      "over expensive Western imports (e.g. salmon, kale, quinoa, avocado).";

    const prompt = 
      `Compile a highly customized, culturally appropriate 7-day meal plan (3 meals/day: BREAKFAST, LUNCH, DINNER = exactly 21 meals in total) matching these specs:\n` +
      `\n` +
      `[PATIENT CLINICAL METRICS]\n` +
      `- Name: ${user.name}\n` +
      `- Daily Target Calories: ${dailyCalorieTarget} kcal/day (Enforce this budget across the 3 meals daily. Make breakfast ~30%, lunch ~40%, dinner ~30%)\n` +
      `- Goal Target: ${goal}\n` +
      `- Dietary Preference: ${profile.dietaryPreference || 'OMNIVORE'}\n` +
      `- Carb Intake Level: ${profile.carbPreference || 'MODERATE'}\n` +
      `- Cooking Culture Style: ${profile.foodCulture || 'Filipino'}\n` +
      `\n` +
      `[CLINICAL SAFE GUARDS]\n` +
      `- Medical Conditions: ${userConditions.join(', ') || 'NONE'}\n` +
      `- Allergens to EXCLUDE completely: ${userAllergens.join(', ') || 'NONE'}\n` +
      `\n` +
      `[NATIVE FILIPINO INGREDIENTS DICTIONARY]\n` +
      `${formattedFoodsContext}\n` +
      `\n` +
      `Structure your response as a STRICT, valid JSON object containing exactly a "meals" array with 21 elements:\n` +
      `{\n` +
      `  "meals": [\n` +
      `    {\n` +
      `      "dayNumber": number (1 to 7),\n` +
      `      "mealType": "BREAKFAST" | "LUNCH" | "DINNER",\n` +
      `      "mealName": "Name of dish (e.g. Steamed Bangus with Tomatoes)",\n` +
      `      "description": "Brief description of cooking and portion size (e.g. 1 medium sized bangus belly, steamed with onions)",\n` +
      `      "calories": number,\n` +
      `      "proteinG": number,\n` +
      `      "carbsG": number,\n` +
      `      "fatG": number,\n` +
      `      "ingredients": [\n` +
      `        { "name": "Exact ingredient name matched or estimated (e.g. Milkfish)", "category": "PRODUCE" | "MEAT" | "FISH" | "PANTRY" }\n` +
      `      ]\n` +
      `    }\n` +
      `  ]\n` +
      `}\n` +
      `\n` +
      `Hard Rules:\n` +
      `- Exclude all clinical allergy allergens entirely from all recipes.\n` +
      `- Filter out high sodium condiments if user has HYPERTENSION.\n` +
      `- Limit simple carbs, white rice portions, and sugars if user has DIABETES.\n` +
      `- Make sure the macronutrients are mathematically aligned with standard portion limits.\n` +
      `- Do not include markdown code block wraps. Return only the raw JSON.`;

    const aiResponse = await generateGenerativeJSON<GeminiMealPlanResponse>(prompt, systemInstruction);

    if (!aiResponse || !Array.isArray(aiResponse.meals) || aiResponse.meals.length !== 21) {
      throw new Error('Gemini API failed to generate a precise 21-meal plan layout.');
    }

    const newPlanGroupId = randomUUID();
    const userHasConditions = userConditions.length > 0 && !userConditions.includes(HealthConditionType.NONE);

    // Cancel old user active plans
    await prisma.mealPlan.updateMany({
      where: { userId, status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] } },
      data: { status: MealPlanStatus.CANCELLED },
    });

    console.log(`[Meal Generation] Validating and indexing 21 AI-generated meals against FNRI composition chain...`);

    // Array to save plans
    const createdPlansList = [];

    // Loop through the 21 generated meals
    for (const rawMeal of aiResponse.meals) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (rawMeal.dayNumber - 1));
      scheduledDate.setHours(0, 0, 0, 0);

      // Perform lookups on every ingredient in the recipe to check for safety flag
      let hasEstimatedIngredient = false;
      const ingredientsData = [];

      for (const ing of rawMeal.ingredients) {
        try {
          const lookup = await lookupIngredient(ing.name);
          if (lookup.source === 'ESTIMATED') {
            hasEstimatedIngredient = true;
          }
          ingredientsData.push({
            ingredientName: lookup.food.name || ing.name,
            category: lookup.food.category || ing.category || 'PANTRY',
            foodItemId: lookup.food.id || null,
          });
        } catch (lookupErr) {
          console.warn(`Ingredient lookup failed for: ${ing.name}, using as estimated.`, lookupErr);
          hasEstimatedIngredient = true;
          ingredientsData.push({
            ingredientName: ing.name,
            category: ing.category || 'PANTRY',
            foodItemId: null,
          });
        }
      }

      // Determine the AI safety tag
      let flag: AIConfidenceFlag = AIConfidenceFlag.SAFE;
      if (userHasConditions) {
        if (hasEstimatedIngredient) {
          flag = AIConfidenceFlag.NEEDS_REVIEW; // Unverified items + clinical conditions = NEEDS_REVIEW!
        } else {
          flag = AIConfidenceFlag.CAUTION; // Verified database items + clinical conditions = CAUTION!
        }
      }

      // ALL AI-generated meals MUST start as PENDING_REVIEW (Legal Protection Layer 3)
      // Only MealLibrary-sourced meals should be auto-APPROVED
      const status: MealPlanStatus = MealPlanStatus.PENDING_REVIEW;

      // Save plan item and ingredients atomically
      const createdPlan = await prisma.mealPlan.create({
        data: {
          planGroupId: newPlanGroupId,
          userId,
          status,
          mealType: rawMeal.mealType,
          mealName: rawMeal.mealName,
          description: rawMeal.description,
          calories: parseFloat(rawMeal.calories as any || 0),
          proteinG: parseFloat(rawMeal.proteinG as any || 0),
          carbsG: parseFloat(rawMeal.carbsG as any || 0),
          fatG: parseFloat(rawMeal.fatG as any || 0),
          aiConfidenceFlag: flag,
          scheduledDate,
          ingredients: {
            create: ingredientsData.map((ing) => ({
              ingredientName: ing.ingredientName,
              category: ing.category,
              foodItemId: ing.foodItemId,
            })),
          },
        },
      });

      createdPlansList.push(createdPlan);
    }

    // --- STEP 3: Create Nutritionist assignment notifications if NEEDS_REVIEW occurs ---
    const needsReview = createdPlansList.some((p) => p.aiConfidenceFlag === AIConfidenceFlag.NEEDS_REVIEW);
    if (needsReview) {
      console.log(`[Meal Generation] Clinical warning flagged (NEEDS_REVIEW). Creating nutritionist alert...`);
      
      // Look up if user has an active nutritionist assignment
      const activeAssignment = await prisma.nutritionistAssignment.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { nutritionistProfile: true },
      });

      const notificationTitle = 'New Meal Plan Awaiting Verification';
      const notificationMsg = `AI-generated meal plan for patient ${user.name} requires verification due to estimated ingredients and active health restrictions.`;

      if (activeAssignment && activeAssignment.nutritionistProfile) {
        // Send notification to assigned nutritionist
        await prisma.notification.create({
          data: {
            userId: activeAssignment.nutritionistProfile.userId,
            title: notificationTitle,
            message: notificationMsg,
            type: NotificationType.REVIEW_REQUEST,
          },
        });
      } else {
        // Send notification to admin/global nutritionist alerts (assigned to user as fallback)
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
