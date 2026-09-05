import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORK_CREDIT_UNITS_MILLIS,
  assertCompensationPayoutAmount,
  assertMakerCheckerActors,
  calculateCompensation,
  decideWorkCreditAward,
  decideWorkCreditReversal,
  type WorkCreditEntry,
} from '../src/domain/nutritionist-compensation.policy';

test('[TEST-082] ordinary review credit is independent of approval outcome', () => {
  const existing = new Set<string>();
  const units = (['APPROVED', 'REJECTED', 'ESCALATED'] as const).map((sourceOutcome, index) =>
    decideWorkCreditAward({
      creditKind: 'ORDINARY_PLAN_REVIEW',
      sourceActionKey: `review:${index}`,
      sourceOutcome,
      existingSourceActionKeys: existing,
    }),
  );
  assert.deepEqual(units.map((entry) => entry.decision === 'AWARD' ? entry.unitsMillis : null), [1_000, 1_000, 1_000]);
});

test('[TEST-082] work kinds have fixed relative units and duplicate actions receive no second award', () => {
  assert.deepEqual(WORK_CREDIT_UNITS_MILLIS, {
    ORDINARY_PLAN_REVIEW: 1_000,
    HIGH_RISK_SECOND_REVIEW: 1_500,
    LIBRARY_SAFETY_CERTIFICATION: 1_250,
    SAFETY_FLAG_RESOLUTION: 1_500,
  });
  assert.deepEqual(decideWorkCreditAward({
    creditKind: 'HIGH_RISK_SECOND_REVIEW',
    sourceActionKey: 'review:high-risk:2',
    sourceOutcome: 'APPROVED',
    existingSourceActionKeys: new Set(['review:high-risk:2']),
  }), { decision: 'DUPLICATE' });
  assert.throws(() => decideWorkCreditAward({
    creditKind: 'UNSUPPORTED' as never,
    sourceActionKey: 'review:unsupported-kind',
    sourceOutcome: 'APPROVED',
    existingSourceActionKeys: new Set(),
  }), /Unsupported work-credit kind/);
  assert.throws(() => decideWorkCreditAward({
    creditKind: 'ORDINARY_PLAN_REVIEW',
    sourceActionKey: 'review:unsupported-outcome',
    sourceOutcome: 'PENDING' as never,
    existingSourceActionKeys: new Set(),
  }), /Unsupported work-credit outcome/);
});

test('[TEST-082] reversals are signed append-only entries and are deduplicated', () => {
  const original: WorkCreditEntry = {
    id: 'credit-1',
    entryType: 'AWARD',
    creditKind: 'ORDINARY_PLAN_REVIEW',
    sourceActionKey: 'review:1',
    sourceOutcome: 'APPROVED',
    unitsMillis: 1_000,
  };
  assert.deepEqual(decideWorkCreditReversal({
    reversalActionKey: 'review:1:reversal',
    original,
    existingSourceActionKeys: new Set(),
    reversedCreditIds: new Set(),
  }), {
    decision: 'REVERSE',
    unitsMillis: -1_000,
    reversesCreditId: 'credit-1',
    creditKind: 'ORDINARY_PLAN_REVIEW',
    sourceOutcome: 'APPROVED',
  });
  assert.deepEqual(decideWorkCreditReversal({
    reversalActionKey: 'review:1:reversal',
    original,
    existingSourceActionKeys: new Set(['review:1:reversal']),
    reversedCreditIds: new Set(),
  }), { decision: 'DUPLICATE' });
  assert.deepEqual(decideWorkCreditReversal({
    reversalActionKey: 'review:1:another-reversal',
    original,
    existingSourceActionKeys: new Set(),
    reversedCreditIds: new Set(['credit-1']),
  }), { decision: 'ALREADY_REVERSED' });
});

