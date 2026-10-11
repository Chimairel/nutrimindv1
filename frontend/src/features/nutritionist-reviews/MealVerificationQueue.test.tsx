import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealVerificationQueue, { type MealCandidate } from './MealVerificationQueue';

const meal: MealCandidate = {
  kind: 'RAW_RECIPE',
  id: 'recipe',
  revisionKey: 'r1',
  name: 'Tinola',
  description: null,
  mealType: 'LUNCH',
  source: 'RAW_RECIPE_CORPUS',
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  ingredients: [],
  status: 'PENDING',
  claimedByMe: false,
  claimedByOther: true,
};
const props = {
  queue: [meal],
  selectedId: null,
  expanded: false,
  busy: false,
  isLoading: false,
  error: null,
  onSelect: vi.fn(),
  onRetry: vi.fn(),
};

describe('base recipe navigation', () => {
  it('permits preview of peer-claimed recipes without implying claim ownership or invented nutrition', () => {
    render(<MealVerificationQueue {...props} />);
    const row = screen.getByRole('button', { name: /Tinola/ });
    expect(row).toHaveTextContent('Being reviewed by another RND');
    expect(row).not.toHaveTextContent('0 kcal');
    fireEvent.click(row);
    expect(props.onSelect).toHaveBeenCalledWith('RAW_RECIPE:recipe');
  });
  it('prevents changing the selected recipe during a decision request', () => {
    render(<MealVerificationQueue {...props} selectedId="RAW_RECIPE:recipe" busy />);
    expect(screen.getByRole('button', { name: /Tinola/ })).toBeDisabled();
  });
  it('does not call a failed queue empty and offers retry', () => {
    render(<MealVerificationQueue {...props} queue={[]} error="Queue request failed" />);
    expect(screen.queryByText(/Queue clear/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });
});
