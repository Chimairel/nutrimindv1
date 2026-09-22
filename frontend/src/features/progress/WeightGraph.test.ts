import { describe, expect, it } from 'vitest';
import { getTimeScaleRatios } from './WeightGraph';

describe('WeightGraph time scale', () => {
  it('preserves real elapsed gaps instead of spacing observations by array index', () => {
    const ratios = getTimeScaleRatios([
      '2026-09-01T00:00:00.000Z',
      '2026-09-08T00:00:00.000Z',
      '2026-09-29T00:00:00.000Z',
    ]);
    expect(ratios[0]).toBe(0);
    expect(ratios[1]).toBeCloseTo(0.25);
    expect(ratios[2]).toBe(1);
  });
});
