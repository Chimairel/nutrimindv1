import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MealPlanGenerationProgress from './MealPlanGenerationProgress';

describe('MealPlanGenerationProgress', () => {
  it('renders centered without an enclosing card box/div', () => {
    const { container } = render(
      <MealPlanGenerationProgress progress={45} elapsedSeconds={20} stageMessage="Balancing weekly meals" />
    );

    expect(screen.getByText(/Building your weekly meal plan/i)).toBeInTheDocument();
    expect(screen.getByText('Balancing weekly meals')).toBeInTheDocument();
    expect(screen.getByLabelText(/Estimated meal plan generation progress: 45%/i)).toBeInTheDocument();

    const cardBox = container.querySelector('.shadow-card-lg');
    expect(cardBox).toBeNull();
  });

  it('renders completed state cleanly when progress is 100%', () => {
    render(<MealPlanGenerationProgress progress={100} elapsedSeconds={35} />);

    expect(screen.getByText(/Your meal plan is ready!/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
  });
});
