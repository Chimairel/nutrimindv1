import { AssuranceTier, DietaryPreference, MealType } from '@prisma/client';
import {
  getMealSlotCalorieRange,
  isPrimaryMealType,
  type PrimaryMealType,
} from '@/domain/meal-calorie-allocation.policy';
import { classifyIngredientIntoEnnsFoodGroup, type EnnsFoodGroupCode } from '@/domain/enns-food-group.policy';
import { splitCustomRestrictions, validateGeneratedMealCandidate } from '@/domain/generated-meal-validation.policy';
import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';
import { scorePreparationCandidate, type PreparationRankingReasonCode } from '@/domain/upcoming-preparation.policy';
import { databaseRecipeCandidateProvider } from './panlasang-recipe-candidate.provider';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';

export interface RawCandidateSlot {
  dayNumber: number;
  mealType: MealType;
  scheduledDate: Date;
}

export interface SourcedRawRecipeMeal {
  dayNumber: number;
  mealType: MealType;
  rawCandidateId: string;
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ foodItemId: null; name: string; quantity?: number; unit?: string }>;
  candidateRank: number;
  rankingScore: number;
  rankingReasonCodes: PreparationRankingReasonCode[];
}

type RankedCandidate = RecipeCandidateProjection & {
  _ranking: ReturnType<typeof scorePreparationCandidate>;
};

export function normalizeRawRecipeQuantity(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function candidateLocalityScore(
  candidate: RecipeCandidateProjection,
  scores: ReadonlyMap<EnnsFoodGroupCode, number>
): number {
  const groups = new Set<EnnsFoodGroupCode>();
  for (const ingredient of candidate.ingredients) {
    const group = classifyIngredientIntoEnnsFoodGroup({ name: ingredient.name });
    if (group) groups.add(group);
  }
  return [...groups].reduce((total, group) => total + (scores.get(group) ?? 0), 0);
}

/** Corpus origin supplies a recipe, never a clinical clearance. */
export function selectRawRecipeCandidates(input: {
  slots: readonly RawCandidateSlot[];
  candidatesByType: ReadonlyMap<MealType, readonly RankedCandidate[]>;
  dietaryPreference: DietaryPreference;
  allergens: readonly string[];
  otherAllergies?: string | null;
}): { meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] } {
  const meals: SourcedRawRecipeMeal[] = [];
  const usedIds = new Set<string>();
  const usedSignatures = new Set<string>();
  const remainingSlots: RawCandidateSlot[] = [];
  const customAllergies = splitCustomRestrictions(input.otherAllergies);

  for (const slot of input.slots) {
    const candidates = input.candidatesByType.get(slot.mealType) ?? [];
    const index = candidates.findIndex((candidate) => {
      if (usedIds.has(candidate.id) || usedSignatures.has(candidate.contentSignature)) return false;
      if (!candidate.applicableMealTypes.includes(slot.mealType)) return false;
      if (!candidate.dietaryTags.includes(input.dietaryPreference)) return false;
      if (!candidate.nutrition || candidate.ingredients.length === 0) return false;
      // Reject definite conflicts; unknown facts stay pending for RND review.
      return validateGeneratedMealCandidate({
        ingredients: candidate.ingredients,
        dietaryPreference: input.dietaryPreference,
        allergens: input.allergens,
        customAllergies,
      }).accepted;
    });
    if (index < 0) {
      remainingSlots.push(slot);
      continue;
    }
    const candidate = candidates[index];
    usedIds.add(candidate.id);
    usedSignatures.add(candidate.contentSignature);
    meals.push({
      dayNumber: slot.dayNumber,
      mealType: slot.mealType,
      rawCandidateId: candidate.id,
      mealName: candidate.displayName,
      description: candidate.description ?? 'Existing recipe from the broader recipe corpus.',
      calories: candidate.nutrition!.calories,
      proteinG: candidate.nutrition!.proteinG,
      carbsG: candidate.nutrition!.carbsG,
      fatG: candidate.nutrition!.fatG,
      ingredients: candidate.ingredients.map((ingredient) => ({ foodItemId: null, ...ingredient })),
      candidateRank: index + 1,
      rankingScore: candidate._ranking.score,
      rankingReasonCodes: candidate._ranking.reasonCodes,
    });
  }
  return { meals, remainingSlots };
}

