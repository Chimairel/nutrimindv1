import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import MealCard from './MealCard';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return React.createElement('img', imgProps);
  },
}));

describe('MealCard', () => {
  const defaultProps = {
    id: 'meal-1',
    mealName: 'Sinigang na Hipon',
    mealType: 'LUNCH' as const,
    description: 'Sour tamarind soup with shrimp and kangkong.',
    calories: 350,
    proteinG: 28,
    carbsG: 14,
    fatG: 8,
    status: 'APPROVED' as const,
    aiConfidenceFlag: 'SAFE' as const,
    ingredients: [
      { id: 'ing-1', ingredientName: 'Shrimp' },
      { id: 'ing-2', ingredientName: 'Kangkong' },
    ],
  };

  it('renders meal card with name, macros, and Verified badge when approved', () => {
    render(<MealCard {...defaultProps} />);

    expect(screen.getAllByText('Sinigang na Hipon').length).toBeGreaterThan(0);
    expect(screen.getByText(/350 kcal/i)).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders Awaiting Review badge when status is PENDING_REVIEW', () => {
    render(<MealCard {...defaultProps} status="PENDING_REVIEW" />);

    expect(screen.getByText('Awaiting Review')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders Eaten status badge when meal is marked as DONE', () => {
    render(
      <MealCard
        {...defaultProps}
        mealLogs={[{ id: 'log-1', status: 'DONE' }]}
      />
    );

    expect(screen.getByText('Eaten')).toBeInTheDocument();
  });

  it('renders Skipped status badge when meal is marked as SKIPPED', () => {
    render(
      <MealCard
        {...defaultProps}
        mealLogs={[{ id: 'log-2', status: 'SKIPPED' }]}
      />
    );

    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('opens expandable modal and reveals details and ingredients on click', () => {
    render(<MealCard {...defaultProps} />);

    // Click to open card
    const cardButton = screen.getByRole('button', { name: /open Sinigang na Hipon details/i });
    fireEvent.click(cardButton);

    // Modal details should be visible
    expect(screen.getByText('Sour tamarind soup with shrimp and kangkong.')).toBeInTheDocument();
    expect(screen.getByText('Shrimp')).toBeInTheDocument();
    expect(screen.getByText('Kangkong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as eaten/i })).toBeInTheDocument();
  });

  it('renders verifier card with masked PRC license and opens credential modal when clicked', () => {
    const verifier = {
      name: 'Andrea Reyes',
      image: null,
      prcLicenseNumber: '0098765',
      prcLicenseExpiry: '2028-12-31T00:00:00.000Z',
      specialization: 'Clinical Nutrition & Renal Dietetics',
      yearsOfExperience: 8,
      university: 'UP Diliman',
      bio: 'Senior Clinical Nutritionist',
    };

    render(
      <MealCard
        {...defaultProps}
        verifier={verifier}
        nutritionistNote="Reduced sodium for renal support."
        reviewedAt="2026-09-17T08:00:00.000Z"
      />
    );

    // Click to open card
    const cardButton = screen.getByRole('button', { name: /open Sinigang na Hipon details/i });
    fireEvent.click(cardButton);

    // Verify RND banner shows masked PRC license and note
    expect(screen.getByText(/Andrea Reyes, RND/i)).toBeInTheDocument();
    expect(screen.getByText(/PRC Lic\. No\. ••••••8765/i)).toBeInTheDocument();
    expect(screen.getByText(/Reduced sodium for renal support\./i)).toBeInTheDocument();

    // Click to open verifier credential modal
    const verifierBtn = screen.getByRole('button', { name: /view clinical credentials for Andrea Reyes/i });
    fireEvent.click(verifierBtn);

    // NutritionistCredentialModal should be visible
    expect(screen.getByText('Verified Nutritionist')).toBeInTheDocument();
    expect(screen.getByText('Clinical Nutrition & Renal Dietetics')).toBeInTheDocument();
    expect(screen.getByText('UP Diliman')).toBeInTheDocument();
  });
});

