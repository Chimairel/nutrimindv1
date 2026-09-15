import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Breadcrumb1 from './breadcrumb-1';

describe('Breadcrumb1 Component', () => {
  it('renders default segments with links and current page', () => {
    render(<Breadcrumb1 />);
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Meals')).toHaveAttribute('aria-current', 'page');
  });

  it('renders custom segments properly', () => {
    const customSegments = [
      { label: 'KAINARA', href: '/dashboard' },
      { label: 'Meal History', current: true as const },
    ];
    render(<Breadcrumb1 segments={customSegments} />);
    expect(screen.getByRole('link', { name: 'KAINARA' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Meal History')).toHaveAttribute('aria-current', 'page');
  });
});
