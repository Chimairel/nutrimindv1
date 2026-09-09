import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import MealImage, { resolveMealCategory } from './MealImage';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return React.createElement('img', imgProps);
  },
}));

const mockImage = {
  url: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
  altText: 'A plate of vegetable pancit',
  kind: 'REPRESENTATIVE' as const,
  attribution: {
    creator: 'Example Creator',
    licenseCode: 'CC_BY_4_0',
    sourcePageUrl: 'https://example.com/source',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modifications: 'Resized, format-optimized, and cropped for display.',
  },
};

describe('MealImage', () => {
  it('renders representative fallback with category awareness for missing images', () => {
    render(<MealImage mealName="Chicken Tinola" mealType="LUNCH" />);
    expect(screen.getByText('Chicken Tinola')).toBeInTheDocument();
    expect(screen.getByText('Representative visual')).toBeInTheDocument();
    expect(screen.getByText('Poultry & Egg')).toBeInTheDocument();
    expect(screen.getByText(/Visual placeholder · Structured recipe in plan/i)).toBeInTheDocument();
  });

  it('detects seafood, plant-based, meat, and breakfast categories correctly in fallbacks', () => {
    expect(resolveMealCategory('Sinigang na Bangus', 'LUNCH').category).toBe('seafood');
    expect(resolveMealCategory('Ginisang Monggo with Malunggay', 'LUNCH').category).toBe('plant-based');
    expect(resolveMealCategory('Beef Bistek Tagalog', 'DINNER').category).toBe('meat');
    expect(resolveMealCategory('Warm Pandesal with Jam', 'BREAKFAST').category).toBe('breakfast-grain');
  });

  it('retains visible representative disclosure when remote photo is present', () => {
    render(<MealImage mealName="Pancit" mealType="DINNER" image={mockImage} />);
    expect(screen.getByText('Representative image')).toBeInTheDocument();
  });

  it('renders concise non-interactive attribution in compact variant and avoids nested anchor tags', () => {
    const { container } = render(
      <MealImage mealName="Pancit" mealType="DINNER" image={mockImage} variant="compact" showAttributionLinks />
    );
    expect(screen.getByText('Example Creator · CC_BY_4_0 · adapted')).toBeInTheDocument();
    // Compact mode must never emit interactive links inside clickable cards
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders accessible interactive attribution links with target="_blank" in detail mode', () => {
    render(<MealImage mealName="Pancit" mealType="DINNER" image={mockImage} variant="detail" showAttributionLinks />);
    const sourceLink = screen.getByRole('link', { name: /Source page for Pancit image/i });
    const licenseLink = screen.getByRole('link', { name: /License for Pancit image/i });

    expect(sourceLink).toHaveAttribute('href', mockImage.attribution.sourcePageUrl);
    expect(sourceLink).toHaveAttribute('target', '_blank');
    expect(sourceLink).toHaveAttribute('rel', 'noreferrer noopener');

    expect(licenseLink).toHaveAttribute('href', mockImage.attribution.licenseUrl);
    expect(licenseLink).toHaveAttribute('target', '_blank');
    expect(licenseLink).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('switches gracefully to category fallback when remote image delivery fails', () => {
    render(<MealImage mealName="Tuna Rice Bowl" mealType="LUNCH" image={mockImage} />);
    const photo = screen.getByRole('img', { name: mockImage.altText });
    fireEvent.error(photo);

    expect(screen.getByText('Tuna Rice Bowl')).toBeInTheDocument();
    expect(screen.getByText('Representative visual')).toBeInTheDocument();
    expect(screen.getByText('Seafood')).toBeInTheDocument();
  });

  it('represents Cloudinary modification disclosure in attribution', () => {
    render(<MealImage mealName="Pancit" mealType="DINNER" image={mockImage} />);
    const attributionElement = screen.getByText('Example Creator · CC_BY_4_0 · adapted');
    expect(attributionElement).toHaveAttribute('title', mockImage.attribution.modifications);
  });
});
