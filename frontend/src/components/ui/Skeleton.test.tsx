import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Skeleton from '@/components/ui/Skeleton';
import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';
import ProgressSkeleton from '@/features/progress/ProgressSkeleton';
import DashboardSkeleton from '@/features/dashboard/DashboardSkeleton';
import GrocerySkeleton from '@/features/grocery/GrocerySkeleton';

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
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(10);
  });

  it('renders ProgressSkeleton with metric cards and chart placeholder', () => {
    const { container, getByLabelText } = render(<ProgressSkeleton />);
    const region = getByLabelText('Loading progress data');
    expect(region).toBeInTheDocument();
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(10);
  });

  it('renders DashboardSkeleton with day strip and cockpit placeholders', () => {
    const { container, getByLabelText } = render(<DashboardSkeleton />);
    const region = getByLabelText('Loading daily dashboard');
    expect(region).toBeInTheDocument();
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(10);
  });

  it('renders GrocerySkeleton with filter bar and category group placeholders', () => {
    const { container, getByLabelText } = render(<GrocerySkeleton />);
    const region = getByLabelText('Loading grocery checklist');
    expect(region).toBeInTheDocument();
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(10);
  });
});
