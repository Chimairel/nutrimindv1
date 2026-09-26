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
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { classifyMealIngredients } from '@/domain/meal-ingredient-classification.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';

export const certifiedLibraryMealInclude = {
  applicableMealTypes: { orderBy: { mealType: 'asc' as const } },
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
  profileApprovals: {
    include: {
      reviewerNutritionist: {
        include: { user: { select: { role: true, isSuspended: true, name: true, image: true } } },
      },
    },
  },
} as const;

export type CertifiedLibraryMeal = Prisma.MealLibraryGetPayload<{ include: typeof certifiedLibraryMealInclude }>;
export type EligibleLibraryMeal = CertifiedLibraryMeal & { isFavorite: boolean };

export interface EligibleLibraryPage {
  items: EligibleLibraryMeal[];
  nextCursor: string | null;
  total: number;
}

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
  profile: LibraryCandidateProfile,
  options: { safetyOnly?: boolean } = {}
): boolean {
  if (!meal.recipeSignature || !/^[a-f0-9]{64}$/u.test(meal.recipeSignature)) return false;
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
  return conditionCoverageComplete &&
    (options.safetyOnly || !profile.dietaryPreference || tags.includes(profile.dietaryPreference));
}

export function isProfileApprovedLibraryMealCompatible(
  meal: CertifiedLibraryMeal,
  userConditions: readonly string[],
  userAllergens: readonly string[],
  profile: LibraryCandidateProfile
): boolean {
  if (meal.status !== 'APPROVED' || !meal.recipeSignature || !/^[a-f0-9]{64}$/u.test(meal.recipeSignature))
    return false;
  const scope = mealApprovalSafetyScope({
    conditions: userConditions,
    allergens: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
    safetyEntries: profile.safetyEntries,
  });
  if (!scope.supported) return false;
  // Condition labels alone do not encode medication, laboratory results or
  // individually reviewed nutrient limits. Those users retain the existing
  // condition-clearance path rather than inheriting another patient's review.
  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  if (restrictions.conditions.some((condition) => condition !== 'NONE')) return false;
  if (!meal.ingredients.length) return false;
  const approved = meal.profileApprovals.some((entry) =>
    entry.safetyScopeKey === scope.key &&
    entry.recipeSignature === meal.recipeSignature &&
    entry.evidenceRevision === meal.safetyEvidenceRevision &&
    entry.reviewPolicyVersion === MEAL_PLAN_SAFETY_POLICY_VERSION &&
    isNutritionistEligibleForReview(entry.reviewerNutritionist)
  );
  if (!approved) return false;
  const classification = classifyMealIngredients(meal.ingredients.flatMap((ingredient) => [
    { name: ingredient.ingredientName, category: ingredient.category },
    ...(ingredient.foodItem?.name ? [{ name: ingredient.foodItem.name, category: ingredient.category }] : []),
  ]));
  if (restrictions.allergies.length && classification.status !== 'COMPLETE') return false;
  return !classification.detectedAllergens.some((allergen) => restrictions.allergies.includes(allergen));
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
  skipCalorieFilter?: boolean;
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
    !input.skipCalorieFilter && input.mealType && input.dailyCalorieTarget && isPrimaryMealType(input.mealType)
      ? getMealSlotCalorieRange(input.dailyCalorieTarget, input.mealType)
      : null;
  const where: Prisma.MealLibraryWhereInput = {
    ...getApprovedMealLibraryWhere(),
    verifiedByNutritionistId: { not: null },
    safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
    recipeSignature: { not: null },
    ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
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

function encodeLibraryCursor(meal: Pick<CertifiedLibraryMeal, 'mealName' | 'id'>): string {
  return Buffer.from(JSON.stringify({ mealName: meal.mealName, id: meal.id }), 'utf8').toString('base64url');
}

function decodeLibraryCursor(cursor?: string): { mealName: string; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.mealName !== 'string' || typeof parsed.id !== 'string') throw new Error();
    return { mealName: parsed.mealName, id: parsed.id };
  } catch {
    throw new Error('Invalid library cursor.');
  }
}

function afterLibraryCursor(
  meal: Pick<CertifiedLibraryMeal, 'mealName' | 'id'>,
  cursor: { mealName: string; id: string }
) {
  return meal.mealName > cursor.mealName || (meal.mealName === cursor.mealName && meal.id > cursor.id);
}

/**
 * User-facing eligible catalog query. It scans database rows in bounded chunks
 * so the total is authoritative after the final fail-closed policy evaluation,
 * while memory remains bounded by the chunk plus the requested page.
 */
