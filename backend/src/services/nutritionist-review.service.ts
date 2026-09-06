import prisma from '@/lib/prisma';
import {
  MealPlanStatus,
  AIConfidenceFlag,
  NotificationType,
  MealLibrarySafetyReviewOutcome,
  MealIngredientDataSource,
  Prisma,
} from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import {
  getApprovedMealPlanStatusWhere,
  getNutritionistReviewableMealPlanWhere,
} from '@/domain/meal-actionability.policy';
import { getReviewClaimCutoff, getReviewPriority, isReviewClaimActive } from '@/domain/nutritionist-review.policy';
import { recordCompletedMealPlanReviewCredit } from '@/services/work-credit.service';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { GroceryService } from '@/services/grocery.service';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';

export class NutritionistReviewService {
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
            user: { select: { name: true } },
          },
        },
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
      const claimedByName = claimedByOther ? meal.claimedByNutritionist?.user?.name || 'Another nutritionist' : null;

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
        requiresIndependentSecondReview: meal.highRiskReviewRequired && meal.reviewApprovalCount === 1,
        claimStatus: {
          claimedByMe: !!claimedByMe,
          claimedByOther: !!claimedByOther,
          claimedByName,
        },
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
        throw new Error(
          `This meal was already claimed by ${current.claimedByNutritionist?.user?.name || 'another nutritionist'}. Please choose another item.`
        );
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
            safetyProfileEntries: true,
          },
        },
      },
    });

    if (!updatedMealPlan) throw new Error('Meal plan not found.');

    const warnings: { severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE'; message: string }[] = [];
    const user = updatedMealPlan.user;
    const userProfile = user.userProfile;
    const safetyRestrictions = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
      otherConditions: userProfile?.otherConditions,
      otherAllergies: userProfile?.otherAllergies,
    });
    const conditions = safetyRestrictions.conditions;
    const allergies = safetyRestrictions.allergies;

    if (safetyRestrictions.requiresReview) {
      warnings.push({
        severity: 'IMPORTANT',
        message:
          'The user has an unsupported, pending, or evidence-incomplete structured restriction. Review every retained entry before approval.',
      });
    }

    const allergenMatches: Record<string, string[]> = {
      NUTS: ['peanut', 'peanuts', 'mani', 'cashew', 'almond', 'walnut', 'pecan', 'macadamia', 'nut', 'nuts'],
      DAIRY: ['milk', 'cheese', 'butter', 'cream', 'ghee', 'yogurt', 'dairy'],
      EGGS: ['egg', 'eggs', 'itlog'],
      SHELLFISH: [
        'shrimp',
        'crab',
        'lobster',
        'prawn',
        'prawns',
        'mussel',
        'mussels',
        'clam',
        'clams',
        'oyster',
        'oysters',
        'tahong',
        'talaba',
        'hipon',
        'crab',
        'crabs',
      ],
      GLUTEN: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'noodles', 'pancit', 'canton', 'bihon', 'miki', 'gluten'],
    };

    for (const ingredient of updatedMealPlan.ingredients) {
      const ingNameLower = ingredient.ingredientName.toLowerCase();
      const ingCatLower = (ingredient.category || '').toLowerCase();

      for (const allergen of allergies) {
        const keywords = allergenMatches[allergen] || [];
        const isMatch =
          keywords.some((keyword) => ingNameLower.includes(keyword) || ingCatLower.includes(keyword)) ||
          ingNameLower.includes(allergen.toLowerCase().replace('_', ' '));
        if (isMatch) {
          warnings.push({
            severity: 'CRITICAL',
            message: `⚠️ ${ingredient.ingredientName} may contain ${allergen} — this conflicts with the user's declared ${allergen} restriction`,
          });
        }
      }
    }

    if (userProfile) {
      if (conditions.includes('DIABETES') && updatedMealPlan.carbsG > 60) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High carb load (${updatedMealPlan.carbsG.toFixed(1)}g) — user is diabetic. Typical safe range is under 60g per meal.`,
        });
      }
      if (conditions.includes('HYPERTENSION')) {
        let totalSodium = 0;
        let hasSodiumData = false;

        const foodItemIds = updatedMealPlan.ingredients.map((i) => i.foodItemId).filter(Boolean) as string[];

        if (foodItemIds.length > 0) {
          const foodItems = await prisma.foodItem.findMany({
            where: { id: { in: foodItemIds } },
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
            message: `⚠️ High sodium estimate (${totalSodium.toFixed(0)}mg) — user has hypertension.`,
          });
        }
      }
      if (conditions.includes('HEART_CONDITION') && updatedMealPlan.fatG > 20) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High fat content (${updatedMealPlan.fatG.toFixed(1)}g) — user has a heart condition.`,
        });
      }
      if (conditions.includes('KIDNEY_DISEASE') && updatedMealPlan.proteinG > 40) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High protein load (${updatedMealPlan.proteinG.toFixed(1)}g) — user has kidney disease. Protein restriction may be required.`,
        });
      }
      if (conditions.includes('PREGNANT')) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ User is pregnant — verify meal is suitable for prenatal nutrition requirements.`,
        });
      }

      if (userProfile.dailyCalorieTarget && updatedMealPlan.calories > userProfile.dailyCalorieTarget * 0.5) {
        const percentage = ((updatedMealPlan.calories / userProfile.dailyCalorieTarget) * 100).toFixed(0);
        warnings.push({
          severity: 'NOTICE',
          message: `⚠️ This meal alone is ${percentage}% of the user's daily calorie target (${updatedMealPlan.calories.toFixed(0)} kcal / ${userProfile.dailyCalorieTarget.toFixed(0)} kcal daily).`,
        });
      }
    }

    const estimatedIngredients = updatedMealPlan.ingredients.filter((ing) => ing.dataSource === 'GEMINI_ESTIMATED');
    if (estimatedIngredients.length > 0) {
      const names = estimatedIngredients.map((ing) => ing.ingredientName).join(', ');
      warnings.push({
        severity: 'IMPORTANT',
        message: `⚠️ ${estimatedIngredients.length} ingredient(s) have AI-estimated nutrition data, not FNRI verified: [${names}]`,
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
        safetyEntries: safetyRestrictions.displayEntries,
      },
      ingredients: updatedMealPlan.ingredients.map((ing) => ({
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
      },
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

    if (plan.claimedByNutritionistId !== nutritionistProfileId || !plan.claimedAt || plan.claimedAt < claimCutoff) {
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

    const dietaryTags = [plan.user.userProfile?.dietaryPreference, plan.user.userProfile?.goal].filter(
      Boolean
    ) as string[];

    const mealName = updates?.mealName !== undefined ? updates.mealName : plan.mealName;
    const description = updates?.description !== undefined ? updates.description : plan.description;
    const calories = updates?.calories !== undefined ? parseFloat(updates.calories as any) : plan.calories;
    const proteinG = updates?.proteinG !== undefined ? parseFloat(updates.proteinG as any) : plan.proteinG;
    const carbsG = updates?.carbsG !== undefined ? parseFloat(updates.carbsG as any) : plan.carbsG;
    const fatG = updates?.fatG !== undefined ? parseFloat(updates.fatG as any) : plan.fatG;

    if (plan.highRiskReviewRequired && plan.reviewApprovalCount === 0) {
      await prisma.$transaction(
        async (tx) => {
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

          await recordCompletedMealPlanReviewCredit(tx, {
            nutritionistProfileId,
            actorUserId: reviewer.userId,
            mealPlanId,
            stage: 'HIGH_RISK_ESCALATION',
            outcome: 'ESCALATED',
            earnedAt: now,
          });

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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return { success: true, awaitingSecondReview: true };
    }

    await prisma.$transaction(
      async (tx) => {
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
            action: plan.highRiskReviewRequired ? 'MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL' : 'MEAL_PLAN_APPROVED',
            entityType: 'MealPlan',
            entityId: mealPlanId,
            metadata: { policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION },
          },
        });
        await recordCompletedMealPlanReviewCredit(tx, {
          nutritionistProfileId,
          actorUserId: reviewer.userId,
          mealPlanId,
          stage: plan.highRiskReviewRequired ? 'HIGH_RISK_SECOND' : 'ORDINARY_FINAL',
          outcome: 'APPROVED',
          earnedAt: now,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

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
        user: { include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true } },
      },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be rejected.');
    }

    if (plan.claimedByNutritionistId !== nutritionistProfileId || !plan.claimedAt || plan.claimedAt < claimCutoff) {
      throw new Error('You must hold an active claim before rejecting this meal. Please reopen it from the queue.');
    }

    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      select: { userId: true },
    });
    if (!reviewer) throw new Error('Nutritionist profile not found.');

    await prisma.$transaction(
      async (tx) => {
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
        await recordCompletedMealPlanReviewCredit(tx, {
          nutritionistProfileId,
          actorUserId: reviewer.userId,
          mealPlanId,
          stage: plan.highRiskReviewRequired && plan.reviewApprovalCount === 1 ? 'HIGH_RISK_SECOND' : 'ORDINARY_FINAL',
          outcome: 'REJECTED',
          earnedAt: now,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Generate a replacement only after the rejection decision commits.
    try {
      const profile = plan.user.userProfile;
      const safetyRestrictions = adaptUserSafetyRestrictions({
        safetyEntries: plan.user.safetyProfileEntries,
        healthConditions: plan.user.healthConditions.map((item) => item.condition),
        allergies: plan.user.allergies.map((item) => item.allergen),
        otherConditions: profile?.otherConditions,
        otherAllergies: profile?.otherAllergies,
      });
      const conditions = [...safetyRestrictions.conditions, ...safetyRestrictions.customConditions];
      const allergens = [...safetyRestrictions.allergies, ...safetyRestrictions.customFoodRestrictions];

      const prompt =
        `Generate a single replacement ${plan.mealType} meal for a Filipino patient with these constraints:\n` +
        `- Daily Calorie Target: ${profile?.dailyCalorieTarget || 2000} kcal\n` +
        `- Health Conditions: ${conditions.join(', ') || 'NONE'}\n` +
        `- Food restrictions to EXCLUDE or REVIEW: ${allergens.join(', ') || 'NONE'}\n` +
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
}
