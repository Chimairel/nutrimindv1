import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealActivityCalendar from './MealActivityCalendar';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

const mockLogs: MealHistoryLog[] = [
  {
    id: 'log-1',
    loggedAt: '2026-09-07T08:00:00.000Z',
    mealName: 'Tapsilog with Egg',
    source: 'SYSTEM_GENERATED',
    status: 'DONE',
    calories: 520,
    proteinG: 28,
    carbsG: 65,
    fatG: 14,
    notes: 'Ate before workout',
    mealType: 'BREAKFAST',
  },
  {
    id: 'log-2',
    loggedAt: '2026-09-07T12:30:00.000Z',
    mealName: 'Chicken Tinola',
    source: 'SYSTEM_GENERATED',
    status: 'DONE',
    calories: 640,
    proteinG: 45,
    carbsG: 50,
    fatG: 18,
    notes: null,
    mealType: 'LUNCH',
  },
];

describe('MealActivityCalendar', () => {
  it('renders the activity matrix and view mode toggles', () => {
    const handleSelect = vi.fn();
    render(
      <MealActivityCalendar
        logs={mockLogs}
        selectedDateKey="2026-09-07"
        onSelectDateKey={handleSelect}
      />
    );

    expect(screen.getByText('Activity Matrix')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('Cumulative')).toBeInTheDocument();
  });

  it('switches view modes when toggle buttons are clicked', () => {
    const handleSelect = vi.fn();
    render(
      <MealActivityCalendar
        logs={mockLogs}
        selectedDateKey="2026-09-07"
        onSelectDateKey={handleSelect}
      />
    );

    const weeklyButton = screen.getByText('Weekly');
    fireEvent.click(weeklyButton);
    expect(weeklyButton).toHaveClass('bg-brand-surface');

    const cumulativeButton = screen.getByText('Cumulative');
    fireEvent.click(cumulativeButton);
    expect(cumulativeButton).toHaveClass('bg-brand-surface');
  });

  it('triggers onSelectDateKey when an active day cell is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <MealActivityCalendar
        logs={mockLogs}
        selectedDateKey={null}
        onSelectDateKey={handleSelect}
      />
    );

    const activeCell = screen.getByLabelText(/2026-09-07: 2 meals logged/i);
    expect(activeCell).toBeInTheDocument();

    fireEvent.click(activeCell);
    expect(handleSelect).toHaveBeenCalledWith('2026-09-07');
  });
});
