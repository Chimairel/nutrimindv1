import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DailyIntakeDonut, AnimatedValue } from './daily-intake-donut';

describe('DailyIntakeDonut', () => {
  it('renders with accessible role and aria-label', () => {
    render(<DailyIntakeDonut consumed={500} target={2000} />);
    const gauge = screen.getByRole('img', { name: /Daily calorie intake: 25%, 500 of 2000 calories/i });
    expect(gauge).toBeInTheDocument();
  });

  it('handles zero consumed calories without negative values', () => {
    render(<DailyIntakeDonut consumed={0} target={2000} />);
    const gauge = screen.getByRole('img', { name: /Daily calorie intake: 0%, 0 of 2000 calories/i });
    expect(gauge).toBeInTheDocument();
  });

  it('renders animated value component', () => {
    render(<AnimatedValue value={100} suffix=" kcal" />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });
});
