import prisma from '../src/lib/prisma';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { GroceryService } from '../src/services/grocery.service';
import { UserService } from '../src/services/user.service';

const fixtureNamespace = `structured-safety-${Date.now()}`;
const email = `${fixtureNamespace}@example.invalid`;

async function main() {
  if (process.env.ALLOW_STRUCTURED_SAFETY_ACCEPTANCE !== 'true') {
    throw new Error('Set ALLOW_STRUCTURED_SAFETY_ACCEPTANCE=true only after the migration target is approved.');
  }

  const certifiedMeal = await prisma.mealLibrary.findFirst({
    where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE' },
    include: { ingredients: true },
  });
  if (!certifiedMeal || certifiedMeal.ingredients.length === 0) {
    throw new Error('Acceptance requires one existing certified library meal with ingredients.');
  }

  const user = await prisma.user.create({
    data: {
      name: 'Structured Safety Acceptance Fixture',
      email,
      passwordHash: 'not-a-login-credential',
      emailVerified: true,
      userProfile: { create: { dietaryPreference: 'OMNIVORE', dailyCalorieTarget: 2_000 } },
      nutritionReport: {
        create: {
          acknowledgedAt: new Date(),
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          generalSummary: 'Reserved structured-safety acceptance fixture.',
          basedOnConditions: [],
          basedOnAllergies: [],
        },
      },
    },
  });

  try {
    const plan = await prisma.mealPlan.create({
      data: {
        planGroupId: fixtureNamespace,
        userId: user.id,
        libraryMealId: certifiedMeal.id,
        nutritionistId: certifiedMeal.verifiedByNutritionistId,
        status: 'APPROVED',
        mealType: certifiedMeal.mealType,
        mealName: certifiedMeal.mealName,
        description: certifiedMeal.description,
        calories: certifiedMeal.calories,
        proteinG: certifiedMeal.proteinG,
        carbsG: certifiedMeal.carbsG,
        fatG: certifiedMeal.fatG,
        scheduledDate: new Date(Date.now() + 86_400_000),
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        reviewApprovalCount: 1,
        ingredients: {
          create: certifiedMeal.ingredients.map((ingredient) => ({
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
    const groceryBefore = await GroceryService.generateGroceryList(user.id);

    const noRestrictionInputs = [
      { domain: 'CONDITION' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
      { domain: 'ALLERGY' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
      { domain: 'INTOLERANCE' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
      { domain: 'AVOIDED_INGREDIENT' as const, value: 'NONE', provenance: 'PREDEFINED' as const },
    ];
    const noRestrictionSave = await SafetyIntakeService.save(user.id, noRestrictionInputs);
    const firstRevisionCount = await prisma.healthProfileRevision.count({
      where: { userId: user.id, revisionType: 'STRUCTURED_SAFETY_UPDATED' },
    });
    if (!noRestrictionSave.changed || firstRevisionCount !== 1) {
      throw new Error('The first semantic change did not create exactly one structured revision.');
    }

    await UserService.runSafetyRecheck(user.id);
    const [planAfter, groceryAfter] = await Promise.all([
      prisma.mealPlan.findUnique({ where: { id: plan.id } }),
      GroceryService.getGroceryList(user.id),
    ]);
    if (planAfter?.status !== 'APPROVED' || planAfter.requiresSafetyRevalidation ||
        groceryAfter?.id !== groceryBefore.id ||
        groceryAfter.groceryItems.length !== groceryBefore.groceryItems.length) {
      throw new Error('A still-compatible active plan or its derived grocery list changed during safety recheck.');
    }

    await prisma.mealPlan.delete({ where: { id: plan.id } });
    await prisma.groceryList.deleteMany({ where: { userId: user.id } });

    const inputs = [
      { domain: 'CONDITION' as const, value: 'DIABETES; high blood pressure / Gout', provenance: 'CUSTOM' as const },
      { domain: 'ALLERGY' as const, value: 'egg / soy', provenance: 'CUSTOM' as const },
      { domain: 'INTOLERANCE' as const, value: 'lactose intolerance', provenance: 'CUSTOM' as const },
      { domain: 'AVOIDED_INGREDIENT' as const, value: 'pork', provenance: 'CUSTOM' as const },
    ];
    const first = await SafetyIntakeService.save(user.id, inputs);
    if (!first.changed || first.entries.length !== 7 || !first.requiresReview ||
        !first.entries.some((entry) => entry.canonicalCode === 'HYPERTENSION' && entry.originalText === 'high blood pressure')) {
      throw new Error('Structured save did not retain the complete restriction set with canonical alias resolution.');
    }

    const [profile, secondRevisionCount] = await Promise.all([
      UserService.getUserProfileDetails(user.id),
      prisma.healthProfileRevision.count({ where: { userId: user.id, revisionType: 'STRUCTURED_SAFETY_UPDATED' } }),
    ]);
    if (profile?.safetyEntries.length !== 7 || secondRevisionCount !== firstRevisionCount + 1) {
      throw new Error('Structured entries did not survive profile reload with one revision for the semantic change.');
    }
    const compatibilityEvidence = {
      diabetes: profile.healthConditions.includes('DIABETES'),
      hypertension: profile.healthConditions.includes('HYPERTENSION'),
      eggs: profile.allergies.includes('EGGS'),
      gout: Boolean(profile.userProfile?.otherConditions?.includes('Gout')),
      lactose: Boolean(profile.userProfile?.otherAllergies?.includes('Lactose')),
      reportInvalidated: profile.nutritionReport?.acknowledgedAt === null,
    };
    if (Object.values(compatibilityEvidence).some((value) => !value)) {
      throw new Error(`Legacy projection or nutrition-report invalidation is incomplete: ${JSON.stringify(compatibilityEvidence)}`);
    }

    const second = await SafetyIntakeService.save(user.id, inputs);
    const finalRevisionCount = await prisma.healthProfileRevision.count({
      where: { userId: user.id, revisionType: 'STRUCTURED_SAFETY_UPDATED' },
    });
    if (second.changed || finalRevisionCount !== secondRevisionCount) {
      throw new Error('Identical structured safety submission was not idempotent.');
    }

    console.log(JSON.stringify({
      success: true,
      entriesReloaded: profile.safetyEntries.length,
      canonicalAlias: 'HYPERTENSION',
      semanticChangeRevisionDelta: secondRevisionCount - firstRevisionCount,
      totalRevisions: finalRevisionCount,
      reportInvalidated: compatibilityEvidence.reportInvalidated,
      activePlanRemainedActionable: planAfter?.status === 'APPROVED' && !planAfter.requiresSafetyRevalidation,
      groceryProjectionUnchanged: groceryAfter?.id === groceryBefore.id,
      idempotent: !second.changed,
    }));
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id, email } });
    const [residualUsers, residualEntries, residualPlans, residualGroceryLists] = await Promise.all([
      prisma.user.count({ where: { email } }),
      prisma.safetyProfileEntry.count({ where: { userId: user.id } }),
      prisma.mealPlan.count({ where: { userId: user.id } }),
      prisma.groceryList.count({ where: { userId: user.id } }),
    ]);
    console.log(JSON.stringify({
      cleanup: true,
      fixture: email,
      residualUsers,
      residualEntries,
      residualPlans,
      residualGroceryLists,
    }));
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Structured safety acceptance failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
