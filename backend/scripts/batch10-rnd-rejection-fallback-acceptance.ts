import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { getNextWeeklyCycleWindow } from '../src/domain/meal-plan-cycle.policy';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { NutritionistReviewService } from '../src/services/nutritionist-review.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { aggregateGroceryIngredients, groceryItemKey } from '../src/domain/grocery-quantity.policy';

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.BATCH10_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('RND rejection acceptance requires a disposable loopback database.');
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('Disable GEMINI_API_KEY so this test proves the certified fallback is used.');
  }

  const id = randomUUID();
  const reviewer = await prisma.nutritionistProfile.findFirstOrThrow({
    where: { user: { email: 'nutritionist@gmail.com' }, isVerified: true },
  });
  let userId: string | null = null;
  let fallbackLibraryId: string | null = null;
  let initialUsageCount: number | null = null;
  let rejectedPlanId: string | null = null;
  let unavailablePlanId: string | null = null;
  let fallbackAuditPlanId: string | null = null;
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 10 RND Rejection Fixture',
        email: `batch10-rejection-${id}@example.invalid`,
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
            generalSummary: 'Synthetic RND rejection acceptance report.',
            basedOnConditions: [],
            basedOnAllergies: [],
          },
        },
      },
    });
    userId = user.id;
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const window = getNextWeeklyCycleWindow(profile, new Date(Date.now() + 7 * 86_400_000));
    const cycleId = await MealGenerationService.generateWindowOnce(userId, {
      planType: 'WEEKLY',
      numDays: 7,
      startDate: window.startDate,
    });
    const original = await prisma.mealPlan.findFirstOrThrow({
      where: { planGroupId: cycleId, mealType: 'BREAKFAST', status: 'APPROVED' },
      orderBy: { scheduledDate: 'asc' },
    });
    const beforeList = await prisma.groceryList.findUniqueOrThrow({ where: { planGroupId: cycleId } });
    await prisma.mealPlan.update({ where: { id: original.id }, data: { status: 'CANCELLED' } });
    const pending = await prisma.mealPlan.create({
      data: {
        planGroupId: cycleId,
        userId,
        status: 'PENDING_REVIEW',
        mealType: 'BREAKFAST',
        mealName: 'Synthetic candidate for RND rejection',
        calories: original.calories,
        proteinG: original.proteinG,
        carbsG: original.carbsG,
        fatG: original.fatG,
        scheduledDate: original.scheduledDate,
        aiConfidenceFlag: 'NEEDS_REVIEW',
        requiresSafetyRevalidation: true,
      },
    });
    rejectedPlanId = pending.id;
    await NutritionistReviewService.getReviewCardDetails(reviewer.id, pending.id, true);
    const usageBefore = new Map(
      (await prisma.mealLibrary.findMany({ select: { id: true, usageCount: true } })).map((meal) => [
        meal.id,
        meal.usageCount,
      ])
    );
    const aiCallsBefore = await prisma.aiUsageEvent.count();
    const decision = await NutritionistReviewService.rejectMealPlan(
      reviewer.id,
      pending.id,
      'Synthetic ingredient evidence is insufficient.'
    );
    assert.ok(
      'replacementPlanId' in decision && decision.replacementPlanId,
      'Rejection must select a certified fallback.'
    );
    const replacementPlanId = decision.replacementPlanId;
    const [rejected, replacement, list, decisions, audit] = await Promise.all([
      prisma.mealPlan.findUniqueOrThrow({ where: { id: pending.id } }),
      prisma.mealPlan.findUniqueOrThrow({ where: { id: replacementPlanId } }),
      prisma.groceryList.findUniqueOrThrow({ where: { planGroupId: cycleId }, include: { groceryItems: true } }),
      prisma.mealPlanReviewDecision.findMany({ where: { mealPlanId: pending.id } }),
      prisma.auditEvent.findFirst({
        where: {
          entityType: 'MealPlan',
          entityId: replacementPlanId,
          action: 'MEAL_PLAN_SLOT_CERTIFIED_FALLBACK_SELECTED',
        },
      }),
    ]);
    fallbackLibraryId = replacement.libraryMealId;
    fallbackAuditPlanId = replacement.id;
    initialUsageCount = fallbackLibraryId ? (usageBefore.get(fallbackLibraryId) ?? null) : null;
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.supersededByMealPlanId, replacement.id);
    assert.equal(replacement.status, 'APPROVED');
    assert.equal(replacement.candidateProvenance, 'CERTIFIED_LIBRARY');
    assert.ok(replacement.libraryMealId);
    // The cancelled fixture selection is still a valid certified option. The
    // rejected candidate itself is synthetic and has no library authority.
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].decision, 'REJECT');
    assert.ok(audit);
    assert.equal(list.isStale, false);
    assert.ok(list.generatedAt >= beforeList.generatedAt);
    assert.equal(await prisma.aiUsageEvent.count(), aiCallsBefore, 'Certified fallback must not invoke Gemini.');

    const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(userId, cycleId);
    assert.equal(clearedIds.length, 21);
    const sameSlot = await prisma.mealPlan.findMany({
      where: { planGroupId: cycleId, scheduledDate: pending.scheduledDate, mealType: 'BREAKFAST', status: 'APPROVED' },
    });
    assert.deepEqual(
      sameSlot.map((meal) => meal.id),
      [replacement.id]
    );
    const clearedMeals = await prisma.mealPlan.findMany({
      where: { id: { in: clearedIds } },
      include: {
        ingredients: true,
        servingComponents: { where: { componentType: 'COOKED_RICE' }, include: { foodItem: true } },
      },
    });
    const expectedItems = aggregateGroceryIngredients(
      clearedMeals.flatMap((meal) => [
        ...meal.ingredients.map((item) => ({
          ingredientName: item.ingredientName,
          category: item.category || 'Other',
          quantity: item.quantity,
          unit: item.unit,
        })),
        ...meal.servingComponents.flatMap((component) =>
          component.foodItem && component.quantityG
            ? [
                {
                  ingredientName: component.foodItem.name,
                  category: component.foodItem.category || 'Rice and grains',
                  quantity: component.quantityG,
                  unit: 'g',
                },
              ]
            : []
        ),
      ])
    );
    const actual = new Map(
      list.groceryItems.map((item) => [groceryItemKey(item.ingredientName, item.unit), item.quantity])
    );
    assert.equal(actual.size, expectedItems.length);
    for (const item of expectedItems) assert.equal(actual.get(item.key), item.quantity);

    // A higher-calorie breakfast has no certified option in this 51-meal
    // catalogue. With an empty raw corpus and disabled Gemini, rejection must
    // remain visibly unavailable instead of pretending a replacement exists.
    const laterWindow = getNextWeeklyCycleWindow(profile, new Date(Date.now() + 40 * 86_400_000));
    const laterCycleId = `batch10-rejection-unavailable-${id}`;
    const laterDeadline = new Date(laterWindow.startDate.getTime() - 86_400_000);
    await prisma.mealPlanCycle.create({
      data: {
        id: laterCycleId,
        userId,
        planType: 'WEEKLY',
        startDate: laterWindow.startDate,
        endDate: laterWindow.endDate,
        preparationOpensAt: new Date(laterWindow.startDate.getTime() - 5 * 86_400_000),
        shoppingDeadlineAt: laterDeadline,
        expectedSlotCount: 21,
        status: 'UNDER_REVIEW',
        snapshot: {
          create: {
            userId,
            profileRevision: profile.revision,
            safetyRevision: profile.safetyRevision,
            weightKg: profile.weightKg!,
            activityLevel: profile.activityLevel!,
            goal: profile.goal!,
            dailyCalorieTarget: 2000,
            dailyMacroTargets: { proteinG: 100, carbsG: 250, fatG: 70 },
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'FLEXIBLE',
            ricePreferenceProvenance: 'DEFAULTED',
            planningGeographyLevel: 'NATIONAL',
            mealLocalityPreference: 'NATIONAL',
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    const unavailable = await prisma.mealPlan.create({
      data: {
        planGroupId: laterCycleId,
        userId,
        status: 'PENDING_REVIEW',
        planType: 'WEEKLY',
        mealType: 'BREAKFAST',
        mealName: 'Synthetic high-target candidate for rejection',
        calories: 600,
        proteinG: 30,
        carbsG: 70,
        fatG: 20,
        scheduledDate: laterWindow.startDate,
        aiConfidenceFlag: 'NEEDS_REVIEW',
      },
    });
    unavailablePlanId = unavailable.id;
    await NutritionistReviewService.getReviewCardDetails(reviewer.id, unavailable.id, true);
    const unavailableDecision = await NutritionistReviewService.rejectMealPlan(
      reviewer.id,
      unavailable.id,
      'Synthetic ingredient evidence is insufficient.'
    );
    assert.equal(unavailableDecision.replacementPlanId, null);
    assert.equal(unavailableDecision.replacementUnavailable, true);
    const [unavailableAfter, unavailableNotice, unavailableAudit] = await Promise.all([
      prisma.mealPlan.findUniqueOrThrow({ where: { id: unavailable.id } }),
      prisma.notification.findFirst({ where: { userId, title: 'No reviewed replacement available yet' } }),
      prisma.auditEvent.findFirst({
        where: { entityType: 'MealPlan', entityId: unavailable.id, action: 'MEAL_PLAN_REPLACEMENT_UNAVAILABLE' },
      }),
    ]);
    assert.equal(unavailableAfter.status, 'REJECTED');
    assert.equal(unavailableAfter.supersededByMealPlanId, null);
    assert.ok(unavailableNotice);
    assert.ok(unavailableAudit);
    assert.equal(await prisma.groceryList.count({ where: { planGroupId: laterCycleId } }), 0);
    const deadlineResult = await UpcomingPlanPreparationService.reconcileDeadline(
      userId,
      laterCycleId,
      new Date(laterDeadline.getTime() + 60_000)
    );
    assert.equal(deadlineResult?.status, 'INCOMPLETE_AT_DEADLINE');
    console.log(
      '[Batch 10 RND rejection] PASS: certified fallback, 21 cleared slots and matching groceries; unavailable high-target slot stayed blocked and became incomplete at deadline'
    );
  } finally {
    if (userId) {
      await prisma.mealPlanReviewDecision.deleteMany({ where: { mealPlan: { userId } } });
      await prisma.user.delete({ where: { id: userId } });
    }
    if (rejectedPlanId || unavailablePlanId || fallbackAuditPlanId) {
      await prisma.auditEvent.deleteMany({
        where: {
          entityType: 'MealPlan',
          entityId: {
            in: [rejectedPlanId, unavailablePlanId, fallbackAuditPlanId].filter((value): value is string =>
              Boolean(value)
            ),
          },
        },
      });
    }
    if (fallbackLibraryId && initialUsageCount !== null) {
      await prisma.mealLibrary.updateMany({
        where: { id: fallbackLibraryId, usageCount: initialUsageCount + 1 },
        data: { usageCount: initialUsageCount },
      });
    }
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[Batch 10 RND rejection] FAIL', error);
  process.exitCode = 1;
});
