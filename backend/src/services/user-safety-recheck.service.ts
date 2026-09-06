import prisma from '@/lib/prisma';
import {
  HealthConditionType,
  AllergenType,
  MealPlanStatus,
  AIConfidenceFlag,
  NotificationType,
  MealLogSource,
  MealLogDataSource,
  MealLogStatus,
  MealIngredientDataSource,
  MealLibrarySafetyEvidenceStatus,
} from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import { GroceryService } from './grocery.service';
import { getApprovedMealLibraryWhere } from '@/domain/meal-actionability.policy';
import { certifiedLibraryMealInclude, isCertifiedLibraryMealCompatible } from './meal-swap.service';
import {
  MEAL_PLAN_SAFETY_POLICY_VERSION,
  requiresEscalatedMealReview,
} from '@/domain/meal-plan-production-safety.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';

export class UserSafetyRecheckService {
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
      const keywords = [
        'shrimp',
        'prawn',
        'crab',
        'lobster',
        'shellfish',
        'mussel',
        'clam',
        'oyster',
        'hipon',
        'alimango',
        'alimasag',
        'tahong',
        'talaba',
        'alamang',
        'seafood',
      ];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.NUTS)) {
      const keywords = ['peanut', 'cashew', 'almond', 'walnut', 'pecan', 'nut', 'mani', 'kasuy', 'hazelnut'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.DAIRY)) {
      const keywords = [
        'milk',
        'cheese',
        'butter',
        'cream',
        'yogurt',
        'dairy',
        'gatas',
        'keso',
        'condensed milk',
        'evaporated milk',
      ];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.GLUTEN)) {
      const keywords = [
        'wheat',
        'flour',
        'bread',
        'gluten',
        'pasta',
        'spaghetti',
        'macaroni',
        'noodles',
        'pan de sal',
        'soy sauce',
        'toyo',
      ];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (allergens.includes(AllergenType.EGGS)) {
      const keywords = ['egg', 'itlog', 'mayo', 'mayonnaise', 'balut', 'penoy'];
      if (keywords.some((k) => joinedIngs.includes(k))) return true;
    }

    // 2. Check Clinical Health Conditions
    if (conditions.includes(HealthConditionType.HYPERTENSION)) {
      const sodiumKeywords = [
        'chicharon',
        'spam',
        'hotdog',
        'sausage',
        'instant noodle',
        'tuyo',
        'patis',
        'bagoong',
        'soy sauce',
        'toyo',
        'salted',
      ];
      if (sodiumKeywords.some((k) => joinedIngs.includes(k))) return true;
    }

    if (conditions.includes(HealthConditionType.DIABETES)) {
      const sugarKeywords = [
        'sugar',
        'sweet',
        'cake',
        'pastry',
        'soda',
        'coke',
        'juice',
        'condensed milk',
        'honey',
        'syrup',
        'turon',
        'bananacue',
      ];
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
        safetyProfileEntries: true,
      },
    });

    if (!user || !user.userProfile) {
      console.warn(`[Safety Recheck] User or profile not found for user: ${userId}`);
      return;
    }

    const { userProfile } = user;
    const safetyRestrictions = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
      otherConditions: userProfile.otherConditions,
      otherAllergies: userProfile.otherAllergies,
    });
    const userConditions = safetyRestrictions.conditions;
    const userAllergens = safetyRestrictions.allergies;

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
      isCertifiedLibraryMealCompatible(candidate, userConditions, userAllergens, {
        ...userProfile,
        safetyEntries: user.safetyProfileEntries,
      })
    );
    const highRiskReviewRequired = requiresEscalatedMealReview(
      userConditions,
      safetyRestrictions.customConditions.join(', ')
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
        return !assignedLibraryMeals.some(
          (assignment) =>
            assignment.mealPlanId !== meal.id &&
            assignment.libraryMealId === candidate.id &&
            Math.abs(assignment.scheduledDate.getTime() - meal.scheduledDate.getTime()) < 3 * 86_400_000
        );
      });

      if (eligibleMatches.length > 0) {
        const unusedMatches = eligibleMatches.filter(
          (candidate) =>
            !assignedLibraryMeals.some(
              (assignment) => assignment.mealPlanId !== meal.id && assignment.libraryMealId === candidate.id
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
          'You are a clinical dietitian generating a safe replacement meal for a patient with new health conditions.';

        const prompt =
          `Generate a single replacement ${meal.mealType} meal for a patient with these constraints:\n` +
          `- Daily Calorie Target: ${userProfile.dailyCalorieTarget || 2000} kcal (Aim for approx: breakfast 30%, lunch 40%, dinner 30%)\n` +
          `- Health Conditions: ${[...userConditions, ...safetyRestrictions.customConditions].join(', ') || 'NONE'}\n` +
          `- Food restrictions to EXCLUDE or REVIEW: ${[...userAllergens, ...safetyRestrictions.customFoodRestrictions].join(', ') || 'NONE'}\n` +
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
          message: `We updated ${replacedCount} meal(s) in your current plan due to your health or food restriction update.`,
          type: NotificationType.PLAN_APPROVED,
        },
      });
    }
  }
}
