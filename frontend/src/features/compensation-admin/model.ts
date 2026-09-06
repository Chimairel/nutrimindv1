export type Policy = {
  id: string;
  version: string;
  status: string;
  currency: string;
  baseRetainerMinor: number;
  workloadUnitCapMillis: number;
  workloadBands: Array<{ minimumUnitsMillis: number; allowanceMinor: number }>;
  effectiveFrom: string;
};

export type Period = {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  policy: { version: string };
  _count: { statements: number };
};

export type Adjustment = {
  id: string;
  amountMinor: number;
  currency: string;
  reasonCode: string;
  note?: string;
  status: string;
};

export type Payout = {
  id: string;
  status: string;
  amountMinor: number;
  currency: string;
  externalReference?: string | null;
};

export type Statement = {
  id: string;
  status: string;
  grossMinor: number;
  creditedUnitsMillis: number;
  workloadAllowanceMinor: number;
  adjustmentMinor: number;
  currency: string;
  nutritionistProfile: { user: { name: string } };
  period: { policy: { version: string }; periodStart: string; periodEnd: string };
  adjustments: Adjustment[];
  payouts: Payout[];
};

export type Workspace = {
  policies: Policy[];
  periods: Period[];
  statements: Statement[];
  pendingAdjustments: Array<Adjustment & { statement: { nutritionistProfile: { user: { name: string } } } }>;
  payouts: Payout[];
  reconciliation: {
    approvedStatementGrossMinor: number;
    committedPayoutMinor: number;
    recordedPaidMinor: number;
    outstandingApprovedMinor: number;
    mismatchMinor: number;
    currency: string;
  };
};

export type CompensationAction = (key: string, request: () => Promise<unknown>, success: string) => Promise<void>;

export const compensationFieldClass =
  'min-h-11 w-full rounded-2xl border border-brand-border bg-brand-bgAlt px-4 text-sm text-brand-text outline-none focus:border-brand-green';

export const peso = (minor: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(minor / 100);

export const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));

export function compensationApiError(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { error?: unknown } } };
  return typeof candidate.response?.data?.error === 'string' ? candidate.response.data.error : fallback;
}
