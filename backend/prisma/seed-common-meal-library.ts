/**
 * Populate the reusable MealLibrary with FNRI-linked common meals and certify
 * each exact evidence revision through NutritionistService.
 *
 * Database dry run: npm run seed:meal-library
 * Offline source/FNRI projection: npm run seed:meal-library -- --offline-dry-run
 * Apply: npm run seed:meal-library -- --apply
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  MealIngredientDataSource,
  MealApplicabilityReviewStatus,
  MealApplicabilitySource,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyReviewOutcome,
  MealLibraryStatus,
  MealType,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import {
  COMMON_MEAL_CATALOGUE,
  SUPPORTED_LIBRARY_ALLERGENS,
  assertCommonMealCatalogue,
  getCatalogueDietaryTags,
  type CommonMealDefinition,
} from '../src/data/common-meal-catalogue';
import { calculateCatalogueNutrition, type CatalogueFnriFoodEvidence } from '../src/domain/catalogue-nutrition.policy';
import {
  CURRENT_CATALOGUE_REVIEW_REASON,
  MANAGED_CATALOGUE_REVIEW_REASONS,
  catalogueDefinitionSignature,
  hasCurrentCatalogueDefinition,
  shouldUpdateCatalogueVerifiedCount,
} from '../src/domain/catalogue-population.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { NutritionistService } from '../src/services/nutritionist.service';
import { evaluateMealLibrarySafetyEvidence } from '../src/domain/meal-library-safety-evidence.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { isNutritionistEligibleForReview } from '../src/domain/nutritionist-review.policy';
import { isCertifiedLibraryMealCompatible } from '../src/services/meal-swap.service';
import {
  classifyMealIngredients,
  MEAL_INGREDIENT_CLASSIFICATION_VERSION,
} from '../src/domain/meal-ingredient-classification.policy';

const APPLY = process.argv.includes('--apply');
const OFFLINE_DRY_RUN = process.argv.includes('--offline-dry-run');
const SEED_REVIEW_REASON = CURRENT_CATALOGUE_REVIEW_REASON;
const NUTRITIONIST_EMAIL = 'nutritionist@gmail.com';
const COVERAGE_GAP_ADDITION_NAMES = ['Tokwa Ampalaya Rice Bowl', 'Tokwa Sayote and Sitaw Dinner Plate'] as const;

async function ensureFixtureReviewedMealType(mealLibraryId: string, mealType: MealType) {
  await prisma.mealLibraryApplicableType.upsert({
    where: { mealLibraryId_mealType: { mealLibraryId, mealType } },
    create: {
      mealLibraryId,
      mealType,
      source: MealApplicabilitySource.NUTRITIONIST_REVIEW,
      reviewStatus: MealApplicabilityReviewStatus.REVIEWED,
    },
    update: {
      source: MealApplicabilitySource.NUTRITIONIST_REVIEW,
      reviewStatus: MealApplicabilityReviewStatus.REVIEWED,
    },
  });
}

function needsSoybeanCurdClassificationRefresh(
  meal: CommonMealDefinition,
  storedVersion: string | null | undefined
): boolean {
  return (
    meal.ingredients.some((item) => /^Soybean cheese, (?:salted|soft curd|hard curd)$/u.test(item.foodName)) &&
    storedVersion !== MEAL_INGREDIENT_CLASSIFICATION_VERSION
  );
}

async function resolveFnriFoods(): Promise<Map<string, CatalogueFnriFoodEvidence>> {
  const requiredNames = [
    ...new Set(COMMON_MEAL_CATALOGUE.flatMap((meal) => meal.ingredients.map((item) => item.foodName))),
  ];
  const rows = await prisma.foodItem.findMany({
    where: { name: { in: requiredNames }, source: 'FNRI' },
    select: { id: true, name: true, calories: true, proteinG: true, carbsG: true, fatG: true, sodium: true },
  });

  const grouped = new Map<string, CatalogueFnriFoodEvidence[]>();
  for (const row of rows) grouped.set(row.name, [...(grouped.get(row.name) || []), row]);
  const missing = requiredNames.filter((name) => !grouped.has(name));
  const ambiguous = requiredNames.filter((name) => (grouped.get(name)?.length || 0) !== 1 && !missing.includes(name));
  if (missing.length > 0) throw new Error(`Missing FNRI food rows: ${missing.join(', ')}`);
  if (ambiguous.length > 0) throw new Error(`Ambiguous FNRI food rows: ${ambiguous.join(', ')}`);

  return new Map(requiredNames.map((name) => [name, grouped.get(name)![0]]));
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function requiredNumber(value: string | undefined, field: string, foodName: string): number {
  const parsed = Number(value);
  if (!value?.trim() || !Number.isFinite(parsed)) {
    throw new Error(`Invalid FNRI ${field} for ${foodName}`);
  }
  return parsed;
}

function optionalNumber(value: string | undefined): number | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === '-' || normalized === 'tr' || normalized === 'n/a') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveFnriFoodsFromCsv(): Map<string, CatalogueFnriFoodEvidence> {
  const requiredNames = new Set(COMMON_MEAL_CATALOGUE.flatMap((meal) => meal.ingredients.map((item) => item.foodName)));
  const csvPath = path.join(__dirname, 'data', 'fnri.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean).slice(1);
  const grouped = new Map<string, CatalogueFnriFoodEvidence[]>();

  for (const line of lines) {
    const cells = parseCSVLine(line);
    const name = cells[1];
    if (!requiredNames.has(name) || cells[5]?.toUpperCase() !== 'TRUE') continue;
    const row: CatalogueFnriFoodEvidence = {
      id: `fnri-csv:${cells[0]}`,
      name,
      calories: requiredNumber(cells[7], 'calories', name),
      proteinG: requiredNumber(cells[8], 'protein', name),
      fatG: requiredNumber(cells[9], 'fat', name),
      carbsG: requiredNumber(cells[10], 'carbohydrate', name),
      sodium: optionalNumber(cells[18]),
    };
    grouped.set(name, [...(grouped.get(name) || []), row]);
  }

  const missing = [...requiredNames].filter((name) => !grouped.has(name));
  const ambiguous = [...requiredNames].filter((name) => (grouped.get(name)?.length || 0) > 1);
  if (missing.length > 0) throw new Error(`Missing FNRI CSV rows: ${missing.join(', ')}`);
  if (ambiguous.length > 0) throw new Error(`Ambiguous FNRI CSV rows: ${ambiguous.join(', ')}`);
  return new Map([...requiredNames].map((name) => [name, grouped.get(name)![0]]));
}

function projectCertifiedMeal(meal: CommonMealDefinition, foods: ReadonlyMap<string, CatalogueFnriFoodEvidence>) {
  const nutrition = calculateCatalogueNutrition(meal, foods);
  const suitableConditions: string[] = [];
  const allergensReviewedAbsent = SUPPORTED_LIBRARY_ALLERGENS.filter(
    (allergen) => !meal.allergensPresent.includes(allergen)
  );
  return {
    mealName: meal.mealName,
    mealType: meal.mealType,
    recipeSignature: buildMealLibraryRecipeSignature({
      mealName: meal.mealName,
      mealType: meal.mealType,
      calories: nutrition.calories,
      proteinG: nutrition.proteinG,
      carbsG: nutrition.carbsG,
      fatG: nutrition.fatG,
      ingredients: meal.ingredients.map((item) => ({
        ingredientName: item.foodName,
        foodItemId: foods.get(item.foodName)!.id,
        quantity: item.grams,
        unit: 'g',
      })),
    }),
    dietaryTags: getCatalogueDietaryTags(meal),
    status: 'APPROVED',
    safetyEvidenceStatus: 'COMPLETE',
    safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
    conditionDeclarationState: suitableConditions.length > 0 ? 'REVIEWED_WITH_DECLARATIONS' : 'REVIEWED_NONE_DECLARED',
    allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
    crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
    safetyEvidenceRevision: 1,
    certifiedEvidenceRevision: 1,
    safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
    safetyInvalidatedAt: null,
    safetyReviewedByNutritionist: {
      isVerified: true,
      prcLicenseExpiry: new Date('2999-12-31T00:00:00.000Z'),
    },
    ingredients: meal.ingredients.map((item) => ({
      dataSource: 'FNRI',
      foodItemId: foods.get(item.foodName)!.id,
      ingredientName: item.foodName,
      quantity: item.grams,
      unit: 'g',
    })),
    safetyDeclarations: [
      ...suitableConditions.map((canonicalKey) => ({
        declarationType: 'CONDITION_REVIEWED',
        canonicalKey,
        customKey: null,
      })),
      ...meal.allergensPresent.map((canonicalKey) => ({
        declarationType: 'ALLERGEN_PRESENT',
        canonicalKey,
        customKey: null,
      })),
      ...allergensReviewedAbsent.map((canonicalKey) => ({
        declarationType: 'ALLERGEN_REVIEWED_ABSENT',
        canonicalKey,
        customKey: null,
      })),
    ],
    nutrition,
    suitableConditions,
    allergensPresent: meal.allergensPresent,
    allergensReviewedAbsent,
  };
}

function runOfflineDryRun(counts: Record<string, number>, foods: ReadonlyMap<string, CatalogueFnriFoodEvidence>) {
  const projectedMeals = COMMON_MEAL_CATALOGUE.map((meal) => projectCertifiedMeal(meal, foods));
  const safetyEntries = [
    { domain: 'ALLERGY', canonicalCode: 'EGGS', displayName: 'Eggs', supportState: 'SUPPORTED' },
  ] as const;
  const matching = projectedMeals.filter((meal) =>
    isCertifiedLibraryMealCompatible(meal, [], [], {
      dietaryPreference: 'VEGETARIAN',
      goal: 'MAINTAIN',
      otherConditions: null,
      otherAllergies: null,
      safetyEntries,
    })
  );
  const projectedCoverage = Object.fromEntries(
    ['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType) => [
      mealType,
      matching.filter((meal) => meal.mealType === mealType).length,
    ])
  ) as Record<string, number>;
  if (Object.values(projectedCoverage).some((count) => count < 7)) {
    throw new Error(`Projected combined-profile coverage remains incomplete: ${JSON.stringify(projectedCoverage)}`);
  }

  const repeatWrites = COMMON_MEAL_CATALOGUE.filter(
    (meal) =>
      !hasCurrentCatalogueDefinition(meal, {
        safetyEvidenceStatus: 'COMPLETE',
        safetyReviews: [
          {
            reasonCode: CURRENT_CATALOGUE_REVIEW_REASON,
            evidenceSnapshot: { signature: catalogueDefinitionSignature(meal) },
          },
        ],
      })
  ).length;
  if (repeatWrites !== 0) throw new Error(`Idempotence projection requires ${repeatWrites} repeat writes.`);

  const additions = projectedMeals.filter((meal) =>
    COVERAGE_GAP_ADDITION_NAMES.includes(meal.mealName as (typeof COVERAGE_GAP_ADDITION_NAMES)[number])
  );
  if (additions.length !== COVERAGE_GAP_ADDITION_NAMES.length) {
    throw new Error(`Expected ${COVERAGE_GAP_ADDITION_NAMES.length} bounded additions, found ${additions.length}.`);
  }
  console.log(
    JSON.stringify(
      {
        mode: 'offline-dry-run',
        databaseConnected: false,
        catalogueMeals: COMMON_MEAL_CATALOGUE.length,
        mealTypeCounts: counts,
        exactFnriFoods: foods.size,
        projectedAgainstRecorded49MealBaseline: {
          creates: additions.length,
          updates: 0,
          skips: COMMON_MEAL_CATALOGUE.length - additions.length,
        },
        repeatRun: {
          catalogueWrites: repeatWrites,
          profileCounterWrites: Number(
            shouldUpdateCatalogueVerifiedCount(COMMON_MEAL_CATALOGUE.length, COMMON_MEAL_CATALOGUE.length)
          ),
          skips: COMMON_MEAL_CATALOGUE.length,
        },
        projectedProfile: {
          restrictions: ['VEGETARIAN', 'EGGS'],
          counts: projectedCoverage,
          weekReady: true,
        },
        additions: additions.map((meal) => ({
          mealName: meal.mealName,
          mealType: meal.mealType,
          nutrition: meal.nutrition,
          ingredients: meal.ingredients,
          suitableConditions: meal.suitableConditions,
          allergensPresent: meal.allergensPresent,
          allergensReviewedAbsent: meal.allergensReviewedAbsent,
        })),
      },
      null,
      2
    )
  );
}

async function main() {
  if (APPLY && OFFLINE_DRY_RUN) {
    throw new Error('--apply and --offline-dry-run cannot be combined.');
  }
  assertCommonMealCatalogue();
  for (const meal of COMMON_MEAL_CATALOGUE) {
    const classification = classifyMealIngredients(
      meal.ingredients.map((item) => ({ name: item.foodName, category: item.category }))
    );
    const undeclared = classification.detectedAllergens.filter((allergen) => !meal.allergensPresent.includes(allergen));
    if (classification.status !== 'COMPLETE' || undeclared.length > 0) {
      throw new Error(
        `Catalogue ingredient classification conflicts with ${meal.mealName}: ${undeclared.join(', ') || classification.unknownIngredients.join(', ')}`
      );
    }
  }
  const counts = Object.fromEntries(
    ['BREAKFAST', 'LUNCH', 'DINNER'].map((type) => [
      type,
      COMMON_MEAL_CATALOGUE.filter((meal) => meal.mealType === type).length,
    ])
  );
  if (Object.values(counts).some((count) => count < 7)) {
    throw new Error(`Catalogue must provide at least seven meals per main slot: ${JSON.stringify(counts)}`);
  }

  if (OFFLINE_DRY_RUN) {
    const foods = resolveFnriFoodsFromCsv();
    runOfflineDryRun(counts, foods);
    return;
  }

  const nutritionist = await prisma.nutritionistProfile.findFirst({
    where: { user: { email: NUTRITIONIST_EMAIL } },
    include: { user: { select: { name: true, role: true } } },
  });
  if (!nutritionist) {
    throw new Error(`Run the test-account seed first; no nutritionist profile exists for ${NUTRITIONIST_EMAIL}.`);
  }

  const foods = await resolveFnriFoods();
  console.log(
    `Validated ${COMMON_MEAL_CATALOGUE.length} meals (${JSON.stringify(counts)}) and ${foods.size} exact FNRI foods.`
  );
  const managedRows = await prisma.mealLibrary.findMany({
    where: {
      mealName: { in: COMMON_MEAL_CATALOGUE.map((meal) => meal.mealName) },
      safetyReviews: { some: { reasonCode: { in: [...MANAGED_CATALOGUE_REVIEW_REASONS] } } },
    },
    select: {
      mealName: true,
      safetyEvidenceStatus: true,
      ingredientClassificationVersion: true,
      safetyReviews: {
        where: { reasonCode: { in: [...MANAGED_CATALOGUE_REVIEW_REASONS] } },
        select: { reasonCode: true, evidenceSnapshot: true },
      },
      applicableMealTypes: { select: { mealType: true, source: true, reviewStatus: true } },
    },
  });
  const definitionsByName = new Map(COMMON_MEAL_CATALOGUE.map((meal) => [meal.mealName, meal]));
  const missingReviewedTypes = managedRows.filter(
    (row) =>
      !row.applicableMealTypes.some(
        (entry) =>
          entry.mealType === definitionsByName.get(row.mealName)?.mealType &&
          entry.source === MealApplicabilitySource.NUTRITIONIST_REVIEW &&
          entry.reviewStatus === MealApplicabilityReviewStatus.REVIEWED
      )
  ).length;
  const soybeanCurdRefreshes = managedRows.filter((row) =>
    needsSoybeanCurdClassificationRefresh(definitionsByName.get(row.mealName)!, row.ingredientClassificationVersion)
  ).length;
  const recertifications = managedRows.filter((row) => {
    const meal = definitionsByName.get(row.mealName)!;
    return (
      !hasCurrentCatalogueDefinition(meal, row) ||
      needsSoybeanCurdClassificationRefresh(meal, row.ingredientClassificationVersion)
    );
  }).length;
  console.log(
    `Preflight: ${managedRows.length} existing managed meals; ${missingReviewedTypes} missing reviewed meal-type facts; ${soybeanCurdRefreshes} soybean-curd classifier refreshes; ${recertifications} recertifications; ${COMMON_MEAL_CATALOGUE.length - managedRows.length} new meals.`
  );
  console.log(`Reviewer: ${nutritionist.user.name} (${nutritionist.prcLicenseNumber})`);
  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to create and certify the catalogue.');
    return;
  }

  let created = 0;
  let certified = 0;
  let skipped = 0;

  for (const meal of COMMON_MEAL_CATALOGUE) {
    const signature = catalogueDefinitionSignature(meal);
    const collisions = await prisma.mealLibrary.findMany({
      where: { mealName: meal.mealName },
      include: {
        safetyReviews: {
          where: { reasonCode: { in: [...MANAGED_CATALOGUE_REVIEW_REASONS] } },
          select: { id: true, reasonCode: true, evidenceSnapshot: true },
        },
      },
    });
    const managed = collisions.find((candidate) => candidate.safetyReviews.length > 0);
    if (!managed && collisions.length > 0) {
      throw new Error(`Refusing to overwrite an existing non-catalogue meal named "${meal.mealName}".`);
    }
    if (managed && collisions.length > 1) {
      throw new Error(`Meal-name collision requires manual resolution: "${meal.mealName}".`);
    }

    let mealId = managed?.id;
    let expectedRevision = managed?.safetyEvidenceRevision;
    if (
      managed &&
      hasCurrentCatalogueDefinition(meal, managed) &&
      !needsSoybeanCurdClassificationRefresh(meal, managed.ingredientClassificationVersion)
    ) {
      await ensureFixtureReviewedMealType(managed.id, meal.mealType as MealType);
      skipped += 1;
      continue;
    }

    const nutrition = calculateCatalogueNutrition(meal, foods);
    const { sodiumMg, ...macros } = nutrition;
    const suitableConditions: string[] = [];

    if (!mealId) {
      const draft = await prisma.mealLibrary.create({
        data: {
          verifiedByNutritionistId: nutritionist.id,
          mealName: meal.mealName,
          description: meal.description,
          mealType: meal.mealType as MealType,
          ...macros,
          suitableConditions,
          allergenFree: [],
          dietaryTags: getCatalogueDietaryTags(meal),
          status: MealLibraryStatus.APPROVED,
          safetyEvidenceRevision: 1,
          ingredients: {
            create: meal.ingredients.map((item, position) => ({
              position,
              ingredientName: item.foodName,
              category: item.category,
              foodItemId: foods.get(item.foodName)!.id,
              dataSource: MealIngredientDataSource.FNRI,
              quantity: item.grams,
              unit: 'g',
            })),
          },
          safetyReviews: {
            create: {
              nutritionistProfileId: nutritionist.id,
              outcome: MealLibrarySafetyReviewOutcome.DRAFT_CREATED,
              evidenceRevision: 1,
              reasonCode: SEED_REVIEW_REASON,
              evidenceSnapshot: {
                source: SEED_REVIEW_REASON,
                signature,
                mealName: meal.mealName,
                ingredients: meal.ingredients,
                nutrition: { ...macros, sodiumMg },
                suitableConditions,
              },
            },
          },
        },
      });
      mealId = draft.id;
      expectedRevision = draft.safetyEvidenceRevision;
      created += 1;
    } else {
      const nextDraftRevision = expectedRevision! + 1;
      await prisma.$transaction(
        async (tx) => {
          await tx.mealLibrarySafetyDeclaration.deleteMany({ where: { mealLibraryId: mealId! } });
          await tx.mealLibraryIngredient.deleteMany({ where: { mealLibraryId: mealId! } });
          await tx.mealLibrary.update({
            where: { id: mealId! },
            data: {
              verifiedByNutritionistId: nutritionist.id,
              mealName: meal.mealName,
              description: meal.description,
              mealType: meal.mealType as MealType,
              ...macros,
              suitableConditions,
              allergenFree: [],
              dietaryTags: getCatalogueDietaryTags(meal),
              status: MealLibraryStatus.APPROVED,
              safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.INCOMPLETE,
              conditionDeclarationState: 'NOT_REVIEWED',
              allergenDeclarationState: 'NOT_REVIEWED',
              crossContactAssessment: 'NOT_ASSESSED',
              safetyEvidenceRevision: nextDraftRevision,
              certifiedEvidenceRevision: null,
              safetyReviewedByNutritionistId: null,
              safetyReviewedAt: null,
              safetyInvalidatedAt: new Date(),
              safetyInvalidationReason: 'CATALOGUE_DEFINITION_UPDATED',
              ingredients: {
                create: meal.ingredients.map((item, position) => ({
                  position,
                  ingredientName: item.foodName,
                  category: item.category,
                  foodItemId: foods.get(item.foodName)!.id,
                  dataSource: MealIngredientDataSource.FNRI,
                  quantity: item.grams,
                  unit: 'g',
                })),
              },
            },
          });
          await tx.mealLibrarySafetyReview.create({
            data: {
              mealLibraryId: mealId!,
              nutritionistProfileId: nutritionist.id,
              outcome: MealLibrarySafetyReviewOutcome.DRAFT_CREATED,
              evidenceRevision: nextDraftRevision,
              reasonCode: SEED_REVIEW_REASON,
              evidenceSnapshot: {
                source: SEED_REVIEW_REASON,
                signature,
                mealName: meal.mealName,
                ingredients: meal.ingredients,
                nutrition: { ...macros, sodiumMg },
                suitableConditions,
              },
            },
          });
        },
        { maxWait: 10_000, timeout: 30_000 }
      );
      expectedRevision = nextDraftRevision;
    }

    const allergensReviewedAbsent = SUPPORTED_LIBRARY_ALLERGENS.filter(
      (allergen) => !meal.allergensPresent.includes(allergen)
    );
    await NutritionistService.certifyLibraryMealSafety(nutritionist.id, mealId, {
      expectedRevision: expectedRevision!,
      conditionDeclarationState:
        suitableConditions.length > 0 ? 'REVIEWED_WITH_DECLARATIONS' : 'REVIEWED_NONE_DECLARED',
      allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
      suitableConditions,
      allergensPresent: meal.allergensPresent,
      allergensReviewedAbsent,
    });
    await ensureFixtureReviewedMealType(mealId, meal.mealType as MealType);
    certified += 1;
    console.log(`Certified ${meal.mealType.toLowerCase()}: ${meal.mealName}`);
  }

  const verifiedRows = await prisma.mealLibrary.findMany({
    where: { safetyReviews: { some: { reasonCode: SEED_REVIEW_REASON } } },
    include: {
      ingredients: { orderBy: { position: 'asc' } },
      safetyDeclarations: true,
      applicableMealTypes: true,
      flags: { where: { status: 'PENDING' } },
      safetyReviewedByNutritionist: { include: { user: { select: { role: true } } } },
    },
  });
  if (verifiedRows.length !== COMMON_MEAL_CATALOGUE.length) {
    throw new Error(`Expected ${COMMON_MEAL_CATALOGUE.length} managed meals, found ${verifiedRows.length}.`);
  }
  for (const row of verifiedRows) {
    const evidence = evaluateMealLibrarySafetyEvidence({
      ...row,
      reviewerEligible: row.safetyReviewedByNutritionist
        ? isNutritionistEligibleForReview(row.safetyReviewedByNutritionist)
        : false,
    });
    if (!evidence.complete || row.flags.length > 0) {
      throw new Error(
        `Certification verification failed for ${row.mealName}: ${evidence.reasons.join(', ') || 'PENDING_FLAG'}`
      );
    }
    if (row.verifiedByNutritionistId !== nutritionist.id) {
      throw new Error(`Unexpected verifier for managed meal: ${row.mealName}`);
    }
    if (
      !row.applicableMealTypes.some(
        (entry) =>
          entry.mealType === row.mealType &&
          entry.source === MealApplicabilitySource.NUTRITIONIST_REVIEW &&
          entry.reviewStatus === MealApplicabilityReviewStatus.REVIEWED
      )
    ) {
      throw new Error(`Reviewed meal-type evidence is missing for managed meal: ${row.mealName}`);
    }
  }

  const totalVerified = await prisma.mealLibrary.count({
    where: { verifiedByNutritionistId: nutritionist.id },
  });
  const profileCounterUpdated = shouldUpdateCatalogueVerifiedCount(nutritionist.totalVerified, totalVerified);
  if (profileCounterUpdated) {
    await prisma.nutritionistProfile.update({
      where: { id: nutritionist.id },
      data: { totalVerified },
    });
  }

  console.log(`Finished: ${created} created, ${certified} certified, ${skipped} already current.`);
  console.log(
    `Verified database state: ${verifiedRows.length} current catalogue meals; profile total ${totalVerified}; profile counter ${profileCounterUpdated ? 'updated' : 'unchanged'}.`
  );
}

main()
  .catch((error) => {
    console.error('Meal-library population failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
