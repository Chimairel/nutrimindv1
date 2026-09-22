import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckinModal, { buildDirtyCheckinUpdates } from './CheckinModal';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ updateUserSession: vi.fn() }),
}));

describe('CheckinModal', () => {
  it('lets the user close without recording a response', () => {
    const onClose = vi.fn();
    render(<CheckinModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('submits only values that differ from the prefilled profile', () => {
    const initial = { weightKg: '70', activityLevel: 'ACTIVE', goal: 'MAINTAIN' };
    expect(buildDirtyCheckinUpdates(initial, { ...initial, goal: 'BUILD_MUSCLE' })).toEqual({
      goal: 'BUILD_MUSCLE',
    });
    expect(buildDirtyCheckinUpdates(initial, initial)).toEqual({});
  });
});
