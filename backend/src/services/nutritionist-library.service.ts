import prisma from '@/lib/prisma';
import { suspendMealClearancesForEvidenceChange } from './condition-clearance.service';
import { isMealWithinSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
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
  AllergenType,
  DietaryPreference,
  Goal,
  HealthConditionType,
  Prisma,
  SafetyDeclarationProvenance,
  MealIngredientClassificationStatus,
  MealNutritionEvidenceSource,
  MealType,
} from '@prisma/client';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '@/domain/meal-library-safety-evidence.policy';
import type { CertifyMealLibrarySafetyInput } from '@/domain/meal-library-safety-review.schema';
import { certifiedLibraryMealInclude, isCertifiedLibraryMealCompatible } from '@/services/meal-swap.service';
import {
  BASE_LIBRARY_COVERAGE_PROFILES,
  COMBINATION_CONDITIONS,
  COMBINATION_CONSTRAINTS,
  COVERAGE_MEAL_TYPES,
  STRUCTURED_COMBINATION_COVERAGE_PROFILES,
} from '@/domain/nutritionist-library-coverage.profiles';
import {
  classifyMealIngredients,
  MEAL_INGREDIENT_CLASSIFICATION_VERSION,
} from '@/domain/meal-ingredient-classification.policy';
import {
  getNutritionistMealLibrary,
  getNutritionistMealLibraryWithFilters,
  type NutritionistLibraryFilters,
} from './nutritionist-library-query.service';
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

