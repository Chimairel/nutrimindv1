import {
  AIConfidenceFlag,
  AssuranceTier,
  HealthConditionType,
  MealCandidateProvenance,
  MealPlanStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import {
  getMealSlotCalorieDeviation,
  isMealWithinSlotCalorieRange,
  isPrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  queryEligibleLibraryMeals,
} from './meal-library-candidate-query.service';
import { buildBaseServingPersistence } from './meal-plan-serving.service';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { scorePreparationCandidate } from '@/domain/upcoming-preparation.policy';

export class CertifiedSlotFallbackService {
  static async replaceWithBestCertified(input: {
    mealPlanId: string;
    tolerance: number;
    reasonCode: string;
    expectedStatus?: MealPlanStatus;
  }): Promise<{ replaced: boolean; replacementPlanId: string | null }> {
    const target = await prisma.mealPlan.findUnique({
      where: { id: input.mealPlanId },
      include: { cycle: { include: { snapshot: true } } },
    });
    if (!target || !target.cycle.snapshot) return { replaced: false, replacementPlanId: null };
    if (!isPrimaryMealType(target.mealType)) return { replaced: false, replacementPlanId: null };
    const slotType = target.mealType;
    if (target.cycle.shoppingStartedAt) return { replaced: false, replacementPlanId: null };
    if (input.expectedStatus && target.status !== input.expectedStatus) {
      return { replaced: false, replacementPlanId: null };
    }
    const pinnedSelection = await prisma.mealPlan.findFirst({
      where: {
        planGroupId: target.planGroupId,
        scheduledDate: target.scheduledDate,
        mealType: target.mealType,
        status: MealPlanStatus.APPROVED,
        userSelectionPinnedAt: { not: null },
      },
      select: { id: true },
    });
    if (pinnedSelection) return { replaced: false, replacementPlanId: null };

    const context = await loadUserNutritionContext(prisma, target.userId, 'User profile is unavailable for fallback.');
    const usedIds = new Set(
      (
        await prisma.mealPlan.findMany({
          where: {
            planGroupId: target.planGroupId,
            libraryMealId: { not: null },
            status: { in: [MealPlanStatus.APPROVED, MealPlanStatus.PENDING_REVIEW] },
          },
          select: { libraryMealId: true },
        })
      ).flatMap((meal) => (meal.libraryMealId ? [meal.libraryMealId] : []))
    );
    const candidates = await queryEligibleLibraryMeals({
      mealType: slotType,
      userConditions: context.conditions,
      userAllergens: context.allergens,
      profile: { ...context.profile, userId: target.userId, safetyEntries: context.user.safetyProfileEntries },
      limit: 120,
    });
    const ranked = candidates
      .filter((candidate) => candidate.id !== target.libraryMealId)
      .filter((candidate) =>
        isMealWithinSlotCalorieRange({
          calories: candidate.calories,
          dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
          mealType: slotType,
          tolerance: input.tolerance,
        })
      )
      .sort((left, right) => {
        const repetition = Number(usedIds.has(left.id)) - Number(usedIds.has(right.id));
        if (repetition) return repetition;
        return (
          getMealSlotCalorieDeviation({
            calories: left.calories,
            dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
            mealType: slotType,
          }) -
            getMealSlotCalorieDeviation({
              calories: right.calories,
              dailyCalorieTarget: target.cycle.snapshot!.dailyCalorieTarget,
              mealType: slotType,
            }) ||
          left.usageCount - right.usageCount ||
          left.id.localeCompare(right.id)
        );
      });
    const candidate = ranked[0];
    if (!candidate) return { replaced: false, replacementPlanId: null };

    const ranking = scorePreparationCandidate({
      activeClearanceCoverage: true,
      allergenDeclarationsComplete: true,
      ingredientsResolved: candidate.ingredients.every((ingredient) => Boolean(ingredient.foodItemId)),
      nutrientsComplete: [candidate.calories, candidate.proteinG, candidate.carbsG, candidate.fatG].every(
        Number.isFinite
      ),
      dietCompatible: true,
      remainingReviews: 0,
      calorieDeviationRatio:
        getMealSlotCalorieDeviation({
          calories: candidate.calories,
          dailyCalorieTarget: target.cycle.snapshot.dailyCalorieTarget,
          mealType: slotType,
        }) / target.cycle.snapshot.dailyCalorieTarget,
      mealTypeMatch: true,
      ricePreference: target.cycle.snapshot.ricePreference,
      riceRole: candidate.riceRole,
      riceRoleReviewStatus: candidate.riceRoleReviewStatus,
      usedInRecentCycle: usedIds.has(candidate.id),
    });
    const conditions = context.conditions.filter(
      (condition): condition is HealthConditionType => condition !== HealthConditionType.NONE
    );

    return prisma.$transaction(async (tx) => {
      const latestTarget = await tx.mealPlan.findUniqueOrThrow({ where: { id: target.id } });
      if (input.expectedStatus && latestTarget.status !== input.expectedStatus) {
        return { replaced: false, replacementPlanId: null };
      }
      const currentPinnedSelection = await tx.mealPlan.findFirst({
        where: {
          planGroupId: target.planGroupId,
          scheduledDate: target.scheduledDate,
          mealType: target.mealType,
          status: MealPlanStatus.APPROVED,
          userSelectionPinnedAt: { not: null },
        },
        select: { id: true },
      });
      if (currentPinnedSelection) return { replaced: false, replacementPlanId: null };
      const latest = await tx.mealLibrary.findUniqueOrThrow({
        where: { id: candidate.id },
        include: certifiedLibraryMealInclude,
      });
      if (
        !isCertifiedLibraryMealCompatible(latest, context.conditions, context.allergens, {
          ...context.profile,
          userId: target.userId,
          safetyEntries: context.user.safetyProfileEntries,
        })
      ) {
        throw new Error('Certified fallback evidence changed during selection.');
      }
      const ingredients = latest.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        category: ingredient.category,
        foodItemId: ingredient.foodItemId,
        dataSource: ingredient.dataSource,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      }));
      const serving = buildBaseServingPersistence({
        ...latest,
        mealType: slotType,
        recipeSignature: latest.recipeSignature,
        ingredients,
        evidenceSource: 'CERTIFIED_DEADLINE_OR_REJECTION_FALLBACK',
      });
      const replacement = await tx.mealPlan.create({
        data: {
          planGroupId: target.planGroupId,
          userId: target.userId,
          status: MealPlanStatus.APPROVED,
          candidateProvenance: MealCandidateProvenance.CERTIFIED_LIBRARY,
          libraryMealId: latest.id,
          nutritionistId: latest.safetyReviewedByNutritionistId,
          planType: target.planType,
          mealType: slotType,
          mealName: latest.mealName,
          description: latest.description,
          calories: latest.calories,
          proteinG: latest.proteinG,
          carbsG: latest.carbsG,
          fatG: latest.fatG,
          aiConfidenceFlag: AIConfidenceFlag.SAFE,
          scheduledDate: target.scheduledDate,
          reviewedAt: latest.safetyReviewedAt,
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          highRiskReviewRequired: target.cycle.assuranceTier === AssuranceTier.ENHANCED,
          reviewApprovalCount: target.cycle.assuranceTier === AssuranceTier.ENHANCED ? 2 : 1,
          candidateRank: 1,
          rankingScore: ranking.score,
          rankingReasonCodes: [...ranking.reasonCodes, input.reasonCode],
          fallbackAvailable: ranked.length > 1,
          selectionEvidence: {
            schemaVersion: 1,
            source: 'VERIFIED_LIBRARY',
            fallbackReasonCode: input.reasonCode,
            rankingScore: ranking.score,
            rankingReasonCodes: ranking.reasonCodes,
            capturedAt: new Date().toISOString(),
          } as Prisma.InputJsonObject,
          ingredients: { create: ingredients },
          ...serving,
        },
      });
      for (const condition of conditions) {
        const clearance = latest.conditionClearances.find(
          (item) =>
            item.condition === condition &&
            item.state === 'ACTIVE' &&
            item.recipeSignature === latest.recipeSignature &&
            item.evidenceRevision === latest.safetyEvidenceRevision &&
            (!item.userScopeId || item.userScopeId === target.userId) &&
            (!item.expiresAt || item.expiresAt > new Date())
        );
        if (!clearance) throw new Error('Certified fallback condition clearance changed during selection.');
        await tx.mealPlanClearanceUsage.create({
          data: {
            mealPlanId: replacement.id,
            clearanceId: clearance.id,
            condition,
            composedServingSignature: replacement.composedServingSignature,
          },
        });
      }
      await tx.mealPlan.update({
        where: { id: target.id },
        data: {
          status:
            target.status === MealPlanStatus.REJECTED || target.status === MealPlanStatus.DISPUTED
              ? target.status
              : MealPlanStatus.CANCELLED,
          supersededByMealPlanId: replacement.id,
          fallbackAvailable: true,
        },
      });
      await tx.mealLibrary.update({ where: { id: latest.id }, data: { usageCount: { increment: 1 } } });
      await tx.auditEvent.create({
        data: {
          actorUserId: null,
          action: 'MEAL_PLAN_SLOT_CERTIFIED_FALLBACK_SELECTED',
          entityType: 'MealPlan',
          entityId: replacement.id,
          metadata: { supersededMealPlanId: target.id, reasonCode: input.reasonCode },
        },
      });
      return { replaced: true, replacementPlanId: replacement.id };
    });
  }
}
