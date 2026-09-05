import 'dotenv/config';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { COMMON_MEAL_CATALOGUE } from '../src/data/common-meal-catalogue';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
} from '../src/services/meal-swap.service';
import { GroceryService } from '../src/services/grocery.service';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { UserService } from '../src/services/user.service';

const FIXTURE_EMAIL = 'e2e.structured-replacement.acceptance@example.invalid';
const FIXTURE_PLAN_GROUP = 'e2e.structured-replacement.acceptance';
const managedNames = COMMON_MEAL_CATALOGUE.map((meal) => meal.mealName);

async function cleanupFixture() {
  await prisma.user.deleteMany({ where: { email: FIXTURE_EMAIL } });
}

async function main() {
  if (process.env.ALLOW_STRUCTURED_REPLACEMENT_ACCEPTANCE !== 'true') {
    throw new Error(
      'Mutation gate closed. This fixture creates one reserved user/plan/grocery set and temporarily increments one existing managed meal usageCount. Set ALLOW_STRUCTURED_REPLACEMENT_ACCEPTANCE=true only after explicit approval of that exact scope and rollback.'
    );
  }

  const managedMeals = await prisma.mealLibrary.findMany({
    where: {
      mealName: { in: managedNames },
      status: 'APPROVED',
      safetyEvidenceStatus: 'COMPLETE',
      safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
      flags: { none: { status: 'PENDING' } },
    },
    include: certifiedLibraryMealInclude,
  });
  assert.equal(managedMeals.length, 49, 'Acceptance requires the exact 49-meal certified managed catalogue.');
  const usageSnapshot = new Map(managedMeals.map((meal) => [meal.id, meal.usageCount]));

  const eggProfile = {
    dietaryPreference: 'OMNIVORE',
    goal: 'MAINTAIN',
    otherConditions: null,
    otherAllergies: null,
    safetyEntries: [
      { domain: 'ALLERGY', canonicalCode: 'EGGS', displayName: 'Eggs', supportState: 'SUPPORTED' },
    ],
  } as const;
  const original = managedMeals.find((meal) =>
    meal.safetyDeclarations.some((declaration) =>
      declaration.declarationType === 'ALLERGEN_PRESENT' && declaration.canonicalKey === 'EGGS'
    ) && meal.ingredients.length > 0
  );
  assert.ok(original, 'Acceptance requires one certified managed meal with an explicit EGGS-present declaration.');
  const replacements = managedMeals.filter((meal) =>
    meal.mealType === original.mealType &&
    meal.id !== original.id &&
    isCertifiedLibraryMealCompatible(meal, [], [], eggProfile)
  );
  assert.ok(replacements.length > 0, 'Acceptance requires one certified egg-compatible replacement in the same meal slot.');

  let userId: string | null = null;
  let planId: string | null = null;
  let selectedReplacementId: string | null = null;
  let recheckAttempted = false;
  try {
    await cleanupFixture();
    const user = await prisma.user.create({
      data: {
        name: 'Structured Replacement Acceptance Fixture',
        email: FIXTURE_EMAIL,
        passwordHash: 'not-a-login-credential',
        emailVerified: true,
        userProfile: {
          create: {
            dietaryPreference: 'OMNIVORE',
            goal: 'MAINTAIN',
            dailyCalorieTarget: 2_000,
          },
        },
        nutritionReport: {
          create: {
            acknowledgedAt: new Date(),
            foodsToAvoid: [],
            foodsToLimit: [],
            foodsRecommended: [],
            drinksGuidance: [],
            generalSummary: 'Reserved structured replacement fixture.',
            basedOnConditions: [],
            basedOnAllergies: [],
          },
        },
      },
    });
    userId = user.id;
    const plan = await prisma.mealPlan.create({
      data: {
        planGroupId: FIXTURE_PLAN_GROUP,
        userId,
        libraryMealId: original.id,
        nutritionistId: original.verifiedByNutritionistId,
        status: 'APPROVED',
        mealType: original.mealType,
        mealName: original.mealName,
        description: original.description,
        calories: original.calories,
        proteinG: original.proteinG,
        carbsG: original.carbsG,
        fatG: original.fatG,
        scheduledDate: new Date(Date.now() + 86_400_000),
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        reviewApprovalCount: 1,
        ingredients: {
          create: original.ingredients.map((ingredient) => ({
            ingredientName: ingredient.ingredientName,
            category: ingredient.category,
            foodItemId: ingredient.foodItemId,
            dataSource: ingredient.dataSource,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
        },
      },
    });
    planId = plan.id;
    const groceryBefore = await GroceryService.generateGroceryList(userId);

    const inputs = [
      { domain: 'CONDITION' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
      { domain: 'ALLERGY' as const, value: 'EGGS', provenance: 'PREDEFINED' as const },
      { domain: 'INTOLERANCE' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
      { domain: 'AVOIDED_INGREDIENT' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
    ];
    const firstSave = await SafetyIntakeService.save(userId, inputs);
    assert.equal(firstSave.changed, true);
    recheckAttempted = true;
    await UserService.runSafetyRecheck(userId);

    const planAfter = await prisma.mealPlan.findUnique({
      where: { id: plan.id },
      include: { ingredients: true },
    });
    assert.ok(planAfter);
    selectedReplacementId = planAfter.libraryMealId;
    const [groceryAfter, revisionsAfter, reportAfter, replacementLog] = await Promise.all([
      GroceryService.getGroceryList(userId),
      prisma.healthProfileRevision.findMany({ where: { userId, revisionType: 'STRUCTURED_SAFETY_UPDATED' } }),
      prisma.nutritionReport.findUnique({ where: { userId } }),
      prisma.mealLog.findUnique({ where: { mealPlanId: plan.id } }),
    ]);
    assert.equal(planAfter.status, 'APPROVED');
    assert.equal(planAfter.requiresSafetyRevalidation, false);
    assert.notEqual(planAfter.libraryMealId, original.id);
    assert.ok(replacements.some((meal) => meal.id === planAfter.libraryMealId));
    assert.ok(groceryAfter);
    assert.notEqual(groceryAfter.id, groceryBefore.id);
    assert.deepEqual(
      new Set(groceryAfter.groceryItems.map((item) => item.ingredientName.toLowerCase())),
      new Set(planAfter.ingredients.map((item) => item.ingredientName.toLowerCase()))
    );
    assert.equal(revisionsAfter.length, 1);
    assert.equal(reportAfter?.acknowledgedAt, null);
    assert.equal(replacementLog?.source, 'SAFETY_REPLACED');

    const secondSave = await SafetyIntakeService.save(userId, inputs);
    await UserService.runSafetyRecheck(userId);
    const [planFinal, groceryFinal, revisionCountFinal] = await Promise.all([
      prisma.mealPlan.findUnique({ where: { id: plan.id } }),
      GroceryService.getGroceryList(userId),
      prisma.healthProfileRevision.count({ where: { userId, revisionType: 'STRUCTURED_SAFETY_UPDATED' } }),
    ]);
    assert.equal(secondSave.changed, false);
    assert.equal(planFinal?.libraryMealId, planAfter.libraryMealId);
    assert.equal(groceryFinal?.id, groceryAfter.id);
    assert.equal(revisionCountFinal, 1);

    console.log(JSON.stringify({
      passed: true,
      fixture: FIXTURE_EMAIL,
      originalMealId: original.id,
      replacementMealId: planAfter.libraryMealId,
      groceryRefreshed: groceryAfter.id !== groceryBefore.id,
      revisionHistoryPreserved: revisionsAfter.length === 1,
      replacementEvidencePreserved: replacementLog?.source === 'SAFETY_REPLACED',
      idempotent: !secondSave.changed && groceryFinal?.id === groceryAfter.id,
    }, null, 2));
  } finally {
    const cleanupFailures: string[] = [];

    // Resolve the selected row before deleting the fixture. This is a fallback
    // for failures after the recheck transaction commits but before the normal
    // assertion query records its replacement id.
    if (recheckAttempted && !selectedReplacementId && planId) {
      try {
        const planForCleanup = await prisma.mealPlan.findUnique({
          where: { id: planId },
          select: { libraryMealId: true },
        });
        selectedReplacementId = planForCleanup?.libraryMealId ?? null;
      } catch (error) {
        cleanupFailures.push(`could not resolve selected replacement: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Restore only the counter increment owned by this fixture. The equality
    // predicate is compare-and-set: if another process changed the row, this
    // fixture refuses to overwrite or decrement that concurrent state.
    if (recheckAttempted && selectedReplacementId && selectedReplacementId !== original.id) {
      try {
        const baseline = usageSnapshot.get(selectedReplacementId);
        assert.notEqual(baseline, undefined, 'Selected replacement is outside the managed counter snapshot.');
        const current = await prisma.mealLibrary.findUnique({
          where: { id: selectedReplacementId },
          select: { usageCount: true },
        });
        assert.ok(current, 'Selected replacement disappeared before counter restoration.');
        if (current.usageCount === baseline! + 1) {
          const restored = await prisma.mealLibrary.updateMany({
            where: { id: selectedReplacementId, usageCount: baseline! + 1 },
            data: { usageCount: { decrement: 1 } },
          });
          assert.equal(restored.count, 1, 'Selected counter changed during compare-and-set restoration.');
        } else {
          assert.equal(
            current.usageCount,
            baseline,
            'Selected counter contains concurrent or unexpected changes; refusing to overwrite it.'
          );
        }
      } catch (error) {
        cleanupFailures.push(`selected counter restoration failed safely: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Fixture-row deletion is independent from counter restoration, so either
    // cleanup is still attempted if the other one fails.
    try {
      await cleanupFixture();
    } catch (error) {
      cleanupFailures.push(`reserved-row cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const [residualUsers, residualPlans, residualGroceries, residualEntries, residualRevisions, residualLogs, selectedAfter] = await Promise.all([
        prisma.user.count({ where: { email: FIXTURE_EMAIL } }),
        prisma.mealPlan.count({ where: { planGroupId: FIXTURE_PLAN_GROUP } }),
        userId ? prisma.groceryList.count({ where: { userId } }) : Promise.resolve(0),
        userId ? prisma.safetyProfileEntry.count({ where: { userId } }) : Promise.resolve(0),
        userId ? prisma.healthProfileRevision.count({ where: { userId } }) : Promise.resolve(0),
        userId ? prisma.mealLog.count({ where: { userId } }) : Promise.resolve(0),
        selectedReplacementId && usageSnapshot.has(selectedReplacementId)
          ? prisma.mealLibrary.findUnique({ where: { id: selectedReplacementId }, select: { usageCount: true } })
          : Promise.resolve(null),
      ]);
      const selectedCounterDrift = selectedAfter && selectedReplacementId
        ? Number(selectedAfter.usageCount !== usageSnapshot.get(selectedReplacementId))
        : 0;
      assert.deepEqual(
        { residualUsers, residualPlans, residualGroceries, residualEntries, residualRevisions, residualLogs, selectedCounterDrift },
        { residualUsers: 0, residualPlans: 0, residualGroceries: 0, residualEntries: 0, residualRevisions: 0, residualLogs: 0, selectedCounterDrift: 0 }
      );
    } catch (error) {
      cleanupFailures.push(`cleanup verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (cleanupFailures.length > 0) {
      throw new Error(`Acceptance cleanup was incomplete:\n- ${cleanupFailures.join('\n- ')}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Structured replacement acceptance failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
