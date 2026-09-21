import { assertMealSlotCalories } from '@/domain/generated-plan-calories.policy';
import prisma from '@/lib/prisma';
import { lockUserProfile } from './profile-revision.service';
import { MealPlanStatus, AIConfidenceFlag, NotificationType, MealIngredientDataSource, Prisma } from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getNutritionistReviewableMealPlanWhere } from '@/domain/meal-actionability.policy';
import { getReviewClaimCutoff, getReviewPriority, isReviewClaimActive } from '@/domain/nutritionist-review.policy';
import { recordCompletedMealPlanReviewCredit } from '@/services/work-credit.service';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { GroceryService } from '@/services/grocery.service';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { NutritionistReplacementService } from './nutritionist-replacement.service';
import { classifyMealIngredients } from '@/domain/meal-ingredient-classification.policy';
import { evaluateApprovedConditionRules } from './condition-rule.service';
import { getNutritionistApprovedMeals } from './nutritionist-approved-meals.service';

export class NutritionistReviewService {
  static async getReviewQueue(nutritionistProfileId?: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    // Show the whole shared queue, including items actively claimed by peers.
    const reviewer = nutritionistProfileId
      ? await prisma.nutritionistProfile.findUnique({
          where: { id: nutritionistProfileId },
          select: { canLeadReview: true },
        })
      : null;
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
    const visibleMeals = pendingMeals.filter((meal) => {
      const secondReview = meal.highRiskReviewRequired && meal.reviewApprovalCount === 1;
      if (!secondReview) return true;
      return reviewer?.canLeadReview === true && meal.firstApprovedByNutritionistId !== nutritionistProfileId;
    });
    const sorted = visibleMeals.sort((a, b) => {
      const aEscalated = a.highRiskReviewRequired && a.reviewApprovalCount === 1 ? 0 : 1;
      const bEscalated = b.highRiskReviewRequired && b.reviewApprovalCount === 1 ? 0 : 1;
      if (aEscalated !== bEscalated) return aEscalated - bEscalated;
      return getReviewPriority(a.aiConfidenceFlag) - getReviewPriority(b.aiConfidenceFlag);
    });

    const result = sorted.map((meal) => {
      const isBlindSecondReview = meal.highRiskReviewRequired && meal.reviewApprovalCount === 1;
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
        aiConfidenceFlag: meal.requiresSafetyRevalidation ? AIConfidenceFlag.NEEDS_REVIEW : meal.aiConfidenceFlag,
        requiresSafetyRevalidation: meal.requiresSafetyRevalidation,
        planType: meal.planType,
        nutritionistNote: isBlindSecondReview ? null : meal.nutritionistNote,
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
    const [reviewer, reviewTarget] = await Promise.all([
      prisma.nutritionistProfile.findUnique({
        where: { id: nutritionistProfileId },
        select: { canLeadReview: true },
      }),
      prisma.mealPlan.findUnique({
        where: { id: mealPlanId },
        select: { highRiskReviewRequired: true, reviewApprovalCount: true, firstApprovedByNutritionistId: true },
      }),
    ]);
    if (!reviewer || !reviewTarget) throw new Error('Meal plan or nutritionist profile not found.');
    if (reviewTarget.highRiskReviewRequired && reviewTarget.reviewApprovalCount === 1) {
      if (!reviewer.canLeadReview) throw new Error('Lead review capability is required for this second review.');
      if (reviewTarget.firstApprovedByNutritionistId === nutritionistProfileId) {
        throw new Error('A different nutritionist must perform the independent second review.');
      }
    }

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

    const ingredientClassification = classifyMealIngredients(
      updatedMealPlan.ingredients.map((ingredient) => ({
        name: ingredient.ingredientName,
        category: ingredient.category,
      }))
    );
    for (const allergen of allergies) {
      if (ingredientClassification.detectedAllergens.includes(allergen as any)) {
        warnings.push({
          severity: 'CRITICAL',
          message: `A deterministic ingredient match found ${allergen}, which conflicts with the user's declared restriction.`,
        });
      }
    }

    const conditionRuleResults = await evaluateApprovedConditionRules({
      conditions,
      ingredientNames: updatedMealPlan.ingredients.map((ingredient) => ingredient.ingredientName),
      nutrients: {
        calories: updatedMealPlan.calories,
        proteinG: updatedMealPlan.proteinG,
        carbsG: updatedMealPlan.carbsG,
      },
      bodyWeightKg: userProfile?.weightKg,
    });
    for (const result of conditionRuleResults.nutrientEvaluations) {
      if (result.evaluation.decision !== 'PASS') {
        warnings.push({
          severity:
            result.evaluation.decision === 'FAIL' && result.rule.severity === 'HARD_BLOCK' ? 'CRITICAL' : 'IMPORTANT',
          message:
            result.evaluation.decision === 'FAIL'
              ? `${result.condition}: approved rule ${result.rule.id} was violated (${result.evaluation.measuredValue} vs ${result.rule.threshold} ${result.rule.unit}).`
              : `${result.condition}: approved rule ${result.rule.id} could not be evaluated because required nutrient or daily context is missing.`,
        });
      }
    }
    for (const result of conditionRuleResults.ingredientMatches) {
      warnings.push({
        severity: result.rule.severity === 'HARD_BLOCK' ? 'CRITICAL' : 'IMPORTANT',
        message: `${result.condition}: approved ingredient rule ${result.rule.ingredientCategory} matched ${result.matches.join(', ')}.`,
      });
    }
    for (const condition of conditionRuleResults.uncoveredConditions) {
      warnings.push({
        severity: 'IMPORTANT',
        message: `${condition}: no active approved deterministic rules cover this condition; manual nutritionist clearance is required.`,
      });
    }

    if (userProfile) {
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

    if (updatedMealPlan.requiresSafetyRevalidation)
      warnings.push({
        severity: 'IMPORTANT',
        message:
          'Profile or supporting evidence changed. Recheck this meal against the current diet, restrictions and target before deciding. Previous automated triage is no longer current.',
      });
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
        aiConfidenceFlag: updatedMealPlan.requiresSafetyRevalidation
          ? AIConfidenceFlag.NEEDS_REVIEW
          : updatedMealPlan.aiConfidenceFlag,
        requiresSafetyRevalidation: updatedMealPlan.requiresSafetyRevalidation,
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
        quantity: ing.quantity,
        unit: ing.unit,
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
      select: { userId: true, canLeadReview: true },
    });
    if (!reviewer) throw new Error('Nutritionist profile not found.');
    if (plan.highRiskReviewRequired && plan.reviewApprovalCount === 1 && !reviewer.canLeadReview) {
      throw new Error('Lead review capability is required for this second review.');
    }

    const mealName = updates?.mealName !== undefined ? updates.mealName : plan.mealName;
    const description = updates?.description !== undefined ? updates.description : plan.description;
    const calories = updates?.calories !== undefined ? parseFloat(updates.calories as any) : plan.calories;
    const proteinG = updates?.proteinG !== undefined ? parseFloat(updates.proteinG as any) : plan.proteinG;
    const carbsG = updates?.carbsG !== undefined ? parseFloat(updates.carbsG as any) : plan.carbsG;
    const fatG = updates?.fatG !== undefined ? parseFloat(updates.fatG as any) : plan.fatG;

    assertMealSlotCalories(calories, plan.user.userProfile?.dailyCalorieTarget ?? 2000, plan.mealType);

    if (plan.highRiskReviewRequired && plan.reviewApprovalCount === 0) {
      await prisma.$transaction(
        async (tx) => {
          await lockUserProfile(tx, plan.userId);
          const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId: plan.userId } });
          if ('user' in plan && currentProfile.revision !== plan.user.userProfile?.revision)
            throw new Error('User information changed. Reopen this review.');
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

          await tx.mealPlanReviewDecision.create({
            data: {
              mealPlanId,
              nutritionistProfileId,
              stage: 'PRIMARY',
              decision: 'APPROVE',
              rationale: note?.trim() || null,
              evidenceSnapshot: {
                mealName,
                calories,
                proteinG,
                carbsG,
                fatG,
                policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              },
            },
          });

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
        await lockUserProfile(tx, plan.userId);
        const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId: plan.userId } });
        if ('user' in plan && currentProfile.revision !== plan.user.userProfile?.revision)
          throw new Error('User information changed. Reopen this review.');
        await tx.groceryList.updateMany({ where: { userId: plan.userId }, data: { isStale: true } });
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

        await tx.mealPlanReviewDecision.create({
          data: {
            mealPlanId,
            nutritionistProfileId,
            stage: plan.highRiskReviewRequired ? 'SECONDARY' : 'PRIMARY',
            decision: 'APPROVE',
            rationale: note?.trim() || null,
            evidenceSnapshot: {
              mealName,
              calories,
              proteinG,
              carbsG,
              fatG,
              policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            },
          },
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
            metadata: {
              policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
              reusableEvidencePublished: false,
              reusableEvidenceRequiresExplicitAction: true,
            },
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

  static async resolveMealPlanDispute(
    nutritionistProfileId: string,
    mealPlanId: string,
    decision: 'APPROVE' | 'REJECT',
    rationale: string
  ) {
    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      select: { userId: true, isVerified: true, prcLicenseExpiry: true, canLeadReview: true },
    });
    if (!reviewer || !reviewer.isVerified || reviewer.prcLicenseExpiry < new Date() || !reviewer.canLeadReview) {
      throw new Error('A currently eligible Lead nutritionist is required for dispute adjudication.');
    }
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: { reviewDecisions: true },
    });
    if (!plan || plan.status !== MealPlanStatus.DISPUTED) throw new Error('Disputed meal plan not found.');
    if (plan.reviewDecisions.some((item) => item.nutritionistProfileId === nutritionistProfileId)) {
      throw new Error('Dispute adjudication requires a Lead who did not submit either disputed decision.');
    }
    const now = new Date();
    const status = decision === 'APPROVE' ? MealPlanStatus.APPROVED : MealPlanStatus.REJECTED;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.mealPlanReviewDecision.create({
        data: {
          mealPlanId,
          nutritionistProfileId,
          stage: 'DISPUTE_RESOLUTION',
          decision,
          rationale: rationale.trim(),
          evidenceSnapshot: {
            mealName: plan.mealName,
            calories: plan.calories,
            proteinG: plan.proteinG,
            carbsG: plan.carbsG,
            fatG: plan.fatG,
            policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          },
        },
      });
      const result = await tx.mealPlan.update({
        where: { id: mealPlanId },
        data: {
          status,
          nutritionistId: nutritionistProfileId,
          nutritionistNote: rationale.trim(),
          reviewedAt: now,
          requiresSafetyRevalidation: status !== MealPlanStatus.APPROVED,
          reviewApprovalCount: status === MealPlanStatus.APPROVED ? 2 : plan.reviewApprovalCount,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'MEAL_PLAN_DISPUTE_RESOLVED',
          entityType: 'MealPlan',
          entityId: mealPlanId,
          metadata: { decision },
        },
      });
      await tx.notification.create({
        data: {
          userId: plan.userId,
          title: decision === 'APPROVE' ? 'Meal review completed' : 'Meal removed after review',
          message:
            decision === 'APPROVE'
              ? `A Lead dietitian completed adjudication for "${plan.mealName}".`
              : `A Lead dietitian rejected "${plan.mealName}" after independent review.`,
          type: decision === 'APPROVE' ? NotificationType.PLAN_APPROVED : NotificationType.PLAN_REJECTED,
        },
      });
      return result;
    });
    if (status === MealPlanStatus.APPROVED) {
      try {
        await GroceryService.generateGroceryList(plan.userId);
      } catch (error) {
        console.error('[NutritionistService] Grocery projection refresh failed after dispute resolution:', error);
      }
    }
    return updated;
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
      select: { userId: true, canLeadReview: true },
    });
    if (!reviewer) throw new Error('Nutritionist profile not found.');
    const isSecondReview = plan.highRiskReviewRequired && plan.reviewApprovalCount === 1;
    if (isSecondReview) {
      if (!reviewer.canLeadReview) throw new Error('Lead review capability is required for this second review.');
      if (plan.firstApprovedByNutritionistId === nutritionistProfileId) {
        throw new Error('A different nutritionist must perform the independent second review.');
      }
    }

    await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, plan.userId);
        const currentProfile = await tx.userProfile.findUniqueOrThrow({ where: { userId: plan.userId } });
        if ('user' in plan && currentProfile.revision !== plan.user.userProfile?.revision)
          throw new Error('User information changed. Reopen this review.');
        const decision = await tx.mealPlan.updateMany({
          where: {
            id: mealPlanId,
            status: MealPlanStatus.PENDING_REVIEW,
            claimedByNutritionistId: nutritionistProfileId,
            claimedAt: { gte: claimCutoff },
          },
          data: {
            status: isSecondReview ? MealPlanStatus.DISPUTED : MealPlanStatus.REJECTED,
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

        await tx.mealPlanReviewDecision.create({
          data: {
            mealPlanId,
            nutritionistProfileId,
            stage: isSecondReview ? 'SECONDARY' : 'PRIMARY',
            decision: 'REJECT',
            rationale: reason.trim(),
            evidenceSnapshot: {
              mealName: plan.mealName,
              calories: plan.calories,
              proteinG: plan.proteinG,
              carbsG: plan.carbsG,
              fatG: plan.fatG,
              policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: plan.userId,
            title: isSecondReview ? 'Meal review requires adjudication' : 'Meal Plan Needs Changes ⚠️',
            message: isSecondReview
              ? `Independent reviewers disagreed about "${plan.mealName}". It is blocked pending Lead adjudication.`
              : `Your meal "${plan.mealName}" was flagged by a dietitian: ${reason.trim().replace(/[.!?]+$/, '')}. A replacement is being generated.`,
            type: NotificationType.PLAN_REJECTED,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: isSecondReview ? 'MEAL_PLAN_REVIEW_DISPUTED' : 'MEAL_PLAN_REJECTED',
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

    if (isSecondReview) return { success: true, disputed: true };

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

      const replacement = await generateGenerativeJSON<any>(prompt, undefined, undefined, {
        operation: 'MEAL_REPLACEMENT',
        purpose: 'REJECTED_MEAL_REPLACEMENT',
      });

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
   * Generates a real-time candidate replacement meal based on the nutritionist's
   * rejection reason as an explicit negative constraint, without committing to the DB.
   */
  static generateReplacementCandidate = NutritionistReplacementService.generateReplacementCandidate;
  static replaceAndApproveMealPlan = NutritionistReplacementService.replaceAndApproveMealPlan;

  static async getApprovedMeals(nutritionistProfileId: string) {
    return getNutritionistApprovedMeals(nutritionistProfileId);
  }
}