test('[TEST-082] compensation uses capped workload bands instead of unbounded per-item pay', () => {
  const result = calculateCompensation({
    currency: 'PHP',
    baseRetainerMinor: 1_000_000,
    workloadUnitCapMillis: 10_000,
    creditEntries: [
      { unitsMillis: 8_000 },
      { unitsMillis: 5_000 },
      { unitsMillis: -1_000 },
    ],
    workloadBands: [
      { minimumUnitsMillis: 0, allowanceMinor: 0 },
      { minimumUnitsMillis: 5_000, allowanceMinor: 100_000 },
      { minimumUnitsMillis: 10_000, allowanceMinor: 200_000 },
    ],
    approvedAdjustmentsMinor: [25_000, -5_000],
  });
  assert.deepEqual(result, {
    creditedUnitsMillis: 12_000,
    cappedUnitsMillis: 10_000,
    baseRetainerMinor: 1_000_000,
    workloadAllowanceMinor: 200_000,
    adjustmentMinor: 20_000,
    grossMinor: 1_220_000,
    currency: 'PHP',
  });
});

test('[TEST-082] added volume above the cap cannot increase the allowance', () => {
  const common = {
    currency: 'PHP',
    baseRetainerMinor: 1_000_000,
    workloadUnitCapMillis: 10_000,
    workloadBands: [
      { minimumUnitsMillis: 0, allowanceMinor: 0 },
      { minimumUnitsMillis: 10_000, allowanceMinor: 200_000 },
    ],
  } as const;
  const atCap = calculateCompensation({ ...common, creditEntries: [{ unitsMillis: 10_000 }] });
  const aboveCap = calculateCompensation({ ...common, creditEntries: [{ unitsMillis: 1_000_000 }] });
  assert.equal(atCap.workloadAllowanceMinor, aboveCap.workloadAllowanceMinor);
  assert.equal(atCap.grossMinor, aboveCap.grossMinor);
});

test('[TEST-082] invalid bands and adjustments fail closed', () => {
  assert.throws(() => calculateCompensation({
    currency: 'PHP',
    baseRetainerMinor: 0,
    workloadUnitCapMillis: 10_000,
    creditEntries: [],
    workloadBands: [
      { minimumUnitsMillis: 5_000, allowanceMinor: 10_000 },
      { minimumUnitsMillis: 5_000, allowanceMinor: 20_000 },
    ],
  }), /thresholds must be unique/);
  assert.throws(() => calculateCompensation({
    currency: 'PHP',
    baseRetainerMinor: 0,
    workloadUnitCapMillis: 10_000,
    creditEntries: [],
    workloadBands: [
      { minimumUnitsMillis: 0, allowanceMinor: 20_000 },
      { minimumUnitsMillis: 5_000, allowanceMinor: 10_000 },
    ],
  }), /allowances must be nondecreasing/);
  assert.throws(() => calculateCompensation({
    currency: 'PHP',
    baseRetainerMinor: 10_000,
    workloadUnitCapMillis: 10_000,
    creditEntries: [],
    workloadBands: [],
    approvedAdjustmentsMinor: [-20_000],
  }), /cannot make compensation negative/);
});

test('[TEST-082] maker-checker actors must remain distinct', () => {
  assert.doesNotThrow(() => assertMakerCheckerActors({
    preparedBy: 'admin-1',
    reviewedBy: 'admin-2',
    approvedBy: 'admin-3',
    submittedBy: 'admin-4',
  }));
  assert.throws(() => assertMakerCheckerActors({
    preparedBy: 'admin-1',
    reviewedBy: 'admin-2',
    approvedBy: 'admin-1',
    submittedBy: 'admin-4',
  }), /require distinct actors/);
});

test('[TEST-082] payout records cannot exceed the approved statement or cross currencies', () => {
  assert.deepEqual(assertCompensationPayoutAmount({
    statementGrossMinor: 1_220_000,
    alreadyCommittedMinor: 200_000,
    requestedMinor: 1_000_000,
    statementCurrency: 'PHP',
    payoutCurrency: 'PHP',
  }), { remainingBeforeMinor: 1_020_000, remainingAfterMinor: 20_000 });
  assert.throws(() => assertCompensationPayoutAmount({
    statementGrossMinor: 1_220_000,
    alreadyCommittedMinor: 220_000,
    requestedMinor: 1_000_001,
    statementCurrency: 'PHP',
    payoutCurrency: 'PHP',
  }), /exceeds the remaining/);
  assert.throws(() => assertCompensationPayoutAmount({
    statementGrossMinor: 1_220_000,
    alreadyCommittedMinor: 0,
    requestedMinor: 1_000,
    statementCurrency: 'PHP',
    payoutCurrency: 'USD',
  }), /Currency mismatch/);
});
