import { describe, expect, it } from 'vitest';
import { getIngredientEvidencePresentation } from './ingredient-evidence';

describe('nutritionist ingredient evidence presentation', () => {
  it('shows an FNRI identity link without claiming professional verification', () => {
    const result = getIngredientEvidencePresentation({
      source: 'SOURCE_RECIPE',
      compositionFoodName: 'Rice, well-milled, boiled',
      compositionSource: 'FNRI',
    });
    expect(result.label).toBe('✓');
    expect(result.title).toContain('FNRI identity linked');
    expect(result.title).toContain('professional review remain separate');
  });

  it('labels USDA composition without implying reusable certification', () => {
    const result = getIngredientEvidencePresentation({
      source: 'USDA_FDC',
      compositionFoodName: 'Olive oil',
      compositionSource: 'USDA_FDC',
    });
    expect(result.label).toBe('USDA');
    expect(result.title).toContain('professional review remain separate');
  });

  it('uses a neutral source marker for unmatched source-recipe ingredients', () => {
    const result = getIngredientEvidencePresentation({ source: 'SOURCE_RECIPE' });
    expect(result.label).toBe('SRC');
    expect(result.title).not.toContain('AI');
  });

  it('reserves the warning treatment for AI estimates', () => {
    const result = getIngredientEvidencePresentation({ source: 'GEMINI_ESTIMATED' });
    expect(result.label).toBe('AI');
    expect(result.borderClass).toContain('amber');
  });
});
