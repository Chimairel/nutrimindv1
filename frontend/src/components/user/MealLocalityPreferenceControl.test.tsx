import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealLocalityPreferenceControl from './MealLocalityPreferenceControl';

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          regions: ['Central Visayas', 'Bicol Region'],
          provinceHucs: [{ name: 'Cebu City', regionName: 'Central Visayas' }],
        },
      },
    }),
  },
}));

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
    await waitFor(() => expect(slider).toHaveAttribute('aria-valuetext', 'Central Visayas'));
    expect(screen.getByRole('button', { name: 'Philippines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cebu City' })).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('LOCAL');
  });

  it('locks invalid typed names and provinces outside the chosen region', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MealLocalityPreferenceControl
        value="NATIONAL"
        regionName="Unknown"
        provinceHucName="Cebu City"
        onChange={onChange}
      />
    );
    expect(screen.getByRole('button', { name: 'Unknown' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cebu City' })).toBeDisabled();
    expect(screen.getByText(/Choose a valid Region/)).toBeInTheDocument();
    rerender(
      <MealLocalityPreferenceControl
        value="NATIONAL"
        regionName="Bicol Region"
        provinceHucName="Cebu City"
        onChange={onChange}
      />
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bicol Region' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Cebu City' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('REGIONAL');
  });

  it('locks all controls while saving and describes prerequisites on the slider', async () => {
    render(
      <MealLocalityPreferenceControl
        value="NATIONAL"
        regionName="Central Visayas"
        provinceHucName=""
        disabled
        onChange={vi.fn()}
      />
    );
    await screen.findByText(/Choose a valid Province/);
    expect(screen.getByRole('slider')).toHaveAccessibleDescription(/Choose a valid Province/);
    expect(screen.getByRole('button', { name: 'Central Visayas' })).toBeDisabled();
  });

  it('does not offer a local stop until a province/HUC is saved', () => {
    render(
      <MealLocalityPreferenceControl value="REGIONAL" regionName="Bicol Region" provinceHucName="" onChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Province/HUC' })).toBeDisabled();
  });
});
