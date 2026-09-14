import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HydratedForm from './HydratedForm';
import PasswordInput from '@/components/ui/PasswordInput';

describe('recovery form hydration', () => {
  it('disables native form controls in server-rendered HTML', () => {
    expect(
      renderToString(
        <HydratedForm>
          <input name="password" />
          <button>Confirm</button>
        </HydratedForm>
      )
    ).toContain('<fieldset disabled=""');
  });
  it('enables client submission and independent password visibility without submitting', () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <HydratedForm onSubmit={submit}>
        <PasswordInput label="New password" defaultValue="Dummy123" />
        <PasswordInput label="Confirm password" defaultValue="Dummy123" />
        <button type="submit">Confirm reset</button>
      </HydratedForm>
    );
    expect(screen.getByLabelText('New password')).not.toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
    expect(submit).toHaveBeenCalledOnce();
  });
});
