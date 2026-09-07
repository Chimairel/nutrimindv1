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
});
