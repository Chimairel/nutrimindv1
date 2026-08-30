import prisma from '@/lib/prisma';
import { calculateDailyTarget } from '@/lib/calculations';
import { 
  Goal, 
  ActivityLevel, 
  DietaryPreference, 
  CarbPreference, 
  HealthConditionType, 
  AllergenType,
  MealPlanStatus,
  AIConfidenceFlag,
  NotificationType,
  MealLogSource,
  MealLogDataSource,
  MealLogStatus,
  MealIngredientDataSource
} from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import { GroceryService } from './grocery.service';
import { getApprovedMealLibraryWhere, getApprovedMealPlanStatusWhere } from '@/domain/meal-actionability.policy';
import { evaluateOnboardingStatus } from '@/domain/onboarding.policy';

interface ProfileUpdateData {
  age?: number;
  biologicalSex?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  goal?: Goal;
  activityLevel?: ActivityLevel;
  dietaryPreference?: DietaryPreference;
  carbPreference?: CarbPreference;
  foodCulture?: string;
}

export class UserService {
  /**
   * Updates or creates the user's base profile settings.
   */
  static async updateUserProfile(userId: string, data: ProfileUpdateData) {
    const safeData: ProfileUpdateData = {};
    const supportedFields: (keyof ProfileUpdateData)[] = [
      'age', 'biologicalSex', 'heightCm', 'weightKg', 'targetWeightKg',
      'goal', 'activityLevel', 'dietaryPreference', 'carbPreference', 'foodCulture',
    ];
    for (const field of supportedFields) {
      if (data[field] !== undefined) {
        (safeData as Record<string, unknown>)[field] = data[field];
      }
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: safeData,
      create: {
        userId,
        ...safeData,
      },
    });
    return profile;
  }

  /**
   * Updates user health conditions atomically within a transaction.
   */
  static async updateHealthConditions(userId: string, conditions: HealthConditionType[]) {
    // Perform operations in a database transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
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
    return prisma.healthCondition.findMany({
      where: { userId },
    });
  }

  static async updateHealthConditionsWithCustom(
    userId: string,
    conditions: HealthConditionType[],
    otherConditions: string
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.healthCondition.deleteMany({ where: { userId } });
      await tx.healthCondition.createMany({
        data: conditions.map((condition) => ({ userId, condition })),
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: { otherConditions },
        create: { userId, otherConditions },
      });
    });

    return prisma.healthCondition.findMany({ where: { userId } });
  }

  /**
   * Updates user allergens atomically within a transaction.
   */
  static async updateAllergies(userId: string, allergies: AllergenType[]) {
    await prisma.$transaction(async (tx) => {
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
    return prisma.allergy.findMany({
      where: { userId },
    });
  }

  static async updateAllergiesWithCustom(
    userId: string,
    allergies: AllergenType[],
    otherAllergies: string
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.allergy.deleteMany({ where: { userId } });
      await tx.allergy.createMany({
        data: allergies.map((allergen) => ({ userId, allergen })),
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: { otherAllergies },
        create: { userId, otherAllergies },
      });
    });

    return prisma.allergy.findMany({ where: { userId } });
  }

  /**
   * Saves custom free-text health conditions to the user's profile.
   * This is separate from the enum-based healthConditions table.
   */
  static async updateOtherConditions(userId: string, otherConditions: string) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { otherConditions },
      create: { userId, otherConditions },
    });
  }

  /**
   * Saves custom free-text food allergies to the user's profile.
   * This is separate from the enum-based allergies table.
   */
  static async updateOtherAllergies(userId: string, otherAllergies: string) {
    return prisma.userProfile.upsert({
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
  static async saveShoppingDay(userId: string, shoppingDayGroup: 'WEEKEND' | 'WEEKDAY') {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { shoppingDayGroup },
      create: { userId, shoppingDayGroup },
    });
  }

  /**
   * Accepts the Terms of Service.

   */
  static async acceptTos(userId: string, termsVersion: string, privacyVersion: string) {
    const acceptedAt = new Date();
    return prisma.user.update({
      where: { id: userId },
      data: {
        tosAccepted: true,
        tosAcceptedAt: acceptedAt,
        acceptedTermsVersion: termsVersion,
        acceptedPrivacyVersion: privacyVersion,
        healthDataConsentedAt: acceptedAt,
      },
    });
  }

  /**
   * Updates the user's avatar image seed or custom URL.
   */
  static async updateUserImage(userId: string, image: string) {
    return prisma.user.update({
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
  static async completeOnboarding(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: { select: { condition: true } },
        allergies: { select: { allergen: true } },
      },
    });

    if (!user?.userProfile) {
      throw new Error('User profile must be initialized before completing onboarding.');
    }

    const onboardingStatus = evaluateOnboardingStatus({
      onboardingDone: user.onboardingDone,
      tosAccepted: user.tosAccepted,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      profile: user.userProfile,
      conditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
    });
    if (!onboardingStatus.readyToComplete) {
      throw new Error(`Onboarding is incomplete. Continue at ${onboardingStatus.nextPath}.`);
    }

    const profile = user.userProfile;

    // Verify critical statistics exist
    const { age, heightCm, weightKg, goal, activityLevel, biologicalSex } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !biologicalSex) {
      throw new Error('Onboarding statistics are incomplete.');
    }

    const hasPregnantCondition = user.healthConditions.some(
      (c) => c.condition === HealthConditionType.PREGNANT
    );

    // 2. Run calorie target calculations using biologicalSex from profile
    const calculations = calculateDailyTarget({
      age,
      heightCm,
      weightKg,
      goal,
      activityLevel,
      biologicalSex: biologicalSex as 'MALE' | 'FEMALE' | undefined,
      hasPregnantCondition,
    });

    // 3. Persist targets and flag onboarding as complete
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { userId },
        data: {
          dailyCalorieTarget: calculations.dailyCalorieTarget,
        },
      }),
      prisma.user.update({
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
  static async getUserProfileDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        tosAccepted: true,
        tosAcceptedAt: true,
        acceptedTermsVersion: true,
        acceptedPrivacyVersion: true,
        healthDataConsentedAt: true,
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

    const onboardingStatus = evaluateOnboardingStatus({
      onboardingDone: user.onboardingDone,
      tosAccepted: user.tosAccepted,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      profile: user.userProfile,
      conditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
    });

    // Transform into clean structure for client
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      tosAccepted: user.tosAccepted,
      tosAcceptedAt: user.tosAcceptedAt,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      healthDataConsentedAt: user.healthDataConsentedAt,
      onboardingDone: user.onboardingDone,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userProfile: user.userProfile,
      healthConditions: user.healthConditions.map((c) => c.condition),
      allergies: user.allergies.map((a) => a.allergen),
      nutritionReport: user.nutritionReport,
      onboardingStatus,
    };
  }

  /**
   * Helper function to detect health condition and allergy conflicts in a meal.
   */
  static checkSafetyConflict(
    conditions: HealthConditionType[],
    allergens: AllergenType[],
    meal: { mealName: string; description: string | null; ingredients: { ingredientName: string }[] }
  ): boolean {
    const ingredientNames = meal.ingredients.map((i) => i.ingredientName.toLowerCase());
    const desc = meal.description || '';
    const joinedIngs = ingredientNames.join(' ') + ' ' + meal.mealName.toLowerCase() + ' ' + desc.toLowerCase();

    // 1. Check Allergen Keywords
    if (allergens.includes(AllergenType.SHELLFISH)) {
      const keywords = ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'mussel', 'clam', 'oyster', 'hipon', 'alimango', 'alimasag', 'tahong', 'talaba', 'alamang', 'seafood'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.NUTS)) {
      const keywords = ['peanut', 'cashew', 'almond', 'walnut', 'pecan', 'nut', 'mani', 'kasuy', 'hazelnut'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.DAIRY)) {
      const keywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', 'gatas', 'keso', 'condensed milk', 'evaporated milk'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.GLUTEN)) {
      const keywords = ['wheat', 'flour', 'bread', 'gluten', 'pasta', 'spaghetti', 'macaroni', 'noodles', 'pan de sal', 'soy sauce', 'toyo'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.EGGS)) {
      const keywords = ['egg', 'itlog', 'mayo', 'mayonnaise', 'balut', 'penoy'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    // 2. Check Clinical Health Conditions
    if (conditions.includes(HealthConditionType.HYPERTENSION)) {
      const sodiumKeywords = ['chicharon', 'spam', 'hotdog', 'sausage', 'instant noodle', 'tuyo', 'patis', 'bagoong', 'soy sauce', 'toyo', 'salted'];
      if (sodiumKeywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (conditions.includes(HealthConditionType.DIABETES)) {
      const sugarKeywords = ['sugar', 'sweet', 'cake', 'pastry', 'soda', 'coke', 'juice', 'condensed milk', 'honey', 'syrup', 'turon', 'bananacue'];
      if (sugarKeywords.some((k) => joinedIngs.includes(k))) return true;
    }

    return false;
  }

  /**
   * Automatically recheck active plan meals against new health conditions/allergies.
   * Swaps conflicting meals with eligible library meals or triggers a single-meal AI regeneration.
   * This logic is completely exempt from weekly swap count caps.
   */
  static async runSafetyRecheck(userId: string) {
    // 1. Fetch user conditions, allergies, and profile stats
    const user = await prisma.user.findUnique({
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
    const latestMeal = await prisma.mealPlan.findFirst({
      where: {
        userId,
        status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
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
    const remainingMeals = await prisma.mealPlan.findMany({
      where: {
        planGroupId,
        userId,
        status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
        mealLogs: {
          none: {
            status: { in: [MealLogStatus.DONE, MealLogStatus.SKIPPED] },
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
      if (!hasConflict) continue;

      console.log(`[Safety Recheck] Conflict detected for meal "${meal.mealName}" (Type: ${meal.mealType})`);

      // Attempt to find a compatible pre-verified library meal
      const libraryMeals = await prisma.mealLibrary.findMany({
        where: {
          mealType: meal.mealType,
          ...getApprovedMealLibraryWhere(),
        },
      });

      const eligibleMatches = libraryMeals.filter((m) => {
        // Health conditions
        if (m.suitableConditions) {
          const conditions = m.suitableConditions as string[];
          const hasUnsuitable = userConditions.some(
            (c) => c !== HealthConditionType.NONE && !conditions.includes(c)
          );
          if (hasUnsuitable) return false;
        }
        // Allergens
        if (m.allergenFree) {
          const freeFrom = m.allergenFree as string[];
          const hasAllergen = userAllergens.some(
            (a) => a !== AllergenType.NONE && !freeFrom.includes(a)
          );
          if (hasAllergen) return false;
        }
        // Dietary Preferences
        if (userProfile.dietaryPreference && m.dietaryTags) {
          const tags = m.dietaryTags as string[];
          if (!tags.includes(userProfile.dietaryPreference)) return false;
        }
        // Goal
        if (userProfile.goal && m.dietaryTags) {
          const tags = m.dietaryTags as string[];
          if (!tags.includes(userProfile.goal)) return false;
        }
        return true;
      });

      if (eligibleMatches.length > 0) {
        // Rotation check based on usageCount
        const minUsage = Math.min(...eligibleMatches.map((m) => m.usageCount));
        const candidates = eligibleMatches.filter((m) => m.usageCount === minUsage);
        const selectedLibraryMeal = candidates[Math.floor(Math.random() * candidates.length)];

        console.log(`[Safety Recheck] Swapping in verified library meal: "${selectedLibraryMeal.mealName}"`);

        await prisma.$transaction(async (tx) => {
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
              aiConfidenceFlag: AIConfidenceFlag.SAFE,
              status: MealPlanStatus.APPROVED, // Verified library is approved automatically
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
              ...getApprovedMealPlanStatusWhere(),
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
              source: MealLogSource.SAFETY_REPLACED,
              mealName: selectedLibraryMeal.mealName,
              calories: selectedLibraryMeal.calories,
              proteinG: selectedLibraryMeal.proteinG,
              carbsG: selectedLibraryMeal.carbsG,
              fatG: selectedLibraryMeal.fatG,
              dataSource: MealLogDataSource.FNRI,
              status: MealLogStatus.PENDING,
            },
          });
        });
      } else {
        // Fallback: call Gemini AI to generate a single replacement
        console.log(`[Safety Recheck] No library matches. Generating single replacement via Gemini...`);
        const systemInstruction = 
          "You are a clinical dietitian generating a safe replacement meal for a patient with new health conditions.";
        
        const prompt =
          `Generate a single replacement ${meal.mealType} meal for a patient with these constraints:\n` +
          `- Daily Calorie Target: ${userProfile.dailyCalorieTarget || 2000} kcal (Aim for approx: breakfast 30%, lunch 40%, dinner 30%)\n` +
          `- Health Conditions: ${userConditions.join(', ') || 'NONE'}\n` +
          `- Allergens to EXCLUDE: ${userAllergens.join(', ') || 'NONE'}\n` +
          `- Dietary Preference: ${userProfile.dietaryPreference || 'OMNIVORE'}\n` +
          `- Goal: ${userProfile.goal || 'MAINTAIN'}\n` +
          `Return a strict JSON object:\n` +
          `{ "mealName": string, "description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "ingredients": [{"name": string, "category": string}] }`;

        try {
          const replacement = await generateGenerativeJSON<any>(prompt, systemInstruction);

          await prisma.$transaction(async (tx) => {
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
                aiConfidenceFlag: AIConfidenceFlag.CAUTION,
                status: MealPlanStatus.PENDING_REVIEW, // Saved as PENDING_REVIEW
              },
            });

            // Delete old ingredients
            await tx.mealIngredient.deleteMany({
              where: { mealPlanId: meal.id },
            });

            // Create new ingredients
            if (replacement.ingredients && replacement.ingredients.length > 0) {
              await tx.mealIngredient.createMany({
                data: replacement.ingredients.map((ing: any) => ({
                  mealPlanId: meal.id,
                  ingredientName: ing.name,
                  category: ing.category || 'PANTRY',
                  dataSource: MealIngredientDataSource.GEMINI_ESTIMATED,
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
                source: MealLogSource.SAFETY_REPLACED,
                mealName: replacement.mealName,
                calories: parseFloat(replacement.calories || 0),
                proteinG: parseFloat(replacement.proteinG || 0),
                carbsG: parseFloat(replacement.carbsG || 0),
                fatG: parseFloat(replacement.fatG || 0),
                dataSource: MealLogDataSource.GEMINI_ESTIMATED,
                status: MealLogStatus.PENDING,
              },
            });
          });
        } catch (geminiErr) {
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
        await GroceryService.generateGroceryList(userId);
      } catch (groceryErr) {
        console.error(`[Safety Recheck] Grocery list regeneration failed:`, groceryErr);
      }

      // 2. Notify the user
      await prisma.notification.create({
        data: {
          userId,
          title: 'Meal Plan Safety Update ⚠️',
          message: `We updated ${replacedCount} meal(s) in your current plan due to your allergy/condition update.`,
          type: NotificationType.PLAN_APPROVED,
        },
      });
    }
  }
}
