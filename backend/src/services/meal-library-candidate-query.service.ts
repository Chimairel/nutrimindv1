import {
  AllergenType,
  DietaryPreference,
  HealthConditionType,
  MealLibrarySafetyDeclarationType,
  MealLibrarySafetyEvidenceStatus,
  MealType,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMealSlotCalorieRange, isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import { getApprovedMealLibraryWhere } from '@/domain/meal-actionability.policy';
import { evaluateMealLibrarySafetyEvidence } from '@/domain/meal-library-safety-evidence.policy';
import { evaluateMealGenerationLibraryCompatibility } from '@/domain/meal-generation-library-compatibility.adapter';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import {
  adaptUserSafetyRestrictions,
  type StructuredSafetyRestrictionEntry,
} from '@/domain/structured-restriction.adapter';
import { conditionAllowsRulesetAutomation, conditionRequiresUserScopedClearance } from '@/domain/assurance-tier.policy';
import { enforceClearanceCircuitBreakers } from '@/services/condition-clearance.service';

export const certifiedLibraryMealInclude = {
  ingredients: {
    orderBy: { position: 'asc' as const },
    include: { foodItem: { select: { name: true, category: true } } },
  },
  safetyDeclarations: true,
  safetyReviewedByNutritionist: {
    include: { user: { select: { role: true, name: true, image: true, isSuspended: true } } },
  },
  verifiedByNutritionist: {
    include: { user: { select: { name: true, image: true } } },
  },
  conditionClearances: {
    where: { state: 'ACTIVE' as const },
    orderBy: { activatedAt: 'desc' as const },
    include: {
      decisions: {
        include: {
          nutritionistProfile: {
            select: {
              isVerified: true,
              prcLicenseExpiry: true,
              canLeadReview: true,
              user: { select: { isSuspended: true } },
            },
          },
        },
      },
      rulePolicyVersion: { select: { state: true, automationAllowed: true, policyVersion: true } },
    },
  },
} as const;

export type CertifiedLibraryMeal = Prisma.MealLibraryGetPayload<{ include: typeof certifiedLibraryMealInclude }>;

export interface LibraryCandidateProfile {
  userId?: string;
  dietaryPreference: DietaryPreference | string | null;
  /** Accepted for caller compatibility; goals never participate in reusable tags. */
  goal?: string | null;
  otherConditions: string | null;
  otherAllergies: string | null;
  safetyEntries?: readonly StructuredSafetyRestrictionEntry[];
}

export function isCertifiedLibraryMealCompatible(
  meal: CertifiedLibraryMeal | any,
  userConditions: readonly string[],
  userAllergens: readonly string[],
  profile: LibraryCandidateProfile
): boolean {
  const safety = evaluateMealLibrarySafetyEvidence({
    ...meal,
    reviewerEligible: meal.safetyReviewedByNutritionist
      ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      : false,
  });
  if (!safety.complete) return false;

  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  const requestedConditions = restrictions.conditions.filter((condition) => condition !== 'NONE');
  const now = new Date();
  const activeClearances = Array.isArray(meal.conditionClearances)
    ? meal.conditionClearances.filter(
        (clearance: any) =>
          clearance.state === 'ACTIVE' &&
          clearance.recipeSignature === meal.recipeSignature &&
          clearance.evidenceRevision === meal.safetyEvidenceRevision &&
          (!clearance.expiresAt || clearance.expiresAt > now) &&
          clearance.auditDueAt > now &&
          (!clearance.userScopeId || clearance.userScopeId === profile.userId) &&
          (!conditionRequiresUserScopedClearance(clearance.condition) || clearance.userScopeId === profile.userId) &&
          (clearance.provenance === 'APPROVED_RULESET'
            ? conditionAllowsRulesetAutomation(clearance.condition) &&
              clearance.rulePolicyVersion?.state === 'ACTIVE' &&
              clearance.rulePolicyVersion?.automationAllowed === true &&
              clearance.rulePolicyVersion?.policyVersion === clearance.policyVersion
            : Array.isArray(clearance.decisions) &&
              clearance.decisions.filter(
                (decision: any) =>
                  decision.decision === 'APPROVE' && isNutritionistEligibleForReview(decision.nutritionistProfile)
              ).length >= (clearance.assuranceTier === 'ENHANCED' ? 2 : 1) &&
              (clearance.assuranceTier !== 'ENHANCED' ||
                clearance.decisions.some(
                  (decision: any) =>
                    decision.decision === 'APPROVE' &&
                    decision.nutritionistProfile?.canLeadReview === true &&
                    isNutritionistEligibleForReview(decision.nutritionistProfile)
                )))
      )
    : [];
  const clearedConditions = new Set(activeClearances.map((clearance: any) => String(clearance.condition)));
  const conditionCoverageComplete = requestedConditions.every((condition) => clearedConditions.has(condition));
  const compatibility = evaluateMealGenerationLibraryCompatibility({
    userRestrictions: restrictions.evaluationRestrictions,
    candidate: {
      status: meal.status,
      suitableConditions: [...clearedConditions],
      allergenFree: safety.allergenFree,
      safetyEvidence: {
        ...safety.adapterEvidence,
        conditionRuleMatches: [...clearedConditions],
        conditionDomainReviewed: conditionCoverageComplete,
      },
      ingredients: safety.ingredients,
    },
  });
  if (!compatibility.eligible) return false;

  const tags = Array.isArray(meal.dietaryTags) ? meal.dietaryTags : [];
  return conditionCoverageComplete && (!profile.dietaryPreference || tags.includes(profile.dietaryPreference));
}

function positiveValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value !== 'NONE'))];
}

