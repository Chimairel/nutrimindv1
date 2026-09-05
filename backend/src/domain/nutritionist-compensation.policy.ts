import { assertCurrency, assertPositiveMoney, sumMinorAmounts } from './billing-money.policy';

export type WorkCreditKind =
  | 'ORDINARY_PLAN_REVIEW'
  | 'HIGH_RISK_SECOND_REVIEW'
  | 'LIBRARY_SAFETY_CERTIFICATION'
  | 'SAFETY_FLAG_RESOLUTION';

export type ReviewOutcome = 'APPROVED' | 'REJECTED' | 'ESCALATED';

export const WORK_CREDIT_UNITS_MILLIS: Readonly<Record<WorkCreditKind, number>> = Object.freeze({
  ORDINARY_PLAN_REVIEW: 1_000,
  HIGH_RISK_SECOND_REVIEW: 1_500,
  LIBRARY_SAFETY_CERTIFICATION: 1_250,
  SAFETY_FLAG_RESOLUTION: 1_500,
});

export interface WorkCreditEntry {
  id: string;
  entryType: 'AWARD' | 'REVERSAL';
  creditKind: WorkCreditKind;
  sourceActionKey: string;
  sourceOutcome: string;
  unitsMillis: number;
  reversesCreditId?: string | null;
}

const ACTION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/;

function assertActionKey(value: string): void {
  if (!ACTION_KEY_PATTERN.test(value)) throw new TypeError('Work-credit action key is invalid.');
}

export function decideWorkCreditAward(input: {
  creditKind: WorkCreditKind;
  sourceActionKey: string;
  sourceOutcome: ReviewOutcome;
  existingSourceActionKeys: ReadonlySet<string>;
}):
  | { decision: 'DUPLICATE' }
  | { decision: 'AWARD'; unitsMillis: number; sourceOutcome: ReviewOutcome } {
  assertActionKey(input.sourceActionKey);
  if (!Object.prototype.hasOwnProperty.call(WORK_CREDIT_UNITS_MILLIS, input.creditKind)) {
    throw new TypeError('Unsupported work-credit kind.');
  }
  if (!['APPROVED', 'REJECTED', 'ESCALATED'].includes(input.sourceOutcome)) {
    throw new TypeError('Unsupported work-credit outcome.');
  }
  if (input.existingSourceActionKeys.has(input.sourceActionKey)) return { decision: 'DUPLICATE' };

  return {
    decision: 'AWARD',
    unitsMillis: WORK_CREDIT_UNITS_MILLIS[input.creditKind],
    sourceOutcome: input.sourceOutcome,
  };
}

export function decideWorkCreditReversal(input: {
  reversalActionKey: string;
  original: WorkCreditEntry;
  existingSourceActionKeys: ReadonlySet<string>;
  reversedCreditIds: ReadonlySet<string>;
}):
  | { decision: 'DUPLICATE' | 'ALREADY_REVERSED' }
  | {
      decision: 'REVERSE';
      unitsMillis: number;
      reversesCreditId: string;
      creditKind: WorkCreditKind;
      sourceOutcome: string;
    } {
  assertActionKey(input.reversalActionKey);
  if (input.existingSourceActionKeys.has(input.reversalActionKey)) return { decision: 'DUPLICATE' };
  if (input.original.entryType !== 'AWARD' || input.original.unitsMillis <= 0) {
    throw new Error('Only a positive award entry can be reversed.');
  }
  if (input.reversedCreditIds.has(input.original.id)) return { decision: 'ALREADY_REVERSED' };
  return {
    decision: 'REVERSE',
    unitsMillis: -input.original.unitsMillis,
    reversesCreditId: input.original.id,
    creditKind: input.original.creditKind,
    sourceOutcome: input.original.sourceOutcome,
  };
}

export interface WorkloadBand {
  minimumUnitsMillis: number;
  allowanceMinor: number;
}

export interface CompensationCalculation {
  creditedUnitsMillis: number;
  cappedUnitsMillis: number;
  baseRetainerMinor: number;
  workloadAllowanceMinor: number;
  adjustmentMinor: number;
  grossMinor: number;
  currency: string;
}

function assertNonnegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a nonnegative safe integer.`);
  }
}

export function calculateCompensation(input: {
  currency: string;
  baseRetainerMinor: number;
  workloadUnitCapMillis: number;
  creditEntries: readonly Pick<WorkCreditEntry, 'unitsMillis'>[];
  workloadBands: readonly WorkloadBand[];
  approvedAdjustmentsMinor?: readonly number[];
}): CompensationCalculation {
  assertCurrency(input.currency);
  assertNonnegativeInteger(input.baseRetainerMinor, 'baseRetainerMinor');
  assertNonnegativeInteger(input.workloadUnitCapMillis, 'workloadUnitCapMillis');

  const sortedBands = [...input.workloadBands].sort((a, b) => a.minimumUnitsMillis - b.minimumUnitsMillis);
  sortedBands.forEach((band, index) => {
    assertNonnegativeInteger(band.minimumUnitsMillis, 'minimumUnitsMillis');
    assertNonnegativeInteger(band.allowanceMinor, 'allowanceMinor');
    if (index > 0 && sortedBands[index - 1].minimumUnitsMillis === band.minimumUnitsMillis) {
      throw new Error('Workload-band thresholds must be unique.');
    }
    if (index > 0 && sortedBands[index - 1].allowanceMinor > band.allowanceMinor) {
      throw new Error('Workload-band allowances must be nondecreasing.');
    }
  });

  const netCreditUnitsMillis = sumMinorAmounts(input.creditEntries.map((entry) => entry.unitsMillis));
  const creditedUnitsMillis = Math.max(0, netCreditUnitsMillis);
  const cappedUnitsMillis = Math.min(creditedUnitsMillis, input.workloadUnitCapMillis);
  const workloadAllowanceMinor = sortedBands.reduce(
    (allowance, band) => cappedUnitsMillis >= band.minimumUnitsMillis ? band.allowanceMinor : allowance,
    0,
  );
  const adjustmentMinor = sumMinorAmounts(input.approvedAdjustmentsMinor ?? []);
  const grossMinor = sumMinorAmounts([input.baseRetainerMinor, workloadAllowanceMinor, adjustmentMinor]);
  if (grossMinor < 0) throw new RangeError('Approved adjustments cannot make compensation negative.');

  return {
    creditedUnitsMillis,
    cappedUnitsMillis,
    baseRetainerMinor: input.baseRetainerMinor,
    workloadAllowanceMinor,
    adjustmentMinor,
    grossMinor,
    currency: input.currency,
  };
}

export function assertMakerCheckerActors(input: {
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  submittedBy: string;
}): void {
  const actors = [input.preparedBy, input.reviewedBy, input.approvedBy, input.submittedBy];
  if (actors.some((actor) => actor.trim().length === 0)) throw new TypeError('Every workflow actor is required.');
  if (new Set(actors).size !== actors.length) {
    throw new Error('Compensation preparation, review, approval, and payout submission require distinct actors.');
  }
}

export function assertCompensationPayoutAmount(input: {
  statementGrossMinor: number;
  alreadyCommittedMinor: number;
  requestedMinor: number;
  statementCurrency: string;
  payoutCurrency: string;
}): { remainingBeforeMinor: number; remainingAfterMinor: number } {
  assertPositiveMoney({ amountMinor: input.statementGrossMinor, currency: input.statementCurrency });
  assertCurrency(input.payoutCurrency, input.statementCurrency);
  assertNonnegativeInteger(input.alreadyCommittedMinor, 'alreadyCommittedMinor');
  assertPositiveMoney({ amountMinor: input.requestedMinor, currency: input.payoutCurrency });
  if (input.alreadyCommittedMinor > input.statementGrossMinor) {
    throw new RangeError('Committed payouts exceed the approved statement amount.');
  }
  const remainingBeforeMinor = input.statementGrossMinor - input.alreadyCommittedMinor;
  if (input.requestedMinor > remainingBeforeMinor) {
    throw new RangeError('Payout exceeds the remaining approved statement amount.');
  }
  return {
    remainingBeforeMinor,
    remainingAfterMinor: remainingBeforeMinor - input.requestedMinor,
  };
}
