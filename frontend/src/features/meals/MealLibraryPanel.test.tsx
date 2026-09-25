import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealLibraryPanel from './MealLibraryPanel';
import type { useMealsWorkspace } from './useMealsWorkspace';

vi.mock('@/components/user/MealImage', () => ({
  default: ({ mealName }: { mealName: string }) => <div aria-label={`Image of ${mealName}`} />,
}));

const noOp = vi.fn();

describe('Meal Library', () => {
  it('shows owner-scoped plan approvals without calling them reusable certified recipes', () => {
    const workspace = {
      handleLibrarySearchSubmit: noOp,
      librarySearch: '',
      setLibrarySearch: noOp,
      libraryMealType: 'All',
      setLibraryMealType: noOp,
      isLibraryLoading: false,
      libraryError: null,
      libraryMeals: [],
      setSelectedVerifier: noOp,
      libraryFavoriteOnly: false,
      setLibraryFavoriteOnly: noOp,
      libraryRiceRole: 'All',
      setLibraryRiceRole: noOp,
      libraryNextCursor: null,
      loadMoreLibrary: noOp,
      toggleLibraryFavorite: noOp,
      libraryTotalCount: 0,
      meals: [{
        id: 'approved-plan-meal',
        status: 'APPROVED',
        mealName: 'Corned Beef Sinigang',
        mealType: 'DINNER',
        calories: 771,
        proteinG: 54,
        carbsG: 32,
        fatG: 48,
        libraryMealId: null,
      }],
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    render(<MealLibraryPanel workspace={workspace} />);

    expect(screen.getByText('Corned Beef Sinigang')).toBeInTheDocument();
    expect(screen.getByText('Approved for you')).toBeInTheDocument();
    expect(screen.getByText('In your plan')).toBeInTheDocument();
    expect(screen.queryByText('No Recipes Found')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View planned meal' })).toHaveAttribute('href', '/dashboard/approved-plan-meal');
  });
});