export async function queryEligibleLibraryMeals(input: {
  mealType?: MealType;
  dailyCalorieTarget?: number;
  userConditions: readonly string[];
  userAllergens: readonly string[];
  profile: LibraryCandidateProfile;
  excludeIds?: readonly string[];
  search?: string;
  limit?: number;
}): Promise<CertifiedLibraryMeal[]> {
  await enforceClearanceCircuitBreakers();
  const limit = Math.max(1, Math.min(input.limit ?? 80, 120));
  const conditions = positiveValues(input.userConditions);
  const allergens = positiveValues(input.userAllergens);
  const and: Prisma.MealLibraryWhereInput[] = [];

  for (const condition of conditions) {
    and.push({
      conditionClearances: {
        some: {
          condition: condition as HealthConditionType,
          state: 'ACTIVE',
          OR: [{ userScopeId: null }, ...(input.profile.userId ? [{ userScopeId: input.profile.userId }] : [])],
        },
      },
    });
  }
  for (const allergen of allergens) {
    and.push(
      {
        safetyDeclarations: {
          some: {
            canonicalKey: allergen,
            declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT,
          },
        },
      },
      {
        safetyDeclarations: {
          none: { canonicalKey: allergen, declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT },
        },
      }
    );
  }

  const calorieRange =
    input.mealType && input.dailyCalorieTarget && isPrimaryMealType(input.mealType)
      ? getMealSlotCalorieRange(input.dailyCalorieTarget, input.mealType)
      : null;
  const where: Prisma.MealLibraryWhereInput = {
    ...getApprovedMealLibraryWhere(),
    verifiedByNutritionistId: { not: null },
    safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
    ...(input.mealType ? { mealType: input.mealType } : {}),
    ...(calorieRange ? { calories: { gte: calorieRange.minimum, lte: calorieRange.maximum } } : {}),
    ...(input.excludeIds?.length ? { id: { notIn: [...input.excludeIds] } } : {}),
    ...(input.search ? { mealName: { contains: input.search, mode: 'insensitive' } } : {}),
    ...(input.profile.dietaryPreference ? { dietaryTags: { array_contains: [input.profile.dietaryPreference] } } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const candidates = await prisma.mealLibrary.findMany({
    where,
    include: certifiedLibraryMealInclude,
    orderBy: [{ usageCount: 'asc' }, { addedAt: 'desc' }, { id: 'asc' }],
    take: limit,
  });

  return candidates.filter((meal) =>
    isCertifiedLibraryMealCompatible(meal, input.userConditions, input.userAllergens, input.profile)
  );
}

export function toCanonicalConditions(values: readonly HealthConditionType[]): string[] {
  return positiveValues(values);
}

export function toCanonicalAllergens(values: readonly AllergenType[]): string[] {
  return positiveValues(values);
}
