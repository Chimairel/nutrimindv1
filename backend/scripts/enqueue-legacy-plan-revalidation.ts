import prisma from '../src/lib/prisma';
import { MealPlanStatus } from '@prisma/client';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';

async function main() {
  const apply = process.argv.includes('--apply');
  const where = {
    status: MealPlanStatus.APPROVED,
    requiresSafetyRevalidation: true,
    scheduledDate: { gte: getStartOfManilaBusinessDay() },
  } as const;
  const candidateCount = await prisma.mealPlan.count({ where });

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', candidateCount }));
    return;
  }
  if (candidateCount === 0) {
    console.log(JSON.stringify({ mode: 'apply', candidateCount, updatedCount: 0 }));
    return;
  }

  const updatedCount = await prisma.$transaction(async (tx) => {
    const result = await tx.mealPlan.updateMany({
      where,
      data: {
        status: MealPlanStatus.PENDING_REVIEW,
        safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        reviewApprovalCount: 0,
        firstApprovedByNutritionistId: null,
        firstApprovedAt: null,
        claimedByNutritionistId: null,
        claimedAt: null,
      },
    });
    await tx.auditEvent.create({
      data: {
        action: 'LEGACY_PLAN_REVALIDATION_ENQUEUED',
        entityType: 'MealPlanBatch',
        metadata: {
          count: result.count,
          policyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
          scope: 'CURRENT_AND_FUTURE_APPROVED_REVALIDATION_REQUIRED',
        },
      },
    });
    return result.count;
  });

  console.log(JSON.stringify({ mode: 'apply', candidateCount, updatedCount }));
}

main()
  .catch((error) => {
    console.error('[Legacy plan remediation] Failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
