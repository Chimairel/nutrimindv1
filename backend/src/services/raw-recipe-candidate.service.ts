import { AiUsageOperation, DietaryPreference, MealType, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getMealSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';

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
}

type CandidateRow = Prisma.RawRecipeCandidateGetPayload<Record<string, never>>;

const MAX_CANDIDATES_PER_TYPE = 24;

export function normalizeRawRecipeQuantity(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ingredientArray(value: Prisma.JsonValue): SourcedRawRecipeMeal['ingredients'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) return [];
    // Raw recipes commonly use qualitative amounts such as "to taste". The
    // importer represents those as zero, but persisted ingredient quantities
    // deliberately use null for unknown amounts and require positive numbers
    // whenever an amount is present.
    const quantity = normalizeRawRecipeQuantity(record.quantity);
    const unit = typeof record.unit === 'string' && record.unit.trim() ? record.unit.trim() : undefined;
    return [{ foodItemId: null, name, quantity, unit }];
  });
}

function candidateFitsPreference(candidate: CandidateRow, preference: DietaryPreference): boolean {
  return stringArray(candidate.dietaryTags).includes(preference);
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
}): Promise<{ meals: SourcedRawRecipeMeal[]; remainingSlots: RawCandidateSlot[] }> {
  if (input.slots.length === 0) return { meals: [], remainingSlots: [] };

  const mealTypes = [...new Set(input.slots.map((slot) => slot.mealType))];
  const candidateGroups = await Promise.all(
    mealTypes.map(async (mealType) => {
      if (!isPrimaryMealType(mealType)) return [];
      const range = getMealSlotCalorieRange(input.dailyCalorieTarget, mealType);
      const rows = await prisma.rawRecipeCandidate.findMany({
        where: {
          status: 'AVAILABLE',
          mealType,
          calories: { gte: range.minimum, lte: range.maximum },
          ...(input.excludeCandidateIds?.length ? { id: { notIn: [...input.excludeCandidateIds] } } : {}),
        },
        orderBy: [{ calories: 'asc' }, { recipeName: 'asc' }],
        take: MAX_CANDIDATES_PER_TYPE,
      });
      return rows.filter((row) => candidateFitsPreference(row, input.dietaryPreference));
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
    `Requested slots: ${JSON.stringify(input.slots.map(({ dayNumber, mealType }) => ({ dayNumber, mealType })))}`,
    `Candidates: ${JSON.stringify(
      candidates.map((candidate) => ({
        id: candidate.id,
        mealType: candidate.mealType,
        name: candidate.recipeName,
        category: candidate.category,
        calories: candidate.calories,
        dietaryTags: stringArray(candidate.dietaryTags),
        ingredients: ingredientArray(candidate.ingredients)
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
  const slotByKey = new Map(input.slots.map((slot) => [`${slot.dayNumber}:${slot.mealType}`, slot]));
  const selectedKeys = new Set<string>();
  const selectedCandidateIds = new Set<string>();
  const meals: SourcedRawRecipeMeal[] = [];
  for (const selection of response.selections) {
    const key = `${selection.dayNumber}:${selection.mealType}`;
    const slot = slotByKey.get(key);
    const candidate = candidateById.get(selection.rawCandidateId);
    if (!slot || !candidate || candidate.mealType !== slot.mealType) continue;
    if (selectedKeys.has(key) || selectedCandidateIds.has(candidate.id)) continue;
    if (!candidateFitsPreference(candidate, input.dietaryPreference)) continue;
    if (
      candidate.calories === null ||
      candidate.proteinG === null ||
      candidate.carbsG === null ||
      candidate.fatG === null
    )
      continue;
    const ingredients = ingredientArray(candidate.ingredients);
    if (!ingredients.length) continue;
    selectedKeys.add(key);
    selectedCandidateIds.add(candidate.id);
    meals.push({
      dayNumber: slot.dayNumber,
      mealType: slot.mealType,
      rawCandidateId: candidate.id,
      mealName: candidate.recipeName,
      description: candidate.description ?? `Existing recipe sourced from ${candidate.sourceName}.`,
      calories: candidate.calories,
      proteinG: candidate.proteinG,
      carbsG: candidate.carbsG,
      fatG: candidate.fatG,
      ingredients,
    });
  }

  return {
    meals,
    remainingSlots: input.slots.filter((slot) => !selectedKeys.has(`${slot.dayNumber}:${slot.mealType}`)),
  };
}
