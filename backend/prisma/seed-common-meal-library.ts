/**
 * Populate the reusable MealLibrary with FNRI-linked common meals and certify
 * each exact evidence revision through NutritionistService.
 *
 * Dry run: npm run seed:meal-library
 * Apply:   npm run seed:meal-library -- --apply
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import {
  MealIngredientDataSource,
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
  deriveCatalogueConditionSuitability,
  getCatalogueDietaryTags,
  type CommonMealDefinition,
} from '../src/data/common-meal-catalogue';
import { NutritionistService } from '../src/services/nutritionist.service';
import { evaluateMealLibrarySafetyEvidence } from '../src/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '../src/domain/nutritionist-review.policy';

const APPLY = process.argv.includes('--apply');
const LEGACY_SEED_REVIEW_REASONS = [
  'NUTRIMIND_COMMON_LIBRARY_V1',
  'NUTRIMIND_COMMON_LIBRARY_V2',
] as const;
const SEED_REVIEW_REASON = 'NUTRIMIND_COMMON_LIBRARY_V3';
const MANAGED_REVIEW_REASONS = [...LEGACY_SEED_REVIEW_REASONS, SEED_REVIEW_REASON];
const NUTRITIONIST_EMAIL = 'nutritionist@gmail.com';

type FnriFood = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodium: number | null;
};

function definitionSignature(meal: CommonMealDefinition): string {
  return createHash('sha256').update(JSON.stringify(meal)).digest('hex');
}

function roundNutrient(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateNutrition(meal: CommonMealDefinition, foods: Map<string, FnriFood>) {
  let hasCompleteSodium = true;
  const totals = meal.ingredients.reduce(
    (result, item) => {
      const food = foods.get(item.foodName);
      if (!food) throw new Error(`FNRI item not resolved: ${item.foodName}`);
      const portion = item.grams / 100;
      result.calories += food.calories * portion;
      result.proteinG += food.proteinG * portion;
      result.carbsG += food.carbsG * portion;
      result.fatG += food.fatG * portion;
      if (food.sodium === null) hasCompleteSodium = false;
      else result.sodiumMg += food.sodium * portion;
      return result;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 }
  );

  return {
    calories: roundNutrient(totals.calories),
    proteinG: roundNutrient(totals.proteinG),
    carbsG: roundNutrient(totals.carbsG),
    fatG: roundNutrient(totals.fatG),
    sodiumMg: hasCompleteSodium ? roundNutrient(totals.sodiumMg) : null,
  };
}

async function resolveFnriFoods(): Promise<Map<string, FnriFood>> {
  const requiredNames = [...new Set(
    COMMON_MEAL_CATALOGUE.flatMap((meal) => meal.ingredients.map((item) => item.foodName))
  )];
  const rows = await prisma.foodItem.findMany({
    where: { name: { in: requiredNames }, source: 'FNRI' },
    select: { id: true, name: true, calories: true, proteinG: true, carbsG: true, fatG: true, sodium: true },
  });

  const grouped = new Map<string, FnriFood[]>();
  for (const row of rows) grouped.set(row.name, [...(grouped.get(row.name) || []), row]);
  const missing = requiredNames.filter((name) => !grouped.has(name));
  const ambiguous = requiredNames.filter((name) => (grouped.get(name)?.length || 0) !== 1 && !missing.includes(name));
  if (missing.length > 0) throw new Error(`Missing FNRI food rows: ${missing.join(', ')}`);
  if (ambiguous.length > 0) throw new Error(`Ambiguous FNRI food rows: ${ambiguous.join(', ')}`);

  return new Map(requiredNames.map((name) => [name, grouped.get(name)![0]]));
}

async function main() {
  assertCommonMealCatalogue();
  const counts = Object.fromEntries(
    ['BREAKFAST', 'LUNCH', 'DINNER'].map((type) => [
      type,
      COMMON_MEAL_CATALOGUE.filter((meal) => meal.mealType === type).length,
    ])
  );
  if (Object.values(counts).some((count) => count < 7)) {
    throw new Error(`Catalogue must provide at least seven meals per main slot: ${JSON.stringify(counts)}`);
  }

  const nutritionist = await prisma.nutritionistProfile.findFirst({
    where: { user: { email: NUTRITIONIST_EMAIL } },
    include: { user: { select: { name: true, role: true } } },
  });
  if (!nutritionist) {
    throw new Error(`Run the test-account seed first; no nutritionist profile exists for ${NUTRITIONIST_EMAIL}.`);
  }

  const foods = await resolveFnriFoods();
  console.log(`Validated ${COMMON_MEAL_CATALOGUE.length} meals (${JSON.stringify(counts)}) and ${foods.size} exact FNRI foods.`);
  console.log(`Reviewer: ${nutritionist.user.name} (${nutritionist.prcLicenseNumber})`);
  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to create and certify the catalogue.');
    return;
  }

  let created = 0;
  let certified = 0;
  let skipped = 0;

  for (const meal of COMMON_MEAL_CATALOGUE) {
    const signature = definitionSignature(meal);
    const collisions = await prisma.mealLibrary.findMany({
      where: { mealName: meal.mealName },
      include: {
        safetyReviews: {
          where: { reasonCode: { in: MANAGED_REVIEW_REASONS } },
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

    const currentVersionReview = managed?.safetyReviews.find((review) => {
      const snapshot = review.evidenceSnapshot as { signature?: unknown } | null;
      return review.reasonCode === SEED_REVIEW_REASON && snapshot?.signature === signature;
    });
    let mealId = managed?.id;
    let expectedRevision = managed?.safetyEvidenceRevision;
    if (managed?.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE && currentVersionReview) {
      skipped += 1;
      continue;
    }

    const nutrition = calculateNutrition(meal, foods);
    const { sodiumMg, ...macros } = nutrition;
    const suitableConditions = deriveCatalogueConditionSuitability({
      carbsG: macros.carbsG,
      sodiumMg,
    });

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
      await prisma.$transaction(async (tx) => {
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
      });
      expectedRevision = nextDraftRevision;
    }

    const allergensReviewedAbsent = SUPPORTED_LIBRARY_ALLERGENS.filter(
      (allergen) => !meal.allergensPresent.includes(allergen)
    );
    await NutritionistService.certifyLibraryMealSafety(nutritionist.id, mealId, {
      expectedRevision: expectedRevision!,
      conditionDeclarationState: suitableConditions.length > 0
        ? 'REVIEWED_WITH_DECLARATIONS'
        : 'REVIEWED_NONE_DECLARED',
      allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
      suitableConditions,
      allergensPresent: meal.allergensPresent,
      allergensReviewedAbsent,
    });
    certified += 1;
    console.log(`Certified ${meal.mealType.toLowerCase()}: ${meal.mealName}`);
  }

  const verifiedRows = await prisma.mealLibrary.findMany({
    where: { safetyReviews: { some: { reasonCode: SEED_REVIEW_REASON } } },
    include: {
      ingredients: { orderBy: { position: 'asc' } },
      safetyDeclarations: true,
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
      throw new Error(`Certification verification failed for ${row.mealName}: ${evidence.reasons.join(', ') || 'PENDING_FLAG'}`);
    }
    if (row.verifiedByNutritionistId !== nutritionist.id) {
      throw new Error(`Unexpected verifier for managed meal: ${row.mealName}`);
    }
  }

  const totalVerified = await prisma.mealLibrary.count({
    where: { verifiedByNutritionistId: nutritionist.id },
  });
  await prisma.nutritionistProfile.update({
    where: { id: nutritionist.id },
    data: { totalVerified },
  });

  console.log(`Finished: ${created} created, ${certified} certified, ${skipped} already current.`);
  console.log(`Verified database state: ${verifiedRows.length} current catalogue meals; profile total ${totalVerified}.`);
}

main()
  .catch((error) => {
    console.error('Meal-library population failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
