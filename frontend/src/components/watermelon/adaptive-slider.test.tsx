import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdaptiveSlider from './adaptive-slider';

describe('AdaptiveSlider', () => {
  it('renders slider input with 5 stops and clamped values', () => {
    const onChange = vi.fn();
    render(
      <AdaptiveSlider
        value={3}
        min={1}
        max={5}
        step={1}
        maxAllowed={5}
        onChange={onChange}
        aria-label="Meal locality strength"
      />
    );

    const slider = screen.getByRole('slider', { name: 'Meal locality strength' });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue('3');

    // Arrow Right should increment
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(4);

    // Arrow Left should decrement
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('respects maxAllowed constraint when navigating', () => {
    const onChange = vi.fn();
    render(
      <AdaptiveSlider
        value={1}
        min={1}
        max={5}
        step={1}
        maxAllowed={3}
        onChange={onChange}
        aria-label="Meal locality strength"
      />
    );

    const slider = screen.getByRole('slider', { name: 'Meal locality strength' });

    // End key should jump to maxAllowed (3)
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