export class NutritionistLibraryService {
  static async getMealLibrary(limit = 50) {
    return getNutritionistMealLibrary(limit);
  }
  static async checkLibraryMealMutationPermission(userId: string, userRole: string, meal: any): Promise<boolean> {
    if (!meal) return false;

    // Check if user is the original verifier
    if (meal.verifiedByNutritionist?.userId === userId) {
      return true;
    }

    // Check if user is ADMIN and the verifier account is inactive/deactivated/deleted
    if (userRole === 'ADMIN') {
      const verifierProfile = await prisma.nutritionistProfile.findUnique({
        where: { id: meal.verifiedByNutritionistId || '' },
        include: { user: true },
      });

      if (
        !verifierProfile ||
        !verifierProfile.user ||
        verifierProfile.user.role !== 'NUTRITIONIST' ||
        verifierProfile.prcLicenseExpiry < new Date()
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Query MealLibrary with advanced filters, search, and pagination
   */
  static async getMealLibraryWithFilters(currentUserId: string, filters: NutritionistLibraryFilters) {
    return getNutritionistMealLibraryWithFilters(currentUserId, filters);
  }

  /**
   * Operational coverage for profiles the reusable library currently supports.
   * A profile is week-ready only when every main slot has at least seven
   * current, unflagged, reviewer-eligible meals.
   */
  static async getMealLibraryCoverage() {
    const meals = await prisma.mealLibrary.findMany({
      where: {
        status: MealLibraryStatus.APPROVED,
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        flags: { none: { status: FlagStatus.PENDING } },
      },
      include: certifiedLibraryMealInclude,
    });
    const countProfile = (definition: {
      dietaryPreference: DietaryPreference;
      conditions: readonly HealthConditionType[];
      allergens: readonly AllergenType[];
      safetyEntries?: readonly {
        domain: string;
        canonicalCode: string | null;
        displayName: string;
        supportState: string;
      }[];
    }) => {
      const matching = meals.filter((meal) =>
        isCertifiedLibraryMealCompatible(meal, definition.conditions, definition.allergens, {
          dietaryPreference: definition.dietaryPreference,
          goal: Goal.MAINTAIN,
          otherConditions: null,
          otherAllergies: null,
          safetyEntries: definition.safetyEntries,
        })
      );
      const counts = Object.fromEntries(
        COVERAGE_MEAL_TYPES.map((mealType) => [
          mealType,
          matching.filter((meal) => meal.applicableMealTypes.some((entry) => entry.mealType === mealType)).length,
        ])
      ) as Record<(typeof COVERAGE_MEAL_TYPES)[number], number>;
      const minimumPerSlot = Math.min(...Object.values(counts));
      const servingCoverage = [1400, 1600, 1800, 1900, 2000, 2200, 2400, 2800].map((dailyCalorieTarget) => {
        const counts = Object.fromEntries(
          COVERAGE_MEAL_TYPES.map((mealType) => [
            mealType,
            matching.filter(
              (meal) =>
                meal.applicableMealTypes.some((entry) => entry.mealType === mealType) &&
                isMealWithinSlotCalorieRange({ ...meal, mealType, dailyCalorieTarget })
            ).length,
          ])
        );
        return { dailyCalorieTarget, counts, weekReady: Math.min(...Object.values(counts)) >= 7 };
      });
      return {
        servingCoverage,
        counts,
        total: matching.length,
        minimumPerSlot,
        weekReady: minimumPerSlot >= 7,
      };
    };

    const profiles = BASE_LIBRARY_COVERAGE_PROFILES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      ...countProfile(definition),
    }));

    const combinationMatrix = COMBINATION_CONDITIONS.map((condition) => ({
      key: condition.key,
      label: condition.label,
      cells: COMBINATION_CONSTRAINTS.map((constraint) => ({
        key: constraint.key,
        label: constraint.label,
        ...countProfile({
          dietaryPreference: constraint.dietaryPreference,
          conditions: [condition.condition],
          allergens: [constraint.allergen],
        }),
      })),
    }));

    const combinationColumns = COMBINATION_CONSTRAINTS.map(({ key, label }) => ({
      key,
      label,
    }));

    const structuredProfiles = STRUCTURED_COMBINATION_COVERAGE_PROFILES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      ...countProfile({
        dietaryPreference: definition.dietaryPreference,
        conditions: [],
        allergens: [],
        safetyEntries: definition.safetyEntries,
      }),
    }));

    return {
      certifiedMeals: meals.filter(
        (meal) =>
          meal.certifiedEvidenceRevision === meal.safetyEvidenceRevision &&
          meal.safetyReviewedByNutritionist &&
          isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      ).length,
      requiredPerSlot: 7,
      profiles,
      combinationColumns,
      combinationMatrix,
      structuredProfiles,
    };
  }

  /**
   * Get single library meal details
   */
  static async getLibraryMeal(mealId: string) {
    return prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        flags: {
          include: {
            flaggedByNutritionist: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        ingredients: { orderBy: { position: 'asc' } },
        applicableMealTypes: { orderBy: { mealType: 'asc' } },
        safetyDeclarations: true,
        safetyReviewedByNutritionist: {
          include: { user: { select: { name: true } } },
        },
        safetyReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            nutritionistProfile: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });
  }

  /**
   * Certifies one exact, stable library evidence revision. This is separate
   * from approving the original user's meal plan and is intentionally strict:
   * only linked FNRI ingredients and explicit reviewed declarations qualify.
   */
  static async certifyLibraryMealSafety(
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

  /**
   * Update meal details in MealLibrary
   */
  static async editLibraryMeal(userId: string, userRole: string, mealId: string, updatedFields: any) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true, ingredients: { orderBy: { position: 'asc' } } },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can edit this meal.');
    }

    const now = new Date();
    const wasComplete = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
    const applicableMealTypes = Array.isArray(updatedFields.applicableMealTypes)
      ? updatedFields.applicableMealTypes
      : null;
    const primaryMealType = applicableMealTypes?.includes(meal.mealType)
      ? meal.mealType
      : (applicableMealTypes?.[0] ?? meal.mealType);
    const calories = parseFloat(updatedFields.calories || 0);
    const proteinG = parseFloat(updatedFields.proteinG || 0);
    const carbsG = parseFloat(updatedFields.carbsG || 0);
    const fatG = parseFloat(updatedFields.fatG || 0);
    const recipeSignature = buildMealLibraryRecipeSignature({
      mealName: updatedFields.mealName,
      mealType: primaryMealType,
      calories,
      proteinG,
      carbsG,
      fatG,
      ingredients: meal.ingredients,
    });
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
        const updated = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            mealName: updatedFields.mealName,
            description: updatedFields.description,
            mealType: primaryMealType,
            calories,
            proteinG,
            carbsG,
            fatG,
            recipeSignature,
            sodiumMg: Object.prototype.hasOwnProperty.call(updatedFields, 'sodiumMg')
              ? updatedFields.sodiumMg
              : meal.sodiumMg,
            sugarG: Object.prototype.hasOwnProperty.call(updatedFields, 'sugarG') ? updatedFields.sugarG : meal.sugarG,
            fiberG: Object.prototype.hasOwnProperty.call(updatedFields, 'fiberG') ? updatedFields.fiberG : meal.fiberG,
            potassiumMg: Object.prototype.hasOwnProperty.call(updatedFields, 'potassiumMg')
              ? updatedFields.potassiumMg
              : meal.potassiumMg,
            phosphorusMg: Object.prototype.hasOwnProperty.call(updatedFields, 'phosphorusMg')
              ? updatedFields.phosphorusMg
              : meal.phosphorusMg,
            saturatedFatG: Object.prototype.hasOwnProperty.call(updatedFields, 'saturatedFatG')
              ? updatedFields.saturatedFatG
              : meal.saturatedFatG,
            nutritionServingDescription: Object.prototype.hasOwnProperty.call(
              updatedFields,
              'nutritionServingDescription'
            )
              ? updatedFields.nutritionServingDescription
              : meal.nutritionServingDescription,
            nutritionEvidenceSource: MealNutritionEvidenceSource.NUTRITIONIST_EDITED,
            dietaryTags: updatedFields.dietaryTags || meal.dietaryTags,
            ...(updatedFields.riceRole
              ? {
                  riceRole: updatedFields.riceRole,
                  riceRoleReviewStatus: 'REVIEWED' as const,
                  includedRiceG: updatedFields.riceRole === 'INCLUDES_RICE' ? (updatedFields.includedRiceG ?? null) : null,
                }
              : {}),
            safetyEvidenceRevision: { increment: 1 },
            ...(wasComplete
              ? {
                  safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
                  safetyInvalidatedAt: now,
                  safetyInvalidationReason: 'MEAL_CONTENT_CHANGED',
                }
              : {}),
          },
        });

        if (applicableMealTypes) {
          await tx.mealLibraryApplicableType.deleteMany({ where: { mealLibraryId: mealId } });
          await tx.mealLibraryApplicableType.createMany({
            data: applicableMealTypes.map((mealType: MealType) => ({
              mealLibraryId: mealId,
              mealType,
              source: 'NUTRITIONIST_REVIEW',
              reviewStatus: 'REVIEWED',
            })),
          });
        }

        if (wasComplete) {
          await suspendMealClearancesForEvidenceChange(tx, mealId, 'MEAL_CONTENT_CHANGED');
          await tx.mealLibrarySafetyReview.create({
            data: {
              mealLibraryId: mealId,
              nutritionistProfileId: meal.verifiedByNutritionistId,
              outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
              evidenceRevision: updated.safetyEvidenceRevision,
              policyVersion: updated.safetyPolicyVersion,
              reasonCode: 'MEAL_CONTENT_CHANGED',
              evidenceSnapshot: {
                priorCertifiedRevision: meal.certifiedEvidenceRevision,
                currentRevision: updated.safetyEvidenceRevision,
              },
            },
          });
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /**
   * Delete verified meal from MealLibrary
   */
  static async deleteLibraryMeal(userId: string, userRole: string, mealId: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can delete this meal.');
    }

    const now = new Date();
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
        const archived = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            status: MealLibraryStatus.ARCHIVED,
            safetyEvidenceStatus:
              meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                ? MealLibrarySafetyEvidenceStatus.STALE
                : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: now,
            safetyInvalidationReason: 'LIBRARY_ARCHIVED',
          },
        });
        await suspendMealClearancesForEvidenceChange(tx, mealId, 'LIBRARY_ARCHIVED');
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId: meal.verifiedByNutritionistId,
            outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
            evidenceRevision: archived.safetyEvidenceRevision,
            policyVersion: archived.safetyPolicyVersion,
            reasonCode: 'LIBRARY_ARCHIVED',
            evidenceSnapshot: { priorStatus: meal.status, archivedAt: now.toISOString() },
          },
        });
        return archived;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /**
   * Flag a library meal for re-review
   */
  static async flagLibraryMeal(userId: string, mealId: string, reason: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: true,
        flags: { where: { status: FlagStatus.PENDING }, select: { id: true } },
      },
    });

    if (!meal) throw new Error('Meal not found.');

    if (meal.verifiedByNutritionist?.userId === userId) {
      throw new Error('You cannot flag your own verified meal. Edit it directly instead.');
    }
    if (meal.status === MealLibraryStatus.ARCHIVED) throw new Error('Archived meals cannot be flagged.');
    if (meal.flags.length > 0) throw new Error('This meal already has a pending flag.');

    const flaggerProfile = await prisma.nutritionistProfile.findUnique({
      where: { userId },
    });
    if (!flaggerProfile) throw new Error('Flagger profile not found.');

    const flag = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
        const createdFlag = await tx.mealLibraryFlag.create({
          data: {
            mealLibraryId: mealId,
            flaggedByNutritionistId: flaggerProfile.id,
            reason,
            status: FlagStatus.PENDING,
          },
        });
        const wasComplete = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
        const updated = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            status: MealLibraryStatus.FLAGGED,
            ...(wasComplete
              ? {
                  safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
                  safetyInvalidatedAt: new Date(),
                  safetyInvalidationReason: 'LIBRARY_FLAGGED',
                }
              : {}),
          },
        });
        if (wasComplete) {
          await suspendMealClearancesForEvidenceChange(tx, mealId, 'LIBRARY_FLAGGED');
          await tx.mealLibrarySafetyReview.create({
            data: {
              mealLibraryId: mealId,
              nutritionistProfileId: flaggerProfile.id,
              outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
              evidenceRevision: updated.safetyEvidenceRevision,
              policyVersion: updated.safetyPolicyVersion,
              reasonCode: 'LIBRARY_FLAGGED',
              evidenceSnapshot: { flagId: createdFlag.id },
            },
          });
        }
        return createdFlag;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (meal.verifiedByNutritionist?.userId) {
      await prisma.notification.create({
        data: {
          userId: meal.verifiedByNutritionist.userId,
          title: 'Meal Plan Flagged 🚩',
          message: `Your verified meal "${meal.mealName}" was flagged for re-review: ${reason}`,
          type: 'MEAL_FLAGGED',
        },
      });
    }

    return flag;
  }

  /**
   * Resolve an active flag (edit, delete, or dismiss)
   */
  static async resolveLibraryMealFlag(
    userId: string,
    userRole: string,
    mealId: string,
    resolution: 'edit' | 'delete' | 'dismiss',
    updatedFields?: any
  ) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: true,
        flags: {
          where: { status: 'PENDING' },
          include: {
            flaggedByNutritionist: true,
          },
        },
      },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can resolve flags on this meal.');
    }

    const pendingFlags = meal.flags;
    const flagIds = pendingFlags.map((f) => f.id);

    if (resolution === 'delete') {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
          await tx.mealLibraryFlag.updateMany({
            where: { id: { in: flagIds } },
            data: { status: FlagStatus.RESOLVED_REMOVED, resolvedAt: new Date() },
          });
          await tx.mealLibrary.update({
            where: { id: mealId },
            data: {
              status: MealLibraryStatus.ARCHIVED,
              safetyEvidenceStatus:
                meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                  ? MealLibrarySafetyEvidenceStatus.STALE
                  : meal.safetyEvidenceStatus,
              safetyInvalidatedAt: new Date(),
              safetyInvalidationReason: 'LIBRARY_ARCHIVED',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Resolved: Meal Removed 🗑️',
              message: `The meal "${meal.mealName}" you flagged has been removed from the library.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    const newStatus = MealLibraryStatus.APPROVED;
    const flagStatus = FlagStatus.RESOLVED_KEPT;

    if (resolution === 'edit') {
      if (!updatedFields) throw new Error('Updated fields are required for edit resolution.');

      await prisma.$transaction([
        prisma.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: flagStatus, resolvedAt: new Date() },
        }),
        prisma.mealLibrary.update({
          where: { id: mealId },
          data: {
            mealName: updatedFields.mealName,
            description: updatedFields.description,
            calories: parseFloat(updatedFields.calories || 0),
            proteinG: parseFloat(updatedFields.proteinG || 0),
            carbsG: parseFloat(updatedFields.carbsG || 0),
            fatG: parseFloat(updatedFields.fatG || 0),
            suitableConditions: updatedFields.suitableConditions || meal.suitableConditions,
            allergenFree: updatedFields.allergenFree || meal.allergenFree,
            dietaryTags: updatedFields.dietaryTags || meal.dietaryTags,
            status: newStatus,
            safetyEvidenceRevision: { increment: 1 },
            safetyEvidenceStatus:
              meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                ? MealLibrarySafetyEvidenceStatus.STALE
                : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: meal.safetyInvalidatedAt || new Date(),
            safetyInvalidationReason: 'FLAG_RESOLUTION_EDIT',
          },
        }),
      ]);

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Resolved: Meal Updated ✏️',
              message: `The meal "${meal.mealName}" you flagged has been updated and kept in the library.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    if (resolution === 'dismiss') {
      await prisma.$transaction([
        prisma.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: flagStatus, resolvedAt: new Date() },
        }),
        prisma.mealLibrary.update({
          where: { id: mealId },
          data: { status: newStatus },
        }),
      ]);

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Dismissed ℹ️',
              message: `Your flag on meal "${meal.mealName}" was dismissed by the original verifier.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    throw new Error('Invalid resolution type.');
  }
}
