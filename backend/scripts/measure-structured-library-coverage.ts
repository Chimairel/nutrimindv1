import 'dotenv/config';
import assert from 'node:assert/strict';
import { DietaryPreference, Goal } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { COMMON_MEAL_CATALOGUE } from '../src/data/common-meal-catalogue';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
} from '../src/services/meal-swap.service';

const profiles = [
  {
    key: 'DIABETES_VEGETARIAN_EGGS',
    label: 'Diabetes + vegetarian + egg allergy',
    diet: DietaryPreference.VEGETARIAN,
    safetyEntries: [
      { domain: 'CONDITION', canonicalCode: 'DIABETES', displayName: 'Diabetes', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'EGGS', displayName: 'Eggs', supportState: 'SUPPORTED' },
    ],
  },
  {
    key: 'HYPERTENSION_PESCATARIAN_DAIRY',
    label: 'Hypertension + pescatarian + dairy allergy',
    diet: DietaryPreference.PESCATARIAN,
    safetyEntries: [
      { domain: 'CONDITION', canonicalCode: 'HYPERTENSION', displayName: 'Hypertension', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'DAIRY', displayName: 'Dairy', supportState: 'SUPPORTED' },
    ],
  },
  {
    key: 'DIABETES_HYPERTENSION_GLUTEN',
    label: 'Diabetes + hypertension + gluten allergy',
    diet: DietaryPreference.OMNIVORE,
    safetyEntries: [
      { domain: 'CONDITION', canonicalCode: 'DIABETES', displayName: 'Diabetes', supportState: 'SUPPORTED' },
      { domain: 'CONDITION', canonicalCode: 'HYPERTENSION', displayName: 'Hypertension', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'GLUTEN', displayName: 'Gluten', supportState: 'SUPPORTED' },
    ],
  },
] as const;

async function main() {
  const managedNames = COMMON_MEAL_CATALOGUE.map((meal) => meal.mealName);
  const meals = await prisma.mealLibrary.findMany({
    where: {
      mealName: { in: managedNames },
      status: 'APPROVED',
      safetyEvidenceStatus: 'COMPLETE',
      safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
      flags: { none: { status: 'PENDING' } },
    },
    include: certifiedLibraryMealInclude,
  });

  assert.equal(COMMON_MEAL_CATALOGUE.length, 49, 'The version-controlled managed catalogue changed; update the evidence scope.');
  assert.equal(meals.length, 49, 'The configured database does not contain all 49 current certified managed meals.');

  const results = profiles.map((profile) => {
    const matching = meals.filter((meal) => isCertifiedLibraryMealCompatible(
      meal,
      [],
      [],
      {
        dietaryPreference: profile.diet,
        goal: Goal.MAINTAIN,
        otherConditions: null,
        otherAllergies: null,
        safetyEntries: profile.safetyEntries,
      }
    ));
    const counts = {
      BREAKFAST: matching.filter((meal) => meal.mealType === 'BREAKFAST').length,
      LUNCH: matching.filter((meal) => meal.mealType === 'LUNCH').length,
      DINNER: matching.filter((meal) => meal.mealType === 'DINNER').length,
    };
    return {
      key: profile.key,
      label: profile.label,
      counts,
      total: matching.length,
      minimumPerSlot: Math.min(counts.BREAKFAST, counts.LUNCH, counts.DINNER),
      weekReady: Object.values(counts).every((count) => count >= 7),
    };
  });

  console.log(JSON.stringify({
    readOnly: true,
    evaluator: 'isCertifiedLibraryMealCompatible',
    managedCertifiedMeals: meals.length,
    requiredPerSlot: 7,
    profiles: results,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Structured coverage measurement failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
