import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealLocalityPreferenceControl from './MealLocalityPreferenceControl';

describe('MealLocalityPreferenceControl', () => {
  it('shows the three dynamic stops and supports keyboard changes', async () => {
    const onChange = vi.fn();
    render(
      <MealLocalityPreferenceControl
        value="REGIONAL"
        regionName="Central Visayas"
        provinceHucName="Cebu City"
        onChange={onChange}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Meal locality strength' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Central Visayas');
    expect(screen.getByRole('button', { name: 'Philippines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cebu City' })).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('LOCAL');
  });

  it('does not offer a local stop until a province/HUC is saved', () => {
    render(
      <MealLocalityPreferenceControl value="REGIONAL" regionName="Bicol Region" provinceHucName="" onChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Province/HUC' })).toBeDisabled();
  });
});
