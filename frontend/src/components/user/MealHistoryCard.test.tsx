import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealHistoryCard from './MealHistoryCard';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

const baseLog: MealHistoryLog = {
  id: 'log-101',
  loggedAt: '2026-09-07T08:00:00.000Z',
  mealName: 'Hearty Pandesal with Peanut Butter, Boiled Eggs, and Butter',
  source: 'SYSTEM_GENERATED',
  status: 'DONE',
  calories: 859,
  proteinG: 40,
  carbsG: 75,
  fatG: 22,
  notes: 'Felt very energized after eating',
  mealType: 'BREAKFAST',
};

describe('MealHistoryCard', () => {
  it('keeps skipped meals and their note editor available', async () => {
    const onUpdateNotes = vi.fn().mockResolvedValue(undefined);
    render(<MealHistoryCard log={{ ...baseLog, status: 'SKIPPED' }} onUpdateNotes={onUpdateNotes} />);
    expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.change(screen.getByLabelText(/Personal Meal Notes/i), {
      target: { value: 'Skipped because I was away.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Note/i }));
    await waitFor(() => expect(onUpdateNotes).toHaveBeenCalledWith(baseLog.id, 'Skipped because I was away.'));
  });

  it('renders category, meal title, macros, and existing note preview', () => {
    render(<MealHistoryCard log={baseLog} />);

    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Hearty Pandesal with Peanut Butter, Boiled Eggs, and Butter')).toBeInTheDocument();
    expect(screen.getByText('859 kcal')).toBeInTheDocument();
    expect(screen.getByText('40g protein')).toBeInTheDocument();
    expect(screen.getByText(/Felt very energized after eating/i)).toBeInTheDocument();
    expect(screen.getByText('DONE')).toBeInTheDocument();
  });

  it('expands note editor when card is clicked', () => {
    render(<MealHistoryCard log={baseLog} />);

    // Expand card
    const cardButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(cardButton);

    expect(screen.getByLabelText(/Personal Meal Notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Note/i })).toBeInTheDocument();
  });

  it('allows editing notes and calls onUpdateNotes when Save Note is clicked', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    render(<MealHistoryCard log={baseLog} onUpdateNotes={handleUpdate} />);

    // Expand card
    const cardButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(cardButton);

    const textarea = screen.getByLabelText(/Personal Meal Notes/i);
    fireEvent.change(textarea, { target: { value: 'Updated note: substituted peanut butter with almond butter' } });

    const saveButton = screen.getByRole('button', { name: /Save Note/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(
        'log-101',
        'Updated note: substituted peanut butter with almond butter'
      );
    });
  });
});
