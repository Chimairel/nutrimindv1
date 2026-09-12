import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NutritionistGuidanceCard } from './NutritionistGuidanceCard';

describe('NutritionistGuidanceCard', () => {
  it('explains provenance without claiming advice authorship or whole-plan verification', () => {
    render(<NutritionistGuidanceCard />);
    expect(screen.getByText(/FNRI linkage describes nutrition provenance/)).toBeInTheDocument();
    expect(screen.queryByText(/Clinical Guidance|Audited by|Allergen Safe|2,500/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Health profile' })).toHaveAttribute('href', '/profile/health');
    expect(screen.getByRole('link', { name: 'View progress' })).toHaveAttribute('href', '/progress');
  });
  it('keeps pending review visible', () => {
    render(<NutritionistGuidanceCard isPendingReview />);
    expect(screen.getByRole('status')).toHaveTextContent('Pending meals are previews');
  });
});
