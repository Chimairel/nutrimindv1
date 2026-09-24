import { describe, expect, it } from 'vitest';
import { normalizeAdminAnalytics } from './useAdminAnalytics';

describe('admin analytics response normalization', () => {
  it('normalizes legacy null AI purposes before the page renders them', () => {
    const result = normalizeAdminAnalytics({
      totalUsers: 4,
      aiUsageByOperation30d: [{ operation: 'OTHER', purpose: null, status: 'SUCCESS', count: 3 }],
    });

    expect(result?.totalUsers).toBe(4);
    expect(result?.aiUsageByOperation30d).toEqual([
      { operation: 'OTHER', purpose: 'UNSPECIFIED', status: 'SUCCESS', count: 3 },
    ]);
  });

  it('fills fields missing from an older session cache with safe empty values', () => {
    const result = normalizeAdminAnalytics({ totalUsers: 2 });

    expect(result?.rawRecipeCandidates).toBe(0);
    expect(result?.activeClearancesByCondition).toEqual([]);
    expect(result?.planSelectionsByProvenance30d).toEqual([]);
  });

  it('rejects a non-object response', () => {
    expect(normalizeAdminAnalytics(null)).toBeNull();
    expect(normalizeAdminAnalytics([])).toBeNull();
  });
});
