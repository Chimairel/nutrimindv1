import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { queryEligibleLibraryMeals } from '../src/services/meal-library-candidate-query.service';
import { getNextWeeklyCycleWindow } from '../src/domain/meal-plan-cycle.policy';

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.BATCH10_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Full-library-plan acceptance requires a disposable loopback database.');
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('Disable GEMINI_API_KEY for this certified-library-only acceptance.');
  }
  const id = randomUUID();
  const email = `batch10-full-plan-${id}@example.invalid`;
  let userId: string | null = null;
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 10 Full Plan Fixture',
        email,
        passwordHash: 'disabled',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        userProfile: {
          create: {
            age: 28,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 55,
            targetWeightKg: 55,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            dailyCalorieTarget: 1200,
            shoppingDayGroup: 'WEEKEND',
            shoppingDayOfWeek: 6,
          },
        },
        healthConditions: { create: { condition: 'NONE' } },
        allergies: { create: { allergen: 'NONE' } },
        nutritionReport: {
          create: {
            acknowledgedAt: new Date(),
            foodsToAvoid: [],
            foodsToLimit: [],
            foodsRecommended: [],
            drinksGuidance: [],
            generalSummary: 'Synthetic full-plan acceptance report.',
            basedOnConditions: [],
            basedOnAllergies: [],
          },
        },
      },
    });
    userId = user.id;
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
      const eligible = await queryEligibleLibraryMeals({
        mealType,
        dailyCalorieTarget: 1200,
        userConditions: [],
        userAllergens: [],
        profile: { ...profile, userId },
      });
      console.log(`[Batch 10 full library plan] ${mealType}: ${eligible.length} certified eligible meals`);
      assert.ok(eligible.length >= 7, `Insufficient certified ${mealType} meals for a seven-day plan.`);
    }
    const plannedWeek = getNextWeeklyCycleWindow(profile, new Date(Date.now() + 7 * 86_400_000));
    const aiUsageBefore = await prisma.aiUsageEvent.count();
    const planGroupId = await MealGenerationService.generateWindowOnce(userId, {
      planType: 'WEEKLY',
      numDays: 7,
      startDate: plannedWeek.startDate,
    });
    const plans = await prisma.mealPlan.findMany({ where: { planGroupId } });
    assert.equal(plans.length, 21);
    assert.ok(plans.every((plan) => plan.status === 'APPROVED' && Boolean(plan.libraryMealId)));
    assert.equal(new Set(plans.map((plan) => plan.libraryMealId)).size, 21);
    assert.equal(await prisma.groceryList.count({ where: { planGroupId } }), 1);
    assert.equal(await prisma.aiUsageEvent.count(), aiUsageBefore, 'A full certified plan must not invoke Gemini.');
    console.log('[Batch 10 full library plan] PASS: 21 distinct certified slots and upcoming groceries');
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[Batch 10 full library plan] FAIL', error);
  process.exitCode = 1;
});
