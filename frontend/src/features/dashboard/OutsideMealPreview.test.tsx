import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import PreviewConfirmation from './OutsideMealPreview';
import type { OutsideMealModalProps } from './outside-meal-modal.types';

const membership = vi.hoisted(() => ({
  data: null as null | {
    enabled: boolean;
    enhanced: boolean;
    healthAccess: boolean;
    resetsAt: string;
    usage: { OUTSIDE_REVIEW: { used: number; cap: number; remaining: number } };
  },
  isLoading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));
vi.mock('@/features/membership/MembershipProvider', () => ({ useMembership: () => membership }));
const macros = { calories: 400, proteinG: 20, carbsG: 50, fatG: 14 };
const props: OutsideMealModalProps & { warning: NonNullable<OutsideMealModalProps['warning']> } = {
  isLoading: false,
  isOpen: true,
  mealName: 'Reported meal',
  mealType: 'LUNCH',
  notes: '',
  onClose: vi.fn(),
  onMealNameChange: vi.fn(),
  onMealTypeChange: vi.fn(),
  onNotesChange: vi.fn(),
  onSubmit: vi.fn(),
  onWarningCancel: vi.fn(),
  warning: {
    confirmationId: 'preview',
    usedAi: true,
    warnings: [],
    reasons: ['Preparation is unrecorded'],
    estimate: macros,
    items: [
      {
        name: 'Reported food',
        portionGrams: null,
        source: 'GEMINI_ESTIMATED',
        nutritionStatus: 'PENDING_REVIEW',
        includedInTotals: true,
        ...macros,
        calorieLow: 300,
        calorieHigh: 500,
        warnings: [],
      },
    ],
    summary: { provisionalCalories: 400, provisionalItemCount: 1, unresolvedItemCount: 0, completeness: 'COMPLETE' },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  membership.error = null;
  membership.isLoading = false;
  membership.data = {
    enabled: true,
    enhanced: true,
    healthAccess: true,
    resetsAt: '2026-10-11T16:00:00Z',
    usage: { OUTSIDE_REVIEW: { used: 0, cap: 1, remaining: 1 } },
  };
});
it('saves an estimate separately from requesting one whole-meal review', () => {
  render(<PreviewConfirmation {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use estimate' }));
  expect(props.onSubmit).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Ask RND to review' }));
  expect(props.onSubmit).toHaveBeenLastCalledWith(true, undefined, true);
  expect(screen.getByText(/1 of 1 meal reviews left/)).toBeInTheDocument();
  expect(screen.getByText(/300–500 kcal/)).toBeInTheDocument();
});
it.each(['quota', 'lifestyle', 'loading', 'error'])(
  'keeps saving available when review is unavailable: %s',
  (state) => {
    if (state === 'quota') membership.data!.usage.OUTSIDE_REVIEW.remaining = 0;
    if (state === 'lifestyle') membership.data!.healthAccess = false;
    if (state === 'loading') membership.isLoading = true;
    if (state === 'error') membership.error = 'Unavailable';
    render(<PreviewConfirmation {...props} />);
    expect(screen.getByRole('button', { name: 'Ask RND to review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use estimate' })).toBeEnabled();
    if (state === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Retry allowance' }));
      expect(membership.refresh).toHaveBeenCalledOnce();
    }
  }
);
