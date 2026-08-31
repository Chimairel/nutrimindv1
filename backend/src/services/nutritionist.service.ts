import prisma from '@/lib/prisma';
import {
  MealPlanStatus,
  AIConfidenceFlag,
  NotificationType,
  MealLibraryStatus,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyEvidenceOrigin,
  MealLibraryDeclarationState,
  MealLibraryCrossContactAssessment,
  MealLibrarySafetyDeclarationType,
  MealLibrarySafetyReviewOutcome,
  FlagStatus,
  MealIngredientDataSource,
  Prisma,
} from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import {
  getApprovedMealPlanStatusWhere,
  getNutritionistReviewableMealPlanWhere,
} from '@/domain/meal-actionability.policy';
import {
  getReviewClaimCutoff,
  getReviewPriority,
  isNutritionistEligibleForReview,
  isReviewClaimActive,
} from '@/domain/nutritionist-review.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '@/domain/meal-library-safety-evidence.policy';
import type { CertifyMealLibrarySafetyInput } from '@/domain/meal-library-safety-review.schema';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { GroceryService } from '@/services/grocery.service';

export class NutritionistService {
  /**
   * Returns the shared staff review queue for a nutritionist.
   * Sorted by: NEEDS_REVIEW → CAUTION → SAFE
   */
  static async getReviewQueue(nutritionistProfileId?: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    // Show the whole shared queue, including items actively claimed by peers.
    const pendingMeals = await prisma.mealPlan.findMany({
      where: getNutritionistReviewableMealPlanWhere(),
      include: {
        user: { select: { id: true, name: true } },
        ingredients: true,
        claimedByNutritionist: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' },
    });

    // Sort purely by confidence flag severity (NEEDS_REVIEW -> CAUTION -> SAFE)
    const sorted = pendingMeals.sort((a, b) => {
      const aEscalated = a.highRiskReviewRequired && a.reviewApprovalCount === 1 ? 0 : 1;
      const bEscalated = b.highRiskReviewRequired && b.reviewApprovalCount === 1 ? 0 : 1;
      if (aEscalated !== bEscalated) return aEscalated - bEscalated;
      return getReviewPriority(a.aiConfidenceFlag) - getReviewPriority(b.aiConfidenceFlag);
    });

    const result = sorted.map((meal) => {
      const isClaimed = meal.claimedByNutritionistId && meal.claimedAt && meal.claimedAt >= thirtyMinutesAgo;
      const claimedByMe = isClaimed && meal.claimedByNutritionistId === nutritionistProfileId;
      const claimedByOther = isClaimed && meal.claimedByNutritionistId !== nutritionistProfileId;
      const claimedByName = claimedByOther ? (meal.claimedByNutritionist?.user?.name || 'Another nutritionist') : null;

      return {
        id: meal.id,
        planGroupId: meal.planGroupId,
        userId: meal.userId,
        nutritionistId: meal.nutritionistId,
        libraryMealId: meal.libraryMealId,
        status: meal.status,
        mealType: meal.mealType,
        mealName: meal.mealName,
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        aiConfidenceFlag: meal.aiConfidenceFlag,
        planType: meal.planType,
        nutritionistNote: meal.nutritionistNote,
        scheduledDate: meal.scheduledDate,
        reviewedAt: meal.reviewedAt,
        createdAt: meal.createdAt,
        user: meal.user,
        ingredients: meal.ingredients,
        highRiskReviewRequired: meal.highRiskReviewRequired,
        reviewApprovalCount: meal.reviewApprovalCount,
        requiresIndependentSecondReview:
          meal.highRiskReviewRequired && meal.reviewApprovalCount === 1,
        claimStatus: {
          claimedByMe: !!claimedByMe,
          claimedByOther: !!claimedByOther,
          claimedByName,
        }
      };
    });

    return result;
  }

  /**
   * Fetches detailed data for a specific review card and sets a temporary claim lock.
   */
  static async getReviewCardDetails(nutritionistProfileId: string, mealPlanId: string) {
    const now = new Date();
    const claimCutoff = getReviewClaimCutoff(now);

    // updateMany supplies a compare-and-set claim: only one reviewer can change
    // an unclaimed/expired row from the shared queue at a time.
    const claimResult = await prisma.mealPlan.updateMany({
      where: {
        id: mealPlanId,
        ...getNutritionistReviewableMealPlanWhere(),
        NOT: {
          highRiskReviewRequired: true,
          reviewApprovalCount: 1,
          firstApprovedByNutritionistId: nutritionistProfileId,
        },
        OR: [
          { claimedByNutritionistId: null },
          { claimedAt: null },
          { claimedAt: { lt: claimCutoff } },
          { claimedByNutritionistId: nutritionistProfileId },
        ],
      },
      data: {
        claimedByNutritionistId: nutritionistProfileId,
        claimedAt: now,
      },
    });

    if (claimResult.count !== 1) {
      const current = await prisma.mealPlan.findUnique({
        where: { id: mealPlanId },
        select: {
          status: true,
          claimedByNutritionistId: true,
          claimedAt: true,
          claimedByNutritionist: {
            select: { user: { select: { name: true } } },
          },
        },
      });

      if (!current) throw new Error('Meal plan not found.');
      if (current.status !== MealPlanStatus.PENDING_REVIEW) {
        throw new Error('This meal was already reviewed. Please refresh the queue.');
      }
      if (isReviewClaimActive(current, now) && current.claimedByNutritionistId !== nutritionistProfileId) {
        throw new Error(`This meal was already claimed by ${current.claimedByNutritionist?.user?.name || 'another nutritionist'}. Please choose another item.`);
      }
      throw new Error('Unable to acquire an active claim for this meal. Please refresh the queue.');
    }

    const updatedMealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        ingredients: true,
        user: {
          include: {
            userProfile: true,
            healthConditions: true,
            allergies: true,
          },
        },
      },
    });

    if (!updatedMealPlan) throw new Error('Meal plan not found.');

    const warnings: { severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE'; message: string }[] = [];
    const user = updatedMealPlan.user;
    const userProfile = user.userProfile;
    const conditions = user.healthConditions.map(hc => hc.condition);
    const allergies = user.allergies.map(a => a.allergen);

    const allergenMatches: Record<string, string[]> = {
      NUTS: ['peanut', 'peanuts', 'mani', 'cashew', 'almond', 'walnut', 'pecan', 'macadamia', 'nut', 'nuts'],
      DAIRY: ['milk', 'cheese', 'butter', 'cream', 'ghee', 'yogurt', 'dairy'],
      EGGS: ['egg', 'eggs', 'itlog'],
      SHELLFISH: ['shrimp', 'crab', 'lobster', 'prawn', 'prawns', 'mussel', 'mussels', 'clam', 'clams', 'oyster', 'oysters', 'tahong', 'talaba', 'hipon', 'crab', 'crabs'],
      GLUTEN: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'noodles', 'pancit', 'canton', 'bihon', 'miki', 'gluten'],
    };

    for (const ingredient of updatedMealPlan.ingredients) {
      const ingNameLower = ingredient.ingredientName.toLowerCase();
      const ingCatLower = (ingredient.category || '').toLowerCase();
      
      for (const allergen of allergies) {
        const keywords = allergenMatches[allergen] || [];
        const isMatch = keywords.some(keyword => ingNameLower.includes(keyword) || ingCatLower.includes(keyword)) ||
                        ingNameLower.includes(allergen.toLowerCase().replace('_', ' '));
        if (isMatch) {
          warnings.push({
            severity: 'CRITICAL',
            message: `⚠️ ${ingredient.ingredientName} may contain ${allergen} — user has declared a ${allergen} allergy`
          });
        }
      }
    }

    if (userProfile) {
      if (conditions.includes('DIABETES') && updatedMealPlan.carbsG > 60) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High carb load (${updatedMealPlan.carbsG.toFixed(1)}g) — user is diabetic. Typical safe range is under 60g per meal.`
        });
      }
      if (conditions.includes('HYPERTENSION')) {
        let totalSodium = 0;
        let hasSodiumData = false;
        
        const foodItemIds = updatedMealPlan.ingredients
          .map(i => i.foodItemId)
          .filter(Boolean) as string[];
          
        if (foodItemIds.length > 0) {
          const foodItems = await prisma.foodItem.findMany({
            where: { id: { in: foodItemIds } }
          });
          
          for (const item of foodItems) {
            if (item.sodium !== null && item.sodium !== undefined) {
              totalSodium += item.sodium;
              hasSodiumData = true;
            }
          }
        }
        
        if (hasSodiumData && totalSodium > 800) {
          warnings.push({
            severity: 'IMPORTANT',
            message: `⚠️ High sodium estimate (${totalSodium.toFixed(0)}mg) — user has hypertension.`
          });
        }
      }
      if (conditions.includes('HEART_CONDITION') && updatedMealPlan.fatG > 20) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High fat content (${updatedMealPlan.fatG.toFixed(1)}g) — user has a heart condition.`
        });
      }
      if (conditions.includes('KIDNEY_DISEASE') && updatedMealPlan.proteinG > 40) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High protein load (${updatedMealPlan.proteinG.toFixed(1)}g) — user has kidney disease. Protein restriction may be required.`
        });
      }
      if (conditions.includes('PREGNANT')) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ User is pregnant — verify meal is suitable for prenatal nutrition requirements.`
        });
      }

      if (userProfile.dailyCalorieTarget && updatedMealPlan.calories > (userProfile.dailyCalorieTarget * 0.50)) {
        const percentage = ((updatedMealPlan.calories / userProfile.dailyCalorieTarget) * 100).toFixed(0);
        warnings.push({
          severity: 'NOTICE',
          message: `⚠️ This meal alone is ${percentage}% of the user's daily calorie target (${updatedMealPlan.calories.toFixed(0)} kcal / ${userProfile.dailyCalorieTarget.toFixed(0)} kcal daily).`
        });
      }
    }

    const estimatedIngredients = updatedMealPlan.ingredients.filter(ing => ing.dataSource === 'GEMINI_ESTIMATED');
    if (estimatedIngredients.length > 0) {
      const names = estimatedIngredients.map(ing => ing.ingredientName).join(', ');
      warnings.push({
        severity: 'IMPORTANT',
        message: `⚠️ ${estimatedIngredients.length} ingredient(s) have AI-estimated nutrition data, not FNRI verified: [${names}]`
      });
    }

    const severityOrder = { CRITICAL: 0, IMPORTANT: 1, NOTICE: 2 };
    warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const userAge = userProfile?.age || 0;

    return {
      mealPlan: {
        id: updatedMealPlan.id,
        planGroupId: updatedMealPlan.planGroupId,
        userId: updatedMealPlan.userId,
        status: updatedMealPlan.status,
        mealType: updatedMealPlan.mealType,
        mealName: updatedMealPlan.mealName,
        description: updatedMealPlan.description,
        calories: updatedMealPlan.calories,
        proteinG: updatedMealPlan.proteinG,
        carbsG: updatedMealPlan.carbsG,
        fatG: updatedMealPlan.fatG,
        aiConfidenceFlag: updatedMealPlan.aiConfidenceFlag,
        planType: updatedMealPlan.planType,
        scheduledDate: updatedMealPlan.scheduledDate,
        createdAt: updatedMealPlan.createdAt,
      },
      user: {
        name: user.name,
        age: userAge,
        sex: userProfile?.biologicalSex || 'MALE',
        goal: userProfile?.goal || 'MAINTAIN',
        dailyCalorieTarget: userProfile?.dailyCalorieTarget || 2000,
        dietaryPreference: userProfile?.dietaryPreference || 'OMNIVORE',
        carbPreference: userProfile?.carbPreference || 'MODERATE',
        conditions: conditions,
        allergies: allergies,
      },
      ingredients: updatedMealPlan.ingredients.map(ing => ({
        name: ing.ingredientName,
        source: ing.dataSource,
      })),
      warnings: warnings,
      highRiskReviewRequired: updatedMealPlan.highRiskReviewRequired,
      reviewApprovalCount: updatedMealPlan.reviewApprovalCount,
      requiresIndependentSecondReview:
        updatedMealPlan.highRiskReviewRequired && updatedMealPlan.reviewApprovalCount === 1,
      claimStatus: {
        claimedByMe: true,
        claimedByOther: false,
        claimedByName: null,
      }
    };
  }

  /**
   * Approves a meal plan.
   * Sets status=APPROVED, auto-saves to MealLibrary, increments totalVerified, notifies user.
   */
  static async approveMealPlan(
    nutritionistProfileId: string, 
    mealPlanId: string, 
    note?: string,
    updates?: {
      mealName?: string;
      description?: string;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      ingredients?: { name: string; category?: string; dataSource?: MealIngredientDataSource }[];
    }
  ) {
    const now = new Date();
    const claimCutoff = getReviewClaimCutoff(now);
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        ingredients: true,
        user: {
          include: {
            healthConditions: true,
            allergies: true,
            userProfile: true,
          },
        },
      },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be approved.');
    }

    if (plan.claimedByNutritionistId !== nutritionistProfileId ||
        !plan.claimedAt ||
        plan.claimedAt < claimCutoff) {
      throw new Error('You must hold an active claim before approving this meal. Please reopen it from the queue.');
    }
    if (
      plan.highRiskReviewRequired &&
      plan.reviewApprovalCount === 1 &&
      plan.firstApprovedByNutritionistId === nutritionistProfileId
    ) {
      throw new Error('A different nutritionist must perform the second high-risk review.');
    }

    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      select: { userId: true },
    });
    if (!reviewer) throw new Error('Nutritionist profile not found.');

    const dietaryTags = [
      plan.user.userProfile?.dietaryPreference,
      plan.user.userProfile?.goal,
    ].filter(Boolean) as string[];

    const mealName = updates?.mealName !== undefined ? updates.mealName : plan.mealName;
    const description = updates?.description !== undefined ? updates.description : plan.description;
    const calories = updates?.calories !== undefined ? parseFloat(updates.calories as any) : plan.calories;
    const proteinG = updates?.proteinG !== undefined ? parseFloat(updates.proteinG as any) : plan.proteinG;
    const carbsG = updates?.carbsG !== undefined ? parseFloat(updates.carbsG as any) : plan.carbsG;
    const fatG = updates?.fatG !== undefined ? parseFloat(updates.fatG as any) : plan.fatG;

    if (plan.highRiskReviewRequired && plan.reviewApprovalCount === 0) {
      await prisma.$transaction(async (tx) => {
        const firstDecision = await tx.mealPlan.updateMany({
          where: {
            id: mealPlanId,
            status: MealPlanStatus.PENDING_REVIEW,
            reviewApprovalCount: 0,
            claimedByNutritionistId: nutritionistProfileId,
            claimedAt: { gte: claimCutoff },
          },
          data: {
            mealName,
            description,
            calories,
            proteinG,
            carbsG,
            fatG,
            nutritionistNote: note || null,
            reviewApprovalCount: 1,
            firstApprovedByNutritionistId: nutritionistProfileId,
            firstApprovedAt: now,
            claimedByNutritionistId: null,
            claimedAt: null,
          },
        });
        if (firstDecision.count !== 1) {
          throw new Error('The active claim expired or this meal was already reviewed. Please refresh the queue.');
        }

        if (updates?.ingredients) {
          await tx.mealIngredient.deleteMany({ where: { mealPlanId } });
          await tx.mealIngredient.createMany({
            data: updates.ingredients.map((ingredient) => ({
              mealPlanId,
              ingredientName: ingredient.name,
              category: ingredient.category || 'PANTRY',
              dataSource: ingredient.dataSource || MealIngredientDataSource.FNRI,
            })),
          });
        }

        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: 'MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL',
            entityType: 'MealPlan',
            entityId: mealPlanId,
            metadata: { policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION },
          },
        });
        await tx.notification.create({
          data: {
            userId: plan.userId,
            title: 'Additional safety review in progress',
            message: `Your meal "${mealName}" passed its first review and is awaiting an independent second nutritionist review.`,
            type: NotificationType.REVIEW_REQUEST,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return { success: true, awaitingSecondReview: true };
    }

    await prisma.$transaction(async (tx) => {
      // Compare-and-set the decision while this reviewer still owns a live
      // claim. A competing or expired decision changes zero rows and rolls the
      // entire transaction back before a library record can be published.
      const decision = await tx.mealPlan.updateMany({
        where: {
          id: mealPlanId,
          status: MealPlanStatus.PENDING_REVIEW,
          claimedByNutritionistId: nutritionistProfileId,
          claimedAt: { gte: claimCutoff },
        },
        data: {
          status: MealPlanStatus.APPROVED,
          mealName,
          description,
          calories,
          proteinG,
          carbsG,
          fatG,
          nutritionistId: nutritionistProfileId,
          nutritionistNote: note || null,
          reviewedAt: now,
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          reviewApprovalCount: plan.highRiskReviewRequired ? 2 : 1,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });

      if (decision.count !== 1) {
        throw new Error('The active claim expired or this meal was already reviewed. Please refresh the queue.');
      }

      if (updates?.ingredients) {
        await tx.mealIngredient.deleteMany({
          where: { mealPlanId },
        });
        await tx.mealIngredient.createMany({
          data: updates.ingredients.map((ing) => ({
            mealPlanId,
            ingredientName: ing.name,
            category: ing.category || 'PANTRY',
            dataSource: ing.dataSource || MealIngredientDataSource.FNRI,
          })),
        });
      }

      const finalIngredients = await tx.mealIngredient.findMany({
        where: { mealPlanId },
        orderBy: { id: 'asc' },
      });

      // Approval makes this exact user meal actionable, but it does not silently
      // certify the reusable library entry. Stable library-owned ingredients are
      // copied into an INCOMPLETE draft for a separate evidence review.
      const libraryMeal = await tx.mealLibrary.create({
        data: {
          verifiedByNutritionistId: nutritionistProfileId,
          mealName,
          description,
          mealType: plan.mealType,
          calories,
          proteinG,
          carbsG,
          fatG,
          suitableConditions: [],
          allergenFree: [],
          dietaryTags,
          safetyEvidenceRevision: 1,
          ingredients: {
            create: finalIngredients.map((ingredient, position) => ({
              position,
              ingredientName: ingredient.ingredientName,
              category: ingredient.category,
              foodItemId: ingredient.foodItemId,
              dataSource: ingredient.dataSource,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          },
        },
      });

      await tx.mealLibrarySafetyReview.create({
        data: {
          mealLibraryId: libraryMeal.id,
          nutritionistProfileId,
          outcome: MealLibrarySafetyReviewOutcome.DRAFT_CREATED,
          evidenceRevision: 1,
          reasonCode: 'INITIAL_APPROVAL_DRAFT',
          evidenceSnapshot: {
            mealName,
            description,
            mealType: plan.mealType,
            calories,
            proteinG,
            carbsG,
            fatG,
            ingredients: finalIngredients.map((ingredient, position) => ({
              position,
              ingredientName: ingredient.ingredientName,
              category: ingredient.category,
              foodItemId: ingredient.foodItemId,
              dataSource: ingredient.dataSource,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          },
        },
      });

      await tx.mealPlan.update({
        where: { id: mealPlanId },
        data: { libraryMealId: libraryMeal.id },
      });

      await tx.nutritionistProfile.update({
        where: { id: nutritionistProfileId },
        data: { totalVerified: { increment: 1 } },
      });

      await tx.notification.create({
        data: {
          userId: plan.userId,
          title: 'Meal Plan Approved ✅',
          message: `Your meal "${mealName}" has been approved by a Registered Dietitian.${note ? ` Note: ${note}` : ''}`,
          type: NotificationType.PLAN_APPROVED,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: plan.highRiskReviewRequired
            ? 'MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL'
            : 'MEAL_PLAN_APPROVED',
          entityType: 'MealPlan',
          entityId: mealPlanId,
          metadata: { policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // The grocery list is a derived projection of the user's approved current
    // plan. Rebuild it immediately after approval so users never have to issue
    // a second "generate" command. This runs after the approval transaction:
    // a projection failure must not roll back or misreport a valid clinical
    // review decision.
    try {
      await GroceryService.generateGroceryList(plan.userId);
    } catch (error) {
      console.error('[NutritionistService] Grocery projection refresh failed after approval:', error);
    }

    return { success: true };
  }

  /**
   * Rejects a meal plan and triggers AI regeneration of that specific meal.
   */
  static async rejectMealPlan(nutritionistProfileId: string, mealPlanId: string, reason: string) {
    const now = new Date();
    const claimCutoff = getReviewClaimCutoff(now);
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        user: { include: { userProfile: true, healthConditions: true, allergies: true } }
      },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be rejected.');
    }

    if (plan.claimedByNutritionistId !== nutritionistProfileId ||
        !plan.claimedAt ||
        plan.claimedAt < claimCutoff) {
      throw new Error('You must hold an active claim before rejecting this meal. Please reopen it from the queue.');
    }

    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      select: { userId: true },
    });
    if (!reviewer) throw new Error('Nutritionist profile not found.');

    await prisma.$transaction(async (tx) => {
      const decision = await tx.mealPlan.updateMany({
        where: {
          id: mealPlanId,
          status: MealPlanStatus.PENDING_REVIEW,
          claimedByNutritionistId: nutritionistProfileId,
          claimedAt: { gte: claimCutoff },
        },
        data: {
          status: MealPlanStatus.REJECTED,
          nutritionistId: nutritionistProfileId,
          nutritionistNote: reason,
          reviewedAt: now,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });

      if (decision.count !== 1) {
        throw new Error('The active claim expired or this meal was already reviewed. Please refresh the queue.');
      }

      await tx.notification.create({
        data: {
          userId: plan.userId,
          title: 'Meal Plan Needs Changes ⚠️',
          message: `Your meal "${plan.mealName}" was flagged by a dietitian: ${reason.trim().replace(/[.!?]+$/, '')}. A replacement is being generated.`,
          type: NotificationType.PLAN_REJECTED,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'MEAL_PLAN_REJECTED',
          entityType: 'MealPlan',
          entityId: mealPlanId,
          metadata: { reason: reason.trim().slice(0, 240) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Generate a replacement only after the rejection decision commits.
    try {
      const profile = plan.user.userProfile;
      const conditions = plan.user.healthConditions.map((c) => c.condition);
      const allergens = plan.user.allergies.map((a) => a.allergen);

      const prompt =
        `Generate a single replacement ${plan.mealType} meal for a Filipino patient with these constraints:\n` +
        `- Daily Calorie Target: ${profile?.dailyCalorieTarget || 2000} kcal\n` +
        `- Health Conditions: ${conditions.join(', ') || 'NONE'}\n` +
        `- Allergens to EXCLUDE: ${allergens.join(', ') || 'NONE'}\n` +
        `- Dietary Preference: ${profile?.dietaryPreference || 'OMNIVORE'}\n` +
        `- Rejection Reason: ${reason}\n` +
        `Return a strict JSON object:\n` +
        `{ "mealName": string, "description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "ingredients": [{"name": string, "category": string}] }`;

      const replacement = await generateGenerativeJSON<any>(prompt);

      // Create replacement meal with same planGroupId and scheduledDate
      await prisma.mealPlan.create({
        data: {
          planGroupId: plan.planGroupId,
          userId: plan.userId,
          status: MealPlanStatus.PENDING_REVIEW,
          mealType: plan.mealType,
          mealName: replacement.mealName,
          description: replacement.description,
          calories: replacement.calories,
          proteinG: replacement.proteinG,
          carbsG: replacement.carbsG,
          fatG: replacement.fatG,
          aiConfidenceFlag: AIConfidenceFlag.CAUTION,
          scheduledDate: plan.scheduledDate,
          ingredients: {
            create: (replacement.ingredients || []).map((ing: any) => ({
              ingredientName: ing.name,
              category: ing.category || 'PANTRY',
              dataSource: MealIngredientDataSource.GEMINI_ESTIMATED,
            })),
          },
        },
      });
    } catch (err) {
      console.error('[NutritionistService] Replacement meal generation failed:', err);
    }

    return { success: true };
  }


  /**
   * Returns the nutritionist's own profile.
   */
  static async getProfile(userId: string) {
    return prisma.nutritionistProfile.findUnique({
      where: { userId },
    });
  }

  /**
   * Updates the nutritionist's profile.
   */
  static async updateProfile(userId: string, data: { bio?: string; specialization?: string }) {
    return prisma.nutritionistProfile.update({
      where: { userId },
      data,
    });
  }

  /**
   * Returns MealLibrary entries.
   */
  static async getMealLibrary(limit = 50) {
    return prisma.mealLibrary.findMany({
      orderBy: { usageCount: 'desc' },
      take: limit,
      include: { verifiedByNutritionist: { select: { userId: true } } },
    });
  }

  /**
   * Returns all meal plans approved by this nutritionist.
   */
  static async getApprovedMeals(nutritionistProfileId: string) {
    return prisma.mealPlan.findMany({
      where: {
        ...getApprovedMealPlanStatusWhere(),
        nutritionistId: nutritionistProfileId,
      },
      select: {
        id: true,
        mealName: true,
        mealType: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        nutritionistNote: true,
        reviewedAt: true,
        scheduledDate: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { reviewedAt: 'desc' },
    });
  }

  /**
   * Checks if the user is authorized to perform mutations (edit/delete/resolve flags)
   * on a verified meal entry. Only the verifier has permissions, except for ADMIN
   * override if the verifier account has been deactivated or is inactive.
   */
  static async checkLibraryMealMutationPermission(
    userId: string,
    userRole: string,
    meal: any
  ): Promise<boolean> {
    if (!meal) return false;

    // Check if user is the original verifier
    if (meal.verifiedByNutritionist?.userId === userId) {
      return true;
    }

    // Check if user is ADMIN and the verifier account is inactive/deactivated/deleted
    if (userRole === 'ADMIN') {
      const verifierProfile = await prisma.nutritionistProfile.findUnique({
        where: { id: meal.verifiedByNutritionistId || '' },
        include: { user: true },
      });

      if (
        !verifierProfile ||
        !verifierProfile.user ||
        verifierProfile.user.role !== 'NUTRITIONIST' ||
        verifierProfile.prcLicenseExpiry < new Date()
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Query MealLibrary with advanced filters, search, and pagination
   */
  static async getMealLibraryWithFilters(
    currentUserId: string,
    filters: {
      search?: string;
      mealType?: string;
      conditionTag?: string;
      status?: string;
      verifiedByMe?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.search) {
      where.mealName = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    if (filters.mealType && filters.mealType !== 'All') {
      where.mealType = filters.mealType;
    }

    if (filters.conditionTag && filters.conditionTag !== 'All') {
      where.suitableConditions = {
        array_contains: filters.conditionTag,
      };
    }

    if (filters.status && filters.status !== 'All') {
      where.status = filters.status;
    }

    if (filters.verifiedByMe) {
      where.verifiedByNutritionist = {
        userId: currentUserId,
      };
    }

    const [total, meals] = await Promise.all([
      prisma.mealLibrary.count({ where }),
      prisma.mealLibrary.findMany({
        where,
        orderBy: { addedAt: 'desc' },
        skip,
        take: limit,
        include: {
          verifiedByNutritionist: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
          flags: {
            where: { status: 'PENDING' },
            include: {
              flaggedByNutritionist: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          ingredients: { orderBy: { position: 'asc' } },
          safetyDeclarations: true,
          safetyReviewedByNutritionist: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
    ]);

    return { total, page, limit, meals };
  }

  /**
   * Get single library meal details
   */
  static async getLibraryMeal(mealId: string) {
    return prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        flags: {
          include: {
            flaggedByNutritionist: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        ingredients: { orderBy: { position: 'asc' } },
        safetyDeclarations: true,
        safetyReviewedByNutritionist: {
          include: { user: { select: { name: true } } },
        },
        safetyReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            nutritionistProfile: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });
  }

  /**
   * Certifies one exact, stable library evidence revision. This is separate
   * from approving the original user's meal plan and is intentionally strict:
   * only linked FNRI ingredients and explicit reviewed declarations qualify.
   */
  static async certifyLibraryMealSafety(
    nutritionistProfileId: string,
    mealId: string,
    input: CertifyMealLibrarySafetyInput
  ) {
    const now = new Date();
    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      include: { user: { select: { role: true } } },
    });
    if (!reviewer || !isNutritionistEligibleForReview(reviewer, now)) {
      throw new Error('Only a currently verified nutritionist with an unexpired PRC license can certify evidence.');
    }

    return prisma.$transaction(async (tx) => {
      const meal = await tx.mealLibrary.findUnique({
        where: { id: mealId },
        include: {
          ingredients: { orderBy: { position: 'asc' } },
          flags: { where: { status: FlagStatus.PENDING }, select: { id: true } },
        },
      });
      if (!meal) throw new Error('Meal not found.');
      if (meal.status !== MealLibraryStatus.APPROVED || meal.flags.length > 0) {
        throw new Error('Flagged or archived meals cannot be certified. Resolve the operational status first.');
      }
      if (meal.safetyEvidenceRevision !== input.expectedRevision) {
        throw new Error('Evidence revision conflict. Refresh the meal before certifying.');
      }
      if (meal.ingredients.length === 0) {
        throw new Error('Certification requires at least one stable library ingredient.');
      }
      if (meal.ingredients.some((ingredient) =>
        ingredient.dataSource !== MealIngredientDataSource.FNRI || !ingredient.foodItemId
      )) {
        throw new Error('Every library ingredient must be resolved and linked to FNRI before certification.');
      }

      const nextRevision = input.expectedRevision + 1;
      const declarations = [
        ...input.suitableConditions.map((canonicalKey) => ({
          mealLibraryId: mealId,
          declarationType: MealLibrarySafetyDeclarationType.CONDITION_REVIEWED,
          canonicalKey,
        })),
        ...input.allergensPresent.map((canonicalKey) => ({
          mealLibraryId: mealId,
          declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT,
          canonicalKey,
        })),
        ...input.allergensReviewedAbsent.map((canonicalKey) => ({
          mealLibraryId: mealId,
          declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT,
          canonicalKey,
        })),
      ];

      const revisionClaim = await tx.mealLibrary.updateMany({
        where: {
          id: mealId,
          status: MealLibraryStatus.APPROVED,
          safetyEvidenceRevision: input.expectedRevision,
        },
        data: {
          safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
          safetyEvidenceOrigin: MealLibrarySafetyEvidenceOrigin.NUTRITIONIST_REVIEW,
          conditionDeclarationState: input.conditionDeclarationState as MealLibraryDeclarationState,
          allergenDeclarationState: input.allergenDeclarationState as MealLibraryDeclarationState,
          crossContactAssessment: input.crossContactAssessment as MealLibraryCrossContactAssessment,
          suitableConditions: input.suitableConditions,
          allergenFree: input.allergensReviewedAbsent,
          safetyEvidenceRevision: nextRevision,
          certifiedEvidenceRevision: nextRevision,
          safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
          safetyReviewedByNutritionistId: nutritionistProfileId,
          safetyReviewedAt: now,
          safetyInvalidatedAt: null,
          safetyInvalidationReason: null,
        },
      });
      if (revisionClaim.count !== 1) {
        throw new Error('Evidence revision conflict. Refresh the meal before certifying.');
      }

      await tx.mealLibrarySafetyDeclaration.deleteMany({ where: { mealLibraryId: mealId } });
      if (declarations.length > 0) {
        await tx.mealLibrarySafetyDeclaration.createMany({ data: declarations });
      }

      const evidenceSnapshot = {
        meal: {
          mealName: meal.mealName,
          description: meal.description,
          mealType: meal.mealType,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
        },
        ingredients: meal.ingredients.map((ingredient) => ({
          position: ingredient.position,
          ingredientName: ingredient.ingredientName,
          category: ingredient.category,
          foodItemId: ingredient.foodItemId,
          dataSource: ingredient.dataSource,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
        declarations: {
          conditionDeclarationState: input.conditionDeclarationState,
          allergenDeclarationState: input.allergenDeclarationState,
          suitableConditions: input.suitableConditions,
          allergensPresent: input.allergensPresent,
          allergensReviewedAbsent: input.allergensReviewedAbsent,
          crossContactAssessment: input.crossContactAssessment,
        },
      };
      await tx.mealLibrarySafetyReview.create({
        data: {
          mealLibraryId: mealId,
          nutritionistProfileId,
          outcome: MealLibrarySafetyReviewOutcome.CERTIFIED,
          evidenceRevision: nextRevision,
          policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
          reasonCode: 'CERTIFIED_CURRENT_REVISION',
          evidenceSnapshot,
        },
      });

      return tx.mealLibrary.findUnique({
        where: { id: mealId },
        include: {
          ingredients: { orderBy: { position: 'asc' } },
          safetyDeclarations: true,
          safetyReviewedByNutritionist: {
            include: { user: { select: { name: true } } },
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Update meal details in MealLibrary
   */
  static async editLibraryMeal(
    userId: string,
    userRole: string,
    mealId: string,
    updatedFields: any
  ) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can edit this meal.');
    }

    const now = new Date();
    const wasComplete = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.mealLibrary.update({
        where: { id: mealId },
        data: {
          mealName: updatedFields.mealName,
          description: updatedFields.description,
          calories: parseFloat(updatedFields.calories || 0),
          proteinG: parseFloat(updatedFields.proteinG || 0),
          carbsG: parseFloat(updatedFields.carbsG || 0),
          fatG: parseFloat(updatedFields.fatG || 0),
          dietaryTags: updatedFields.dietaryTags || meal.dietaryTags,
          safetyEvidenceRevision: { increment: 1 },
          ...(wasComplete ? {
            safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
            safetyInvalidatedAt: now,
            safetyInvalidationReason: 'MEAL_CONTENT_CHANGED',
          } : {}),
        },
      });

      if (wasComplete) {
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId: meal.verifiedByNutritionistId,
            outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
            evidenceRevision: updated.safetyEvidenceRevision,
            policyVersion: updated.safetyPolicyVersion,
            reasonCode: 'MEAL_CONTENT_CHANGED',
            evidenceSnapshot: {
              priorCertifiedRevision: meal.certifiedEvidenceRevision,
              currentRevision: updated.safetyEvidenceRevision,
            },
          },
        });
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Delete verified meal from MealLibrary
   */
  static async deleteLibraryMeal(userId: string, userRole: string, mealId: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can delete this meal.');
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const archived = await tx.mealLibrary.update({
        where: { id: mealId },
        data: {
          status: MealLibraryStatus.ARCHIVED,
          safetyEvidenceStatus: meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
            ? MealLibrarySafetyEvidenceStatus.STALE
            : meal.safetyEvidenceStatus,
          safetyInvalidatedAt: now,
          safetyInvalidationReason: 'LIBRARY_ARCHIVED',
        },
      });
      await tx.mealLibrarySafetyReview.create({
        data: {
          mealLibraryId: mealId,
          nutritionistProfileId: meal.verifiedByNutritionistId,
          outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
          evidenceRevision: archived.safetyEvidenceRevision,
          policyVersion: archived.safetyPolicyVersion,
          reasonCode: 'LIBRARY_ARCHIVED',
          evidenceSnapshot: { priorStatus: meal.status, archivedAt: now.toISOString() },
        },
      });
      return archived;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Flag a library meal for re-review
   */
  static async flagLibraryMeal(userId: string, mealId: string, reason: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: true,
        flags: { where: { status: FlagStatus.PENDING }, select: { id: true } },
      },
    });

    if (!meal) throw new Error('Meal not found.');

    if (meal.verifiedByNutritionist?.userId === userId) {
      throw new Error('You cannot flag your own verified meal. Edit it directly instead.');
    }
    if (meal.status === MealLibraryStatus.ARCHIVED) throw new Error('Archived meals cannot be flagged.');
    if (meal.flags.length > 0) throw new Error('This meal already has a pending flag.');

    const flaggerProfile = await prisma.nutritionistProfile.findUnique({
      where: { userId },
    });
    if (!flaggerProfile) throw new Error('Flagger profile not found.');

    const flag = await prisma.$transaction(async (tx) => {
      const createdFlag = await tx.mealLibraryFlag.create({
        data: {
          mealLibraryId: mealId,
          flaggedByNutritionistId: flaggerProfile.id,
          reason,
          status: FlagStatus.PENDING,
        },
      });
      const wasComplete = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
      const updated = await tx.mealLibrary.update({
        where: { id: mealId },
        data: {
          status: MealLibraryStatus.FLAGGED,
          ...(wasComplete ? {
            safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
            safetyInvalidatedAt: new Date(),
            safetyInvalidationReason: 'LIBRARY_FLAGGED',
          } : {}),
        },
      });
      if (wasComplete) {
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId: flaggerProfile.id,
            outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
            evidenceRevision: updated.safetyEvidenceRevision,
            policyVersion: updated.safetyPolicyVersion,
            reasonCode: 'LIBRARY_FLAGGED',
            evidenceSnapshot: { flagId: createdFlag.id },
          },
        });
      }
      return createdFlag;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (meal.verifiedByNutritionist?.userId) {
      await prisma.notification.create({
        data: {
          userId: meal.verifiedByNutritionist.userId,
          title: 'Meal Plan Flagged 🚩',
          message: `Your verified meal "${meal.mealName}" was flagged for re-review: ${reason}`,
          type: 'MEAL_FLAGGED',
        },
      });
    }

    return flag;
  }

  /**
   * Resolve an active flag (edit, delete, or dismiss)
   */
  static async resolveLibraryMealFlag(
    userId: string,
    userRole: string,
    mealId: string,
    resolution: 'edit' | 'delete' | 'dismiss',
    updatedFields?: any
  ) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: true,
        flags: {
          where: { status: 'PENDING' },
          include: {
            flaggedByNutritionist: true,
          },
        },
      },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can resolve flags on this meal.');
    }

    const pendingFlags = meal.flags;
    const flagIds = pendingFlags.map((f) => f.id);

    if (resolution === 'delete') {
      await prisma.$transaction(async (tx) => {
        await tx.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: FlagStatus.RESOLVED_REMOVED, resolvedAt: new Date() },
        });
        await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            status: MealLibraryStatus.ARCHIVED,
            safetyEvidenceStatus: meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
              ? MealLibrarySafetyEvidenceStatus.STALE
              : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: new Date(),
            safetyInvalidationReason: 'LIBRARY_ARCHIVED',
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Resolved: Meal Removed 🗑️',
              message: `The meal "${meal.mealName}" you flagged has been removed from the library.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    const newStatus = MealLibraryStatus.APPROVED;
    const flagStatus = FlagStatus.RESOLVED_KEPT;

    if (resolution === 'edit') {
      if (!updatedFields) throw new Error('Updated fields are required for edit resolution.');

      await prisma.$transaction([
        prisma.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: flagStatus, resolvedAt: new Date() },
        }),
        prisma.mealLibrary.update({
          where: { id: mealId },
          data: {
            mealName: updatedFields.mealName,
            description: updatedFields.description,
            calories: parseFloat(updatedFields.calories || 0),
            proteinG: parseFloat(updatedFields.proteinG || 0),
            carbsG: parseFloat(updatedFields.carbsG || 0),
            fatG: parseFloat(updatedFields.fatG || 0),
            suitableConditions: updatedFields.suitableConditions || meal.suitableConditions,
            allergenFree: updatedFields.allergenFree || meal.allergenFree,
            dietaryTags: updatedFields.dietaryTags || meal.dietaryTags,
            status: newStatus,
            safetyEvidenceRevision: { increment: 1 },
            safetyEvidenceStatus: meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
              ? MealLibrarySafetyEvidenceStatus.STALE
              : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: meal.safetyInvalidatedAt || new Date(),
            safetyInvalidationReason: 'FLAG_RESOLUTION_EDIT',
          },
        }),
      ]);

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Resolved: Meal Updated ✏️',
              message: `The meal "${meal.mealName}" you flagged has been updated and kept in the library.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    if (resolution === 'dismiss') {
      await prisma.$transaction([
        prisma.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: flagStatus, resolvedAt: new Date() },
        }),
        prisma.mealLibrary.update({
          where: { id: mealId },
          data: { status: newStatus },
        }),
      ]);

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Dismissed ℹ️',
              message: `Your flag on meal "${meal.mealName}" was dismissed by the original verifier.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    throw new Error('Invalid resolution type.');
  }
}
