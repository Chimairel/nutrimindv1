import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import MealImage, { resolveMealCategory, resolveCanonicalReviewedImage } from './MealImage';

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
  it.each(['Beef tapa with egg', 'Beef with cabbage', 'Pork with vegetables'])(
    'keeps primary meat visible in %s',
    (name) => {
      expect(resolveMealCategory(name).category).toBe('meat');
    }
  );

  it('uses structured primary ingredients and avoids eggplant/egg substring collisions', () => {
    expect(
      resolveMealCategory('Vegetable plate', 'LUNCH', [{ ingredientName: 'Beef', category: 'Meat & Poultry' }]).category
    ).toBe('meat');
    expect(resolveMealCategory('Eggplant adobo').category).toBe('plant-based');
    expect(resolveMealCategory('Chicken with cabbage').category).toBe('poultry-egg');
  });

  it('only assigns approved exact recipe names and retains source attribution', () => {
    expect(resolveCanonicalReviewedImage('Chicken adobo')).toBeNull();
    expect(resolveCanonicalReviewedImage('Beef tapa with egg')).toBeNull();
    expect(resolveCanonicalReviewedImage('Banana Peanut Butter Oatmeal')?.attribution.creator).toBe(
      'Renee Comet (Photographer)'
    );
    expect(resolveCanonicalReviewedImage('Beef Rice Bowl with Cabbage')?.attribution.sourcePageUrl).toContain(
      'Braised_Beef_Shin_Rice_Bowl'
    );
  });

  it('recovers when a failed image is replaced and disables skeleton motion', () => {
    const { rerender, container } = render(<MealImage mealName="Pancit" image={mockImage} />);
    expect(container.querySelector('.animate-pulse')).toHaveClass('motion-reduce:animate-none');
    fireEvent.error(screen.getByRole('img'));
    rerender(<MealImage mealName="Pancit" image={{ ...mockImage, url: '/replacement.jpg' }} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/replacement.jpg');
  });
  it('renders representative fallback with category awareness for missing images when placeholder is disabled', () => {
    render(<MealImage mealName="Chicken Tinola" mealType="LUNCH" allowMealTypePlaceholder={false} />);
    expect(screen.getByRole('figure', { name: /Chicken Tinola/ })).toBeInTheDocument();
    expect(screen.getByText('Illustration')).toBeInTheDocument();
    expect(screen.getByText('Poultry & Egg')).toBeInTheDocument();
    expect(screen.getByText(/Recipe photo coming soon/i)).toBeInTheDocument();
  });

  it('renders authentic culinary photo placeholders for breakfast, lunch, dinner, and snack by default', () => {
    const { rerender } = render(<MealImage mealName="Chicken Tinola" mealType="LUNCH" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/meals/placeholder-lunch.jpg');
    expect(screen.getByText('Representative image')).toBeInTheDocument();

    rerender(<MealImage mealName="Tapsilog" mealType="BREAKFAST" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/meals/placeholder-breakfast.jpg');

    rerender(<MealImage mealName="Sinigang na Baboy" mealType="DINNER" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/meals/placeholder-dinner.jpg');

    rerender(<MealImage mealName="Turon" mealType="SNACK" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/meals/placeholder-snack.jpg');
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
    render(<MealImage mealName="Tuna Rice Bowl" mealType="LUNCH" image={mockImage} allowMealTypePlaceholder={false} />);
    const photo = screen.getByRole('img', { name: mockImage.altText });
    fireEvent.error(photo);

    expect(screen.getByRole('figure', { name: /Tuna Rice Bowl/ })).toBeInTheDocument();
    expect(screen.getByText('Illustration')).toBeInTheDocument();
    expect(screen.getByText('Seafood')).toBeInTheDocument();
  });

  it('uses the recipe video thumbnail if the Panlasang article photo fails to load', () => {
    const image = {
      ...mockImage,
      url: 'https://panlasangpinoy.com/wp-content/uploads/recipe.jpg',
      kind: 'EXACT' as const,
      fallback: {
        ...mockImage,
        url: 'https://i.ytimg.com/vi/uXi6QDOdhGg/mqdefault.jpg',
        kind: 'EXACT' as const,
      },
    };
    render(<MealImage mealName="Pancit" image={image} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', image.fallback.url);
  });

  it('represents Cloudinary modification disclosure in attribution', () => {
    render(<MealImage mealName="Pancit" mealType="DINNER" image={mockImage} />);
    const attributionElement = screen.getByText('Example Creator · CC_BY_4_0 · adapted');
    expect(attributionElement).toHaveAttribute('title', mockImage.attribution.modifications);
  });

  it('renders thumbnail variant for dense cockpit rows with real image and category fallback', () => {
    const { container: photoContainer } = render(
      <MealImage mealName="Pancit" mealType="DINNER" image={mockImage} variant="thumbnail" />
    );
    expect(screen.getByRole('img', { name: mockImage.altText })).toBeInTheDocument();
    expect(photoContainer.querySelectorAll('a')).toHaveLength(0);

    render(
      <MealImage
        mealName="Sinigang na Baboy"
        mealType="DINNER"
        variant="thumbnail"
        allowCanonicalFallback={false}
        allowMealTypePlaceholder={false}
      />
    );
    expect(screen.getByLabelText('Sinigang na Baboy (Meat & Savory visual placeholder)')).toBeInTheDocument();
  });
});
