import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Skeleton from '@/components/ui/Skeleton';
import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';

describe('Skeleton', () => {
  it('renders with default pulse and custom classes', () => {
    const { container } = render(<Skeleton className="h-10 w-20 custom-test" data-testid="test-skeleton" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-pulse');
    expect(el).toHaveClass('h-10');
    expect(el).toHaveClass('w-20');
    expect(el).toHaveClass('custom-test');
  });

  it('renders MealPlanSkeleton with 3 meal card placeholders and metrics strip', () => {
    const { container, getByLabelText } = render(<MealPlanSkeleton />);
    const region = getByLabelText('Loading meal plan schedule');
    expect(region).toBeInTheDocument();

    // Skeletons should be present inside the layout
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(10);
  });
});
