import prisma from '@/lib/prisma';

import {
  MealLibraryStatus,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyEvidenceOrigin,
  MealLibraryDeclarationState,
  MealLibraryCrossContactAssessment,
  MealLibrarySafetyDeclarationType,
  MealLibrarySafetyReviewOutcome,
  FlagStatus,
  MealIngredientDataSource,
  Prisma,
  SafetyDeclarationProvenance,
  MealIngredientClassificationStatus,
} from '@prisma/client';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '@/domain/meal-library-safety-evidence.policy';
import type { CertifyMealLibrarySafetyInput } from '@/domain/meal-library-safety-review.schema';

import {
  classifyMealIngredients,
  MEAL_INGREDIENT_CLASSIFICATION_VERSION,
} from '@/domain/meal-ingredient-classification.policy';

import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';

const INDEPENDENT_CONDITION_REVIEW_KEYS = new Set(['KIDNEY_DISEASE', 'PREGNANT']);
const REQUIRED_ALLERGEN_FACT_KEYS = ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS'] as const;

function certificationProposalKey(input: CertifyMealLibrarySafetyInput): string {
  return JSON.stringify({
    conditionDeclarationState: input.conditionDeclarationState,
    allergenDeclarationState: input.allergenDeclarationState,
    crossContactAssessment: input.crossContactAssessment,
    suitableConditions: [...input.suitableConditions].sort(),
    allergensPresent: [...input.allergensPresent].sort(),
    allergensReviewedAbsent: [...input.allergensReviewedAbsent].sort(),
  });
}

