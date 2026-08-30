export interface MealGenerationResultRow {
  planType: string;
  status: string;
}

export interface PendingMealPlanSummary {
  mealCount: number;
  planType: string;
  reviewStatus: 'PENDING_REVIEW';
}

export interface PendingMealPreviewInput extends MealGenerationResultRow {
  mealName: string;
  mealType: string;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scheduledDate: Date | string;
  ingredients: readonly { ingredientName: string; category: string | null }[];
}

export interface PendingMealPlanPreview extends PendingMealPlanSummary {
  meals: {
    mealName: string;
    mealType: string;
    description: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    scheduledDate: string;
    ingredients: { ingredientName: string; category: string }[];
  }[];
}

export interface GeneratedMealPlanSummary {
  generatedMealCount: number;
  pendingReview: PendingMealPlanSummary | null;
}

export function summarizePendingMealPlan(
  rows: readonly MealGenerationResultRow[]
): PendingMealPlanSummary | null {
  const pendingRows = rows.filter((row) => row.status === 'PENDING_REVIEW');
  if (pendingRows.length === 0) return null;

  return {
    mealCount: pendingRows.length,
    planType: pendingRows[0].planType,
    reviewStatus: 'PENDING_REVIEW',
  };
}

export function buildPendingMealPlanPreview(
  rows: readonly PendingMealPreviewInput[]
): PendingMealPlanPreview | null {
  const pendingRows = rows.filter((row) => row.status === 'PENDING_REVIEW');
  const summary = summarizePendingMealPlan(pendingRows);
  if (!summary) return null;

  return {
    ...summary,
    meals: pendingRows.map((row) => ({
      mealName: row.mealName,
      mealType: row.mealType,
      description: row.description,
      calories: row.calories,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      scheduledDate: new Date(row.scheduledDate).toISOString(),
      ingredients: row.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        category: ingredient.category ?? 'PANTRY',
      })),
    })),
  };
}

export function summarizeGeneratedMealPlan(
  rows: readonly MealGenerationResultRow[]
): GeneratedMealPlanSummary {
  if (rows.length === 0) {
    throw new Error('Meal generation completed without creating any meal records.');
  }

  return {
    generatedMealCount: rows.length,
    pendingReview: summarizePendingMealPlan(rows),
  };
}
