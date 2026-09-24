import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('renders failure state cleanly with error message and action controls', () => {
    const onRetry = vi.fn();
    const onCancel = vi.fn();

    render(
      <MealPlanGenerationProgress
        progress={45}
        elapsedSeconds={20}
        stageMessage="Plan generation could not be completed."
        isFailed={true}
        onRetry={onRetry}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/Plan generation interrupted/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Plan generation could not be completed/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Generation stopped/i)).toBeInTheDocument();

    // Verify retry and cancel buttons
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    expect(retryBtn).toBeInTheDocument();
    retryBtn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByRole('button', { name: /Return to Dashboard/i });
    expect(cancelBtn).toBeInTheDocument();
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
