import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { clearSessionResourceCache, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { GroceryPreviewCard } from './GroceryPreviewCard';
import type { GroceryPageSnapshot } from '@/features/grocery/current-grocery';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const list = {
  id: 'list',
  weekLabel: 'Test cycle',
  generatedAt: '',
  groceryItems: [
    {
      id: 'rice',
      ingredientName: 'Rice',
      category: 'Grains',
      isChecked: false,
      quantity: 100,
      unit: 'g',
      sourceMealCount: 1,
      isPantryStaple: false,
    },
  ],
};
const get = vi.mocked(api.get);
beforeEach(() => {
  clearSessionResourceCache();
  get.mockReset();
});

function respond(approved: unknown[], pending: number) {
  get.mockImplementation(async (url) => ({
    data:
      url === '/user/grocery/current'
        ? { success: true, data: list }
        : { success: true, data: approved, meta: { pendingReview: { mealCount: pending } } },
  }));
}

describe('GroceryPreviewCard', () => {
  it('suppresses stale groceries when no current approved meals exist and caches authoritative pending count', async () => {
    respond([], 3);
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(await screen.findByRole('status')).toHaveTextContent('3 meals awaiting review');
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    expect(readSessionResource('fixture', 'user-grocery-page')).toEqual({ groceryList: null, pendingMealCount: 3 });
  });
  it('keeps a partial approved checklist alongside pending warnings', async () => {
    respond([{ id: 'approved' }], 2);
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(await screen.findByText('Rice')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 meals awaiting review');
  });
  it('renders cached content immediately but rechecks approval on mount', async () => {
    writeSessionResource('fixture', 'user-grocery-page', { groceryList: list, pendingMealCount: 1 });
    respond([], 4);
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(screen.getByText('Rice')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Rice')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('4 meals awaiting review');
  });
  it('does not turn failed review validation into an empty or falsely safe cached list', async () => {
    writeSessionResource('fixture', 'user-grocery-page', { groceryList: list, pendingMealCount: 5 });
    get.mockResolvedValue({ data: { success: false } });
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    expect(readSessionResource<GroceryPageSnapshot>('fixture', 'user-grocery-page')?.pendingMealCount).toBe(5);
  });
  it('does not leak cached groceries or late responses into another owner', async () => {
    const finish: Array<(value: unknown) => void> = [];
    get.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish.push(resolve);
        })
    );
    writeSessionResource('first', 'user-grocery-page', { groceryList: list, pendingMealCount: 0 });
    const { rerender } = render(<GroceryPreviewCard ownerId="first" onNavigateToGrocery={vi.fn()} />);
    rerender(<GroceryPreviewCard onNavigateToGrocery={vi.fn()} />);
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    await act(async () => {
      finish[0]({ data: { success: true, data: list } });
      finish[1]({ data: { success: true, data: [] } });
    });
    expect(readSessionResource<GroceryPageSnapshot>('first', 'user-grocery-page')?.groceryList).toEqual(list);
    expect(readSessionResource(undefined, 'user-grocery-page')).toBeNull();
  });
});
