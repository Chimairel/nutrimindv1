import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutsideMealModal } from './OutsideMealModal';
import api from '@/lib/axios';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('OutsideMealModal', () => {
  const defaultProps = {
    error: null,
    isLoading: false,
    isOpen: true,
    mealName: 'Air Fryer Buffalo Wings',
    mealType: 'LUNCH' as const,
    notes: 'Homemade dinner',
    onClose: vi.fn(),
    onMealNameChange: vi.fn(),
    onMealTypeChange: vi.fn(),
    onNotesChange: vi.fn(),
    onSubmit: vi.fn(),
    onWarningCancel: vi.fn(),
    warning: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders food logging with a snack category', () => {
    render(<OutsideMealModal {...defaultProps} />);

    expect(screen.getByText('LOG FOOD OR A MEAL')).toBeDefined();
    expect(screen.getByText('Breakfast')).toBeDefined();
    expect(screen.getByText('Lunch')).toBeDefined();
    expect(screen.getByText('Dinner')).toBeDefined();
    expect(screen.getByText('Snack')).toBeDefined();
  });

  it('allows switching meal category when clicked', () => {
    const onMealTypeChange = vi.fn();
    render(<OutsideMealModal {...defaultProps} onMealTypeChange={onMealTypeChange} />);

    fireEvent.click(screen.getByText('Dinner'));
    expect(onMealTypeChange).toHaveBeenCalledWith('DINNER');
  });

  it('allows user to manually edit calories, protein, carbs, and fat freely', () => {
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} onSubmit={onSubmit} />);

    // The optional portion precedes the four editable nutrition inputs.
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBe(5);

    const [calInput, protInput, carbsInput, fatInput] = inputs.slice(1);

    // User types custom 1.5-serving values
    fireEvent.change(calInput, { target: { value: '750' } });
    fireEvent.change(protInput, { target: { value: '45' } });
    fireEvent.change(carbsInput, { target: { value: '15' } });
    fireEvent.change(fatInput, { target: { value: '30' } });

    expect((calInput as HTMLInputElement).value).toBe('750');
    expect((protInput as HTMLInputElement).value).toBe('45');
    expect((carbsInput as HTMLInputElement).value).toBe('15');
    expect((fatInput as HTMLInputElement).value).toBe('30');

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /Preview nutrition/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        useAiEstimate: false,
        items: [
          {
            name: 'Air Fryer Buffalo Wings',
            reportedNutrition: {
              calories: 750,
              proteinG: 45,
              carbsG: 15,
              fatG: 30,
            },
          },
        ],
      })
    );
  });

  it('sends the measured portion with manually reported nutrition', () => {
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Approximate portion in grams (optional)'), {
      target: { value: '250' },
    });
    const [, calories, protein, carbs, fat] = screen.getAllByRole('spinbutton');
    fireEvent.change(calories, { target: { value: '400' } });
    for (const input of [protein, carbs, fat]) fireEvent.change(input, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Preview nutrition/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        items: [
          expect.objectContaining({ portionGrams: 250, reportedNutrition: expect.objectContaining({ calories: 400 }) }),
        ],
      })
    );
  });

  it('calls AI estimate when Get AI estimate is clicked', () => {
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} onSubmit={onSubmit} />);

    const aiButton = screen.getByText('Get AI estimate');
    fireEvent.click(aiButton);

    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        useAiEstimate: true,
        items: [
          {
            name: 'Air Fryer Buffalo Wings',
          },
        ],
      })
    );
  });

  it('renders photo upload and notes fields', () => {
    const onNotesChange = vi.fn();
    render(<OutsideMealModal {...defaultProps} onNotesChange={onNotesChange} />);

    expect(screen.getByText('Upload Photo or Use Camera (Optional)')).toBeDefined();
    const notesInput = screen.getByPlaceholderText('e.g. restaurant, preparation, serving details');
    expect(notesInput).toBeDefined();

    fireEvent.change(notesInput, { target: { value: 'With extra garlic sauce' } });
    expect(onNotesChange).toHaveBeenCalledWith('With extra garlic sauce');
  });

  it('logs rice as a separate measured FNRI food when selected with a source recipe', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          eligible: [
            {
              id: 'pp_adobo',
              name: 'Chicken Adobo Recipe',
              macros: { calories: 300, proteinG: 20, carbsG: 10, fatG: 15 },
              serving: '1 serving',
              label: 'Panlasang Pinoy estimate',
              kind: 'ELIGIBLE_LIBRARY',
              ricePairing: 'ULAM',
              riceReference: {
                fnriCode: 'A020',
                name: 'Rice, well-milled, boiled',
                per100g: { calories: 129, proteinG: 2.1, carbsG: 29.7, fatG: 0.2 },
              },
            },
          ],
          otherKnown: [],
        },
      },
    } as never);
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} mealName="Chicken Adobo" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Food or Meal Eaten (required)'), { target: { value: 'Chicken' } });
    fireEvent.click(await screen.findByText('Chicken Adobo'));
    expect(defaultProps.onMealNameChange).toHaveBeenLastCalledWith('Chicken Adobo');
    expect(screen.queryByText('Chicken Adobo Recipe')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cooked rice with this dish'), { target: { value: '150' } });
    expect(screen.getByText(/Plate preview: 494 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Preview nutrition/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        useAiEstimate: false,
        items: [
          {
            name: 'Chicken Adobo Recipe',
            mealLibraryId: 'pp_adobo',
          },
          { name: 'Rice, well-milled, boiled', portionGrams: 150 },
        ],
      })
    );
  });

  it('scales an FNRI food by consumed grams and keeps the reference source', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          eligible: [],
          otherKnown: [
            {
              id: 'fnri-rice',
              name: 'Rice, well-milled, boiled',
              kind: 'FNRI_FOOD',
              label: 'FNRI food; enter consumed grams',
              macros: { calories: 129, proteinG: 2.1, carbsG: 29.7, fatG: 0.2 },
            },
          ],
        },
      },
    } as never);
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} mealName="Rice" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Food or Meal Eaten (required)'), { target: { value: 'Ric' } });
    fireEvent.click(await screen.findByText('Rice, well-milled, boiled'));
    fireEvent.change(screen.getByLabelText('Amount eaten (grams)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /Preview nutrition/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        useAiEstimate: false,
        items: [{ name: 'Rice, well-milled, boiled', portionGrams: 150 }],
      })
    );
  });

  it('keeps manually entered values when returning from the review preview', () => {
    const { rerender } = render(<OutsideMealModal {...defaultProps} />);
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '400' } });
    const warning = {
      confirmationId: 'preview',
      estimate: { calories: 400, proteinG: 0, carbsG: 0, fatG: 0 },
      items: [],
      warnings: [],
      reasons: [],
      summary: {
        provisionalCalories: 400,
        provisionalItemCount: 1,
        unresolvedItemCount: 0,
        completeness: 'COMPLETE' as const,
      },
      usedAi: false,
    };
    rerender(<OutsideMealModal {...defaultProps} warning={warning} />);
    expect(screen.queryByLabelText('Food or Meal Eaten (required)')).not.toBeVisible();
    rerender(<OutsideMealModal {...defaultProps} />);
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(400);
  });

  it('ignores an older autocomplete response after the query changes', async () => {
    let finishOld!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }) as never
    );
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          eligible: [{ kind: 'RAW_RECIPE', id: 'new', name: 'New food', label: 'Known recipe' }],
          otherKnown: [],
        },
      },
    } as never);
    render(<OutsideMealModal {...defaultProps} />);
    const input = screen.getByLabelText('Food or Meal Eaten (required)');
    fireEvent.change(input, { target: { value: 'old' } });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: 'new' } });
    expect(await screen.findByText('New food')).toBeVisible();
    await act(async () =>
      finishOld({
        data: {
          success: true,
          data: {
            eligible: [{ kind: 'RAW_RECIPE', id: 'old', name: 'Old food', label: 'Known recipe' }],
            otherKnown: [],
          },
        },
      })
    );
    expect(screen.queryByText('Old food')).not.toBeInTheDocument();
    expect(screen.getByText('New food')).toBeVisible();
  });

  it('does not manufacture zero macros from blank nutrition fields', () => {
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: /Preview nutrition/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables form controls and uses no second submission spinner while saving', () => {
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} isLoading onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: /Preview nutrition/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Breakfast' })).toBeDisabled();
    expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: /Preview nutrition/i }).closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
