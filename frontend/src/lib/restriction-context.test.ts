import { describe, expect, it } from 'vitest';
import { hasSameRestrictionContext, normalizeRestrictionContext } from './restriction-context';

describe('restriction context helpers', () => {
  it('normalizes case, spacing, duplicates, ordering, and NONE consistently', () => {
    expect(normalizeRestrictionContext([' shellfish ', 'NONE', 'Diabetes', 'SHELLFISH'])).toEqual([
      'DIABETES',
      'SHELLFISH',
    ]);
  });

  it('compares contexts as normalized sets', () => {
    expect(hasSameRestrictionContext(['diabetes', 'shellfish'], [' SHELLFISH ', 'DIABETES'])).toBe(true);
    expect(hasSameRestrictionContext(['diabetes'], ['hypertension'])).toBe(false);
  });
});
