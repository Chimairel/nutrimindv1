import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Input from './Input';

describe('Input', () => {
  it('associates a generated input id with its visible label', () => {
    render(<Input label="Source code" />);

    const input = screen.getByRole('textbox', { name: 'Source code' });
    expect(input).toHaveAttribute('id');
    expect(input.id).not.toBe('');
  });

  it('uses the generated id for helper and error descriptions', () => {
    const { rerender } = render(<Input label="Official homepage" helperText="Use the agency website." />);
    const input = screen.getByRole('textbox', { name: 'Official homepage' });
    expect(input).toHaveAccessibleDescription('Use the agency website.');

    rerender(<Input label="Official homepage" error="A valid URL is required." />);
    expect(screen.getByRole('textbox', { name: 'Official homepage' })).toHaveAccessibleDescription(
      'A valid URL is required.'
    );
  });
});
