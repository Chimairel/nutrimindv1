"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const calculations_1 = require("@/lib/calculations");
const client_1 = require("@prisma/client");
const gemini_1 = require("@/lib/gemini");
const grocery_service_1 = require("./grocery.service");
class UserService {
    /**
     * Updates or creates the user's base profile settings.
     */
    static async updateUserProfile(userId, data) {
        const profile = await prisma_1.default.userProfile.upsert({
            where: { userId },
            update: {
                ...data,
            },
            create: {
                userId,
                ...data,
            },
        });
        return profile;
    }
    /**
     * Updates user health conditions atomically within a transaction.
     */
    static async updateHealthConditions(userId, conditions) {
        // Perform operations in a database transaction to ensure atomicity
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Delete all existing conditions
            await tx.healthCondition.deleteMany({
                where: { userId },
            });
            // 2. Create the new conditions
            if (conditions.length > 0) {
                await tx.healthCondition.createMany({
                    data: conditions.map((cond) => ({
                        userId,
                        condition: cond,
                    })),
                });
            }
        });
        // Fetch and return updated conditions
        return prisma_1.default.healthCondition.findMany({
            where: { userId },
        });
    }
    /**
     * Updates user allergens atomically within a transaction.
     */
    static async updateAllergies(userId, allergies) {
        await prisma_1.default.$transaction(async (tx) => {
            // 1. Delete all existing allergies
            await tx.allergy.deleteMany({
                where: { userId },
            });
            // 2. Create the new allergies
            if (allergies.length > 0) {
                await tx.allergy.createMany({
                    data: allergies.map((allg) => ({
                        userId,
                        allergen: allg,
                    })),
                });
            }
        });
        // Fetch and return updated allergies
        return prisma_1.default.allergy.findMany({
            where: { userId },
        });
    }
    /**
     * Saves custom free-text health conditions to the user's profile.
     * This is separate from the enum-based healthConditions table.
     */
    static async updateOtherConditions(userId, otherConditions) {
        return prisma_1.default.userProfile.upsert({
            where: { userId },
            update: { otherConditions },
            create: { userId, otherConditions },
        });
    }
    /**
     * Saves custom free-text food allergies to the user's profile.
     * This is separate from the enum-based allergies table.
     */
    static async updateOtherAllergies(userId, otherAllergies) {
        return prisma_1.default.userProfile.upsert({
            where: { userId },
            update: { otherAllergies },
            create: { userId, otherAllergies },
        });
    }
    /**
     * Saves the user's preferred shopping day group.
     * WEEKEND → weekly cycle runs Sunday to Saturday.
     * WEEKDAY → weekly cycle runs Monday to Sunday.
     */
    static async saveShoppingDay(userId, shoppingDayGroup) {
        return prisma_1.default.userProfile.upsert({
            where: { userId },
            update: { shoppingDayGroup },
            create: { userId, shoppingDayGroup },
        });
    }
    /**
     * Accepts the Terms of Service.
  
     */
    static async acceptTos(userId) {
        return prisma_1.default.user.update({
            where: { id: userId },
            data: {
                tosAccepted: true,
                tosAcceptedAt: new Date(),
            },
        });
    }
    /**
     * Updates the user's avatar image seed or custom URL.
     */
    static async updateUserImage(userId, image) {
        return prisma_1.default.user.update({
            where: { id: userId },
            data: { image },
        });
    }
    /**
     * Finalizes user onboarding by:
     * 1. Pulling their latest profile and health conditions.
     * 2. Calculating BMR/TDEE and setting the target daily calories.
     * 3. Updating the profile with the calculated target and setting onboardingDone = true.
     */
    static async completeOnboarding(userId) {
        // 1. Fetch User profile and clinical conditions
        const profile = await prisma_1.default.userProfile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new Error('User profile must be initialized before completing onboarding.');
        }
        // Verify critical statistics exist
        const { age, heightCm, weightKg, goal, activityLevel, biologicalSex } = profile;
        if (!age || !heightCm || !weightKg || !goal || !activityLevel) {
            throw new Error('Onboarding stats (age, height, weight, goal, activityLevel) are incomplete.');
        }
        const healthConditions = await prisma_1.default.healthCondition.findMany({
            where: { userId },
        });
        const hasPregnantCondition = healthConditions.some((c) => c.condition === client_1.HealthConditionType.PREGNANT);
        // 2. Run calorie target calculations using biologicalSex from profile
        const calculations = (0, calculations_1.calculateDailyTarget)({
            age,
            heightCm,
            weightKg,
            goal,
            activityLevel,
            biologicalSex: biologicalSex,
            hasPregnantCondition,
        });
        // 3. Persist targets and flag onboarding as complete
        await prisma_1.default.$transaction([
            prisma_1.default.userProfile.update({
                where: { userId },
                data: {
                    dailyCalorieTarget: calculations.dailyCalorieTarget,
                },
            }),
            prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    onboardingDone: true,
                },
            }),
        ]);
        return {
            dailyCalorieTarget: calculations.dailyCalorieTarget,
            onboardingDone: true,
        };
    }
    /**
     * Fetches the complete dynamic User details (with Profile, Conditions, Allergies, NutritionReport)
     * to fully support client-side AuthContext synchronization.
     */
    static async getUserProfileDetails(userId) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                emailVerified: true,
                tosAccepted: true,
                tosAcceptedAt: true,
                onboardingDone: true,
                image: true,
                createdAt: true,
                updatedAt: true,
                userProfile: true,
                healthConditions: {
                    select: {
                        condition: true,
                    },
                },
                allergies: {
                    select: {
                        allergen: true,
                    },
                },
                nutritionReport: {
                    select: {
                        id: true,
                        generatedAt: true,
                        acknowledgedAt: true,
                    },
                },
            },
        });
        if (!user) {
            return null;
        }
        // Transform into clean structure for client
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
            tosAccepted: user.tosAccepted,
            tosAcceptedAt: user.tosAcceptedAt,
            onboardingDone: user.onboardingDone,
            image: user.image,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            userProfile: user.userProfile,
            healthConditions: user.healthConditions.map((c) => c.condition),
            allergies: user.allergies.map((a) => a.allergen),
            nutritionReport: user.nutritionReport,
        };
    }
    /**
     * Helper function to detect health condition and allergy conflicts in a meal.
     */
    static checkSafetyConflict(conditions, allergens, meal) {
        const ingredientNames = meal.ingredients.map((i) => i.ingredientName.toLowerCase());
        const desc = meal.description || '';
        const joinedIngs = ingredientNames.join(' ') + ' ' + meal.mealName.toLowerCase() + ' ' + desc.toLowerCase();
        // 1. Check Allergen Keywords
        if (allergens.includes(client_1.AllergenType.SHELLFISH)) {
            const keywords = ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'mussel', 'clam', 'oyster', 'hipon', 'alimango', 'alimasag', 'tahong', 'talaba', 'alamang', 'seafood'];
            if (keywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        if (allergens.includes(client_1.AllergenType.NUTS)) {
            const keywords = ['peanut', 'cashew', 'almond', 'walnut', 'pecan', 'nut', 'mani', 'kasuy', 'hazelnut'];
            if (keywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        if (allergens.includes(client_1.AllergenType.DAIRY)) {
            const keywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', 'gatas', 'keso', 'condensed milk', 'evaporated milk'];
            if (keywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        if (allergens.includes(client_1.AllergenType.GLUTEN)) {
            const keywords = ['wheat', 'flour', 'bread', 'gluten', 'pasta', 'spaghetti', 'macaroni', 'noodles', 'pan de sal', 'soy sauce', 'toyo'];
            if (keywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        if (allergens.includes(client_1.AllergenType.EGGS)) {
            const keywords = ['egg', 'itlog', 'mayo', 'mayonnaise', 'balut', 'penoy'];
            if (keywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        // 2. Check Clinical Health Conditions
        if (conditions.includes(client_1.HealthConditionType.HYPERTENSION)) {
            const sodiumKeywords = ['chicharon', 'spam', 'hotdog', 'sausage', 'instant noodle', 'tuyo', 'patis', 'bagoong', 'soy sauce', 'toyo', 'salted'];
            if (sodiumKeywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        if (conditions.includes(client_1.HealthConditionType.DIABETES)) {
            const sugarKeywords = ['sugar', 'sweet', 'cake', 'pastry', 'soda', 'coke', 'juice', 'condensed milk', 'honey', 'syrup', 'turon', 'bananacue'];
            if (sugarKeywords.some((k) => joinedIngs.includes(k)))
                return true;
        }
        return false;
    }
    /**
     * Automatically recheck active plan meals against new health conditions/allergies.
     * Swaps conflicting meals with eligible library meals or triggers a single-meal AI regeneration.
     * This logic is completely exempt from weekly swap count caps.
     */
    static async runSafetyRecheck(userId) {
        // 1. Fetch user conditions, allergies, and profile stats
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: {
                userProfile: true,
                healthConditions: true,
                allergies: true,
            },
        });
        if (!user || !user.userProfile) {
            console.warn(`[Safety Recheck] User or profile not found for user: ${userId}`);
            return;
        }
        const { userProfile } = user;
        const userConditions = user.healthConditions.map((c) => c.condition);
        const userAllergens = user.allergies.map((a) => a.allergen);
        // 2. Find the latest active planGroupId
        const latestMeal = await prisma_1.default.mealPlan.findFirst({
            where: {
                userId,
                status: { in: [client_1.MealPlanStatus.APPROVED, client_1.MealPlanStatus.PENDING_REVIEW] },
            },
            orderBy: { scheduledDate: 'desc' },
            select: { planGroupId: true },
        });
        if (!latestMeal || !latestMeal.planGroupId) {
            console.log(`[Safety Recheck] No active/pending meal plans found for user: ${userId}`);
            return;
        }
        const planGroupId = latestMeal.planGroupId;
        // 3. Fetch remaining (uneaten/unskipped) meals in this planGroupId
        const remainingMeals = await prisma_1.default.mealPlan.findMany({
            where: {
                planGroupId,
                userId,
                status: { in: [client_1.MealPlanStatus.APPROVED, client_1.MealPlanStatus.PENDING_REVIEW] },
                mealLogs: {
                    none: {
                        status: { in: [client_1.MealLogStatus.DONE, client_1.MealLogStatus.SKIPPED] },
                    },
                },
            },
            include: {
                ingredients: true,
            },
        });
        let replacedCount = 0;
        for (const meal of remainingMeals) {
            const hasConflict = UserService.checkSafetyConflict(userConditions, userAllergens, meal);
            if (!hasConflict)
                continue;
            console.log(`[Safety Recheck] Conflict detected for meal "${meal.mealName}" (Type: ${meal.mealType})`);
            // Attempt to find a compatible pre-verified library meal
            const libraryMeals = await prisma_1.default.mealLibrary.findMany({
                where: {
                    mealType: meal.mealType,
                    status: 'APPROVED',
                },
            });
            const eligibleMatches = libraryMeals.filter((m) => {
                // Health conditions
                if (m.suitableConditions) {
                    const conditions = m.suitableConditions;
                    const hasUnsuitable = userConditions.some((c) => c !== client_1.HealthConditionType.NONE && !conditions.includes(c));
                    if (hasUnsuitable)
                        return false;
                }
                // Allergens
                if (m.allergenFree) {
                    const freeFrom = m.allergenFree;
                    const hasAllergen = userAllergens.some((a) => a !== client_1.AllergenType.NONE && !freeFrom.includes(a));
                    if (hasAllergen)
                        return false;
                }
                // Dietary Preferences
                if (userProfile.dietaryPreference && m.dietaryTags) {
                    const tags = m.dietaryTags;
                    if (!tags.includes(userProfile.dietaryPreference))
                        return false;
                }
                // Goal
                if (userProfile.goal && m.dietaryTags) {
                    const tags = m.dietaryTags;
                    if (!tags.includes(userProfile.goal))
                        return false;
                }
                return true;
            });
            if (eligibleMatches.length > 0) {
                // Rotation check based on usageCount
                const minUsage = Math.min(...eligibleMatches.map((m) => m.usageCount));
                const candidates = eligibleMatches.filter((m) => m.usageCount === minUsage);
                const selectedLibraryMeal = candidates[Math.floor(Math.random() * candidates.length)];
                console.log(`[Safety Recheck] Swapping in verified library meal: "${selectedLibraryMeal.mealName}"`);
                await prisma_1.default.$transaction(async (tx) => {
                    // Update MealPlan slot
                    await tx.mealPlan.update({
                        where: { id: meal.id },
                        data: {
                            mealName: selectedLibraryMeal.mealName,
                            description: selectedLibraryMeal.description,
                            calories: selectedLibraryMeal.calories,
                            proteinG: selectedLibraryMeal.proteinG,
                            carbsG: selectedLibraryMeal.carbsG,
                            fatG: selectedLibraryMeal.fatG,
                            libraryMealId: selectedLibraryMeal.id,
                            aiConfidenceFlag: client_1.AIConfidenceFlag.SAFE,
                            status: client_1.MealPlanStatus.APPROVED, // Verified library is approved automatically
                        },
                    });
                    // Delete old ingredients
                    await tx.mealIngredient.deleteMany({
                        where: { mealPlanId: meal.id },
                    });
                    // Clone ingredients from original plan
                    const originalPlan = await tx.mealPlan.findFirst({
                        where: {
                            libraryMealId: selectedLibraryMeal.id,
                            status: client_1.MealPlanStatus.APPROVED,
                        },
                        include: { ingredients: true },
                    });
                    const ingredientsData = originalPlan?.ingredients.map((ing) => ({
                        ingredientName: ing.ingredientName,
                        category: ing.category,
                        foodItemId: ing.foodItemId,
                        dataSource: ing.dataSource,
                    })) || [];
                    if (ingredientsData.length > 0) {
                        await tx.mealIngredient.createMany({
                            data: ingredientsData.map((ing) => ({
                                mealPlanId: meal.id,
                                ingredientName: ing.ingredientName,
                                category: ing.category,
                                foodItemId: ing.foodItemId,
                                dataSource: ing.dataSource,
                            })),
                        });
                    }
                    // Increment library usage
                    await tx.mealLibrary.update({
                        where: { id: selectedLibraryMeal.id },
                        data: { usageCount: { increment: 1 } },
                    });
                    // Delete PENDING logs for this meal
                    await tx.mealLog.deleteMany({
                        where: { mealPlanId: meal.id },
                    });
                    // Create new PENDING log
                    await tx.mealLog.create({
                        data: {
                            userId,
                            mealPlanId: meal.id,
                            source: client_1.MealLogSource.SAFETY_REPLACED,
                            mealName: selectedLibraryMeal.mealName,
                            calories: selectedLibraryMeal.calories,
                            proteinG: selectedLibraryMeal.proteinG,
                            carbsG: selectedLibraryMeal.carbsG,
                            fatG: selectedLibraryMeal.fatG,
                            dataSource: client_1.MealLogDataSource.FNRI,
                            status: client_1.MealLogStatus.PENDING,
                        },
                    });
                });
            }
            else {
                // Fallback: call Gemini AI to generate a single replacement
                console.log(`[Safety Recheck] No library matches. Generating single replacement via Gemini...`);
                const systemInstruction = "You are a clinical dietitian generating a safe replacement meal for a patient with new health conditions.";
                const prompt = `Generate a single replacement ${meal.mealType} meal for a patient with these constraints:\n` +
                    `- Daily Calorie Target: ${userProfile.dailyCalorieTarget || 2000} kcal (Aim for approx: breakfast 30%, lunch 40%, dinner 30%)\n` +
                    `- Health Conditions: ${userConditions.join(', ') || 'NONE'}\n` +
                    `- Allergens to EXCLUDE: ${userAllergens.join(', ') || 'NONE'}\n` +
                    `- Dietary Preference: ${userProfile.dietaryPreference || 'OMNIVORE'}\n` +
                    `- Goal: ${userProfile.goal || 'MAINTAIN'}\n` +
                    `Return a strict JSON object:\n` +
                    `{ "mealName": string, "description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "ingredients": [{"name": string, "category": string}] }`;
                try {
                    const replacement = await (0, gemini_1.generateGenerativeJSON)(prompt, systemInstruction);
                    await prisma_1.default.$transaction(async (tx) => {
                        // Update MealPlan slot
                        await tx.mealPlan.update({
                            where: { id: meal.id },
                            data: {
                                mealName: replacement.mealName,
                                description: replacement.description,
                                calories: parseFloat(replacement.calories || 0),
                                proteinG: parseFloat(replacement.proteinG || 0),
                                carbsG: parseFloat(replacement.carbsG || 0),
                                fatG: parseFloat(replacement.fatG || 0),
                                libraryMealId: null,
                                aiConfidenceFlag: client_1.AIConfidenceFlag.CAUTION,
                                status: client_1.MealPlanStatus.PENDING_REVIEW, // Saved as PENDING_REVIEW
                            },
                        });
                        // Delete old ingredients
                        await tx.mealIngredient.deleteMany({
                            where: { mealPlanId: meal.id },
                        });
                        // Create new ingredients
                        if (replacement.ingredients && replacement.ingredients.length > 0) {
                            await tx.mealIngredient.createMany({
                                data: replacement.ingredients.map((ing) => ({
                                    mealPlanId: meal.id,
                                    ingredientName: ing.name,
                                    category: ing.category || 'PANTRY',
                                    dataSource: client_1.MealIngredientDataSource.GEMINI_ESTIMATED,
                                })),
                            });
                        }
                        // Delete PENDING logs
                        await tx.mealLog.deleteMany({
                            where: { mealPlanId: meal.id },
                        });
                        // Create new PENDING log
                        await tx.mealLog.create({
                            data: {
                                userId,
                                mealPlanId: meal.id,
                                source: client_1.MealLogSource.SAFETY_REPLACED,
                                mealName: replacement.mealName,
                                calories: parseFloat(replacement.calories || 0),
                                proteinG: parseFloat(replacement.proteinG || 0),
                                carbsG: parseFloat(replacement.carbsG || 0),
                                fatG: parseFloat(replacement.fatG || 0),
                                dataSource: client_1.MealLogDataSource.GEMINI_ESTIMATED,
                                status: client_1.MealLogStatus.PENDING,
                            },
                        });
                    });
                }
                catch (geminiErr) {
                    console.error(`[Safety Recheck] Gemini regeneration failed for meal ${meal.id}:`, geminiErr);
                    continue;
                }
            }
            replacedCount++;
        }
        if (replacedCount > 0) {
            console.log(`[Safety Recheck] Successfully replaced ${replacedCount} meal(s) for user ${userId}`);
            // 1. Regenerate Grocery List
            try {
                await grocery_service_1.GroceryService.generateGroceryList(userId);
            }
            catch (groceryErr) {
                console.error(`[Safety Recheck] Grocery list regeneration failed:`, groceryErr);
            }
            // 2. Notify the user
            await prisma_1.default.notification.create({
                data: {
                    userId,
                    title: 'Meal Plan Safety Update ⚠️',
                    message: `We updated ${replacedCount} meal(s) in your current plan due to your allergy/condition update.`,
                    type: client_1.NotificationType.PLAN_APPROVED,
                },
            });
        }
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map