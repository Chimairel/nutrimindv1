import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import OutsideMealHistoryItems from './OutsideMealHistoryItems';
import { useMealHistoryCardModel } from './useMealHistoryCardModel';
import type { MealHistoryLog } from '@/features/meals/meals-workspace.types';
const refresh = vi.fn();
vi.mock('@/features/membership/MembershipProvider', () => ({
  useMembership: () => ({ data: { enabled: false }, refresh }),
}));
const onRequest = vi.fn();
const item = {
  id: 'food-1',
  name: 'Food',
  currentRevision: 0,
  includedInTotals: true,
  calories: 200,
  portionGrams: 100,
};
const log: MealHistoryLog = {
  id: 'log',
  mealName: 'Lunch',
  loggedAt: '2026-10-11T02:00:00Z',
  source: 'USER_LOGGED',
  status: 'DONE',
  calories: 400,
  proteinG: 20,
  carbsG: 50,
  fatG: 14,
  outsideItems: [item, { ...item, id: 'food-2' }],
};
function Harness({ record = log }: { record?: MealHistoryLog }) {
  const model = useMealHistoryCardModel({
    log: record,
    onRequestOutsideReview: onRequest,
    onObservedConsent: vi.fn(),
    onReplyToOutsideReview: vi.fn(),
  });
  return <OutsideMealHistoryItems model={model} />;
}
beforeEach(() => vi.clearAllMocks());
it('offers one request for the whole meal rather than one per food item', async () => {
  render(<Harness />);
  expect(screen.getAllByRole('button', { name: 'Ask RND to review' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Ask RND to review' }));
  await waitFor(() => expect(onRequest).toHaveBeenCalledWith('log', 'food-1'));
  expect(refresh).toHaveBeenCalledOnce();
});
it('retains legacy automatic tasks as history without presenting them as admitted', () => {
  render(
    <Harness
      record={{ ...log, outsideItems: [{ ...item, review: { id: 'old', status: 'NEEDS_MORE_INFO', messages: [] } }] }}
    />
  );
  expect(screen.getByText('No RND review requested')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Clarification reply' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ask RND to review' })).toBeEnabled();
});
it('does not reopen unchanged completed estimates or request more allowance while open', () => {
  const review = {
    id: 'review',
    status: 'VERIFIED',
    requestedByUserAt: '2026-10-11T01:00:00Z',
    reviewedRevision: 0,
    messages: [],
  };
  const { rerender } = render(<Harness record={{ ...log, outsideItems: [{ ...item, currentRevision: 1, review }] }} />);
  expect(screen.getByText('RND-reviewed estimate')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ask RND to review' })).not.toBeInTheDocument();
  rerender(<Harness record={{ ...log, outsideItems: [{ ...item, review: { ...review, status: 'PENDING' } }] }} />);
  expect(screen.queryByRole('button', { name: 'Ask RND to review' })).not.toBeInTheDocument();
});
it('labels a changed reviewed item and prevents consent to reuse its stale review', () => {
  render(
    <Harness
      record={{
        ...log,
        outsideItems: [
          {
            ...item,
            currentRevision: 2,
            review: {
              id: 'review',
              status: 'VERIFIED',
              requestedByUserAt: '2026-10-11T01:00:00Z',
              reviewedRevision: 0,
              messages: [],
            },
          },
        ],
      }}
    />
  );
  expect(screen.getByText('Previous review: this item has changed')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ask RND to review' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Optionally share deidentified food details' })).not.toBeInTheDocument();
});
