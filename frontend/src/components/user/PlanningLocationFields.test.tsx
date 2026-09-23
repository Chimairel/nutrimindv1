import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PlanningLocationFields from './PlanningLocationFields';

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          regions: ['Central Visayas'],
          provinceHucs: [{ name: 'Cebu City', regionName: 'Central Visayas' }],
          source: { version: '2Q 2026' },
        },
      },
    }),
  },
}));

describe('PlanningLocationFields', () => {
  it('always presents two coarse searchable location fields without an evidence-level selector', async () => {
    render(
      <PlanningLocationFields
        level="PROVINCE_HUC"
        regionName="Central Visayas"
        provinceHucName="Cebu City"
        onLevelChange={vi.fn()}
        onRegionNameChange={vi.fn()}
        onProvinceHucNameChange={vi.fn()}
      />
    );

    expect(screen.getByRole('group', { name: 'Meal-planning location' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Region' })).toHaveValue('Region VII (Central Visayas)');
    expect(screen.getByRole('combobox', { name: 'Province / highly urbanized city' })).toHaveValue('Cebu City');
    expect(screen.queryByRole('combobox', { name: 'Evidence area' })).not.toBeInTheDocument();
    expect(await screen.findByText(/PSA PSGC 2Q 2026/i)).toBeInTheDocument();
  });

  it('derives location completeness and clears an incompatible province when region changes', async () => {
    const user = userEvent.setup();
    const onLevelChange = vi.fn();
    const onProvinceHucNameChange = vi.fn();
    render(
      <PlanningLocationFields
        level="PROVINCE_HUC"
        regionName="Central Visayas"
        provinceHucName="Cebu City"
        onLevelChange={onLevelChange}
        onRegionNameChange={vi.fn()}
        onProvinceHucNameChange={onProvinceHucNameChange}
      />
    );

    await user.clear(screen.getByRole('combobox', { name: 'Region' }));
    expect(onLevelChange).toHaveBeenLastCalledWith('NATIONAL');
    expect(onProvinceHucNameChange).toHaveBeenCalledWith('');
  });

  it('allows the national default without a location and requires only the selected detail level', () => {
    const callbacks = {
      onLevelChange: vi.fn(),
      onRegionNameChange: vi.fn(),
      onProvinceHucNameChange: vi.fn(),
      required: true,
    };
    const { rerender } = render(
      <PlanningLocationFields level="NATIONAL" regionName="" provinceHucName="" {...callbacks} />
    );
    expect(screen.getByRole('combobox', { name: 'Region' })).not.toBeRequired();
    expect(screen.getByRole('combobox', { name: 'Province / highly urbanized city' })).not.toBeRequired();

    rerender(<PlanningLocationFields level="REGION" regionName="Central Visayas" provinceHucName="" {...callbacks} />);
    expect(screen.getByRole('combobox', { name: 'Region' })).toBeRequired();
    expect(screen.getByRole('combobox', { name: 'Province / highly urbanized city' })).not.toBeRequired();

    rerender(
      <PlanningLocationFields level="PROVINCE_HUC" regionName="Central Visayas" provinceHucName="" {...callbacks} />
    );
    expect(screen.getByRole('combobox', { name: 'Province / highly urbanized city' })).toBeRequired();
  });
});
