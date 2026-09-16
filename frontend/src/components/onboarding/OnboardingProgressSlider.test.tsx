import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OnboardingProgressSlider from './OnboardingProgressSlider';

describe('OnboardingProgressSlider', () => {
  it('renders active step and progress percentage properly', () => {
    render(<OnboardingProgressSlider currentStep={3} totalSteps={6} />);

    expect(screen.getByText(/Step 3 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/50% Completed/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  });

  it('clamps values within bounds', () => {
    render(<OnboardingProgressSlider currentStep={10} totalSteps={6} />);

    expect(screen.getByText(/Step 6 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Completed/i)).toBeInTheDocument();
  });
});
