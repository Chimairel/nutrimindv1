import {
  MealIngredientClassificationStatus,
  MealLibrarySafetyDeclarationType,
  MealLibrarySafetyReviewOutcome,
  MealLibraryStatus,
  MealNutritionEvidenceSource,
  MealPlanStatus,
  Prisma,
  SafetyDeclarationProvenance,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  classifyMealIngredients,
  MEAL_INGREDIENT_CLASSIFICATION_VERSION,
} from '@/domain/meal-ingredient-classification.policy';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';

export async function persistDeterministicLibraryClassification(tx: Prisma.TransactionClient, mealLibraryId: string) {
  const meal = await tx.mealLibrary.findUniqueOrThrow({
    where: { id: mealLibraryId },
    include: { ingredients: { orderBy: { position: 'asc' } } },
  });
  const classification = classifyMealIngredients(
    meal.ingredients.map((ingredient) => ({
      name: ingredient.ingredientName,
      category: ingredient.category,
    }))
  );

  await tx.mealLibrarySafetyDeclaration.deleteMany({
    where: { mealLibraryId, provenance: SafetyDeclarationProvenance.DETERMINISTIC_CLASSIFIER },
  });
  if (classification.detectedAllergens.length) {
    await tx.mealLibrarySafetyDeclaration.createMany({
      data: classification.detectedAllergens.map((canonicalKey) => ({
        mealLibraryId,
        declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT,
        canonicalKey,
        provenance: SafetyDeclarationProvenance.DETERMINISTIC_CLASSIFIER,
        policyVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
        evidenceSnapshot: {
          source: 'INGREDIENT_LEXICON',
          findings: classification.findings.filter((finding) => finding.facts.includes(`ALLERGEN_${canonicalKey}`)),
        },
      })),
    });
  }
  await tx.mealLibrary.update({
    where: { id: mealLibraryId },
    data: {
      dietaryTags: classification.compatibleDietaryPreferences,
      ingredientClassificationStatus:
        classification.status === 'COMPLETE'
          ? MealIngredientClassificationStatus.COMPLETE
          : MealIngredientClassificationStatus.NEEDS_REVIEW,
      ingredientClassificationVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
      ingredientClassifiedAt: new Date(),
      ingredientClassificationFindings: classification as unknown as Prisma.InputJsonValue,
    },
  });
  return classification;
}

export async function createOrReuseLibraryDraftFromApprovedPlan(nutritionistProfileId: string, mealPlanId: string) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const plan = await tx.mealPlan.findUnique({
          where: { id: mealPlanId },
          include: { ingredients: { orderBy: { id: 'asc' } } },
        });
        if (!plan) throw new Error('Meal plan not found.');
        if (plan.status !== MealPlanStatus.APPROVED || plan.requiresSafetyRevalidation) {
          throw new Error('Only a current user-approved meal can become reusable evidence.');
        }
        if (plan.nutritionistId !== nutritionistProfileId) {
          throw new Error('Only the nutritionist who finalized this user approval can publish its reusable draft.');
        }
        if (!plan.ingredients.length) throw new Error('A reusable recipe requires at least one ingredient.');

        const recipeSignature = buildMealLibraryRecipeSignature({
          mealName: plan.mealName,
          mealType: plan.mealType,
          calories: plan.calories,
          proteinG: plan.proteinG,
          carbsG: plan.carbsG,
          fatG: plan.fatG,
          ingredients: plan.ingredients,
        });
        const existing = await tx.mealLibrary.findUnique({ where: { recipeSignature } });
        if (existing) {
          await tx.mealPlan.update({ where: { id: mealPlanId }, data: { libraryMealId: existing.id } });
          return { meal: existing, deduplicated: true };
        }

        const created = await tx.mealLibrary.create({
          data: {
            verifiedByNutritionistId: nutritionistProfileId,
            mealName: plan.mealName,
            description: plan.description,
            mealType: plan.mealType,
            calories: plan.calories,
            proteinG: plan.proteinG,
            carbsG: plan.carbsG,
            fatG: plan.fatG,
            nutritionEvidenceSource: MealNutritionEvidenceSource.UNKNOWN,
            suitableConditions: [],
            allergenFree: [],
            dietaryTags: [],
            status: MealLibraryStatus.APPROVED,
            safetyEvidenceRevision: 1,
            recipeSignature,
            ingredients: {
              create: plan.ingredients.map((ingredient, position) => ({
                position,
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
        const classification = await persistDeterministicLibraryClassification(tx, created.id);
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: created.id,
            nutritionistProfileId,
            outcome: MealLibrarySafetyReviewOutcome.DRAFT_CREATED,
            evidenceRevision: 1,
            reasonCode: 'EXPLICIT_REUSABLE_EVIDENCE_DRAFT',
            evidenceSnapshot: {
              mealPlanId,
              recipeSignature,
              classificationVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
              classification: classification as unknown as Prisma.InputJsonValue,
            } as Prisma.InputJsonValue,
          },
        });
        await tx.mealPlan.update({ where: { id: mealPlanId }, data: { libraryMealId: created.id } });
        return {
          meal: await tx.mealLibrary.findUniqueOrThrow({ where: { id: created.id } }),
          deduplicated: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const plan = await prisma.mealPlan.findUniqueOrThrow({
        where: { id: mealPlanId },
        include: { ingredients: { orderBy: { id: 'asc' } } },
      });
      const recipeSignature = buildMealLibraryRecipeSignature({ ...plan, ingredients: plan.ingredients });
      const existing = await prisma.mealLibrary.findUniqueOrThrow({ where: { recipeSignature } });
      await prisma.mealPlan.update({ where: { id: mealPlanId }, data: { libraryMealId: existing.id } });
      return { meal: existing, deduplicated: true };
    }
    throw error;
  }
}
