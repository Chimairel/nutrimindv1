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

  it('shows repeated approved plan slots as one recipe with links to both dates', () => {
    const first = {
      id: 'current-slot', status: 'APPROVED', mealName: 'Chicken Adobo Fried Rice',
      mealType: 'BREAKFAST', calories: 721, proteinG: 17, carbsG: 62, fatG: 45,
      baseRecipeSignature: 'same-recipe', composedServingSignature: 'same-serving',
      libraryMealId: null, cycleScope: 'CURRENT', scheduledDate: '2026-09-25T00:00:00.000Z',
    };
    const workspace = {
      handleLibrarySearchSubmit: noOp, librarySearch: '', setLibrarySearch: noOp,
      libraryMealType: 'All', setLibraryMealType: noOp, isLibraryLoading: false,
      libraryError: null, libraryMeals: [], setSelectedVerifier: noOp,
      libraryFavoriteOnly: false, setLibraryFavoriteOnly: noOp,
      libraryRiceRole: 'All', setLibraryRiceRole: noOp, libraryNextCursor: null,
      loadMoreLibrary: noOp, toggleLibraryFavorite: noOp, libraryTotalCount: 0,
      meals: [first, { ...first, id: 'upcoming-slot', cycleScope: 'UPCOMING', scheduledDate: '2026-10-02T00:00:00.000Z' }],
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    render(<MealLibraryPanel workspace={workspace} />);

    expect(screen.getAllByText('Chicken Adobo Fried Rice')).toHaveLength(1);
    expect(screen.getByText('In your plan · 2 times')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'This week · Sep 25' })).toHaveAttribute('href', '/dashboard/current-slot');
    expect(screen.getByRole('link', { name: 'Next week · Oct 2' })).toHaveAttribute('href', '/dashboard/upcoming-slot');
    expect(screen.getByText('0 reviewed recipes · 1 approved recipe in plan')).toBeInTheDocument();
  });

  it('labels profile-matched approvals without presenting them as broad certification', () => {
    const workspace = {
      handleLibrarySearchSubmit: noOp, librarySearch: '', setLibrarySearch: noOp,
      libraryMealType: 'All', setLibraryMealType: noOp, isLibraryLoading: false,
      libraryError: null, setSelectedVerifier: noOp, libraryFavoriteOnly: false,
      setLibraryFavoriteOnly: noOp, libraryRiceRole: 'All', setLibraryRiceRole: noOp,
      libraryNextCursor: null, loadMoreLibrary: noOp, toggleLibraryFavorite: noOp,
      libraryTotalCount: 1, meals: [],
      libraryMeals: [{
        id: 'shared-recipe', mealName: 'Vegetable Rice', mealType: 'LUNCH', mealTypes: ['LUNCH'],
        calories: 400, proteinG: 12, carbsG: 70, fatG: 8, isFavorite: false,
        verifiedBy: 'Dietitian', prcLicenseNumber: '123', reuseBasis: 'PROFILE_MATCHED_APPROVAL',
      }],
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    render(<MealLibraryPanel workspace={workspace} />);
    expect(screen.getByText('Reviewed for a matching health profile')).toBeInTheDocument();
    expect(screen.queryByText('Reusable certified recipe')).not.toBeInTheDocument();
  });
});
