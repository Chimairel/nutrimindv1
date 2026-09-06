import { describe, expect, it } from 'vitest';
import { getLoginFieldErrors, getRegistrationFieldErrors, registrationSchema } from './auth.schemas';

describe('authentication validation', () => {
  it('trims names and email while preserving an intentional password', () => {
    const result = registrationSchema.parse({
      firstName: '  Chimairel ',
      lastName: ' Test ',
      email: ' TEST+NUTRIMIND@GMAIL.COM ',
      password: 'Valid pass 123',
      confirmPassword: 'Valid pass 123',
    });
    expect(result.firstName).toBe('Chimairel');
    expect(result.lastName).toBe('Test');
    expect(result.email).toBe('TEST+NUTRIMIND@GMAIL.COM');
    expect(result.password).toBe('Valid pass 123');
  });

  it('reports mismatched confirmation on the confirmation field', () => {
    const { errors } = getRegistrationFieldErrors({
      firstName: 'Test',
      lastName: 'Account',
      email: 'test@example.com',
      password: 'ValidPassword1',
      confirmPassword: 'DifferentPassword1',
    });
    expect(errors.confirmPassword).toBe('Passwords do not match.');
  });

  it('rejects whitespace-only login values', () => {
    const { errors } = getLoginFieldErrors({ email: '   ', password: '   ' });
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBe('Password cannot consist only of spaces.');
  });
});
