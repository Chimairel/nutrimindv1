import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'All', label: 'All Sources' },
  { value: 'SYSTEM_GENERATED', label: 'KAINARA' },
  { value: 'USER_LOGGED', label: 'Outside Meal' },
  { value: 'USER_SWAPPED', label: 'Swapped' },
];

describe('Select Component', () => {
  it('renders with initial selected label', () => {
    const handleChange = vi.fn();
    render(<Select value="All" onChange={handleChange} options={options} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('All Sources');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens options list when trigger is clicked', () => {
    const handleChange = vi.fn();
    render(<Select value="All" onChange={handleChange} options={options} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('KAINARA')).toBeInTheDocument();
    expect(screen.getByText('Outside Meal')).toBeInTheDocument();
    expect(screen.getByText('Swapped')).toBeInTheDocument();
  });

  it('calls onChange with selected value and closes menu when an option is clicked', () => {
    const handleChange = vi.fn();
    render(<Select value="All" onChange={handleChange} options={options} />);

    // Open menu
    fireEvent.click(screen.getByRole('combobox'));

    // Click "Outside Meal"
    fireEvent.click(screen.getByText('Outside Meal'));

    expect(handleChange).toHaveBeenCalledWith('USER_LOGGED');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes menu when Escape key is pressed', () => {
    const handleChange = vi.fn();
    render(<Select value="All" onChange={handleChange} options={options} />);

    // Open menu
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates options and selects with Enter key', () => {
    const handleChange = vi.fn();
    render(<Select value="All" onChange={handleChange} options={options} />);

    const trigger = screen.getByRole('combobox');
    // Open with Enter
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Arrow down to "KAINARA"
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    // Press Enter to select
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith('SYSTEM_GENERATED');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
