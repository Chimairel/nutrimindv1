import type { Prisma } from '@prisma/client';
import { resolveBillingEntitlement, type EntitlementResolution } from '@/domain/billing-entitlement.policy';
import {
  buildPremiumEntitlementGrantWhere,
  mapPremiumEntitlementEvidence,
  premiumEntitlementGrantSelect,
} from '@/domain/billing-entitlement-evidence';

type EntitlementReadClient = Pick<Prisma.TransactionClient, 'entitlementGrant'>;

export async function resolveUserBillingEntitlement(
  client: EntitlementReadClient,
  userId: string,
  at: Date
): Promise<EntitlementResolution> {
  const rows = await client.entitlementGrant.findMany({
    where: {
      userId,
      ...buildPremiumEntitlementGrantWhere(at),
    },
    orderBy: { effectiveUntil: 'desc' },
    select: premiumEntitlementGrantSelect,
  });
  const evidence = mapPremiumEntitlementEvidence(rows);
  return resolveBillingEntitlement({
    at,
    ...evidence,
  });
}
