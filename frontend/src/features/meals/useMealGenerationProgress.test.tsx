import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMealGenerationProgress } from './useMealGenerationProgress';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/axios', () => ({ default: { get: getMock } }));

describe('useMealGenerationProgress', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: { data: { progressPct: 48, stageMessage: 'Balancing meal slots.' } } });
  });

  it('uses server-reported progress for every active generation surface', async () => {
    const { result } = renderHook(() => useMealGenerationProgress(true));

    await waitFor(() => expect(result.current.progress).toBe(48));
    expect(result.current.stageMessage).toBe('Balancing meal slots.');
    expect(getMock).toHaveBeenCalledWith('/user/meals/generation-status');
  });

  it('provides consistent start and completion states', () => {
    const { result } = renderHook(() => useMealGenerationProgress(false));

    act(() => result.current.begin('Starting safely.'));
    expect(result.current.progress).toBe(5);
    expect(result.current.stageMessage).toBe('Starting safely.');

    act(() => result.current.complete());
    expect(result.current.progress).toBe(100);
    expect(result.current.stageMessage).toBe('Your plan is ready for review.');
  });

  it('handles server-reported failure state gracefully', async () => {
    getMock.mockResolvedValue({
      data: {
        data: {
          status: 'FAILED',
          progressPct: 45,
          stageMessage: 'Plan generation could not be completed.',
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const { result } = renderHook(() => useMealGenerationProgress(true));

    await waitFor(() => expect(result.current.isFailed).toBe(true));
    expect(result.current.progress).toBe(45);
    expect(result.current.errorMessage).toBe('Plan generation could not be completed.');
    expect(result.current.stageMessage).toBe('Plan generation could not be completed.');
  });

  it('ignores stale completed or failed jobs from previous runs', async () => {
    // Stale job updated 1 hour ago
    getMock.mockResolvedValue({
      data: {
        data: {
          status: 'FAILED',
          progressPct: 45,
          stageMessage: 'Old failure message',
          updatedAt: new Date(Date.now() - 3600_000).toISOString(),
        },
      },
    });

    const { result } = renderHook(() => useMealGenerationProgress(true));

    act(() => result.current.begin('Starting fresh generation.'));
    expect(result.current.progress).toBe(5);
    expect(result.current.stageMessage).toBe('Starting fresh generation.');

    // Wait and assert that stale failure was NOT applied
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.isFailed).toBe(false);
    expect(result.current.stageMessage).toBe('Starting fresh generation.');
  });

  it('supports explicit fail and reset calls', () => {
    const { result } = renderHook(() => useMealGenerationProgress(false));

    act(() => result.current.begin());
    expect(result.current.progress).toBe(5);

    act(() => result.current.fail('Network timeout occurred.'));
    expect(result.current.isFailed).toBe(true);
    expect(result.current.errorMessage).toBe('Network timeout occurred.');

    act(() => result.current.reset());
    expect(result.current.isFailed).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.errorMessage).toBeNull();
  });
});
