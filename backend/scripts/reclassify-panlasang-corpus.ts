import 'dotenv/config';
import {
  MealIngredientClassificationStatus,
  MealLibrarySafetyDeclarationType,
  Prisma,
  PrismaClient,
  SafetyDeclarationProvenance,
} from '@prisma/client';
import {
  classifyMealIngredients,
  MEAL_INGREDIENT_CLASSIFICATION_VERSION,
} from '../src/domain/meal-ingredient-classification.policy';
import { proposeMealTypeApplicability } from '../src/domain/meal-applicability.policy';
import { proposeRiceRole } from '../src/domain/recipe-rice-role.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const meals = await prisma.mealLibrary.findMany({
    where: { description: { contains: 'Source: https://panlasangpinoy.com/' } },
    select: {
      id: true,
      mealName: true,
      mealType: true,
      ingredients: { select: { ingredientName: true, category: true, quantity: true, unit: true } },
    },
    orderBy: { id: 'asc' },
  });
  const classified = meals.map((meal) => ({
    meal,
    result: classifyMealIngredients(
      meal.ingredients.map((ingredient) => ({ name: ingredient.ingredientName, category: ingredient.category }))
    ),
    applicableMealTypes: proposeMealTypeApplicability({
      name: meal.mealName,
      primaryMealType: meal.mealType,
    }),
    riceRole: proposeRiceRole({
      name: meal.mealName,
      ingredients: meal.ingredients.map((ingredient) => ({
        name: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
    }),
  }));
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    meals: meals.length,
    complete: classified.filter((item) => item.result.status === 'COMPLETE').length,
    needsReview: classified.filter((item) => item.result.status === 'NEEDS_REVIEW').length,
    allergenPositiveMeals: classified.filter((item) => item.result.detectedAllergens.length > 0).length,
    declarationsToWrite: classified.reduce((sum, item) => sum + item.result.detectedAllergens.length, 0),
    conditionClearancesCreated: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) return;

  const classifiedAt = new Date();
  for (let offset = 0; offset < classified.length; offset += 40) {
    await Promise.all(
      classified.slice(offset, offset + 40).map(({ meal, result, riceRole }) =>
        prisma.mealLibrary.update({
          where: { id: meal.id },
          data: {
            ingredientClassificationStatus:
              result.status === 'COMPLETE'
                ? MealIngredientClassificationStatus.COMPLETE
                : MealIngredientClassificationStatus.NEEDS_REVIEW,
            ingredientClassificationVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
            ingredientClassifiedAt: classifiedAt,
            ingredientClassificationFindings: result as unknown as Prisma.InputJsonValue,
            dietaryTags: result.compatibleDietaryPreferences,
            riceRole: riceRole.riceRole,
            riceRoleReviewStatus: 'PROPOSED',
            includedRiceG: riceRole.includedRiceG,
          },
        })
      )
    );
  }
  const applicability: Prisma.MealLibraryApplicableTypeCreateManyInput[] = classified.flatMap(
    ({ meal, applicableMealTypes }) =>
      applicableMealTypes.map((mealType) => ({
        mealLibraryId: meal.id,
        mealType,
        source: 'DETERMINISTIC_CLASSIFIER',
        reviewStatus: 'PROPOSED',
      }))
  );
  for (let offset = 0; offset < applicability.length; offset += 500) {
    await prisma.mealLibraryApplicableType.createMany({ data: applicability.slice(offset, offset + 500), skipDuplicates: true });
  }
  await prisma.mealLibrarySafetyDeclaration.deleteMany({
    where: {
      mealLibraryId: { in: meals.map((meal) => meal.id) },
      declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT,
      provenance: SafetyDeclarationProvenance.DETERMINISTIC_CLASSIFIER,
    },
  });
  const declarations: Prisma.MealLibrarySafetyDeclarationCreateManyInput[] = [];
  for (const { meal, result } of classified) {
    for (const canonicalKey of result.detectedAllergens) {
      declarations.push({
        mealLibraryId: meal.id,
        declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT,
        canonicalKey,
        provenance: SafetyDeclarationProvenance.DETERMINISTIC_CLASSIFIER,
        policyVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
        evidenceSnapshot: { classifierVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION },
      });
    }
  }
  for (let offset = 0; offset < declarations.length; offset += 250) {
    await prisma.mealLibrarySafetyDeclaration.createMany({ data: declarations.slice(offset, offset + 250) });
  }
  console.log(JSON.stringify({ applied: true, updatedMeals: classified.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
