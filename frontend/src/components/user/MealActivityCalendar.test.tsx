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
  it('keeps skipped activity selectable while excluding its calories', () => {
    const onSelect = vi.fn();
    render(
      <MealActivityCalendar
        logs={[mockLogs[0], { ...mockLogs[1], status: 'SKIPPED' }]}
        selectedDateKey={null}
        onSelectDateKey={onSelect}
      />
    );
    const cell = screen.getByLabelText(/2026-09-07: 2 meals logged/i);
    fireEvent.mouseEnter(cell);
    expect(screen.getByText(/520 kcal/i)).toBeInTheDocument();
    expect(screen.queryByText(/1160 kcal/i)).not.toBeInTheDocument();
    fireEvent.click(cell);
    expect(onSelect).toHaveBeenCalledWith('2026-09-07');
  });

  it('renders the activity matrix and time range filter toggles', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey="2026-09-07" onSelectDateKey={handleSelect} />);

    expect(screen.getByText('Activity Matrix')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
  });

  it('switches time ranges when filter buttons are clicked', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey="2026-09-07" onSelectDateKey={handleSelect} />);

    const monthButton = screen.getByText('Month');
    fireEvent.click(monthButton);
    expect(monthButton).toHaveClass('bg-brand-surface');

    const weekButton = screen.getByText('Week');
    fireEvent.click(weekButton);
    expect(weekButton).toHaveClass('bg-brand-surface');
  });

  it('triggers onSelectDateKey when an active day cell is clicked', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey={null} onSelectDateKey={handleSelect} />);

    const activeCell = screen.getByLabelText(/2026-09-07: 2 meals logged/i);
    expect(activeCell).toBeInTheDocument();

    fireEvent.click(activeCell);
    expect(handleSelect).toHaveBeenCalledWith('2026-09-07');
  });

  it('renders 3 months side-by-side with locked future month and disabled right chevron in Month view', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey={null} onSelectDateKey={handleSelect} />);

    // Switch to Month view
    fireEvent.click(screen.getByText('Month'));

    // Verify left and right chevrons are present
    const prevBtn = screen.getByRole('button', { name: /previous month/i });
    const nextBtn = screen.getByRole('button', { name: /next month/i });

    expect(prevBtn).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();

    expect(nextBtn).toBeInTheDocument();
    // At current month (monthOffset = 0), next month is future so nextBtn must be disabled
    expect(nextBtn).toBeDisabled();

    // Verify locked badge is shown for future month
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('enables the next month chevron after navigating to previous months with left chevron', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey={null} onSelectDateKey={handleSelect} />);

    // Switch to Month view
    fireEvent.click(screen.getByText('Month'));

    const prevBtn = screen.getByRole('button', { name: /previous month/i });
    const nextBtn = screen.getByRole('button', { name: /next month/i });

    // Initially disabled
    expect(nextBtn).toBeDisabled();

    // Click previous month
    fireEvent.click(prevBtn);

    // After navigating back, next month button should now be enabled
    expect(nextBtn).not.toBeDisabled();

    // Click next month to return to current month
    fireEvent.click(nextBtn);

    // Next button should be disabled again
    expect(nextBtn).toBeDisabled();
  });

  it('allows clicking an active day cell in Month view to trigger onSelectDateKey', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey={null} onSelectDateKey={handleSelect} />);

    // Switch to Month view
    fireEvent.click(screen.getByText('Month'));

    // September 7 has 2 logged meals
    const activeCell = screen.getByLabelText(/2026-09-07: 2 meals logged/i);
    expect(activeCell).toBeInTheDocument();

    fireEvent.click(activeCell);
    expect(handleSelect).toHaveBeenCalledWith('2026-09-07');
  });

  it('renders all 12 month labels and locks future days in Year view', () => {
    const handleSelect = vi.fn();
    render(<MealActivityCalendar logs={mockLogs} selectedDateKey={null} onSelectDateKey={handleSelect} />);

    // Year view is the default timeRange
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (const m of months) {
      expect(screen.getByText(m)).toBeInTheDocument();
    }

    // Future days (e.g. December 2026) must be rendered as disabled buttons with locked aria-label & title
    const futureCells = screen.getAllByLabelText(/Upcoming \(Locked\)/i);
    expect(futureCells.length).toBeGreaterThan(0);
    expect(futureCells[0]).toBeDisabled();
    expect(futureCells[0]).toHaveAttribute('title', expect.stringContaining('Upcoming (Locked)'));

    // Past active day cell (2026-09-07) is enabled and hovering updates the status bar
    const activeCell = screen.getByLabelText(/2026-09-07: 2 meals logged/i);
    expect(activeCell).not.toBeDisabled();
    fireEvent.mouseEnter(activeCell);
    expect(screen.getByText(/2 meals logged/i)).toBeInTheDocument();
    expect(screen.getByText(/1160 kcal/i)).toBeInTheDocument();
  });
});
