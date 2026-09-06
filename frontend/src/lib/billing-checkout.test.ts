import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPremiumCheckoutAttemptKey,
  getOrCreatePremiumCheckoutAttemptKey,
  validateHostedCheckoutUrl,
} from './billing-checkout';

describe('billing checkout browser boundary', () => {
  beforeEach(() => sessionStorage.clear());

  it('reuses one valid attempt key until explicitly cleared', () => {
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc');
    const first = getOrCreatePremiumCheckoutAttemptKey();
    expect(first).toBe('premium_12345678123412341234123456789abc');
    expect(getOrCreatePremiumCheckoutAttemptKey()).toBe(first);
    clearPremiumCheckoutAttemptKey();
    expect(sessionStorage.getItem('nutrimind-premium-checkout-attempt')).toBeNull();
  });

  it('accepts only the exact HTTPS PayMongo checkout origin', () => {
    expect(validateHostedCheckoutUrl('https://checkout.paymongo.com/example')).toBe(
      'https://checkout.paymongo.com/example'
    );
    for (const unsafe of [
      'http://checkout.paymongo.com/example',
      'https://checkout.paymongo.com.evil.example/example',
      'https://user:pass@checkout.paymongo.com/example',
      'javascript:alert(1)',
    ]) {
      expect(() => validateHostedCheckoutUrl(unsafe)).toThrow('CHECKOUT_URL_INVALID');
    }
  });
});
