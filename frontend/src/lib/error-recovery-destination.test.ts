import { describe, expect, it } from 'vitest';
import { getErrorRecoveryDestination } from './error-recovery-destination';

const baseUser = {
  userId: 'user-1',
  name: 'Test User',
  email: 'test@example.test',
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
} as const;

describe('error recovery destination', () => {
  it('returns each authenticated role to its own workspace', () => {
    expect(getErrorRecoveryDestination({ ...baseUser, role: 'ADMIN' })).toBe('/admin/overview');
    expect(getErrorRecoveryDestination({ ...baseUser, role: 'NUTRITIONIST' })).toBe('/nutritionist/reviews');
    expect(getErrorRecoveryDestination({ ...baseUser, role: 'USER' })).toBe('/dashboard');
  });

  it('sends an unauthenticated visitor to login', () => {
    expect(getErrorRecoveryDestination(null)).toBe('/login');
  });
});
