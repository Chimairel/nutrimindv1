import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useNutritionistReviews } from './useNutritionistReviews';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const preview = {
  mealPlan: { id: 'meal-1', status: 'PENDING_REVIEW' },
  claimStatus: { claimedByMe: false, claimedByOther: false, claimedByName: null, claimExpiresAt: null },
};

describe('nutritionist review claim controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: { success: true, data: url === '/nutritionist/queue' ? [] : preview },
    }));
    vi.mocked(api.post).mockImplementation(async (url) => ({
      data: { success: true, data: url.endsWith('/claim') ? {
        ...preview, claimStatus: { ...preview.claimStatus, claimedByMe: true },
      } : { released: true } },
    }));
  });

  it('previews without claiming, claims explicitly, then releases and clears selection', async () => {
    const { result } = renderHook(() => useNutritionistReviews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.handleSelectMeal('meal-1'); });
    expect(api.get).toHaveBeenCalledWith('/nutritionist/queue/meal-1');
    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.detailData?.claimStatus.claimedByMe).toBe(false);

    await act(async () => { await result.current.handleClaimMeal(); });
    expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/meal-1/claim');
    expect(result.current.detailData?.claimStatus.claimedByMe).toBe(true);

    await act(async () => { await result.current.handleReleaseMeal(); });
    expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/meal-1/release');
    expect(result.current.selectedMealId).toBeNull();
    expect(result.current.detailData).toBeNull();
  });
});
