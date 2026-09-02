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
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { COMMON_MEAL_CATALOGUE } from '../src/data/common-meal-catalogue';
import { MealSwapService } from '../src/services/meal-swap.service';
import { NutritionistService } from '../src/services/nutritionist.service';

const FIXTURE_PREFIX = 'e2e.condition-library.';
const catalogueNames = new Set(COMMON_MEAL_CATALOGUE.map((meal) => meal.mealName));
const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;

type ProfileCase = {
  label: string;
  diet: DietaryPreference;
  condition: HealthConditionType;
  allergy: AllergenType;
  expectFullWeek: boolean;
};

const baseCases: ProfileCase[] = [
  { label: 'diabetes', diet: DietaryPreference.OMNIVORE, condition: HealthConditionType.DIABETES, allergy: AllergenType.NONE, expectFullWeek: true },
  { label: 'hypertension', diet: DietaryPreference.OMNIVORE, condition: HealthConditionType.HYPERTENSION, allergy: AllergenType.NONE, expectFullWeek: true },
  { label: 'vegetarian', diet: DietaryPreference.VEGETARIAN, condition: HealthConditionType.NONE, allergy: AllergenType.NONE, expectFullWeek: true },
  { label: 'pescatarian', diet: DietaryPreference.PESCATARIAN, condition: HealthConditionType.NONE, allergy: AllergenType.NONE, expectFullWeek: true },
  { label: 'egg-allergy', diet: DietaryPreference.OMNIVORE, condition: HealthConditionType.NONE, allergy: AllergenType.EGGS, expectFullWeek: true },
  { label: 'kidney-fail-closed', diet: DietaryPreference.OMNIVORE, condition: HealthConditionType.KIDNEY_DISEASE, allergy: AllergenType.NONE, expectFullWeek: false },
];

const combinationDimensions = [
  { label: 'omnivore', diet: DietaryPreference.OMNIVORE, allergy: AllergenType.NONE },
  { label: 'vegetarian', diet: DietaryPreference.VEGETARIAN, allergy: AllergenType.NONE },
  { label: 'pescatarian', diet: DietaryPreference.PESCATARIAN, allergy: AllergenType.NONE },
  { label: 'egg-free', diet: DietaryPreference.OMNIVORE, allergy: AllergenType.EGGS },
  { label: 'dairy-free', diet: DietaryPreference.OMNIVORE, allergy: AllergenType.DAIRY },
  { label: 'gluten-free', diet: DietaryPreference.OMNIVORE, allergy: AllergenType.GLUTEN },
  { label: 'nut-free', diet: DietaryPreference.OMNIVORE, allergy: AllergenType.NUTS },
  { label: 'shellfish-free', diet: DietaryPreference.OMNIVORE, allergy: AllergenType.SHELLFISH },
] as const;

const combinationCases: ProfileCase[] = [
  { label: 'diabetes', condition: HealthConditionType.DIABETES },
  { label: 'hypertension', condition: HealthConditionType.HYPERTENSION },
].flatMap((condition) => combinationDimensions.map((dimension) => ({
  label: `matrix-${condition.label}-${dimension.label}`,
  diet: dimension.diet,
  condition: condition.condition,
  allergy: dimension.allergy,
  expectFullWeek: true,
})));

const cases = [...baseCases, ...combinationCases];

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: FIXTURE_PREFIX } } });
}

async function createFixture(profileCase: ProfileCase, passwordHash: string) {
  return prisma.user.create({
    data: {
      name: `Condition Library ${profileCase.label}`,
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
        },
      },
      healthConditions: { create: { condition: profileCase.condition } },
      allergies: { create: { allergen: profileCase.allergy } },
    },
  });
}

async function main() {
  await cleanup();
  const results: Record<string, Record<string, number>> = {};
  const passwordHash = await bcrypt.hash('ConditionLibrary123', 12);

  try {
    for (const profileCase of cases) {
      const user = await createFixture(profileCase, passwordHash);
      const compatible = await MealSwapService.getCompatibleLibraryMeals(user.id);
      const managed = compatible.filter((meal) => catalogueNames.has(meal.mealName));
      const counts = Object.fromEntries(mealTypes.map((mealType) => [
        mealType,
        managed.filter((meal) => meal.mealType === mealType).length,
      ]));

      if (profileCase.expectFullWeek) {
        for (const mealType of mealTypes) {
          assert.ok(counts[mealType] >= 7, `${profileCase.label} has only ${counts[mealType]} compatible ${mealType} meals.`);
        }
      } else {
        assert.equal(managed.length, 0, `${profileCase.label} unexpectedly received baseline catalogue meals.`);
      }

      if (profileCase.allergy === AllergenType.EGGS) {
        const eggDeclarations = await prisma.mealLibrarySafetyDeclaration.count({
          where: {
            mealLibrary: { id: { in: managed.map((meal) => meal.id) } },
            declarationType: 'ALLERGEN_PRESENT',
            canonicalKey: 'EGGS',
          },
        });
        assert.equal(eggDeclarations, 0, 'The egg-allergy result exposed an egg-declared meal.');
      }

      results[profileCase.label] = counts;
    }

    const coverage = await NutritionistService.getMealLibraryCoverage();
    assert.ok(coverage.profiles.every((profile) => profile.weekReady), 'The nutritionist coverage monitor reported a supported-profile gap.');
    assert.ok(
      coverage.combinationMatrix.every((row) => row.cells.every((cell) => cell.weekReady)),
      'The nutritionist combination matrix reported a supported-profile gap.'
    );
    console.log(JSON.stringify({
      passed: true,
      catalogueMeals: catalogueNames.size,
      profiles: results,
      coverageMonitor: coverage.profiles,
      combinationMatrix: coverage.combinationMatrix,
    }, null, 2));
  } finally {
    await cleanup();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
