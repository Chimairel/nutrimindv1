import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { MealGenerationService } from '../src/services/meal-generation.service';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'testuser@gmail.com' } });
  const startedAt = new Date();
  let planGroupId: string | null = null;
  try {
    planGroupId = await MealGenerationService.generate7DayPlan(
      user.id,
      'STARTER',
      1,
      new Date('2031-01-05T16:00:00.000Z')
    );
    const plans = await prisma.mealPlan.findMany({
      where: { planGroupId },
      include: { ingredients: true },
      orderBy: { mealType: 'asc' },
    });
    assert.equal(plans.length, 3);
    assert.ok(plans.some((plan) => plan.status === 'PENDING_REVIEW'));
    assert.ok(
      plans.every((plan) =>
        plan.candidateProvenance === 'CERTIFIED_LIBRARY'
          ? plan.status === 'APPROVED' && !plan.requiresSafetyRevalidation
          : plan.status === 'PENDING_REVIEW' && plan.requiresSafetyRevalidation
      )
    );
    assert.ok(plans.every((plan) => plan.ingredients.length > 0));
    assert.ok(
      plans.every((plan) =>
        ['CERTIFIED_LIBRARY', 'RAW_RECIPE_CORPUS', 'AI_FROM_SCRATCH'].includes(plan.candidateProvenance)
      )
    );
    assert.ok(
      plans
        .filter((plan) => plan.candidateProvenance === 'RAW_RECIPE_CORPUS')
        .every((plan) => Boolean(plan.sourceRawRecipeCandidateId))
    );
    const aiOperations = await prisma.aiUsageEvent.groupBy({
      by: ['operation', 'status'],
      where: { createdAt: { gte: startedAt } },
      _count: { _all: true },
    });
    assert.ok(!aiOperations.some((row) => row.operation === 'MEAL_PLAN_CORPUS_LOOKUP'));
    console.log(
      JSON.stringify(
        {
          pass: true,
          plans: plans.length,
          provenance: plans.reduce<Record<string, number>>((counts, plan) => {
            counts[plan.candidateProvenance] = (counts[plan.candidateProvenance] ?? 0) + 1;
            return counts;
          }, {}),
          statuses: [...new Set(plans.map((plan) => plan.status))],
          aiOperations,
        },
        null,
        2
      )
    );
  } finally {
    if (planGroupId) {
      await prisma.mealPlan.deleteMany({ where: { planGroupId } });
    }
    await prisma.notification.deleteMany({
      where: { userId: user.id, createdAt: { gte: startedAt }, title: 'New Meal Plan Awaiting Verification' },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
