export interface MealSelectionEvidence {
  schemaVersion: 1;
  source: 'VERIFIED_LIBRARY' | 'AI_GENERATED';
  dailyCalorieTarget: number;
  slotCalorieTarget: number | null;
  slotCalorieLower: number | null;
  slotCalorieUpper: number | null;
  localityPreference: 'NATIONAL' | 'REGIONAL' | 'LOCAL';
  planningLocationLabel: string;
  consumptionEvidenceScope: string | null;
  consumptionEvidenceRelease: string | null;
  capturedAt: string;
}

export interface MealExplanation {
  source: 'VERIFIED_LIBRARY' | 'AI_GENERATED' | 'LEGACY_UNKNOWN';
  reviewState: 'NUTRITIONIST_VERIFIED' | 'APPROVED' | 'PENDING_REVIEW';
  nutritionEvidence: 'ALL_FNRI' | 'MIXED' | 'ESTIMATED' | 'UNAVAILABLE';
  calorieFit: 'WITHIN_TARGET' | 'OUTSIDE_TARGET' | 'UNAVAILABLE';
  bullets: string[];
  limitation?: string;
}

interface MealExplanationInput {
  libraryMealId?: string | null;
  status: string;
  aiConfidenceFlag: string;
  calories: number;
  verifierName?: string | null;
  ingredients?: Array<{ dataSource?: string | null; foodItemId?: string | null }>;
  selectionEvidence?: unknown;
}

function isSelectionEvidence(value: unknown): value is MealSelectionEvidence {
  if (!value || typeof value !== 'object') return false;
  const evidence = value as Partial<MealSelectionEvidence>;
  return (
    evidence.schemaVersion === 1 &&
    (evidence.source === 'VERIFIED_LIBRARY' || evidence.source === 'AI_GENERATED') &&
    (evidence.slotCalorieLower === null || typeof evidence.slotCalorieLower === 'number') &&
    (evidence.slotCalorieUpper === null || typeof evidence.slotCalorieUpper === 'number')
  );
}

export function buildMealExplanation(input: MealExplanationInput): MealExplanation {
  const evidence = isSelectionEvidence(input.selectionEvidence) ? input.selectionEvidence : null;
  const ingredients = input.ingredients ?? [];
  const fnriCount = ingredients.filter(
    (ingredient) => ingredient.dataSource === 'FNRI' && Boolean(ingredient.foodItemId)
  ).length;
  const estimatedCount = ingredients.filter((ingredient) => ingredient.dataSource === 'GEMINI_ESTIMATED').length;
  const nutritionEvidence =
    ingredients.length === 0
      ? 'UNAVAILABLE'
      : fnriCount === ingredients.length
        ? 'ALL_FNRI'
        : estimatedCount === ingredients.length
          ? 'ESTIMATED'
          : 'MIXED';
  const source = evidence?.source ?? (input.libraryMealId ? 'VERIFIED_LIBRARY' : 'LEGACY_UNKNOWN');
  const reviewState = input.verifierName
    ? 'NUTRITIONIST_VERIFIED'
    : input.status === 'APPROVED'
      ? 'APPROVED'
      : 'PENDING_REVIEW';
  const calorieFit =
    evidence && evidence.slotCalorieLower !== null && evidence.slotCalorieUpper !== null
      ? input.calories >= evidence.slotCalorieLower && input.calories <= evidence.slotCalorieUpper
        ? 'WITHIN_TARGET'
        : 'OUTSIDE_TARGET'
      : 'UNAVAILABLE';
  const bullets: string[] = [];

  if (source === 'VERIFIED_LIBRARY') bullets.push('Selected from the nutritionist-curated verified meal library.');
  else if (source === 'AI_GENERATED')
    bullets.push('Generated for this plan slot from your saved nutrition and meal-planning preferences.');
  else bullets.push('Exact selection-source evidence was not recorded for this meal.');

  if (evidence && evidence.slotCalorieLower !== null && evidence.slotCalorieUpper !== null) {
    bullets.push(
      `${Math.round(input.calories)} kcal is ${calorieFit === 'WITHIN_TARGET' ? 'within' : 'outside'} this slot's ${Math.round(evidence.slotCalorieLower)}–${Math.round(evidence.slotCalorieUpper)} kcal planning range.`
    );
  }
  if (evidence) {
    bullets.push(
      evidence.consumptionEvidenceScope
        ? `Meal selection used active aggregate food-consumption evidence at ${evidence.consumptionEvidenceScope} scope (${evidence.consumptionEvidenceRelease || 'version recorded by the data workspace'}).`
        : `No active aggregate food-consumption release matched this plan; selection used the governed food catalogue with ${evidence.planningLocationLabel.toLowerCase()}.`
    );
  }

  if (nutritionEvidence === 'ALL_FNRI')
    bullets.push(`All ${ingredients.length} recorded ingredients are linked to FNRI food-composition records.`);
  else if (nutritionEvidence === 'MIXED')
    bullets.push(
      `${fnriCount} of ${ingredients.length} ingredients are FNRI-linked; remaining values include estimates.`
    );
  else if (nutritionEvidence === 'ESTIMATED') bullets.push('Ingredient nutrition currently relies on estimates.');
  else bullets.push('No ingredient-level nutrition provenance was recorded for this meal.');

  if (reviewState === 'NUTRITIONIST_VERIFIED') bullets.push(`Reviewed by ${input.verifierName}.`);
  else if (reviewState === 'PENDING_REVIEW')
    bullets.push(`Professional review is still pending; automated safety flag: ${input.aiConfidenceFlag}.`);
  else bullets.push('Approved for user action under the stored review state.');

  return {
    source,
    reviewState,
    nutritionEvidence,
    calorieFit,
    bullets,
    ...(evidence
      ? {}
      : { limitation: 'Exact calorie-slot and locality evidence is unavailable for this legacy meal.' }),
  };
}