export async function queryEligibleLibraryPage(input: {
  userId: string;
  mealType?: MealType;
  userConditions: readonly string[];
  userAllergens: readonly string[];
  profile: LibraryCandidateProfile;
  search?: string;
  favoriteOnly?: boolean;
  riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE';
  cursor?: string;
  limit?: number;
  /** Browse medically cleared recipes even when they differ from a voluntary diet preference. */
  safetyOnly?: boolean;
  /** Include patient-reviewed recipes with the same recorded safety context. */
  includeProfileApproved?: boolean;
}): Promise<EligibleLibraryPage> {
  await enforceClearanceCircuitBreakers();
  const pageLimit = Math.max(1, Math.min(input.limit ?? 24, 60));
  const requestedCursor = decodeLibraryCursor(input.cursor);
  const conditions = positiveValues(input.userConditions);
  const allergens = positiveValues(input.userAllergens);
  const profileScope = input.includeProfileApproved
    ? mealApprovalSafetyScope({
        conditions: input.userConditions,
        allergens: input.userAllergens,
        otherConditions: input.profile.otherConditions,
        otherAllergies: input.profile.otherAllergies,
        safetyEntries: input.profile.safetyEntries,
      })
    : null;
  const and: Prisma.MealLibraryWhereInput[] = [];
  for (const condition of conditions) {
    and.push({
      conditionClearances: {
        some: {
          condition: condition as HealthConditionType,
          state: 'ACTIVE',
          OR: [{ userScopeId: null }, { userScopeId: input.userId }],
        },
      },
    });
  }
  for (const allergen of allergens) {
    and.push(
      {
        safetyDeclarations: {
          some: { canonicalKey: allergen, declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT },
        },
      },
      {
        safetyDeclarations: {
          none: { canonicalKey: allergen, declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT },
        },
      }
    );
  }
  const where: Prisma.MealLibraryWhereInput = {
    ...getApprovedMealLibraryWhere(),
    recipeSignature: { not: null },
    OR: [
      {
        verifiedByNutritionistId: { not: null },
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...(and.length ? { AND: and } : {}),
      },
      ...(profileScope?.supported && conditions.length === 0
        ? [{ profileApprovals: { some: { safetyScopeKey: profileScope.key } } }]
        : []),
    ],
    ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
    ...(input.search ? { mealName: { contains: input.search, mode: 'insensitive' } } : {}),
    ...(input.riceRole ? { riceRole: input.riceRole, riceRoleReviewStatus: 'REVIEWED' } : {}),
    ...(input.favoriteOnly ? { favorites: { some: { userId: input.userId } } } : {}),
    ...(!input.safetyOnly && input.profile.dietaryPreference
      ? { dietaryTags: { array_contains: [input.profile.dietaryPreference] } }
      : {}),
  };

  const items: EligibleLibraryMeal[] = [];
  let total = 0;
  let scanCursor: { mealName: string; id: string } | null = null;
  const chunkSize = 100;
  for (;;) {
    const rows: Array<CertifiedLibraryMeal & { favorites: Array<{ id: string }> }> = await prisma.mealLibrary.findMany({
      where: {
        ...where,
        ...(scanCursor
          ? {
              AND: [
                {
                  OR: [
                    { mealName: { gt: scanCursor.mealName } },
                    { mealName: scanCursor.mealName, id: { gt: scanCursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: {
        ...certifiedLibraryMealInclude,
        favorites: { where: { userId: input.userId }, select: { id: true } },
      },
      orderBy: [{ mealName: 'asc' }, { id: 'asc' }],
      take: chunkSize,
    });
    for (const row of rows) {
      if (
        !isCertifiedLibraryMealCompatible(row, input.userConditions, input.userAllergens, input.profile, {
          safetyOnly: input.safetyOnly,
        }) &&
        !(input.includeProfileApproved &&
          isProfileApprovedLibraryMealCompatible(row, input.userConditions, input.userAllergens, input.profile))
      ) continue;
      total += 1;
      if ((!requestedCursor || afterLibraryCursor(row, requestedCursor)) && items.length < pageLimit + 1) {
        items.push({ ...row, isFavorite: row.favorites.length > 0 });
      }
    }
    if (rows.length < chunkSize) break;
    const last: CertifiedLibraryMeal & { favorites: Array<{ id: string }> } = rows[rows.length - 1];
    scanCursor = { mealName: last.mealName, id: last.id };
  }

  const hasMore = items.length > pageLimit;
  const page = items.slice(0, pageLimit);
  return {
    items: page,
    nextCursor: hasMore && page.length ? encodeLibraryCursor(page[page.length - 1]) : null,
    total,
  };
}

export function toCanonicalConditions(values: readonly HealthConditionType[]): string[] {
  return positiveValues(values);
}

export function toCanonicalAllergens(values: readonly AllergenType[]): string[] {
  return positiveValues(values);
}