export async function certifyLibraryMealSafety(
  nutritionistProfileId: string,
  mealId: string,
  input: CertifyMealLibrarySafetyInput
) {
  const now = new Date();
  const reviewer = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    include: { user: { select: { role: true } } },
  });
  if (!reviewer || !isNutritionistEligibleForReview(reviewer, now)) {
    throw new Error('Only a currently verified nutritionist with an unexpired PRC license can certify evidence.');
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
      const meal = await tx.mealLibrary.findUnique({
        where: { id: mealId },
        include: {
          ingredients: { orderBy: { position: 'asc' } },
          applicableMealTypes: { orderBy: { mealType: 'asc' } },
          flags: { where: { status: FlagStatus.PENDING }, select: { id: true } },
        },
      });
      if (!meal) throw new Error('Meal not found.');
      if (meal.status !== MealLibraryStatus.APPROVED || meal.flags.length > 0) {
        throw new Error('Flagged or archived meals cannot be certified. Resolve the operational status first.');
      }
      if (meal.safetyEvidenceRevision !== input.expectedRevision) {
        throw new Error('Evidence revision conflict. Refresh the meal before certifying.');
      }
      if (meal.ingredients.length === 0) {
        throw new Error('Certification requires at least one stable library ingredient.');
      }
      if (
        meal.ingredients.some(
          (ingredient) => ingredient.dataSource !== MealIngredientDataSource.FNRI || !ingredient.foodItemId
        )
      ) {
        throw new Error('Every library ingredient must be resolved and linked to FNRI before certification.');
      }
      const recipeSignature = buildMealLibraryRecipeSignature({
        mealName: meal.mealName,
        mealType: meal.mealType,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        ingredients: meal.ingredients,
      });

      const classification = classifyMealIngredients(
        meal.ingredients.map((ingredient) => ({
          name: ingredient.ingredientName,
          category: ingredient.category,
        }))
      );
      const declaredPresent = new Set(input.allergensPresent);
      const declaredAbsent = new Set(input.allergensReviewedAbsent);
      for (const detected of classification.detectedAllergens) {
        if (declaredAbsent.has(detected)) {
          throw new Error(`Deterministic ingredient evidence detects ${detected}; it cannot be certified absent.`);
        }
        if (!declaredPresent.has(detected)) {
          throw new Error(
            `Deterministic ingredient evidence detects ${detected}; include it as present before certifying.`
          );
        }
      }
      const accountedAllergens = new Set([...input.allergensPresent, ...input.allergensReviewedAbsent]);
      if (!REQUIRED_ALLERGEN_FACT_KEYS.every((key) => accountedAllergens.has(key))) {
        throw new Error(
          'Certification requires an explicit present or reviewed-absent fact for every supported allergen.'
        );
      }

      const requiresIndependentReview = input.suitableConditions.some((condition) =>
        INDEPENDENT_CONDITION_REVIEW_KEYS.has(condition)
      );
      const proposalKey = certificationProposalKey(input);
      const pendingIndependentReview = requiresIndependentReview
        ? await tx.mealLibrarySafetyReview.findFirst({
            where: {
              mealLibraryId: mealId,
              outcome: MealLibrarySafetyReviewOutcome.CERTIFICATION_PENDING_SECOND_REVIEW,
              evidenceRevision: input.expectedRevision,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      if (requiresIndependentReview && !pendingIndependentReview) {
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId,
            outcome: MealLibrarySafetyReviewOutcome.CERTIFICATION_PENDING_SECOND_REVIEW,
            evidenceRevision: input.expectedRevision,
            policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
            reasonCode: 'INDEPENDENT_CONDITION_REVIEW_REQUIRED',
            evidenceSnapshot: { proposalKey, input },
          },
        });
        return {
          ...meal,
          certificationAwaitingSecondReview: true,
          certificationRequiredReviewerCount: 2,
        };
      }
      if (pendingIndependentReview) {
        if (pendingIndependentReview.nutritionistProfileId === nutritionistProfileId) {
          throw new Error('A different nutritionist must perform the independent kidney/pregnancy evidence review.');
        }
        const pendingSnapshot = pendingIndependentReview.evidenceSnapshot as Record<string, unknown>;
        if (pendingSnapshot?.proposalKey !== proposalKey) {
          throw new Error(
            'The proposed reusable evidence changed after first review; start the two-review process again.'
          );
        }
      }

      const nextRevision = input.expectedRevision + 1;
      const declarations = [
        ...input.suitableConditions.map((canonicalKey) => ({
          mealLibraryId: mealId,
          declarationType: MealLibrarySafetyDeclarationType.CONDITION_REVIEWED,
          canonicalKey,
          provenance: SafetyDeclarationProvenance.NUTRITIONIST_REVIEW,
          policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        })),
        ...input.allergensPresent.map((canonicalKey) => ({
          mealLibraryId: mealId,
          declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT,
          canonicalKey,
          provenance: SafetyDeclarationProvenance.NUTRITIONIST_REVIEW,
          policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        })),
        ...input.allergensReviewedAbsent.map((canonicalKey) => ({
          mealLibraryId: mealId,
          declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT,
          canonicalKey,
          provenance: SafetyDeclarationProvenance.NUTRITIONIST_REVIEW,
          policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        })),
      ];

      const revisionClaim = await tx.mealLibrary.updateMany({
        where: {
          id: mealId,
          status: MealLibraryStatus.APPROVED,
          safetyEvidenceRevision: input.expectedRevision,
        },
        data: {
          safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
          recipeSignature,
          safetyEvidenceOrigin: MealLibrarySafetyEvidenceOrigin.NUTRITIONIST_REVIEW,
          conditionDeclarationState: input.conditionDeclarationState as MealLibraryDeclarationState,
          allergenDeclarationState: input.allergenDeclarationState as MealLibraryDeclarationState,
          crossContactAssessment: input.crossContactAssessment as MealLibraryCrossContactAssessment,
          suitableConditions: input.suitableConditions,
          allergenFree: input.allergensReviewedAbsent,
          dietaryTags: classification.compatibleDietaryPreferences,
          ingredientClassificationStatus:
            classification.status === 'COMPLETE'
              ? MealIngredientClassificationStatus.COMPLETE
              : MealIngredientClassificationStatus.NEEDS_REVIEW,
          ingredientClassificationVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
          ingredientClassifiedAt: now,
          ingredientClassificationFindings: classification as unknown as Prisma.InputJsonValue,
          safetyEvidenceRevision: nextRevision,
          certifiedEvidenceRevision: nextRevision,
          safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
          safetyReviewedByNutritionistId: nutritionistProfileId,
          verifiedByNutritionistId: meal.verifiedByNutritionistId ?? nutritionistProfileId,
          safetyReviewedAt: now,
          safetyInvalidatedAt: null,
          safetyInvalidationReason: null,
        },
      });
      if (revisionClaim.count !== 1) {
        throw new Error('Evidence revision conflict. Refresh the meal before certifying.');
      }

      await tx.mealLibrarySafetyDeclaration.deleteMany({ where: { mealLibraryId: mealId } });
      if (declarations.length > 0) {
        await tx.mealLibrarySafetyDeclaration.createMany({ data: declarations });
      }

      const evidenceSnapshot = {
        meal: {
          recipeSignature,
          mealName: meal.mealName,
          description: meal.description,
          mealType: meal.mealType,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
        },
        ingredients: meal.ingredients.map((ingredient) => ({
          position: ingredient.position,
          ingredientName: ingredient.ingredientName,
          category: ingredient.category,
          foodItemId: ingredient.foodItemId,
          dataSource: ingredient.dataSource,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
        declarations: {
          conditionDeclarationState: input.conditionDeclarationState,
          allergenDeclarationState: input.allergenDeclarationState,
          suitableConditions: input.suitableConditions,
          allergensPresent: input.allergensPresent,
          allergensReviewedAbsent: input.allergensReviewedAbsent,
          crossContactAssessment: input.crossContactAssessment,
        },
        deterministicClassification: classification,
        independentConditionReview: pendingIndependentReview
          ? {
              firstReviewerId: pendingIndependentReview.nutritionistProfileId,
              secondReviewerId: nutritionistProfileId,
            }
          : null,
      };
      await tx.mealLibrarySafetyReview.create({
        data: {
          mealLibraryId: mealId,
          nutritionistProfileId,
          outcome: MealLibrarySafetyReviewOutcome.CERTIFIED,
          evidenceRevision: nextRevision,
          policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
          reasonCode: 'CERTIFIED_CURRENT_REVISION',
          evidenceSnapshot: evidenceSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      return tx.mealLibrary.findUnique({
        where: { id: mealId },
        include: {
          ingredients: { orderBy: { position: 'asc' } },
          safetyDeclarations: true,
          safetyReviewedByNutritionist: {
            include: { user: { select: { name: true } } },
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 15_000,
    }
  );
}
