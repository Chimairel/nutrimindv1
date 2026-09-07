import { Prisma } from '@prisma/client';
import { MAX_PAST_DUE_GRACE_HOURS } from '@/domain/billing-entitlement.policy';

export const premiumEntitlementGrantSelect = {
  id: true,
  source: true,
  effectiveFrom: true,
  effectiveUntil: true,
  revokedAt: true,
  invoice: { select: { status: true } },
  subscription: { select: { id: true, status: true, pastDueAt: true } },
} satisfies Prisma.EntitlementGrantSelect;

export type PremiumEntitlementGrantRow = Prisma.EntitlementGrantGetPayload<{
  select: typeof premiumEntitlementGrantSelect;
}>;

export function buildPremiumEntitlementGrantWhere(at: Date): Prisma.EntitlementGrantWhereInput {
  const earliestRelevantEnd = new Date(at.getTime() - MAX_PAST_DUE_GRACE_HOURS * 60 * 60 * 1000);
  return {
    entitlementKey: 'PREMIUM',
    effectiveFrom: { lte: at },
    effectiveUntil: { gt: earliestRelevantEnd },
    OR: [{ revokedAt: null }, { revokedAt: { gt: at } }],
  };
}

export function mapPremiumEntitlementEvidence(rows: PremiumEntitlementGrantRow[]) {
  return {
    grants: rows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscription?.id ?? null,
      source: row.source,
      invoiceStatus: row.invoice?.status ?? null,
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      revokedAt: row.revokedAt,
    })),
    subscriptions: rows.flatMap((row) =>
      row.subscription
        ? [{ id: row.subscription.id, status: row.subscription.status, pastDueAt: row.subscription.pastDueAt }]
        : []
    ),
  };
}
