import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getStartOfManilaBusinessDay, getNutritionEligibleMealLogWhere } from '@/domain/meal-actionability.policy';
import { resolvePlanTargetCalories } from '@/domain/plan-cycle-target.policy';

export async function recalculateDailyNutritionLog(
  userId: string,
  date: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const startOfDay = getStartOfManilaBusinessDay(date);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

  // Find if a DailyNutritionLog exists for this day
  const existingLog = await client.dailyNutritionLog.findFirst({
    where: {
      userId,
      logDate: startOfDay,
    },
  });

  if (!existingLog) return; // If no log exists for this day yet, nothing to recalculate

  // Fetch all DONE meal logs for this day
  const mealLogs = await client.mealLog.findMany({
    where: {
      userId,
      status: 'DONE',
      ...getNutritionEligibleMealLogWhere(),
      loggedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const scheduledPlan = await client.mealPlan.findFirst({
    where: { userId, scheduledDate: { gte: startOfDay, lte: endOfDay } },
    orderBy: { createdAt: 'desc' },
    select: { planGroupId: true },
  });
  const [profile, cycleSnapshot] = await Promise.all([
    client.userProfile.findUnique({ where: { userId } }),
    scheduledPlan
      ? client.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: scheduledPlan.planGroupId } })
      : Promise.resolve(null),
  ]);
  const targetCalories = resolvePlanTargetCalories(
    cycleSnapshot?.dailyCalorieTarget,
    profile?.dailyCalorieTarget,
    2000
  );

  let totalCalories = 0;
  let totalProteinG = 0;
  let totalCarbsG = 0;
  let totalFatG = 0;

  for (const log of mealLogs) {
    totalCalories += log.calories;
    totalProteinG += log.proteinG;
    totalCarbsG += log.carbsG;
    totalFatG += log.fatG;
  }

  let adherencePct = 0;
  if (totalCalories > 0) {
    const deviationPct = Math.abs((totalCalories - targetCalories) / targetCalories) * 100;
    adherencePct = Math.max(0, 100 - deviationPct);
  }

  await client.dailyNutritionLog.update({
    where: { id: existingLog.id },
    data: {
      totalCalories,
      totalProteinG,
      totalCarbsG,
      totalFatG,
      targetCalories,
      adherencePct,
    },
  });
}
