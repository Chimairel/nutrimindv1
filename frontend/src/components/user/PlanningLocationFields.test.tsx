import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PlanningLocationFields from './PlanningLocationFields';

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { success: true, data: { regions: [], provinceHucs: [] } } }) },
}));

describe('PlanningLocationFields', () => {
  it('collects only coarse geography and explains the evidence fallback', async () => {
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
    expect(await screen.findByRole('combobox', { name: 'Region' })).toHaveValue('Central Visayas');
    expect(screen.getByRole('combobox', { name: 'Province / HUC' })).toHaveValue('Cebu City');
    expect(screen.getByText(/Do not enter a street address/i)).toBeInTheDocument();
    expect(screen.getByText(/falls back to regional and then national data/i)).toBeInTheDocument();
  });

  it('clears locality values when national evidence is selected', async () => {
    const user = userEvent.setup();
    const onLevelChange = vi.fn();
    const onRegionNameChange = vi.fn();
    const onProvinceHucNameChange = vi.fn();
    render(
      <PlanningLocationFields
        level="REGION"
        regionName="Bicol Region"
        provinceHucName=""
        onLevelChange={onLevelChange}
        onRegionNameChange={onRegionNameChange}
        onProvinceHucNameChange={onProvinceHucNameChange}
      />
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Evidence area' }), 'NATIONAL');
    expect(onLevelChange).toHaveBeenCalledWith('NATIONAL');
    expect(onRegionNameChange).toHaveBeenCalledWith('');
    expect(onProvinceHucNameChange).toHaveBeenCalledWith('');
  });

  it('explains direct national fallback for a regional preference', () => {
    render(
      <PlanningLocationFields
        level="REGION"
        regionName="Bicol Region"
        provinceHucName=""
        onLevelChange={vi.fn()}
        onRegionNameChange={vi.fn()}
        onProvinceHucNameChange={vi.fn()}
      />
    );

    expect(screen.getByText(/falls back to national data/i)).toBeInTheDocument();
    expect(screen.queryByText(/regional and then national data/i)).not.toBeInTheDocument();
  });
});
