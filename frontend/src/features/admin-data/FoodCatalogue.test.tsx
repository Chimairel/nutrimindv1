import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FoodCatalogue from './FoodCatalogue';

const foods = {
  foods: [
    {
      id: 'rice',
      name: 'Rice, white, boiled',
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      aliases: [],
    },
  ],
  total: 1537,
  page: 1,
  limit: 12,
  totalPages: 129,
};

describe('FoodCatalogue', () => {
  it('renders the API calorie field and dynamic canonical count', () => {
    render(<FoodCatalogue initialFoods={foods} canonicalFoodCount={1537} onChanged={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByText(/1,537 nutrient records remain canonical/)).toBeInTheDocument();
    expect(screen.getByText(/130 kcal/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'FNRI catalogue pages' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 129')).toBeInTheDocument();
  });

  it('opens a labelled alias-editing region', async () => {
    const user = userEvent.setup();
    render(<FoodCatalogue initialFoods={foods} canonicalFoodCount={1537} onChanged={vi.fn()} onError={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add alias' }));
    expect(screen.getByRole('region', { name: 'Add a verified alias for Rice, white, boiled' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Verified alias' })).toBeInTheDocument();
  });
});
