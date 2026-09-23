import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MealPlanCycleStatus, MealPlanStatus, MealType, PlanType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { GroceryService } from '../src/services/grocery.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';

const day = 86_400_000;

async function main() {
  const run = randomUUID();
  let userId: string | null = null;
  let libraryMealId: string | null = null;
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 5 Grocery Fixture',
        email: `batch5-${run}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 60,
            targetWeightKg: 60,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            dailyCalorieTarget: 1900,
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    userId = user.id;
    const recipeSignature = randomUUID().replaceAll('-', '');
    const libraryMeal = await prisma.mealLibrary.create({
      data: {
        mealName: `Batch 5 cleared meal ${run}`,
        mealType: MealType.BREAKFAST,
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        recipeSignature,
        status: 'APPROVED',
        safetyEvidenceStatus: 'COMPLETE',
      },
    });
    libraryMealId = libraryMeal.id;

    const now = new Date();
    const progressiveId = `batch5-progressive-${run}`;
    const startDate = new Date(now.getTime() + 2 * day);
    await prisma.mealPlanCycle.create({
      data: {
        id: progressiveId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate,
        endDate: new Date(startDate.getTime() + 6 * day),
        preparationOpensAt: new Date(now.getTime() - day),
        shoppingDeadlineAt: new Date(now.getTime() + day),
        expectedSlotCount: 2,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    const cleared = await prisma.mealPlan.create({
      data: {
        planGroupId: progressiveId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.APPROVED,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: libraryMeal.mealName,
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: startDate,
        reviewedAt: now,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Chicken', category: 'Meat', quantity: 500, unit: 'g' } },
      },
    });
    const pending = await prisma.mealPlan.create({
      data: {
        planGroupId: progressiveId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.LUNCH,
        mealName: 'Pending candidate',
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: startDate,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Brown rice', category: 'Grain', quantity: 300, unit: 'g' } },
      },
    });
    const delayedCompeting = await prisma.mealPlan.create({
      data: {
        planGroupId: progressiveId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: 'Delayed competing candidate',
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: startDate,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Late salt', category: 'Seasoning', quantity: 5, unit: 'g' } },
      },
    });

    const preview = await GroceryService.getCycleProjection(user.id, progressiveId, now);
    assert.equal(preview.coverage.clearedSlotCount, 1);
    assert.equal(preview.coverage.unresolvedSlotCount, 1);
    assert.equal(preview.actionability.canCheckItems, false);
    assert.equal(preview.actionability.canExportPdf, false);
    assert.deepEqual(
      preview.groceryList?.groceryItems.map((item) => item.ingredientName),
      ['Chicken']
    );

    await prisma.mealPlan.update({
      where: { id: pending.id },
      data: { status: MealPlanStatus.APPROVED, reviewedAt: now },
    });
    await prisma.groceryList.updateMany({ where: { planGroupId: progressiveId }, data: { isStale: true } });
    const ready = await GroceryService.getCycleProjection(user.id, progressiveId, now);
    assert.equal(ready.coverage.clearedSlotCount, 2);
    assert.equal(ready.actionability.canCheckItems, true);
    assert.equal(ready.actionability.canExportPdf, true);
    assert.deepEqual(ready.groceryList?.groceryItems.map((item) => item.ingredientName).sort(), [
      'Brown rice',
      'Chicken',
    ]);

    await MealPlanCycleService.startShopping(user.id, progressiveId, now);
    await prisma.mealPlan.update({
      where: { id: delayedCompeting.id },
      data: { status: MealPlanStatus.APPROVED, reviewedAt: new Date(now.getTime() + 1_000) },
    });
    await prisma.groceryList.updateMany({ where: { planGroupId: progressiveId }, data: { isStale: true } });
    const frozen = await GroceryService.getCycleProjection(user.id, progressiveId, new Date(now.getTime() + 2_000));
    assert.equal(frozen.actionability.canCheckItems, true);
    assert.equal(frozen.groceryList?.isStale, false);
    assert.equal(
      frozen.groceryList?.groceryItems.some((item) => item.ingredientName === 'Late salt'),
      false
    );

    const incompleteId = `batch5-incomplete-${run}`;
    const incompleteStart = new Date(now.getTime() + 3 * day);
    await prisma.mealPlanCycle.create({
      data: {
        id: incompleteId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: incompleteStart,
        endDate: new Date(incompleteStart.getTime() + 6 * day),
        preparationOpensAt: new Date(now.getTime() - 2 * day),
        shoppingDeadlineAt: new Date(now.getTime() - 1_000),
        expectedSlotCount: 2,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    await prisma.mealPlan.create({
      data: {
        planGroupId: incompleteId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.APPROVED,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: libraryMeal.mealName,
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: incompleteStart,
        reviewedAt: now,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Eggs', category: 'Protein', quantity: 6, unit: 'piece' } },
      },
    });
    const incomplete = await GroceryService.getCycleProjection(user.id, incompleteId, now);
    assert.equal(incomplete.cycle.status, MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE);
    assert.equal(incomplete.actionability.requiresIncompleteAcknowledgment, true);
    assert.equal(incomplete.actionability.canExportPdf, false);
    await MealPlanCycleService.acknowledgeIncompleteCycle(user.id, incompleteId, now);
    const accepted = await GroceryService.getCycleProjection(user.id, incompleteId, now);
    assert.equal(accepted.actionability.isIncomplete, true);
    assert.equal(accepted.actionability.canCheckItems, true);
    assert.equal(accepted.actionability.canExportPdf, true);

    assert.ok(cleared.id);
    console.log('[Batch 5 acceptance] PASS');
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (libraryMealId) await prisma.mealLibrary.delete({ where: { id: libraryMealId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 5 acceptance] FAIL', error);
  process.exitCode = 1;
});
