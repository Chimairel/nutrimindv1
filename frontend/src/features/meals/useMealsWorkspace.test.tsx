import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMealsWorkspace } from './useMealsWorkspace';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'user-1' } }),
}));

vi.mock('@/lib/axios', () => ({
  default: { get: getMock },
}));

const historyRows = Array.from({ length: 3 }, (_, index) => ({ id: `history-${index}` }));
const libraryRows = Array.from({ length: 5 }, (_, index) => ({ id: `library-${index}` }));

function successfulResponseFor(url: string) {
  if (url === '/user/meals/history') return { data: { success: true, data: historyRows } };
  if (url === '/user/meals/compatible-library') return { data: { success: true, data: libraryRows } };
  return { data: { success: true, data: [], meta: {} } };
}

describe('useMealsWorkspace', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    getMock.mockReset();
    getMock.mockImplementation(async (url: string) => successfulResponseFor(url));
  });

  it('prefetches history and library totals before either tab is opened', async () => {
    const { result } = renderHook(() => useMealsWorkspace());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.historyTotalCount).toBe(3));
    expect(result.current.libraryTotalCount).toBe(5);
    expect(getMock).toHaveBeenCalledWith('/user/meals/history', { params: {} });
    expect(getMock).toHaveBeenCalledWith('/user/meals/compatible-library', { params: {} });
  });

  it('keeps the existing workspace visible during a focus refresh', async () => {
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveRefresh: ((value: ReturnType<typeof successfulResponseFor>) => void) | undefined;
    getMock.mockImplementation((url: string) => {
      if (url !== '/user/meals/current') return Promise.resolve(successfulResponseFor(url));
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    });

    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveRefresh?.(successfulResponseFor('/user/meals/current'));
    });
  });

  it('restores the previous plan immediately after route remount and revalidates silently', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/user/meals/current') {
        return { data: { success: true, data: [{ id: 'cached-meal' }], meta: {} } };
      }
      return successfulResponseFor(url);
    });
    const firstRender = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(firstRender.result.current.isLoading).toBe(false));
    firstRender.unmount();

    let resolveRefresh: ((value: ReturnType<typeof successfulResponseFor>) => void) | undefined;
    getMock.mockImplementation((url: string) => {
      if (url !== '/user/meals/current') return Promise.resolve(successfulResponseFor(url));
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    });

    const secondRender = renderHook(() => useMealsWorkspace());
    expect(secondRender.result.current.isLoading).toBe(false);
    expect(secondRender.result.current.meals).toEqual([{ id: 'cached-meal' }]);
    await waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));

    await act(async () => {
      resolveRefresh?.(successfulResponseFor('/user/meals/current'));
    });
  });
});
