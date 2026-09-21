import { describe, expect, it } from 'vitest';
import { getPostAuthDestination } from './post-auth-destination';

const baseUser = {
  role: 'USER' as const,
  emailVerified: true,
  onboardingDone: true,
  onboardingNextPath: undefined,
  tosAccepted: true,
  reportAcknowledged: true,
};

describe('post-authentication destination', () => {
  it('routes a new Google account directly to its fresh onboarding step', () => {
    expect(
      getPostAuthDestination({
        ...baseUser,
        onboardingDone: false,
        onboardingNextPath: '/onboarding/stats',
      })
    ).toBe('/onboarding/stats');
  });

  it('keeps verification, consent, report, and role gates in their required order', () => {
    expect(getPostAuthDestination({ ...baseUser, emailVerified: false })).toBe('/verify-email');
    expect(getPostAuthDestination({ ...baseUser, tosAccepted: false })).toBe('/onboarding/tos');
    expect(getPostAuthDestination({ ...baseUser, reportAcknowledged: false })).toBe('/nutrition-report');
    expect(getPostAuthDestination({ ...baseUser, role: 'NUTRITIONIST' })).toBe('/nutritionist/reviews');
    expect(getPostAuthDestination({ ...baseUser, role: 'ADMIN' })).toBe('/admin/overview');
  });
});
