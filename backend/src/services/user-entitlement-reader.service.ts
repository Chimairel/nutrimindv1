import type { Prisma } from '@prisma/client';
import {
  MAX_PAST_DUE_GRACE_HOURS,
  resolveBillingEntitlement,
  type EntitlementResolution,
} from '@/domain/billing-entitlement.policy';

type EntitlementReadClient = Pick<Prisma.TransactionClient, 'entitlementGrant'>;

export async function resolveUserBillingEntitlement(
  client: EntitlementReadClient,
  userId: string,
  at: Date,
): Promise<EntitlementResolution> {
  const earliestRelevantEnd = new Date(at.getTime() - MAX_PAST_DUE_GRACE_HOURS * 60 * 60 * 1000);
  const rows = await client.entitlementGrant.findMany({
    where: {
      userId,
      entitlementKey: 'PREMIUM',
      effectiveFrom: { lte: at },
      effectiveUntil: { gt: earliestRelevantEnd },
      OR: [{ revokedAt: null }, { revokedAt: { gt: at } }],
    },
    orderBy: { effectiveUntil: 'desc' },
    select: {
      id: true, source: true, effectiveFrom: true, effectiveUntil: true, revokedAt: true,
      invoice: { select: { status: true } },
      subscription: { select: { id: true, status: true, pastDueAt: true } },
    },
  });
  return resolveBillingEntitlement({
    at,
    grants: rows.map((row) => ({
      id: row.id,
      subscriptionId: row.subscription?.id ?? null,
      source: row.source,
      invoiceStatus: row.invoice?.status ?? null,
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      revokedAt: row.revokedAt,
    })),
    subscriptions: rows.flatMap((row) => row.subscription ? [{
      id: row.subscription.id,
      status: row.subscription.status,
      pastDueAt: row.subscription.pastDueAt,
    }] : []),
  });
}
