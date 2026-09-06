const PREMIUM_ATTEMPT_KEY = 'nutrimind-premium-checkout-attempt';
const VALID_KEY = /^premium_[0-9a-f]{32}$/;

export function getOrCreatePremiumCheckoutAttemptKey(): string {
  if (typeof window === 'undefined') throw new Error('CHECKOUT_BROWSER_REQUIRED');
  const stored = window.sessionStorage.getItem(PREMIUM_ATTEMPT_KEY);
  if (stored && VALID_KEY.test(stored)) return stored;
  const generated = `premium_${window.crypto.randomUUID().replaceAll('-', '')}`;
  window.sessionStorage.setItem(PREMIUM_ATTEMPT_KEY, generated);
  return generated;
}

export function clearPremiumCheckoutAttemptKey(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(PREMIUM_ATTEMPT_KEY);
}

export function validateHostedCheckoutUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('CHECKOUT_URL_INVALID');
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    parsed.origin !== 'https://checkout.paymongo.com' ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error('CHECKOUT_URL_INVALID');
  }
  return parsed.toString();
}
