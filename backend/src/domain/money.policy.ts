export const MAX_POSTGRES_INTEGER = 2_147_483_647;

export interface MoneyInput {
  amountMinor: number;
  currency: string;
}

function assertMinorInteger(amountMinor: number, field: string): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError(`${field} must be a safe integer minor-unit amount.`);
  }
  if (Math.abs(amountMinor) > MAX_POSTGRES_INTEGER) {
    throw new RangeError(`${field} exceeds the supported PostgreSQL integer range.`);
  }
}

export function assertCurrency(currency: string, expectedCurrency?: string): string {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError('Currency must be an uppercase three-letter ISO code.');
  }
  if (expectedCurrency !== undefined && currency !== expectedCurrency) {
    throw new Error(`Currency mismatch: expected ${expectedCurrency}.`);
  }
  return currency;
}

export function assertPositiveMoney(input: MoneyInput, expectedCurrency?: string): MoneyInput {
  assertMinorInteger(input.amountMinor, 'amountMinor');
  assertCurrency(input.currency, expectedCurrency);
  if (input.amountMinor <= 0) {
    throw new RangeError('amountMinor must be greater than zero.');
  }
  return { ...input };
}

export function sumMinorAmounts(amounts: readonly number[]): number {
  return amounts.reduce((sum, amount) => {
    assertMinorInteger(amount, 'amountMinor');
    const next = sum + amount;
    assertMinorInteger(next, 'sum');
    return next;
  }, 0);
}
