import { z } from 'zod';

const identifier = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Use letters, numbers, dots, underscores, colons, or hyphens.');
const isoDateTime = z.string().datetime({ offset: true });
const moneyMinor = z.number().int().safe().nonnegative();

const workloadBandSchema = z.object({
  minimumUnitsMillis: z.number().int().safe().nonnegative(),
  allowanceMinor: moneyMinor,
}).strict();

export const createCompensationPolicySchema = z.object({
  version: identifier.max(64),
  currency: z.literal('PHP'),
  baseRetainerMinor: moneyMinor,
  workloadUnitCapMillis: z.number().int().safe().nonnegative(),
  workloadBands: z.array(workloadBandSchema).max(30),
  effectiveFrom: isoDateTime,
  effectiveUntil: isoDateTime.optional(),
}).strict().superRefine((value, context) => {
  if (value.effectiveUntil && new Date(value.effectiveUntil) <= new Date(value.effectiveFrom)) {
    context.addIssue({ code: 'custom', path: ['effectiveUntil'], message: 'effectiveUntil must be after effectiveFrom.' });
  }
  const sorted = [...value.workloadBands].sort((a, b) => a.minimumUnitsMillis - b.minimumUnitsMillis);
  sorted.forEach((band, index) => {
    if (band.minimumUnitsMillis > value.workloadUnitCapMillis) {
      context.addIssue({ code: 'custom', path: ['workloadBands', index, 'minimumUnitsMillis'], message: 'A workload threshold cannot exceed the cap.' });
    }
    if (index > 0 && sorted[index - 1].minimumUnitsMillis === band.minimumUnitsMillis) {
      context.addIssue({ code: 'custom', path: ['workloadBands'], message: 'Workload thresholds must be unique.' });
    }
    if (index > 0 && sorted[index - 1].allowanceMinor > band.allowanceMinor) {
      context.addIssue({ code: 'custom', path: ['workloadBands'], message: 'Workload allowances must not decrease.' });
    }
  });
});

export const createCompensationPeriodSchema = z.object({
  policyId: z.string().trim().min(1).max(191),
  periodStart: isoDateTime,
  periodEnd: isoDateTime,
}).strict().refine((value) => new Date(value.periodEnd) > new Date(value.periodStart), {
  path: ['periodEnd'],
  message: 'periodEnd must be after periodStart.',
});

export const createCompensationAdjustmentSchema = z.object({
  amountMinor: z.number().int().safe().refine((value) => value !== 0, 'Adjustment amount cannot be zero.'),
  currency: z.literal('PHP'),
  reasonCode: identifier.max(64),
  note: z.string().trim().min(1).max(500).optional(),
  idempotencyKey: identifier,
}).strict();

export const decideCompensationAdjustmentSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE') }).strict(),
  z.object({
    decision: z.literal('REJECT'),
    reason: z.string().trim().min(1).max(240),
  }).strict(),
]);

export const prepareCompensationPayoutSchema = z.object({ idempotencyKey: identifier }).strict();

export const recordManualPayoutSchema = z.object({
  externalReference: z.string().trim().min(1).max(191).regex(/^[A-Za-z0-9][A-Za-z0-9 ./_:#-]*$/, 'The evidence reference contains unsupported characters.'),
}).strict();

export const reverseWorkCreditSchema = z.object({
  reversalActionKey: identifier.max(191),
  reasonCode: identifier.max(64),
}).strict();

export type CreateCompensationPolicyInput = z.infer<typeof createCompensationPolicySchema>;
export type CreateCompensationPeriodInput = z.infer<typeof createCompensationPeriodSchema>;
export type CreateCompensationAdjustmentInput = z.infer<typeof createCompensationAdjustmentSchema>;
export type DecideCompensationAdjustmentInput = z.infer<typeof decideCompensationAdjustmentSchema>;
