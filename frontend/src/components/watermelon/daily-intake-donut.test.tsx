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

  it('renders provisional estimated calories with distinct indicator and aria-label', () => {
    render(<DailyIntakeDonut consumed={800} target={2000} provisional={300} />);
    const gauge = screen.getByRole('img', {
      name: /Daily calorie intake: 40%, 800 of 2000 calories \(includes 300 estimated calories\)/i,
    });
    expect(gauge).toBeInTheDocument();
    expect(screen.getByText(/Intake\*/)).toBeInTheDocument();
  });

  it('handles 100% estimated calories (all from outside meals)', () => {
    render(<DailyIntakeDonut consumed={450} target={1800} provisional={450} />);
    const gauge = screen.getByRole('img', {
      name: /Daily calorie intake: 25%, 450 of 1800 calories \(includes 450 estimated calories\)/i,
    });
    expect(gauge).toBeInTheDocument();
  });
});
