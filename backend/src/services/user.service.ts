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
  MealIngredientDataSource,
  HealthProfileRevisionType,
  MealLibrarySafetyEvidenceStatus,
  Prisma,
} from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import { GroceryService } from './grocery.service';
import { getApprovedMealLibraryWhere } from '@/domain/meal-actionability.policy';
import { evaluateOnboardingStatus } from '@/domain/onboarding.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
} from './meal-swap.service';
import {
  MEAL_PLAN_SAFETY_POLICY_VERSION,
  requiresEscalatedMealReview,
} from '@/domain/meal-plan-production-safety.policy';

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

    return prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.upsert({
        where: { userId },
        update: safeData,
        create: {
          userId,
          ...safeData,
        },
      });
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.BODY_DIET_UPDATED,
          snapshot: safeData as Prisma.InputJsonObject,
        },
      });
      return profile;
    });
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
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.CONDITIONS_UPDATED,
          snapshot: { conditions },
        },
      });
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
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.CONDITIONS_UPDATED,
          snapshot: { conditions, otherConditions },
        },
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
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.ALLERGIES_UPDATED,
          snapshot: { allergies },
        },
      });
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
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.ALLERGIES_UPDATED,
          snapshot: { allergies, otherAllergies },
        },
      });
    });

    return prisma.allergy.findMany({ where: { userId } });
  }

  /**
   * Saves the complete clinical restriction profile in one transaction. The
   * caller can then run exactly one safety scan against a coherent snapshot.
   */
  static async updateSafetyProfile(
    userId: string,
    conditions: HealthConditionType[],
    otherConditions: string,
    allergies: AllergenType[],
    otherAllergies: string
  ) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        healthConditions: { select: { condition: true } },
        allergies: { select: { allergen: true } },
        userProfile: { select: { otherConditions: true, otherAllergies: true } },
      },
    });
    if (!current) throw new Error('User not found.');

    const normalized = (values: readonly string[]) => [...new Set(values)].sort();
    const conditionsChanged = JSON.stringify(normalized(current.healthConditions.map((item) => item.condition)))
      !== JSON.stringify(normalized(conditions))
      || (current.userProfile?.otherConditions || '') !== otherConditions;
    const allergiesChanged = JSON.stringify(normalized(current.allergies.map((item) => item.allergen)))
      !== JSON.stringify(normalized(allergies))
      || (current.userProfile?.otherAllergies || '') !== otherAllergies;
    const changed = conditionsChanged || allergiesChanged;

    if (!changed) {
      return {
        conditions: current.healthConditions,
        allergies: current.allergies,
        changed: false,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.healthCondition.deleteMany({ where: { userId } });
      await tx.allergy.deleteMany({ where: { userId } });

      if (conditions.length > 0) {
        await tx.healthCondition.createMany({
          data: conditions.map((condition) => ({ userId, condition })),
        });
      }
      if (allergies.length > 0) {
        await tx.allergy.createMany({
          data: allergies.map((allergen) => ({ userId, allergen })),
        });
      }

      await tx.userProfile.upsert({
        where: { userId },
        update: { otherConditions, otherAllergies },
        create: { userId, otherConditions, otherAllergies },
      });
      if (conditionsChanged) {
        await tx.healthProfileRevision.create({
          data: {
            userId,
            revisionType: HealthProfileRevisionType.CONDITIONS_UPDATED,
            snapshot: { conditions, otherConditions },
          },
        });
      }
      if (allergiesChanged) {
        await tx.healthProfileRevision.create({
          data: {
            userId,
            revisionType: HealthProfileRevisionType.ALLERGIES_UPDATED,
            snapshot: { allergies, otherAllergies },
          },
        });
      }

      // A report based on the previous restrictions must be acknowledged only
      // after it is regenerated for the new clinical context.
      await tx.nutritionReport.updateMany({
        where: { userId },
        data: { acknowledgedAt: null },
      });
    });

    const [savedConditions, savedAllergies] = await Promise.all([
      prisma.healthCondition.findMany({ where: { userId } }),
      prisma.allergy.findMany({ where: { userId } }),
    ]);
    return { conditions: savedConditions, allergies: savedAllergies, changed: true };
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
   * Saves the user's exact preferred shopping day (0=Sunday ... 6=Saturday).
   * The weekly meal cycle starts the following day. The legacy group is kept
   * in sync for backwards-compatible reporting and old clients.
   */
  static async saveShoppingDay(userId: string, shoppingDayOfWeek: number) {
    if (!Number.isInteger(shoppingDayOfWeek) || shoppingDayOfWeek < 0 || shoppingDayOfWeek > 6) {
      throw new Error('Shopping day must be an integer from Sunday (0) to Saturday (6).');
    }
    const shoppingDayGroup = shoppingDayOfWeek === 0 || shoppingDayOfWeek === 6
      ? 'WEEKEND'
      : 'WEEKDAY';
    return prisma.userProfile.upsert({
      where: { userId },
      update: { shoppingDayGroup, shoppingDayOfWeek },
      create: { userId, shoppingDayGroup, shoppingDayOfWeek },
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
        safetyProfileEntries: {
          orderBy: [{ domain: 'asc' }, { displayName: 'asc' }],
          select: {
            domain: true,
            canonicalCode: true,
            displayName: true,
            originalText: true,
            normalizedText: true,
            provenance: true,
            supportState: true,
            policyReference: true,
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
      safetyEntries: user.safetyProfileEntries,
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
      orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
    });

    const libraryMeals = await prisma.mealLibrary.findMany({
      where: {
        ...getApprovedMealLibraryWhere(),
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
      },
      include: certifiedLibraryMealInclude,
    });
    const eligibleLibraryMeals = libraryMeals.filter((candidate) =>
      isCertifiedLibraryMealCompatible(candidate, userConditions, userAllergens, userProfile)
    );
    const highRiskReviewRequired = requiresEscalatedMealReview(
      userConditions,
      userProfile.otherConditions || ''
    );
    let replacedCount = 0;
    const assignedLibraryMeals = remainingMeals.map((meal) => ({
      mealPlanId: meal.id,
      libraryMealId: meal.libraryMealId,
      scheduledDate: meal.scheduledDate,
    }));

    for (const meal of remainingMeals) {
      const currentCertifiedMeal = meal.libraryMealId
        ? eligibleLibraryMeals.find((candidate) => candidate.id === meal.libraryMealId)
        : null;

      if (currentCertifiedMeal) {
        await prisma.mealPlan.update({
          where: { id: meal.id },
          data: {
            status: MealPlanStatus.APPROVED,
            requiresSafetyRevalidation: false,
            safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            highRiskReviewRequired: false,
            reviewApprovalCount: 1,
            nutritionistId: currentCertifiedMeal.verifiedByNutritionistId,
            reviewedAt: new Date(),
          },
        });
        continue;
      }

      // Make the old row non-actionable before any remote generation attempt.
      await prisma.mealPlan.update({
        where: { id: meal.id },
        data: {
          status: MealPlanStatus.PENDING_REVIEW,
          requiresSafetyRevalidation: true,
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          highRiskReviewRequired,
          reviewApprovalCount: 0,
          firstApprovedByNutritionistId: null,
          firstApprovedAt: null,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });

      const eligibleMatches = eligibleLibraryMeals.filter((candidate) => {
        if (candidate.mealType !== meal.mealType || candidate.id === meal.libraryMealId) return false;
        return !assignedLibraryMeals.some((assignment) =>
          assignment.mealPlanId !== meal.id
          && assignment.libraryMealId === candidate.id
          && Math.abs(assignment.scheduledDate.getTime() - meal.scheduledDate.getTime()) < 3 * 86_400_000
        );
      });

      if (eligibleMatches.length > 0) {
        const unusedMatches = eligibleMatches.filter((candidate) =>
          !assignedLibraryMeals.some((assignment) =>
            assignment.mealPlanId !== meal.id && assignment.libraryMealId === candidate.id
          )
        );
        const rotationPool = unusedMatches.length > 0 ? unusedMatches : eligibleMatches;
        const minUsage = Math.min(...rotationPool.map((candidate) => candidate.usageCount));
        const candidates = rotationPool.filter((candidate) => candidate.usageCount === minUsage);
        const selectedLibraryMeal = candidates[Math.floor(Math.random() * candidates.length)];

        await prisma.$transaction(async (tx) => {
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
              status: MealPlanStatus.APPROVED,
              requiresSafetyRevalidation: false,
              safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              highRiskReviewRequired: false,
              reviewApprovalCount: 1,
              nutritionistId: selectedLibraryMeal.verifiedByNutritionistId,
              reviewedAt: new Date(),
            },
          });

          await tx.mealIngredient.deleteMany({ where: { mealPlanId: meal.id } });
          await tx.mealIngredient.createMany({
            data: selectedLibraryMeal.ingredients.map((ingredient) => ({
              mealPlanId: meal.id,
              ingredientName: ingredient.ingredientName,
              category: ingredient.category,
              foodItemId: ingredient.foodItemId,
              dataSource: ingredient.dataSource,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          });
          await tx.mealLibrary.update({
            where: { id: selectedLibraryMeal.id },
            data: { usageCount: { increment: 1 } },
          });
          await tx.mealLog.upsert({
            where: { mealPlanId: meal.id },
            update: {
              source: MealLogSource.SAFETY_REPLACED,
              mealName: selectedLibraryMeal.mealName,
              calories: selectedLibraryMeal.calories,
              proteinG: selectedLibraryMeal.proteinG,
              carbsG: selectedLibraryMeal.carbsG,
              fatG: selectedLibraryMeal.fatG,
              dataSource: MealLogDataSource.FNRI,
              status: MealLogStatus.PENDING,
            },
            create: {
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
        const assignment = assignedLibraryMeals.find((item) => item.mealPlanId === meal.id);
        if (assignment) assignment.libraryMealId = selectedLibraryMeal.id;
      } else {
        // Fallback: call Gemini AI to generate a single replacement
        console.log(`[Safety Recheck] No library matches. Generating single replacement via Gemini...`);
        const systemInstruction = 
          "You are a clinical dietitian generating a safe replacement meal for a patient with new health conditions.";
        
        const prompt =
          `Generate a single replacement ${meal.mealType} meal for a patient with these constraints:\n` +
          `- Daily Calorie Target: ${userProfile.dailyCalorieTarget || 2000} kcal (Aim for approx: breakfast 30%, lunch 40%, dinner 30%)\n` +
          `- Health Conditions: ${[...userConditions, userProfile.otherConditions].filter(Boolean).join(', ') || 'NONE'}\n` +
          `- Allergens to EXCLUDE: ${[...userAllergens, userProfile.otherAllergies].filter(Boolean).join(', ') || 'NONE'}\n` +
          `- Dietary Preference: ${userProfile.dietaryPreference || 'OMNIVORE'}\n` +
          `- Goal: ${userProfile.goal || 'MAINTAIN'}\n` +
          `Return a strict JSON object:\n` +
          `{ "mealName": string, "description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "ingredients": [{"name": string, "category": string, "quantity": number, "unit": string}] }`;

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
                status: MealPlanStatus.PENDING_REVIEW,
                requiresSafetyRevalidation: true,
                safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
                highRiskReviewRequired,
                reviewApprovalCount: 0,
                nutritionistId: null,
                reviewedAt: null,
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
                  quantity: Number.isFinite(Number(ing.quantity)) ? Number(ing.quantity) : null,
                  unit: typeof ing.unit === 'string' ? ing.unit : null,
                })),
              });
            }

            await tx.mealLog.upsert({
              where: { mealPlanId: meal.id },
              update: {
                source: MealLogSource.SAFETY_REPLACED,
                mealName: replacement.mealName,
                calories: parseFloat(replacement.calories || 0),
                proteinG: parseFloat(replacement.proteinG || 0),
                carbsG: parseFloat(replacement.carbsG || 0),
                fatG: parseFloat(replacement.fatG || 0),
                dataSource: MealLogDataSource.GEMINI_ESTIMATED,
                status: MealLogStatus.PENDING,
              },
              create: {
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
          console.error('[Safety Recheck] AI fallback failed; the meal remains pending review.', geminiErr);
          continue;
        }
      }

      replacedCount++;
    }

    if (replacedCount > 0) {
      console.log(`[Safety Recheck] Successfully replaced ${replacedCount} meal(s) for user ${userId}`);

      // A previously generated checklist no longer represents the safe plan.
      // Remove it before attempting to project the newly approved subset.
      await prisma.groceryList.deleteMany({ where: { userId } });

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
