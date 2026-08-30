import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
  const [plannedDuplicates, dailyDuplicates] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT "mealPlanId" FROM "MealLog"
        WHERE "mealPlanId" IS NOT NULL
        GROUP BY "mealPlanId" HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT "userId", "logDate" FROM "DailyNutritionLog"
        GROUP BY "userId", "logDate" HAVING COUNT(*) > 1
      ) duplicate_groups
    `,
  ]);

  const result = {
    plannedMealDuplicateGroups: plannedDuplicates[0]?.count ?? 0,
    dailyAggregateDuplicateGroups: dailyDuplicates[0]?.count ?? 0,
  };
  console.log(JSON.stringify(result));
  if (result.plannedMealDuplicateGroups || result.dailyAggregateDuplicateGroups) {
    process.exitCode = 2;
  }
}

main().finally(() => prisma.$disconnect());
