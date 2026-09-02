import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  ActivityLevel,
  AllergenType,
  DietaryPreference,
  Goal,
  HealthConditionType,
  Role,
  ShoppingDayGroup,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { COMMON_MEAL_CATALOGUE } from '../src/data/common-meal-catalogue';
import { MealGenerationService } from '../src/services/meal-generation.service';
import { GroceryService } from '../src/services/grocery.service';

const FIXTURE_PREFIX = 'e2e.combined-library-flow.';
const catalogueNames = COMMON_MEAL_CATALOGUE.map((meal) => meal.mealName);

const cases = [
  {
    label: 'diabetes-vegetarian',
    condition: HealthConditionType.DIABETES,
    allergy: AllergenType.NONE,
    diet: DietaryPreference.VEGETARIAN,
  },
  {
    label: 'hypertension-egg-free',
    condition: HealthConditionType.HYPERTENSION,
    allergy: AllergenType.EGGS,
    diet: DietaryPreference.OMNIVORE,
  },
] as const;

function currentManilaDayOfWeek(): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
  }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: FIXTURE_PREFIX } } });
}

async function main() {
  await cleanup();
  const catalogue = await prisma.mealLibrary.findMany({
    where: { mealName: { in: catalogueNames } },
    select: { id: true, usageCount: true },
  });
  assert.equal(catalogue.length, COMMON_MEAL_CATALOGUE.length, 'Populate the current managed catalogue first.');

  const usageSnapshot = new Map(catalogue.map((meal) => [meal.id, meal.usageCount]));
  const aiUsageBefore = await prisma.aiUsageEvent.count();
  const passwordHash = await bcrypt.hash('CombinedLibrary123', 12);
  const manilaDay = currentManilaDayOfWeek();
  assert.ok(manilaDay >= 0, 'Could not resolve the Manila weekday.');
  const shoppingDayOfWeek = (manilaDay + 6) % 7;
  const results: Record<string, unknown> = {};

  try {
    for (const profileCase of cases) {
      const user = await prisma.user.create({
        data: {
          name: `Combined Library ${profileCase.label}`,
          email: `${FIXTURE_PREFIX}${profileCase.label}@example.com`,
          passwordHash,
          role: Role.USER,
          emailVerified: true,
          onboardingDone: true,
          userProfile: {
            create: {
              age: 30,
              biologicalSex: 'FEMALE',
              heightCm: 160,
              weightKg: 60,
              targetWeightKg: 60,
              goal: Goal.MAINTAIN,
              activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
              dietaryPreference: profileCase.diet,
              dailyCalorieTarget: 1900,
              shoppingDayOfWeek,
              shoppingDayGroup: shoppingDayOfWeek === 0 || shoppingDayOfWeek === 6
                ? ShoppingDayGroup.WEEKEND
                : ShoppingDayGroup.WEEKDAY,
            },
          },
          healthConditions: { create: { condition: profileCase.condition } },
          allergies: { create: { allergen: profileCase.allergy } },
        },
      });

      const planGroupId = await MealGenerationService.generatePlanForUser(user.id);
      await GroceryService.generateGroceryList(user.id);
      const plan = await prisma.mealPlan.findMany({
        where: { userId: user.id, planGroupId },
        include: {
          ingredients: true,
          libraryMeal: { include: { safetyDeclarations: true } },
        },
      });
      assert.equal(plan.length, 21, `${profileCase.label} did not receive 21 plan slots.`);
      assert.ok(plan.every((meal) => meal.status === 'APPROVED' && meal.libraryMealId), `${profileCase.label} received a non-library or non-approved slot.`);
      assert.equal(new Set(plan.map((meal) => meal.libraryMealId)).size, 21, `${profileCase.label} repeated a library meal.`);
      assert.ok(plan.every((meal) => meal.ingredients.length > 0), `${profileCase.label} received a meal without grocery ingredients.`);
      assert.ok(plan.every((meal) => meal.libraryMeal?.suitableConditions.includes(profileCase.condition)), `${profileCase.label} received a meal without its condition declaration.`);

      if (profileCase.allergy !== AllergenType.NONE) {
        assert.ok(plan.every((meal) => !meal.libraryMeal?.safetyDeclarations.some(
          (declaration) => declaration.declarationType === 'ALLERGEN_PRESENT' && declaration.canonicalKey === profileCase.allergy
        )), `${profileCase.label} received an allergen conflict.`);
      }

      const grocery = await prisma.groceryList.findFirst({
        where: { userId: user.id },
        include: { groceryItems: true },
        orderBy: { generatedAt: 'desc' },
      });
      assert.ok(grocery?.groceryItems.length, `${profileCase.label} did not receive an automatic grocery projection.`);
      results[profileCase.label] = {
        planSlots: plan.length,
        distinctMeals: new Set(plan.map((meal) => meal.libraryMealId)).size,
        groceryItems: grocery.groceryItems.length,
      };
    }

    assert.equal(await prisma.aiUsageEvent.count(), aiUsageBefore, 'A fully covered combined profile invoked Gemini.');
    console.log(JSON.stringify({ passed: true, geminiCallsRecorded: 0, profiles: results }, null, 2));
  } finally {
    await cleanup();
    await prisma.$transaction([...usageSnapshot].map(([id, usageCount]) => prisma.mealLibrary.update({
      where: { id },
      data: { usageCount },
    })));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
