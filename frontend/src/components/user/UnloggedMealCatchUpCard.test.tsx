import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnloggedMealCatchUpCard from './UnloggedMealCatchUpCard';
import type { MealPlan } from '@/types';

const mockMeal: MealPlan = {
  id: 'meal-test-123',
  planGroupId: 'test-group',
  planType: 'WEEKLY',
  createdAt: '2026-09-12T00:00:00.000Z',
  userId: 'user-1',
  mealName: 'Sinigang na Baboy with Kangkong',
  mealType: 'LUNCH',
  scheduledDate: '2026-09-12T00:00:00.000Z',
  calories: 520,
  proteinG: 38,
  carbsG: 45,
  fatG: 18,
  status: 'APPROVED',
  aiConfidenceFlag: 'SAFE',
  ingredients: [],
  mealLogs: [],
};

describe('UnloggedMealCatchUpCard', () => {
  it('renders category, meal title, unlogged badge, and macros', () => {
    const handleToggle = vi.fn().mockResolvedValue(undefined);
    render(<UnloggedMealCatchUpCard meal={mockMeal} onStatusToggle={handleToggle} />);

    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Unlogged')).toBeInTheDocument();
    expect(screen.getByText('Sinigang na Baboy with Kangkong')).toBeInTheDocument();
    expect(screen.getByText('520 kcal')).toBeInTheDocument();
    expect(screen.getByText('38g P')).toBeInTheDocument();
    expect(screen.getByText('45g C')).toBeInTheDocument();
    expect(screen.getByText('18g F')).toBeInTheDocument();
  });

  it('calls onStatusToggle with DONE when Mark as Eaten is clicked', async () => {
    const handleToggle = vi.fn().mockResolvedValue(undefined);
    render(<UnloggedMealCatchUpCard meal={mockMeal} onStatusToggle={handleToggle} />);

    const eatenBtn = screen.getByRole('button', { name: /Mark as Eaten/i });
    fireEvent.click(eatenBtn);

    await waitFor(() => {
      expect(handleToggle).toHaveBeenCalledWith('meal-test-123', 'DONE');
    });
  });

  it('calls onStatusToggle with SKIPPED when Skip is clicked', async () => {
    const handleToggle = vi.fn().mockResolvedValue(undefined);
    render(<UnloggedMealCatchUpCard meal={mockMeal} onStatusToggle={handleToggle} />);

    const skipBtn = screen.getByRole('button', { name: /Skip/i });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(handleToggle).toHaveBeenCalledWith('meal-test-123', 'SKIPPED');
    });
  });
});
