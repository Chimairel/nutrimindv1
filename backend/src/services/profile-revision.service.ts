import { Prisma } from '@prisma/client';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { calculateDailyTarget } from '@/lib/calculations';

/** Shared transaction boundary: serialize profile changes against report publication and swaps. */
export async function lockUserProfile(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

export async function advanceProfileRevision(tx: Prisma.TransactionClient, userId: string) {
  const profile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
  const conditions = await tx.healthCondition.findMany({ where: { userId } });
  const target =
    profile.age && profile.heightCm && profile.weightKg && profile.goal && profile.activityLevel
      ? calculateDailyTarget({
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          goal: profile.goal,
          activityLevel: profile.activityLevel,
          biologicalSex: profile.biologicalSex as 'MALE' | 'FEMALE' | undefined,
          hasPregnantCondition: conditions.some((item) => item.condition === 'PREGNANT'),
        }).dailyCalorieTarget
      : profile.dailyCalorieTarget;
  const updated = await tx.userProfile.update({
    where: { userId },
    data: { revision: { increment: 1 }, dailyCalorieTarget: target },
  });
  await tx.nutritionReport.updateMany({ where: { userId }, data: { isStale: true, acknowledgedAt: null } });
  await tx.mealPlan.updateMany({
    where: {
      userId,
      scheduledDate: { gte: getStartOfManilaBusinessDay() },
      status: { in: ['APPROVED', 'PENDING_REVIEW'] },
      mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
    },
    data: {
      status: 'PENDING_REVIEW',
      requiresSafetyRevalidation: true,
      reviewApprovalCount: 0,
      firstApprovedByNutritionistId: null,
      firstApprovedAt: null,
      nutritionistId: null,
      reviewedAt: null,
      claimedByNutritionistId: null,
      claimedAt: null,
    },
  });
  await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
  return updated;
}
