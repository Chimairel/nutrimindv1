import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { MealLocalityPreference } from '@/types';
import PlanningLocationFields from './PlanningLocationFields';
import MealLocalityPreferenceControl from './MealLocalityPreferenceControl';

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          regions: ['Central Visayas'],
          provinceHucs: [{ name: 'Cebu City', regionName: 'Central Visayas' }],
        },
      },
    }),
  },
}));

function Journey() {
  const [region, setRegion] = useState('');
  const [province, setProvince] = useState('');
  const [preference, setPreference] = useState<MealLocalityPreference>('NATIONAL');
  return (
    <>
      <PlanningLocationFields
        level="NATIONAL"
        regionName={region}
        provinceHucName={province}
        onRegionNameChange={setRegion}
        onProvinceHucNameChange={setProvince}
        onLevelChange={() => {}}
      />
      <MealLocalityPreferenceControl
        value={preference}
        regionName={region}
        provinceHucName={province}
        onChange={setPreference}
      />
    </>
  );
}

it('unlocks regional and local preferences only as valid locations are selected', async () => {
  const user = userEvent.setup();
  render(<Journey />);
  expect(screen.getByRole('button', { name: 'Region' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Province/HUC' })).toBeDisabled();
  await user.type(screen.getByRole('combobox', { name: 'Region' }), 'Central Visayas');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Central Visayas' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Central Visayas' }));
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Central Visayas');
  await user.type(screen.getByRole('combobox', { name: 'Province / highly urbanized city' }), 'Cebu City');
  await user.click(screen.getByRole('button', { name: 'Cebu City' }));
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cebu City');
  await user.clear(screen.getByRole('combobox', { name: 'Region' }));
  expect(screen.getByRole('combobox', { name: 'Province / highly urbanized city' })).toHaveValue('');
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Philippines');
});
