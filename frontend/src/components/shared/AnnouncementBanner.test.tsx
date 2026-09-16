import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnouncementBanner from './AnnouncementBanner';

describe('AnnouncementBanner', () => {
  it('renders title, message and uses clinical warm banner styling by default', () => {
    const { container } = render(
      <AnnouncementBanner
        title="Action required:"
        message="Acknowledge your nutrition report before using this feature."
      />
    );

    expect(screen.getByText('Action required:')).toBeInTheDocument();
    expect(screen.getByText('Acknowledge your nutrition report before using this feature.')).toBeInTheDocument();
    expect(container.querySelector('aside')).toHaveClass('bg-[#8c3b00]');
    expect(container.querySelector('aside')).toHaveClass('text-white');
    expect(container.querySelector('aside')).toHaveClass('rounded-2xl');
  });

  it('renders badge when provided', () => {
    render(
      <AnnouncementBanner
        title="Status"
        badge={<span data-testid="test-badge">3 meals</span>}
        message="Review in progress"
      />
    );

    expect(screen.getByTestId('test-badge')).toBeInTheDocument();
  });

  it('renders action link when action with href is provided', () => {
    render(
      <AnnouncementBanner
        title="Action required:"
        message="Please verify."
        action={{
          label: 'View Nutrition Report',
          href: '/profile/nutrition-report',
        }}
      />
    );

    const link = screen.getByRole('link', { name: /view nutrition report/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/profile/nutrition-report');
    expect(link).toHaveClass('bg-white');
    expect(link).toHaveClass('text-[#8c3b00]');
  });

  it('renders action button and handles click when onClick is provided', () => {
    const handleClick = vi.fn();
    render(
      <AnnouncementBanner
        title="Action required:"
        message="Please verify."
        action={{
          label: 'Click me',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
