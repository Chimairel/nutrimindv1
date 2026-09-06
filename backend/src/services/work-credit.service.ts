import { Prisma } from '@prisma/client';
import { decideWorkCreditAward, WorkCreditKind, ReviewOutcome } from '@/domain/nutritionist-compensation.policy';

export const WORK_CREDIT_POLICY_VERSION = 'work-credit-v1';

export async function recordCompletedMealPlanReviewCredit(
  tx: Prisma.TransactionClient,
  input: {
    nutritionistProfileId: string;
    actorUserId: string;
    mealPlanId: string;
    stage: 'ORDINARY_FINAL' | 'HIGH_RISK_ESCALATION' | 'HIGH_RISK_SECOND';
    outcome: ReviewOutcome;
    earnedAt: Date;
  },
): Promise<{ id: string }> {
  const creditKind: WorkCreditKind = input.stage === 'HIGH_RISK_SECOND'
    ? 'HIGH_RISK_SECOND_REVIEW'
    : 'ORDINARY_PLAN_REVIEW';
  const sourceActionKey = `meal-plan-review:${input.mealPlanId}:${input.stage.toLowerCase()}`;
  const existing = await tx.nutritionistWorkCredit.findUnique({ where: { sourceActionKey } });
  const decision = decideWorkCreditAward({
    creditKind,
    sourceActionKey,
    sourceOutcome: input.outcome,
    existingSourceActionKeys: new Set(existing ? [sourceActionKey] : []),
  });
  if (decision.decision === 'DUPLICATE') {
    if (!existing || existing.nutritionistProfileId !== input.nutritionistProfileId || existing.creditKind !== creditKind || existing.sourceOutcome !== input.outcome || existing.sourceEntityId !== input.mealPlanId) {
      throw new Error('The completed-review action key is already bound to different credit evidence.');
    }
    return { id: existing.id };
  }
  const credit = await tx.nutritionistWorkCredit.create({
    data: {
      nutritionistProfileId: input.nutritionistProfileId,
      entryType: 'AWARD',
      creditKind,
      sourceActionKey,
      sourceEntityType: 'MealPlanReview',
      sourceEntityId: input.mealPlanId,
      sourceOutcome: input.outcome,
      unitsMillis: decision.unitsMillis,
      policyVersion: WORK_CREDIT_POLICY_VERSION,
      earnedAt: input.earnedAt,
      reasonCode: 'ELIGIBLE_COMPLETED_REVIEW',
    },
  });
  await tx.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      action: 'NUTRITIONIST_WORK_CREDIT_AWARDED',
      entityType: 'NutritionistWorkCredit',
      entityId: credit.id,
      metadata: {
        creditKind,
        policyVersion: WORK_CREDIT_POLICY_VERSION,
        sourceEntityType: 'MealPlanReview',
        sourceOutcome: input.outcome,
      },
    },
  });
  return { id: credit.id };
}
