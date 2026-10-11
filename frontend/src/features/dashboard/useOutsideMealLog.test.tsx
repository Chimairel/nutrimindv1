import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useOutsideMealLog } from './useOutsideMealLog';

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('sonner', () => ({
  toast: { loading: vi.fn(() => 'log-toast'), dismiss: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
const options = {
  useAiEstimate: false,
  items: [{ name: 'Food', reportedNutrition: { calories: 200, proteinG: 10, carbsG: 25, fatG: 7 } }],
  consumedAt: '2026-10-04T02:00:00Z',
};
const preview = {
  warningRequired: true,
  confirmationId: 'preview',
  estimate: options.items[0].reportedNutrition,
  items: [],
  summary: {},
  reasons: [],
  warnings: [],
};
const saved = {
  warningRequired: false,
  log: { id: 'log', loggedAt: options.consumedAt, status: 'DONE', ...options.items[0].reportedNutrition },
  safetyFollowUp: { status: 'INSUFFICIENT_EVIDENCE', messages: [] },
};
const response = (data: unknown) => ({ data: { success: true, data } });

describe('outside food submission', () => {
  beforeEach(() => vi.clearAllMocks());

  it('previews first, blocks duplicate clicks and keeps the modal open while pending', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }) as never
    );
    const onSaved = vi.fn();
    const { result } = renderHook(() => useOutsideMealLog(onSaved));
    act(() => result.current.setIsOpen(true));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.onSubmit(false, options);
      void result.current.onSubmit(false, options);
      result.current.onClose();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      finish(response(preview));
      await pending;
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith('log-toast');
    expect(result.current.warning?.confirmationId).toBe('preview');
  });

  it('updates the tracker and completes Sonner as soon as the log is committed', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(response(preview)).mockResolvedValueOnce(response(saved));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useOutsideMealLog(onSaved));
    act(() => result.current.setIsOpen(true));
    await act(() => result.current.onSubmit(false, options));
    await act(() => result.current.onSubmit(true));
    expect(onSaved).toHaveBeenCalledWith(saved.log);
    expect(result.current.isOpen).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Food logged', expect.objectContaining({ id: 'log-toast' }));
    expect(api.post).toHaveBeenLastCalledWith(
      '/user/meals/log-outside',
      expect.objectContaining({ confirmationId: 'preview', warningAcknowledged: true })
    );
  });

  it('retries unchanged details with the same key and allocates a new key for edited details', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useOutsideMealLog(vi.fn()));
    await act(() => result.current.onSubmit(false, options));
    await act(() => result.current.onSubmit(false, options));
    const bodies = vi.mocked(api.post).mock.calls.map((call) => call[1] as { requestKey: string });
    expect(bodies[0].requestKey).toBe(bodies[1].requestKey);
    await act(() => result.current.onSubmit(false, { ...options, items: [{ name: 'Other food' }] }));
    expect((vi.mocked(api.post).mock.calls[2][1] as { requestKey: string }).requestKey).not.toBe(bodies[0].requestKey);
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('restores the draft when a confirmation has expired', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(response(preview))
      .mockRejectedValueOnce({ response: { data: { code: 'PREVIEW_EXPIRED_OR_USED', error: 'Preview expired' } } });
    const { result } = renderHook(() => useOutsideMealLog(vi.fn()));
    await act(() => result.current.onSubmit(false, options));
    await act(() => result.current.onSubmit(true));
    expect(result.current.warning).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Preview expired', { id: 'log-toast' });
  });

  it('shows high-demand Sonner feedback and preserves the draft for a same-key retry', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce({
        response: {
          data: {
            code: 'AI_HIGH_DEMAND',
            error: 'AI is experiencing high demand right now. Please try again shortly.',
          },
        },
      })
      .mockResolvedValueOnce(response(preview));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useOutsideMealLog(onSaved));
    act(() => {
      result.current.setIsOpen(true);
      result.current.onMealNameChange('Food');
    });
    await act(() => result.current.onSubmit(false, { ...options, useAiEstimate: true }));
    expect(toast.error).toHaveBeenCalledWith('AI is experiencing high demand right now. Please try again shortly.', {
      id: 'log-toast',
      description: 'Your draft is kept. You can retry or enter nutrition values yourself.',
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.mealName).toBe('Food');
    expect(result.current.isLoading).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
    await act(() => result.current.onSubmit(false, { ...options, useAiEstimate: true }));
    const calls = vi.mocked(api.post).mock.calls;
    expect((calls[0][1] as { requestKey: string }).requestKey).toBe((calls[1][1] as { requestKey: string }).requestKey);
    expect(result.current.warning?.confirmationId).toBe('preview');
  });

  it('explains connection failures and avoids claiming a timed-out confirmation was not saved', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
      .mockResolvedValueOnce(response(preview))
      .mockRejectedValueOnce(Object.assign(new Error('timeout of 120000ms exceeded'), { code: 'ECONNABORTED' }));
    const { result } = renderHook(() => useOutsideMealLog(vi.fn()));
    await act(() => result.current.onSubmit(false, options));
    expect(toast.error).toHaveBeenCalledWith('We could not connect. Check your internet connection and try again.', {
      id: 'log-toast',
    });
    await act(() => result.current.onSubmit(false, options));
    await act(() => result.current.onSubmit(true));
    expect(toast.error).toHaveBeenLastCalledWith(
      'The request took too long. Retry to check whether your food was saved.',
      { id: 'log-toast' }
    );
    expect(result.current.warning?.confirmationId).toBe('preview');
  });

  it('does not present photo-upload failure as a failed meal save', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(response(preview))
      .mockResolvedValueOnce(response(saved))
      .mockRejectedValueOnce(new Error('Photo failed'));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useOutsideMealLog(onSaved));
    await act(() =>
      result.current.onSubmit(false, { ...options, imageFile: new File(['image'], 'meal.png', { type: 'image/png' }) })
    );
    await act(() => result.current.onSubmit(true));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Food saved, but the photo could not be attached.');
  });

  it('preserves conflict feedback in a saved Sonner notification', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(response(preview))
      .mockResolvedValueOnce(
        response({
          ...saved,
          safetyFollowUp: { status: 'CONFLICT_DETECTED', messages: ['Possible nut allergy conflict'] },
        })
      );
    const { result } = renderHook(() => useOutsideMealLog(vi.fn()));
    await act(() => result.current.onSubmit(false, options));
    await act(() => result.current.onSubmit(true));
    expect(toast.warning).toHaveBeenCalledWith(
      'Food logged — possible conflict',
      expect.objectContaining({ description: 'Possible nut allergy conflict' })
    );
  });
  it('discards a delayed response after leaving the page', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }) as never
    );
    const onSaved = vi.fn();
    const { result, unmount } = renderHook(() => useOutsideMealLog(onSaved, 'owner'));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.onSubmit(false, options);
    });
    unmount();
    await act(async () => {
      finish(response(saved));
      await pending;
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith('log-toast');
  });
  it('clears the draft and ignores an old account response when the owner changes', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }) as never
    );
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(({ owner }) => useOutsideMealLog(onSaved, owner), {
      initialProps: { owner: 'first' },
    });
    act(() => {
      result.current.setIsOpen(true);
      result.current.onMealNameChange('Private draft');
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.onSubmit(false, options);
    });
    rerender({ owner: 'second' });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.mealName).toBe('');
    await act(async () => {
      finish(response(saved));
      await pending;
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

it('keeps the preview after a rejected RND admission, then saves without requesting review', async () => {
  vi.mocked(api.post).mockResolvedValueOnce(response(preview));
  const onSaved = vi.fn();
  const { result } = renderHook(() => useOutsideMealLog(onSaved));
  await act(async () => {
    await result.current.onSubmit(false, options);
  });
  vi.mocked(api.post).mockRejectedValueOnce({
    response: { status: 429, data: { code: 'MEMBERSHIP_USAGE_LIMIT', error: 'Review allowance used' } },
  });
  await act(async () => {
    await result.current.onSubmit(true, undefined, true);
  });
  expect(api.post).toHaveBeenLastCalledWith(
    '/user/meals/log-outside',
    expect.objectContaining({ requestRndReview: true })
  );
  expect(onSaved).not.toHaveBeenCalled();
  expect(result.current.warning?.confirmationId).toBe('preview');
  vi.mocked(api.post).mockResolvedValueOnce(response(saved));
  await act(async () => {
    await result.current.onSubmit(true);
  });
  expect(api.post).toHaveBeenLastCalledWith(
    '/user/meals/log-outside',
    expect.not.objectContaining({ requestRndReview: true })
  );
  expect(onSaved).toHaveBeenCalledOnce();
});
