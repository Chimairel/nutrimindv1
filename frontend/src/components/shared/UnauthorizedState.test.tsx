import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnauthorizedState from './UnauthorizedState';

describe('UnauthorizedState Component', () => {
  it('renders default report-pending state correctly', () => {
    render(<UnauthorizedState />);

    expect(screen.getByText('Nutrition Report Pending')).toBeInTheDocument();
    expect(
      screen.getByText('Please review and acknowledge your personalized nutrition report before accessing this feature.')
    ).toBeInTheDocument();
    const actionLink = screen.getByRole('link', { name: /view nutrition report/i });
    expect(actionLink).toHaveAttribute('href', '/profile/nutrition-report');
    expect(screen.getByAltText('Access Restricted')).toBeInTheDocument();
  });

  it('renders custom eyebrow, title, and description', () => {
    render(
      <UnauthorizedState
        eyebrow="Action Required"
        title="Custom Report Gate"
        description="Custom explanation for testing."
        imageAlt="Custom Alt"
      />
    );

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('Custom Report Gate')).toBeInTheDocument();
    expect(screen.getByText('Custom explanation for testing.')).toBeInTheDocument();
    expect(screen.getByAltText('Custom Alt')).toBeInTheDocument();
  });

  it('renders RBAC access denied variant with primary and secondary action callbacks', () => {
    const onPrimaryClick = vi.fn();
    const onSecondaryClick = vi.fn();

    render(
      <UnauthorizedState
        variant="page"
        eyebrow="Access Restricted"
        title="Access Denied"
        description="You do not have permission to view this portal."
        action={{
          label: 'Return to Workspace',
          onClick: onPrimaryClick,
        }}
        secondaryAction={{
          label: 'Go Back',
          onClick: onSecondaryClick,
        }}
      />
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to view this portal.')).toBeInTheDocument();

    const primaryButton = screen.getByRole('button', { name: /return to workspace/i });
    fireEvent.click(primaryButton);
    expect(onPrimaryClick).toHaveBeenCalledTimes(1);

    const secondaryButton = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(secondaryButton);
    expect(onSecondaryClick).toHaveBeenCalledTimes(1);
  });
});
