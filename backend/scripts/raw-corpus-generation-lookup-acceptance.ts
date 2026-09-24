import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DietaryPreference, MealCandidateProvenance, MealType, PrismaClient } from '@prisma/client';
import { sourceRawRecipeCandidates } from '../src/services/raw-recipe-candidate.service';
import { prepareGeneratedMealIngredients } from '../src/services/meal-generation-ingredient-preparation.service';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { getNextWeeklyCycleWindow } from '../src/domain/meal-plan-cycle.policy';

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.BATCH10_DISPOSABLE_DB !== '1' || (host !== '127.0.0.1' && host !== 'localhost')) {
    throw new Error('Raw corpus acceptance requires a disposable loopback database.');
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('Disable GEMINI_API_KEY for the provider-free raw corpus acceptance.');
  }
  const prisma = new PrismaClient();
  let userId: string | null = null;
  try {
    const beforeAiCalls = await prisma.aiUsageEvent.count();
    const slots = Array.from({ length: 7 }, (_, dayIndex) =>
      [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER].map((mealType) => ({
        dayNumber: dayIndex + 1,
        mealType,
        scheduledDate: new Date(Date.UTC(2031, 0, dayIndex + 1)),
      }))
    ).flat();
    const startedAt = Date.now();
    const sourced = await sourceRawRecipeCandidates({
      slots,
      dailyCalorieTarget: 2000,
      dietaryPreference: DietaryPreference.OMNIVORE,
      conditions: [],
      allergens: [],
    });
    assert.equal(sourced.meals.length, 21, 'The indexed corpus should fill this ordinary 21-slot plan.');
    const prepared = await prepareGeneratedMealIngredients({
      meals: sourced.meals.map((meal) => ({
        ...meal,
        candidateProvenance: MealCandidateProvenance.RAW_RECIPE_CORPUS,
      })),
      unmatchedSlots: slots,
      startDate: slots[0].scheduledDate,
      userHasConditions: false,
      groundedFoodById: new Map(),
    });
    assert.equal(prepared.preparedMeals.length, sourced.meals.length);
    assert.ok(prepared.preparedMeals.every((meal) => meal.candidateProvenance === 'RAW_RECIPE_CORPUS'));
    assert.ok(prepared.preparedMeals.every((meal) => meal.ingredientsData.length > 0));
    assert.ok(
      prepared.preparedMeals.every((meal) =>
        meal.ingredientsData.every((ingredient) => ingredient.foodItemId || ingredient.dataSource === 'SOURCE_RECIPE')
      )
    );
    assert.equal(
      await prisma.aiUsageEvent.count(),
      beforeAiCalls,
      'Corpus lookup and FNRI reconciliation must make no AI calls.'
    );
    const fixture = await prisma.user.create({
      data: {
        name: 'Raw corpus plan fixture',
        email: `raw-corpus-${randomUUID()}@example.invalid`,
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
            dailyCalorieTarget: 2000,
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
            generalSummary: 'Synthetic raw-corpus acceptance report.',
            basedOnConditions: [],
            basedOnAllergies: [],
          },
        },
      },
    });
    userId = fixture.id;
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const week = getNextWeeklyCycleWindow(profile, new Date(Date.now() + 7 * 86_400_000));
    const planGroupId = await MealGenerationService.generateWindowOnce(userId, {
      planType: 'WEEKLY',
      numDays: 7,
      startDate: week.startDate,
    });
    const plans = await prisma.mealPlan.findMany({ where: { planGroupId } });
    assert.equal(plans.length, 21);
    assert.ok(
      plans.every((plan) =>
        plan.candidateProvenance === 'CERTIFIED_LIBRARY'
          ? plan.status === 'APPROVED'
          : plan.status === 'PENDING_REVIEW' && plan.requiresSafetyRevalidation
      )
    );
    assert.ok(plans.some((plan) => plan.candidateProvenance === 'RAW_RECIPE_CORPUS'));
    assert.equal(await prisma.aiUsageEvent.count(), beforeAiCalls, 'An ordinary 21-slot plan must not invoke Gemini.');
    console.log(
      JSON.stringify({
        pass: true,
        slotsFilled: sourced.meals.length,
        slotsRemaining: sourced.remainingSlots.length,
        planSlots: plans.length,
        pendingReview: plans.filter((plan) => plan.status === 'PENDING_REVIEW').length,
        ingredients: prepared.preparedMeals.reduce((sum, meal) => sum + meal.ingredientsData.length, 0),
        unresolvedIngredients: prepared.preparedMeals.reduce(
          (sum, meal) => sum + meal.ingredientsData.filter((ingredient) => !ingredient.foodItemId).length,
          0
        ),
        aiCalls: 0,
        elapsedMs: Date.now() - startedAt,
      })
    );
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
