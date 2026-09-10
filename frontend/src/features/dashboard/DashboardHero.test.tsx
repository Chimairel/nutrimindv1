import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardHero } from './DashboardHero';

describe('DashboardHero', () => {
  it('does not infer verification from absence of pending review', () => {
    const navigate = vi.fn();
    render(<DashboardHero onOpenWeeklyPlan={navigate} />);
    expect(screen.getByText('No active plan')).toBeInTheDocument();
    expect(screen.queryByText(/PRC RND Verified/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Weekly Plan' }));
    expect(navigate).toHaveBeenCalledOnce();
  });
});
