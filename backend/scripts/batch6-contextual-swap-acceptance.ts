import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MealPlanStatus, MealType, PlanType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { MealSwapService } from '../src/services/meal-swap.service';
import { GroceryService } from '../src/services/grocery.service';
import { CertifiedSlotFallbackService } from '../src/services/certified-slot-fallback.service';

const day = 86_400_000;

async function main() {
  const run = randomUUID();
  let userId: string | null = null;
  const fixtureMealIds: string[] = [];
  const today = getStartOfManilaBusinessDay();
  try {
    const template = await prisma.mealLibrary.findFirstOrThrow({
      where: {
        status: 'APPROVED',
        safetyEvidenceStatus: 'COMPLETE',
        recipeSignature: { not: null },
        mealType: MealType.BREAKFAST,
      },
      include: { ingredients: true, safetyDeclarations: true },
    });
    assert.ok(template.verifiedByNutritionistId && template.safetyReviewedByNutritionistId);
    const user = await prisma.user.create({
      data: {
        name: 'Batch 6 Swap Fixture',
        email: `batch6-${run}@example.invalid`,
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
            ricePreference: 'FLEXIBLE',
            dailyCalorieTarget: 1300,
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    userId = user.id;

    const makeMeal = async (label: string, calories: number, ingredientName: string) => {
      const name = `Batch 6 ${label} ${run}`;
      const ingredients = [
        {
          ingredientName,
          foodItemId: template.ingredients[0].foodItemId,
          category: 'Other',
          dataSource: 'FNRI' as const,
          quantity: 100,
          unit: 'g',
        },
      ];
      const signature = buildMealLibraryRecipeSignature({
        mealName: name,
        mealType: MealType.BREAKFAST,
        calories,
        proteinG: 20,
        carbsG: 45,
        fatG: 15,
        ingredients,
      });
      const row = await prisma.mealLibrary.create({
        data: {
          mealName: name,
          mealType: MealType.BREAKFAST,
          calories,
          proteinG: 20,
          carbsG: 45,
          fatG: 15,
          recipeSignature: signature,
          verifiedByNutritionistId: template.verifiedByNutritionistId,
          safetyReviewedByNutritionistId: template.safetyReviewedByNutritionistId,
          safetyReviewedAt: new Date(),
          safetyEvidenceStatus: 'COMPLETE',
          safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
          safetyEvidenceRevision: 1,
          certifiedEvidenceRevision: 1,
          safetyPolicyVersion: template.safetyPolicyVersion,
          conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
          allergenDeclarationState: template.allergenDeclarationState,
          crossContactAssessment: template.crossContactAssessment,
          dietaryTags: template.dietaryTags ?? ['OMNIVORE'],
          riceRole: 'STANDALONE',
          riceRoleReviewStatus: 'REVIEWED',
          ingredients: { create: ingredients.map((ingredient, position) => ({ ...ingredient, position })) },
          applicableMealTypes: {
            create: { mealType: MealType.BREAKFAST, source: 'NUTRITIONIST_REVIEW', reviewStatus: 'REVIEWED' },
          },
          safetyDeclarations: {
            create: template.safetyDeclarations.map((declaration) => ({
              declarationType: declaration.declarationType,
              canonicalKey: declaration.canonicalKey,
              customKey: declaration.customKey,
              provenance: declaration.provenance,
              policyVersion: declaration.policyVersion,
            })),
          },
        },
      });
      fixtureMealIds.push(row.id);
      return row;
    };
    const original = await makeMeal('original', 360, 'Fixture oats');
    const favorite = await makeMeal('favorite', 380, 'Fixture banana');
    const other = await makeMeal('other', 360, 'Fixture milk');
    await prisma.mealFavorite.create({ data: { userId: user.id, mealLibraryId: favorite.id } });

    const makeCycle = async (id: string, startDate: Date, status: 'ACTIVE' | 'UNDER_REVIEW') => {
      await prisma.mealPlanCycle.create({
        data: {
          id,
          userId: user.id,
          planType: PlanType.WEEKLY,
          startDate,
          endDate: new Date(startDate.getTime() + 6 * day),
          preparationOpensAt: new Date(startDate.getTime() - 4 * day),
          shoppingDeadlineAt: new Date(startDate.getTime() - day),
          expectedSlotCount: 1,
          status,
        },
      });
      const plan = await prisma.mealPlan.create({
        data: {
          planGroupId: id,
          userId: user.id,
          libraryMealId: original.id,
          status: MealPlanStatus.APPROVED,
          planType: PlanType.WEEKLY,
          mealType: MealType.BREAKFAST,
          mealName: original.mealName,
          calories: original.calories,
          proteinG: original.proteinG,
          carbsG: original.carbsG,
          fatG: original.fatG,
          scheduledDate: startDate,
          reviewedAt: new Date(),
          requiresSafetyRevalidation: false,
          safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
          baseRecipeSignature: original.recipeSignature,
          composedServingSignature: original.recipeSignature,
          ingredients: { create: { ingredientName: 'Fixture oats', category: 'Other', quantity: 100, unit: 'g' } },
        },
      });
      await GroceryService.generateGroceryList(user.id, undefined, id);
      return plan;
    };
    const current = await makeCycle(`batch6-current-${run}`, today, 'ACTIVE');
    const upcoming = await makeCycle(`batch6-upcoming-${run}`, new Date(today.getTime() + 7 * day), 'UNDER_REVIEW');
    const competingPending = await prisma.mealPlan.create({
      data: {
        planGroupId: upcoming.planGroupId,
        userId: user.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: `Batch 6 pending competitor ${run}`,
        calories: 365,
        proteinG: 20,
        carbsG: 45,
        fatG: 15,
        scheduledDate: upcoming.scheduledDate,
      },
    });

    const currentOptions = await MealSwapService.getEligibleSwapOptions(user.id, current.id);
    assert.equal(currentOptions.swapOptions[0]?.id, favorite.id, 'Eligible favorite must rank first.');
    assert.ok(currentOptions.swapOptions.some((option) => option.id === other.id));
    assert.ok(currentOptions.swapOptions.every((option) => option.id !== original.id));
    await prisma.mealLibrary.update({ where: { id: other.id }, data: { safetyEvidenceStatus: 'INCOMPLETE' } });
    const pendingOptions = await MealSwapService.getEligibleSwapOptions(user.id, current.id);
    assert.ok(
      pendingOptions.swapOptions.every((option) => option.id !== other.id),
      'Pending meals cannot be swap options.'
    );
    await prisma.mealLibrary.update({ where: { id: other.id }, data: { safetyEvidenceStatus: 'COMPLETE' } });

    const upcomingOptions = await MealSwapService.getEligibleSwapOptions(user.id, upcoming.id);
    assert.ok(upcomingOptions.swapOptions.some((option) => option.id === favorite.id));
    await prisma.mealPlanCycle.update({
      where: { id: upcoming.planGroupId },
      data: { shoppingStartedAt: new Date(), status: 'SHOPPING_STARTED' },
    });
    const upcomingPreview = await MealSwapService.getSwapPreview(user.id, upcoming.id, favorite.id);
    assert.equal(upcomingPreview.groceryDeltaAcknowledgmentRequired, true);
    assert.ok(upcomingPreview.shoppingNeeds.length > 0);
    assert.ok(upcomingPreview.shoppingRemovals.length > 0);
    await assert.rejects(
      MealSwapService.swapMeal(
        user.id,
        upcoming.id,
        favorite.id,
        false,
        true,
        upcomingPreview.previewToken,
        upcomingPreview.requestKey
      ),
      /Acknowledge the grocery additions and removals/
    );
    await MealSwapService.swapMeal(
      user.id,
      upcoming.id,
      favorite.id,
      false,
      true,
      upcomingPreview.previewToken,
      upcomingPreview.requestKey,
      true
    );
    await MealSwapService.swapMeal(
      user.id,
      upcoming.id,
      favorite.id,
      false,
      true,
      upcomingPreview.previewToken,
      upcomingPreview.requestKey,
      true
    );
    assert.equal(await prisma.swapLog.count({ where: { mealPlanId: upcoming.id } }), 1);
    assert.ok((await prisma.mealPlan.findUniqueOrThrow({ where: { id: upcoming.id } })).userSelectionPinnedAt);
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: competingPending.id } })).status,
      MealPlanStatus.CANCELLED
    );
    assert.deepEqual(
      await CertifiedSlotFallbackService.replaceWithBestCertified({
        mealPlanId: competingPending.id,
        tolerance: 0.25,
        reasonCode: 'BATCH6_PIN_TEST',
      }),
      { replaced: false, replacementPlanId: null }
    );
    const upcomingList = await prisma.groceryList.findFirstOrThrow({
      where: { planGroupId: upcoming.planGroupId },
      include: { groceryItems: true },
    });
    assert.ok(upcomingList.groceryItems.some((item) => item.ingredientName === 'Fixture banana'));

    const suspendedPreview = await MealSwapService.getSwapPreview(user.id, current.id, favorite.id);
    await prisma.mealLibrary.update({ where: { id: favorite.id }, data: { status: 'FLAGGED' } });
    const flaggedOptions = await MealSwapService.getEligibleSwapOptions(user.id, current.id);
    assert.ok(
      flaggedOptions.swapOptions.every((option) => option.id !== favorite.id),
      'A flagged favorite cannot cross the hard filter.'
    );
    await assert.rejects(
      MealSwapService.swapMeal(
        user.id,
        current.id,
        favorite.id,
        false,
        true,
        suspendedPreview.previewToken,
        suspendedPreview.requestKey
      ),
      /changed|not available|not certified/
    );
    await prisma.mealLibrary.update({ where: { id: favorite.id }, data: { status: 'APPROVED' } });
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: current.id } })).libraryMealId, original.id);

    const rollbackPreview = await MealSwapService.getSwapPreview(user.id, current.id, other.id);
    const rebuild = GroceryService.generateGroceryList;
    try {
      GroceryService.generateGroceryList = async () => {
        throw new Error('Fixture grocery rebuild failure');
      };
      await assert.rejects(
        MealSwapService.swapMeal(
          user.id,
          current.id,
          other.id,
          false,
          true,
          rollbackPreview.previewToken,
          rollbackPreview.requestKey
        ),
        /Fixture grocery rebuild failure/
      );
    } finally {
      GroceryService.generateGroceryList = rebuild;
    }
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: current.id } })).libraryMealId, original.id);
    assert.equal(await prisma.swapLog.count({ where: { mealPlanId: current.id } }), 0);

    await prisma.dailyNutritionLog.create({
      data: {
        userId: user.id,
        logDate: today,
        totalCalories: 999,
        totalProteinG: 99,
        totalCarbsG: 99,
        totalFatG: 99,
        targetCalories: 1300,
        adherencePct: 20,
      },
    });
    const currentPreview = await MealSwapService.getSwapPreview(user.id, current.id, other.id);
    await MealSwapService.swapMeal(
      user.id,
      current.id,
      other.id,
      false,
      true,
      currentPreview.previewToken,
      currentPreview.requestKey
    );
    const [currentPlan, daily] = await Promise.all([
      prisma.mealPlan.findUniqueOrThrow({ where: { id: current.id } }),
      prisma.dailyNutritionLog.findFirstOrThrow({ where: { userId: user.id, logDate: today } }),
    ]);
    assert.equal(currentPlan.libraryMealId, other.id);
    assert.equal(daily.totalCalories, 0);
    console.log('[Batch 6 contextual swap acceptance] PASS');
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    for (const id of fixtureMealIds) await prisma.mealLibrary.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 6 contextual swap acceptance] FAIL', error);
  process.exitCode = 1;
});
