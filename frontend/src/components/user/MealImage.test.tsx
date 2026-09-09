import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import MealImage from './MealImage';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return React.createElement('img', imgProps);
  },
}));

const image = {
  url: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
  altText: 'A plate of vegetable pancit',
  kind: 'REPRESENTATIVE' as const,
  attribution: { creator: 'Example Creator', licenseCode: 'CC_BY_4_0', sourcePageUrl: null, licenseUrl: null },
};

describe('MealImage', () => {
  it('labels missing images as representative rather than pretending they are exact', () => {
    render(<MealImage mealName="Chicken Tinola" mealType="LUNCH" />);
    expect(screen.getByText('Chicken Tinola')).toBeInTheDocument();
    expect(screen.getByText('Representative image')).toBeInTheDocument();
  });

  it('renders attribution and falls back when remote delivery fails', () => {
    render(<MealImage mealName="Pancit" mealType="DINNER" image={image} />);
    const photo = screen.getByRole('img', { name: image.altText });
    expect(screen.getByText('Example Creator · CC_BY_4_0')).toBeInTheDocument();
    fireEvent.error(photo);
    expect(screen.getByText('Pancit')).toBeInTheDocument();
  });
});
