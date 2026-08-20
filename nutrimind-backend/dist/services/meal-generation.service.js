"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealGenerationService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const gemini_1 = require("@/lib/gemini");
const fnri_1 = require("@/lib/fnri");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
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
class MealGenerationService {
    /**
     * Determines whether to generate a STARTER plan (partial days until next
     * weekStartDay) or a full WEEKLY plan, based on the user's shoppingDayGroup.
     * Falls back to a 7-day WEEKLY plan for users without a shoppingDayGroup.
     */
    static async generatePlanForUser(userId) {
        const profile = await prisma_1.default.userProfile.findUnique({ where: { userId } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayDow = today.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
        // Determine week start day from shoppingDayGroup (default WEEKLY if not set)
        const group = profile?.shoppingDayGroup;
        const weekStartDow = group === client_1.ShoppingDayGroup.WEEKDAY ? 1 : 0; // WEEKDAY→Mon(1), WEEKEND/default→Sun(0)
        if (!group || todayDow === weekStartDow) {
            // No shopping preference set, OR today is exactly the week start → full WEEKLY plan
            return MealGenerationService.generate7DayPlan(userId, client_1.PlanType.WEEKLY, 7, today);
        }
        // Calculate days remaining until next weekStartDay
        const daysUntilStart = (weekStartDow - todayDow + 7) % 7;
        if (daysUntilStart === 0) {
            // Should never reach here due to check above, but safety net
            return MealGenerationService.generate7DayPlan(userId, client_1.PlanType.WEEKLY, 7, today);
        }
        console.log(`[Meal Generation] Generating STARTER plan: ${daysUntilStart} day(s) until next cycle starts.`);
        return MealGenerationService.generate7DayPlan(userId, client_1.PlanType.STARTER, daysUntilStart, today);
    }
    /**
     * Generates a meal plan for N days, customized to the user's macro metrics,
     * clinical restrictions, food preferences, and cultural style.
     * planType: STARTER (bridge plan) or WEEKLY (normal 7-day cycle).
     * numDays: number of days to cover (1-7).
     * startDate: the first day of the plan.
     */
    static async generate7DayPlan(userId, planType = client_1.PlanType.WEEKLY, numDays = 7, startDate = new Date()) {
        // 1. Fetch live user details, profile, conditions, and allergies
        const user = await prisma_1.default.user.findUnique({
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
        const libraryMeals = await prisma_1.default.mealLibrary.findMany({
            where: {
                verifiedByNutritionistId: { not: null }, // Only nutritionist-verified meals
                status: client_1.MealLibraryStatus.APPROVED, // Exclude FLAGGED meals per Addendum 4
            },
        });
        const matchedSlots = [];
        const unmatchedSlots = [];
        // Evaluate each individual slot independently
        for (let day = 0; day < numDays; day++) {
            const scheduledDate = new Date(startDate);
            scheduledDate.setDate(scheduledDate.getDate() + day);
            scheduledDate.setHours(0, 0, 0, 0);
            const slots = [client_1.MealType.BREAKFAST, client_1.MealType.LUNCH, client_1.MealType.DINNER];
            for (const slotType of slots) {
                // Filter in-memory verified library matches
                const matches = libraryMeals.filter((meal) => {
                    if (meal.mealType !== slotType)
                        return false;
                    // 1. Check health conditions compatibility
                    if (meal.suitableConditions) {
                        const conditions = meal.suitableConditions;
                        const hasUnsuitableCondition = userConditions.some((c) => c !== client_1.HealthConditionType.NONE && !conditions.includes(c));
                        if (hasUnsuitableCondition)
                            return false;
                    }
                    // 2. Check allergen exclusions
                    if (meal.allergenFree) {
                        const freeFrom = meal.allergenFree;
                        const hasAllergenConflict = userAllergens.some((a) => a !== client_1.AllergenType.NONE && !freeFrom.includes(a));
                        if (hasAllergenConflict)
                            return false;
                    }
                    // 3. Check dietary preferences matching
                    if (profile.dietaryPreference && meal.dietaryTags) {
                        const tags = meal.dietaryTags;
                        if (!tags.includes(profile.dietaryPreference))
                            return false;
                    }
                    // 4. Check goal matching
                    if (profile.goal && meal.dietaryTags) {
                        const tags = meal.dietaryTags;
                        if (!tags.includes(profile.goal))
                            return false;
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
                }
                else {
                    unmatchedSlots.push({
                        dayNumber: day + 1,
                        mealType: slotType,
                        scheduledDate,
                    });
                }
            }
        }
        let aiMeals = [];
        // --- STEP 2: Fallback/Generation for unmatched slots ---
        if (unmatchedSlots.length > 0) {
            const totalMeals = unmatchedSlots.length;
            console.log(`[Meal Generation] ${totalMeals} unmatched slots. Generating via Gemini AI...`);
            // Fetch local Filipino foods context subset to inject in context
            const localFoodsContext = await (0, fnri_1.getFNRISubset)();
            const formattedFoodsContext = localFoodsContext
                .map((f) => `- ${f.name} (Cat: ${f.category}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g)`)
                .slice(0, 100)
                .join('\n');
            const systemInstruction = `You are a clinical database dietitian specialized in the Philippine Food Composition Table.\n` +
                SYSTEM_CONTEXT;
            const requestedSlotsStr = unmatchedSlots
                .map((s) => `- Day ${s.dayNumber}: ${s.mealType}`)
                .join('\n');
            const prompt = `Generate exactly the following ${totalMeals} meals for the specified days and meal types:\n` +
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
            const MealResponseSchema = zod_1.z.object({
                meals: zod_1.z.array(zod_1.z.object({
                    dayNumber: zod_1.z.number(),
                    mealType: zod_1.z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
                    mealName: zod_1.z.string(),
                    description: zod_1.z.string(),
                    calories: zod_1.z.number(),
                    proteinG: zod_1.z.number(),
                    carbsG: zod_1.z.number(),
                    fatG: zod_1.z.number(),
                    ingredients: zod_1.z.array(zod_1.z.string()),
                })).refine((meals) => {
                    if (meals.length !== unmatchedSlots.length)
                        return false;
                    return unmatchedSlots.every((slot) => meals.some((m) => m.dayNumber === slot.dayNumber && m.mealType === slot.mealType));
                }, {
                    message: `Must generate exactly the requested slots: ${JSON.stringify(unmatchedSlots.map(s => ({ day: s.dayNumber, type: s.mealType })))}`,
                }),
            });
            const aiResponse = await (0, gemini_1.generateGenerativeJSON)(prompt, systemInstruction, MealResponseSchema, 0.2 // Enforce temperature 0.2
            );
            aiMeals = aiResponse.meals;
        }
        const newPlanGroupId = (0, crypto_1.randomUUID)();
        const userHasConditions = userConditions.length > 0 && !userConditions.includes(client_1.HealthConditionType.NONE);
        const createdPlansList = [];
        // Pre-resolve ingredient lookups outside the transaction to prevent database timeouts
        const preparedAiMeals = [];
        for (const rawMeal of aiMeals) {
            const slot = unmatchedSlots.find((s) => s.dayNumber === rawMeal.dayNumber && s.mealType === rawMeal.mealType);
            const scheduledDate = slot ? slot.scheduledDate : new Date(startDate);
            let hasEstimatedIngredient = false;
            const ingredientsData = [];
            for (const ingredientName of rawMeal.ingredients) {
                try {
                    const lookup = await (0, fnri_1.lookupIngredient)(ingredientName);
                    if (lookup.source === 'ESTIMATED') {
                        hasEstimatedIngredient = true;
                    }
                    ingredientsData.push({
                        ingredientName: lookup.food.name || ingredientName,
                        category: lookup.food.category || 'PANTRY',
                        foodItemId: lookup.food.id || null,
                        dataSource: lookup.source === 'ESTIMATED' ? client_1.MealIngredientDataSource.GEMINI_ESTIMATED : client_1.MealIngredientDataSource.FNRI,
                    });
                }
                catch (lookupErr) {
                    console.warn(`Ingredient lookup failed for: ${ingredientName}, using as estimated.`, lookupErr);
                    hasEstimatedIngredient = true;
                    ingredientsData.push({
                        ingredientName,
                        category: 'PANTRY',
                        foodItemId: null,
                        dataSource: client_1.MealIngredientDataSource.GEMINI_ESTIMATED,
                    });
                }
            }
            let flag = client_1.AIConfidenceFlag.SAFE;
            if (userHasConditions) {
                if (hasEstimatedIngredient) {
                    flag = client_1.AIConfidenceFlag.NEEDS_REVIEW; // Unverified items + clinical conditions = NEEDS_REVIEW!
                }
                else {
                    flag = client_1.AIConfidenceFlag.CAUTION; // Verified database items + clinical conditions = CAUTION!
                }
            }
            preparedAiMeals.push({
                mealType: rawMeal.mealType,
                mealName: rawMeal.mealName,
                description: rawMeal.description,
                calories: parseFloat(rawMeal.calories || 0),
                proteinG: parseFloat(rawMeal.proteinG || 0),
                carbsG: parseFloat(rawMeal.carbsG || 0),
                fatG: parseFloat(rawMeal.fatG || 0),
                scheduledDate,
                aiConfidenceFlag: flag,
                ingredientsData,
            });
        }
        // Save plans atomically in a Prisma Transaction (with a 30-second timeout to support sequential batch inserts)
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Cancel previous active/pending plan items atomically
            await tx.mealPlan.updateMany({
                where: { userId, status: { in: [client_1.MealPlanStatus.APPROVED, client_1.MealPlanStatus.PENDING_REVIEW] } },
                data: { status: client_1.MealPlanStatus.CANCELLED },
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
                            status: client_1.MealPlanStatus.PENDING_REVIEW, // Every generated meal goes to nutritionist queue for verification
                            planType,
                            mealType: slot.mealType,
                            mealName: slot.libraryMeal.mealName,
                            description: slot.libraryMeal.description,
                            calories: slot.libraryMeal.calories,
                            proteinG: slot.libraryMeal.proteinG,
                            carbsG: slot.libraryMeal.carbsG,
                            fatG: slot.libraryMeal.fatG,
                            aiConfidenceFlag: client_1.AIConfidenceFlag.SAFE,
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
                        status: client_1.MealPlanStatus.PENDING_REVIEW,
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
        const needsReview = createdPlansList.some((p) => p.aiConfidenceFlag === client_1.AIConfidenceFlag.NEEDS_REVIEW);
        if (needsReview) {
            const notificationTitle = 'New Meal Plan Awaiting Verification';
            await prisma_1.default.notification.create({
                data: {
                    userId,
                    title: notificationTitle,
                    message: 'Your new AI meal plan contains clinical alerts and has been queued for Registered Dietitian review.',
                    type: client_1.NotificationType.REVIEW_REQUEST,
                },
            });
        }
        return newPlanGroupId;
    }
}
exports.MealGenerationService = MealGenerationService;
// Extend Prisma namespace helper using custom declaration to support transactional bulk creates
// We can declare a Prisma helper directly or run normal transactional loops. Let's do a transactional loop!
// Wait! Let's write the transaction logic explicitly inside the class instead of extending the Prisma namespace,
// since it is extremely reliable and avoids TS declaration merge errors! Let's update that.
//# sourceMappingURL=meal-generation.service.js.map