export async function sourceRawRecipeCandidates(input: {
  slots: readonly RawCandidateSlot[];
  dailyCalorieTarget: number;
  dietaryPreference: DietaryPreference;
  conditions: readonly string[];
  allergens: readonly string[];
  otherConditions?: string | null;
  otherAllergies?: string | null;
  excludeCandidateIds?: readonly string[];
  localityFoodGroupScores?: ReadonlyMap<EnnsFoodGroupCode, number>;
  localityEvidenceText?: string;
}): Promise<{ meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] }> {
  if (input.slots.length === 0) return { meals: [], remainingSlots: [] };
  const assuranceTier = getMaximumAssuranceTier(input.conditions);
  const mealTypes = [...new Set(input.slots.map((slot) => slot.mealType))];
  const sources = ['PANLASANG_PINOY', 'USER_OBSERVED'] as const;
  const candidatePools = new Map<MealType, RankedCandidate[]>(mealTypes.map((mealType) => [mealType, []]));
  const nextCursor = new Map<string, string | null>();
  const pagesFetched = new Map<string, number>();
  const keyFor = (mealType: MealType, sourceKind: string) => `${mealType}:${sourceKind}`;
  const rank = (candidate: RecipeCandidateProjection, mealType: PrimaryMealType): RankedCandidate => {
    const range = getMealSlotCalorieRange(input.dailyCalorieTarget, mealType);
    const ranking = scorePreparationCandidate({
      activeClearanceCoverage: false,
      allergenDeclarationsComplete: false,
      ingredientsResolved: candidate.ingredientsComplete,
      nutrientsComplete: candidate.nutrition !== null,
      dietCompatible: true,
      remainingReviews: assuranceTier === AssuranceTier.ENHANCED ? 2 : 1,
      calorieDeviationRatio: candidate.nutrition
        ? Math.abs(candidate.nutrition.calories - range.target) / range.target
        : 1,
      mealTypeMatch: candidate.applicableMealTypes.includes(mealType),
      riceRole: candidate.riceRole,
      localityScore: candidateLocalityScore(
        candidate,
        input.localityFoodGroupScores ?? new Map<EnnsFoodGroupCode, number>()
      ),
      usedInRecentCycle: false,
    });
    return { ...candidate, _ranking: ranking };
  };
  const sortPool = (mealType: MealType) =>
    candidatePools
      .get(mealType)
      ?.sort(
        (left, right) =>
          right._ranking.score - left._ranking.score ||
          left.displayName.localeCompare(right.displayName) ||
          left.id.localeCompare(right.id)
      );
  const loadPage = async (mealType: PrimaryMealType, sourceKind: (typeof sources)[number]) => {
    const key = keyFor(mealType, sourceKind);
    const range = getMealSlotCalorieRange(input.dailyCalorieTarget, mealType);
    const page = await databaseRecipeCandidateProvider.list({
      sourceKind,
      mealType,
      dietaryPreference: input.dietaryPreference,
      calorieMinimum: range.minimum,
      calorieMaximum: range.maximum,
      excludeIds: input.excludeCandidateIds,
      cursor: nextCursor.get(key) ?? undefined,
      limit: 120,
    });
    nextCursor.set(key, page.nextCursor);
    pagesFetched.set(key, (pagesFetched.get(key) ?? 0) + 1);
    candidatePools
      .get(mealType)
      ?.push(
        ...page.items
          .filter((candidate) => candidate.dietaryTags.includes(input.dietaryPreference))
          .map((candidate) => rank(candidate, mealType))
      );
    sortPool(mealType);
  };

  await Promise.all(
    mealTypes.flatMap((mealType) =>
      isPrimaryMealType(mealType) ? sources.map((sourceKind) => loadPage(mealType, sourceKind)) : []
    )
  );
  const select = () =>
    selectRawRecipeCandidates({
      slots: input.slots,
      candidatesByType: candidatePools,
      dietaryPreference: input.dietaryPreference,
      allergens: input.allergens,
      otherAllergies: input.otherAllergies,
    });
  let selected = select();
  // Read further bounded pages only when the first shortlist cannot fill a slot.
  // Current Panlasang corpus is under 2,000 records; twenty 120-row pages cover it.
  while (selected.remainingSlots.length > 0) {
    const remainingTypes = new Set(selected.remainingSlots.map((slot) => slot.mealType));
    const requests = [...remainingTypes].flatMap((mealType) =>
      isPrimaryMealType(mealType)
        ? sources
            .filter((sourceKind) => {
              const key = keyFor(mealType, sourceKind);
              return nextCursor.get(key) && (pagesFetched.get(key) ?? 0) < 20;
            })
            .map((sourceKind) => loadPage(mealType, sourceKind))
        : []
    );
    if (requests.length === 0) break;
    await Promise.all(requests);
    selected = select();
  }
  return selected;
}
