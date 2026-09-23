import { AiUsageOperation, AssuranceTier, DietaryPreference, MealType } from '@prisma/client';
import { z } from 'zod';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getMealSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import { classifyIngredientIntoEnnsFoodGroup, type EnnsFoodGroupCode } from '@/domain/enns-food-group.policy';
import { databaseRecipeCandidateProvider } from './panlasang-recipe-candidate.provider';
import type { RecipeCandidateProjection } from './recipe-candidate-provider';
import { getMaximumAssuranceTier } from '@/domain/assurance-tier.policy';
import {
  scorePreparationCandidate,
  type PreparationRankingReasonCode,
} from '@/domain/upcoming-preparation.policy';

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

const MAX_CANDIDATES_PER_TYPE = 24;

export function normalizeRawRecipeQuantity(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function candidateFitsPreference(candidate: RecipeCandidateProjection, preference: DietaryPreference): boolean {
  return candidate.dietaryTags.includes(preference);
}

function candidateLocalityScore(candidate: RecipeCandidateProjection, scores: ReadonlyMap<EnnsFoodGroupCode, number>): number {
  const groups = new Set<EnnsFoodGroupCode>();
  for (const ingredient of candidate.ingredients) {
    const group = classifyIngredientIntoEnnsFoodGroup({ name: ingredient.name });
    if (group) groups.add(group);
  }
  return [...groups].reduce((total, group) => total + (scores.get(group) ?? 0), 0);
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

  const mealTypes = [...new Set(input.slots.map((slot) => slot.mealType))];
  const assuranceTier = getMaximumAssuranceTier(input.conditions);
  const candidateGroups = await Promise.all(
    mealTypes.map(async (mealType) => {
      if (!isPrimaryMealType(mealType)) return [];
      const range = getMealSlotCalorieRange(input.dailyCalorieTarget, mealType);
      const pages = await Promise.all(([
        ['PANLASANG_PINOY', 90], ['USER_OBSERVED', 30],
      ] as const).map(([sourceKind, limit]) => databaseRecipeCandidateProvider.list({
        sourceKind, recentFirst: sourceKind === 'USER_OBSERVED',
        mealType, dietaryPreference: input.dietaryPreference,
        calorieMinimum: range.minimum, calorieMaximum: range.maximum,
        excludeIds: input.excludeCandidateIds, limit,
      })));
      const localityScores = input.localityFoodGroupScores ?? new Map<EnnsFoodGroupCode, number>();
      return pages.flatMap((page) => page.items)
        .filter((row) => candidateFitsPreference(row, input.dietaryPreference))
        .map((candidate) => {
          const target = range.target;
          const localityScore = candidateLocalityScore(candidate, localityScores);
          const ranking = scorePreparationCandidate({
            activeClearanceCoverage: false,
            allergenDeclarationsComplete: false,
            ingredientsResolved: candidate.ingredientsComplete,
            nutrientsComplete: candidate.nutrition !== null,
            dietCompatible: true,
            remainingReviews: assuranceTier === AssuranceTier.ENHANCED ? 2 : 1,
            calorieDeviationRatio: candidate.nutrition ? Math.abs(candidate.nutrition.calories - target) / target : 1,
            mealTypeMatch: candidate.applicableMealTypes.includes(mealType),
            riceRole: candidate.riceRole,
            localityScore,
            usedInRecentCycle: false,
          });
          return { ...candidate, _ranking: ranking };
        })
        .sort(
          (left, right) =>
            right._ranking.score - left._ranking.score || left.displayName.localeCompare(right.displayName)
        )
        .slice(0, MAX_CANDIDATES_PER_TYPE);
    })
  );
  const candidates = candidateGroups.flat();
  if (!candidates.length) return { meals: [], remainingSlots: [...input.slots] };

  const CandidateSelectionSchema = z.preprocess(
    (value) => {
      const envelope = Array.isArray(value) ? { selections: value } : value;
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return envelope;
      const record = envelope as Record<string, unknown>;
      if (!Array.isArray(record.selections)) return envelope;
      return {
        ...record,
        selections: record.selections.map((selection) => {
          if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return selection;
          const item = selection as Record<string, unknown>;
          return {
            ...item,
            rawCandidateId:
              item.rawCandidateId ??
              item.rawRecipeId ??
              item.recipeId ??
              item.candidateId ??
              item.selectedCandidateId ??
              item.id,
          };
        }),
      };
    },
    z.object({
      selections: z.array(
        z.object({
          dayNumber: z.number().int().min(1).max(7),
          mealType: z.nativeEnum(MealType),
          rawCandidateId: z.string().min(1),
        })
      ),
    })
  );
  const prompt = [
    'Select existing recipes for as many requested meal slots as plausibly fit.',
    'Return only IDs from the supplied candidate list. Do not invent, edit, or certify a recipe.',
    'Exact JSON shape: {"selections":[{"dayNumber":1,"mealType":"BREAKFAST","rawCandidateId":"<supplied id>"}]}',
    'Corpus origin is not safety evidence. Selection will undergo deterministic checks and nutritionist review.',
    `Dietary preference: ${input.dietaryPreference}`,
    `Conditions for general fit only: ${input.conditions.join(', ') || 'NONE'}${input.otherConditions ? `; ${input.otherConditions}` : ''}`,
    `Allergens to avoid proposing: ${input.allergens.join(', ') || 'NONE'}${input.otherAllergies ? `; ${input.otherAllergies}` : ''}`,
    input.localityEvidenceText
      ? `Local familiarity evidence (ranking preference only, never safety evidence):\n${input.localityEvidenceText}`
      : 'No locality consumption evidence is available; do not infer local popularity.',
    `Requested slots: ${JSON.stringify(input.slots.map(({ dayNumber, mealType }) => ({ dayNumber, mealType })))}`,
    `Candidates: ${JSON.stringify(
      candidates.map((candidate) => ({
        id: candidate.id,
        mealTypes: candidate.applicableMealTypes,
        name: candidate.displayName,
        category: candidate.category,
        calories: candidate.nutrition?.calories,
        dietaryTags: candidate.dietaryTags,
        ingredients: candidate.ingredients
          .slice(0, 12)
          .map((ingredient) => ingredient.name),
      }))
    )}`,
  ].join('\n');

  let response: z.infer<typeof CandidateSelectionSchema>;
  try {
    response = await generateGenerativeJSON(
      prompt,
      'You retrieve existing recipes. You never make safety or clinical clearance claims.',
      CandidateSelectionSchema,
      { operation: AiUsageOperation.MEAL_PLAN_CORPUS_LOOKUP, purpose: 'RAW_CORPUS_CANDIDATE_SELECTION' }
    );
  } catch {
    return { meals: [], remainingSlots: [...input.slots] };
  }

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const candidateRankById = new Map(candidates.map((candidate, index) => [candidate.id, index + 1]));
  const slotByKey = new Map(input.slots.map((slot) => [`${slot.dayNumber}:${slot.mealType}`, slot]));
  const selectedKeys = new Set<string>();
  const selectedCandidateIds = new Set<string>();
  const meals: SourcedRawRecipeMeal[] = [];
  for (const selection of response.selections) {
    const key = `${selection.dayNumber}:${selection.mealType}`;
    const slot = slotByKey.get(key);
    const candidate = candidateById.get(selection.rawCandidateId);
    if (!slot || !candidate || !candidate.applicableMealTypes.includes(slot.mealType)) continue;
    if (selectedKeys.has(key) || selectedCandidateIds.has(candidate.id)) continue;
    if (!candidateFitsPreference(candidate, input.dietaryPreference)) continue;
    if (
      candidate.nutrition === null
    )
      continue;
    const ingredients = candidate.ingredients.map((ingredient) => ({ foodItemId: null, ...ingredient }));
    if (!ingredients.length) continue;
    selectedKeys.add(key);
    selectedCandidateIds.add(candidate.id);
    meals.push({
      dayNumber: slot.dayNumber,
      mealType: slot.mealType,
      rawCandidateId: candidate.id,
      mealName: candidate.displayName,
      description: candidate.description ?? 'Existing recipe from the broader recipe corpus.',
      calories: candidate.nutrition.calories,
      proteinG: candidate.nutrition.proteinG,
      carbsG: candidate.nutrition.carbsG,
      fatG: candidate.nutrition.fatG,
      ingredients,
      candidateRank: candidateRankById.get(candidate.id) ?? 1,
      rankingScore: candidate._ranking.score,
      rankingReasonCodes: candidate._ranking.reasonCodes,
    });
  }

  return {
    meals,
    remainingSlots: input.slots.filter((slot) => !selectedKeys.has(`${slot.dayNumber}:${slot.mealType}`)),
  };
}
