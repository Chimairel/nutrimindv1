import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StateNotice from './StateNotice';
import { ThemeProvider } from '@/lib/context/ThemeContext';

describe('StateNotice Component', () => {
  it('renders default no-meal-plan variant correctly', () => {
    const onAction = vi.fn();

    render(
      <StateNotice
        variant="no-meal-plan"
        action={{
          label: 'Generate Meal Plan',
          onClick: onAction,
        }}
      />
    );

    expect(screen.getByText("Meal planning isn't available yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Complete the required account and health steps before your meal plan can be prepared/i)
    ).toBeInTheDocument();
    expect(screen.getByAltText('Meal plan status')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /generate meal plan/i });
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders action-needed variant with report pending link', () => {
    render(<StateNotice variant="action-needed" />);

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('Nutrition Report Pending')).toBeInTheDocument();
    expect(
      screen.getByText(/Please review and acknowledge your personalized nutrition report/i)
    ).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /view nutrition report/i });
    expect(link).toHaveAttribute('href', '/profile/nutrition-report');
    expect(screen.getByAltText('Access Restricted')).toBeInTheDocument();
  });

  it('renders access-denied variant with workspace link and secondary action', () => {
    const onBackClick = vi.fn();

    render(
      <StateNotice
        variant="access-denied"
        secondaryAction={{
          label: 'Go Back',
          onClick: onBackClick,
        }}
      />
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/You do not have permission to view this portal\./i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /return to workspace/i });
    expect(link).toHaveAttribute('href', '/dashboard');

    const backButton = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backButton);
    expect(onBackClick).toHaveBeenCalledTimes(1);
  });

  it('renders verifying variant correctly', () => {
    render(<StateNotice variant="verifying" />);

    expect(screen.getByText('Plan Preparation')).toBeInTheDocument();
    expect(screen.getByText('Verification in Progress')).toBeInTheDocument();
    expect(screen.getByAltText('Plan Preparation')).toBeInTheDocument();
  });

  it('renders not-found variant correctly', () => {
    render(<StateNotice variant="not-found" />);

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.getByAltText('Page Not Found')).toBeInTheDocument();
  });

  it('allows overriding all defaults with custom props', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();

    render(
      <StateNotice
        variant="custom"
        eyebrow="Custom Badge"
        eyebrowVariant="cyan"
        title="Custom State Title"
        description="Custom description explaining this situation."
        imageSrc="/logo/cooking.svg"
        imageAlt="Cooking Graphic"
        action={{
          label: 'Primary Action',
          onClick: onPrimary,
        }}
        secondaryAction={{
          label: 'Secondary Action',
          onClick: onSecondary,
        }}
      />
    );

    expect(screen.getByText('Custom Badge')).toBeInTheDocument();
    expect(screen.getByText('Custom State Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description explaining this situation.')).toBeInTheDocument();
    expect(screen.getByAltText('Cooking Graphic')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /primary action/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /secondary action/i }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('omits action button when action is null', () => {
    render(<StateNotice variant="no-meal-plan" action={null} />);

    expect(screen.getByText("Meal planning isn't available yet")).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows loading state on action button', () => {
    render(
      <StateNotice
        variant="no-meal-plan"
        action={{
          label: 'Generate Plan',
          isLoading: true,
        }}
      />
    );

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('selects theme-reactive sleeping graphic within ThemeProvider', () => {
    render(
      <ThemeProvider>
        <StateNotice variant="no-meal-plan" />
      </ThemeProvider>
    );

    const img = screen.getByAltText('Meal plan status');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('sleeping');
  });
});
