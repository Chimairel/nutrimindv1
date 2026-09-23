import prisma from '@/lib/prisma';

import { MealPlanStatus, NotificationType } from '@prisma/client';

import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { GroceryService } from '@/services/grocery.service';

export async function resolveMealPlanDispute(
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
