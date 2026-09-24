import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutsideMealModal } from './OutsideMealModal';
import api from '@/lib/axios';

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

  it('renders modal with title MANUALLY LOG A MEAL and 4 meal categories', () => {
    render(<OutsideMealModal {...defaultProps} />);

    expect(screen.getByText('MANUALLY LOG A MEAL')).toBeDefined();
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

    // Check 4 nutritional inputs exist and are editable
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBe(4);

    const [calInput, protInput, carbsInput, fatInput] = inputs;

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
    const submitBtn = screen.getByRole('button', { name: /LOG THIS MEAL/i });
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

  it('calls AI estimate when HELP ME FIND VALUES WITH AI is clicked', () => {
    const onSubmit = vi.fn();
    render(<OutsideMealModal {...defaultProps} onSubmit={onSubmit} />);

    const aiButton = screen.getByText('HELP ME FIND VALUES WITH AI');
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
              name: 'Chicken Adobo',
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
    fireEvent.change(screen.getByLabelText('Cooked rice with this dish'), { target: { value: '150' } });
    expect(screen.getByText(/Plate preview: 494 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /LOG THIS MEAL/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        useAiEstimate: false,
        items: [
          {
            name: 'Chicken Adobo',
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
    fireEvent.click(screen.getByRole('button', { name: /LOG THIS MEAL/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({
        useAiEstimate: false,
        items: [{ name: 'Rice, well-milled, boiled', portionGrams: 150 }],
      })
    );
  });
});
