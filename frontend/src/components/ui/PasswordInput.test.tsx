import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
  it('reveals and hides the password without submitting its form', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" defaultValue="Secret123" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('skips visibility toggles when tabbing between password fields', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PasswordInput aria-label="Password" />
        <PasswordInput aria-label="Confirm password" />
      </>
    );

    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Confirm password')).toHaveFocus();
  });

  it('forwards validation state styling to the password field', () => {
    const { rerender } = render(<PasswordInput aria-label="Confirm password" validationState="error" />);
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('data-validation-state', 'error');

    rerender(<PasswordInput aria-label="Confirm password" validationState="success" />);
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('data-validation-state', 'success');
  });
});
