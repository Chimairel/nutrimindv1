export const MAX_POSTGRES_INTEGER = 2_147_483_647;

export type BillingLedgerEntryType = 'CHARGE' | 'REFUND' | 'DISPUTE' | 'ADJUSTMENT';

export interface MoneyInput {
  amountMinor: number;
  currency: string;
}

export interface Money extends MoneyInput {
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

export function assertPositiveMoney(input: MoneyInput, expectedCurrency?: string): Money {
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

export function assertRefundAmount(input: {
  paidMinor: number;
  alreadyRefundedMinor: number;
  requestedMinor: number;
  paymentCurrency: string;
  refundCurrency: string;
}): { remainingBeforeMinor: number; remainingAfterMinor: number } {
  assertPositiveMoney({ amountMinor: input.paidMinor, currency: input.paymentCurrency });
  assertCurrency(input.refundCurrency, input.paymentCurrency);
  assertMinorInteger(input.alreadyRefundedMinor, 'alreadyRefundedMinor');
  assertMinorInteger(input.requestedMinor, 'requestedMinor');

  if (input.alreadyRefundedMinor < 0 || input.alreadyRefundedMinor > input.paidMinor) {
    throw new RangeError('alreadyRefundedMinor must be between zero and the paid amount.');
  }
  if (input.requestedMinor <= 0) {
    throw new RangeError('requestedMinor must be greater than zero.');
  }

  const remainingBeforeMinor = input.paidMinor - input.alreadyRefundedMinor;
  if (input.requestedMinor > remainingBeforeMinor) {
    throw new RangeError('Refund amount exceeds the unrefunded paid amount.');
  }

  return {
    remainingBeforeMinor,
    remainingAfterMinor: remainingBeforeMinor - input.requestedMinor,
  };
}

export function assertLedgerAmount(entryType: BillingLedgerEntryType, amountMinor: number): number {
  assertMinorInteger(amountMinor, 'amountMinor');
  const valid =
    (entryType === 'CHARGE' && amountMinor > 0) ||
    ((entryType === 'REFUND' || entryType === 'DISPUTE') && amountMinor < 0) ||
    (entryType === 'ADJUSTMENT' && amountMinor !== 0);

  if (!valid) {
    throw new RangeError(`Invalid signed amount for ${entryType}.`);
  }
  return amountMinor;
}
