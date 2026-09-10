import type { Prisma } from '@prisma/client';

export async function assertGenerationIntegrity(
  tx: Prisma.TransactionClient,
  userId: string,
  start: Date,
  end: Date,
  revisions: Map<string, number>
) {
  const foods = await tx.foodItem.findMany({
    where: { id: { in: [...revisions.keys()] } },
    select: { id: true, compositionRevision: true },
  });
  if (foods.length !== revisions.size || foods.some((food) => food.compositionRevision !== revisions.get(food.id)))
    throw new Error('Food composition changed during generation. Please retry.');
  const existing = await tx.mealPlan.findMany({
    where: { userId, status: { in: ['APPROVED', 'PENDING_REVIEW'] }, scheduledDate: { gte: start, lte: end } },
    select: { planGroupId: true, mealLogs: { where: { status: { in: ['DONE', 'SKIPPED'] } }, select: { id: true } } },
  });
  const purchased = await tx.groceryItem.count({
    where: {
      purchasedQuantity: { gt: 0 },
      groceryList: { userId, planGroupId: { in: existing.map((meal) => meal.planGroupId) } },
    },
  });
  if (purchased || existing.some((meal) => meal.mealLogs.length))
    throw new Error(
      'This cycle already has purchases or logged meals. Swap individual uneaten meals to preserve your shopping and history.'
    );
}
