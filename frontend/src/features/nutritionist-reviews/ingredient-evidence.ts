export type IngredientEvidenceSource = 'FNRI' | 'SOURCE_RECIPE' | 'GEMINI_ESTIMATED';

export function getIngredientEvidencePresentation(input: {
  source: IngredientEvidenceSource;
  fnriFoodName?: string | null;
}) {
  if (input.fnriFoodName) {
    return {
      label: '✓',
      borderClass: 'border-status-verified-text/30',
      title: `FNRI identity linked: ${input.fnriFoodName}. Portion conversion and professional review remain separate.`,
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
