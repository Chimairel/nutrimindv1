export type IngredientEvidenceSource = 'FNRI' | 'USDA_FDC' | 'SOURCE_RECIPE' | 'GEMINI_ESTIMATED';

export function getIngredientEvidencePresentation(input: {
  source: IngredientEvidenceSource;
  compositionFoodName?: string | null;
  compositionSource?: string | null;
  compositionSourceUrl?: string | null;
}) {
  if (input.compositionFoodName && input.compositionSource === 'USDA_FDC') {
    return {
      label: 'USDA',
      borderClass: 'border-sky-500/30',
      title: `USDA FoodData Central identity linked: ${input.compositionFoodName}. ${input.compositionSourceUrl ?? ''} Portion conversion, local applicability, and professional review remain separate.`,
    };
  }
  if (input.compositionFoodName && input.compositionSource === 'FNRI') {
    return {
      label: '✓',
      borderClass: 'border-status-verified-text/30',
      title: `FNRI identity linked: ${input.compositionFoodName}. Portion conversion and professional review remain separate.`,
    };
  }
  if (input.source === 'SOURCE_RECIPE') {
    return {
      label: 'SRC',
      borderClass: 'border-sky-500/30',
      title: 'Copied from the source recipe; no defensible FNRI identity match is stored yet.',
    };
  }
  return {
    label: 'AI',
    borderClass: 'border-amber-500/35',
    title: 'Nutrition was estimated by AI and needs review.',
  };
}
