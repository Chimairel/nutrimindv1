import { Prisma, PrismaClient } from '@prisma/client';
import type { BillingAccessEvidence, BillingAccessRepository } from '@/services/user-billing-access.service';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { getManilaDateKey, getManilaMidnight, getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';
import { MAX_PAST_DUE_GRACE_HOURS } from '@/domain/billing-entitlement.policy';

export class PrismaUserBillingAccessRepository implements BillingAccessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async readForUser(userId: string, at: Date): Promise<BillingAccessEvidence | null> {
    return this.prisma.$transaction((transaction) => this.readConsistentSnapshot(transaction, userId, at), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  private async readConsistentSnapshot(
    client: Prisma.TransactionClient,
    userId: string,
    at: Date
  ): Promise<BillingAccessEvidence | null> {
    const earliestRelevantEnd = new Date(at.getTime() - MAX_PAST_DUE_GRACE_HOURS * 60 * 60 * 1000);
    const user = await client.user.findFirst({
      where: { id: userId, role: 'USER', isSuspended: false },
      select: {
        id: true,
        entitlementGrants: {
          where: {
            entitlementKey: 'PREMIUM',
            effectiveFrom: { lte: at },
            effectiveUntil: { gt: earliestRelevantEnd },
            OR: [{ revokedAt: null }, { revokedAt: { gt: at } }],
          },
          orderBy: { effectiveUntil: 'desc' },
          select: {
            id: true,
            source: true,
            effectiveFrom: true,
            effectiveUntil: true,
            revokedAt: true,
            invoice: { select: { status: true } },
            subscription: { select: { id: true, status: true, pastDueAt: true } },
          },
        },
        billingCheckoutRequests: {
          where: { provider: 'PAYMONGO', environment: 'TEST' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            createdAt: true,
            completedAt: true,
            providerSessionId: true,
            subscription: { select: { id: true } },
          },
        },
      },
    });
    if (!user) return null;

    const price = await client.billingPrice.findFirst({
      where: {
        provider: 'PAYMONGO',
        environment: 'TEST',
        currency: 'PHP',
        interval: 'MONTH',
        intervalCount: 1,
        isActive: true,
        AND: [
          { OR: [{ activeFrom: null }, { activeFrom: { lte: at } }] },
          { OR: [{ activeUntil: null }, { activeUntil: { gt: at } }] },
        ],
        product: { code: 'PREMIUM', status: 'ACTIVE' },
      },
      orderBy: { version: 'desc' },
      select: { amountMinor: true, currency: true },
    });

    const plan = await client.mealPlan.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
        scheduledDate: { gte: getStartOfManilaBusinessDay(at) },
      },
      orderBy: { createdAt: 'desc' },
      select: { planGroupId: true },
    });
    const [planRange, tracker] = plan
      ? await Promise.all([
          client.mealPlan.aggregate({
            where: { userId, planGroupId: plan.planGroupId },
            _min: { scheduledDate: true },
            _max: { scheduledDate: true },
          }),
          client.planSwapTracker.findFirst({
            where: { userId, planGroupId: plan.planGroupId },
            select: { swapsUsed: true },
          }),
        ])
      : [null, null];

    const latestCheckout = user.billingCheckoutRequests[0] ?? null;
    const providerSessionId = latestCheckout?.providerSessionId;
    const [event, issue] = providerSessionId
      ? await Promise.all([
          client.providerWebhookEvent.findFirst({
            where: {
              provider: 'PAYMONGO',
              environment: 'TEST',
              livemode: false,
              sanitizedPayload: { path: ['resource', 'id'], equals: providerSessionId },
            },
            orderBy: { receivedAt: 'desc' },
            select: { processing: { select: { status: true, nextAttemptAt: true } } },
          }),
          client.billingReconciliationIssue.findFirst({
            where: {
              provider: 'PAYMONGO',
              environment: 'TEST',
              resourceType: 'checkout_session',
              providerResourceId: providerSessionId,
              status: 'OPEN',
            },
            select: { id: true },
          }),
        ])
      : [null, null];

    const grants = user.entitlementGrants.map((grant) => ({
      id: grant.id,
      subscriptionId: grant.subscription?.id ?? null,
      source: grant.source,
      invoiceStatus: grant.invoice?.status ?? null,
      effectiveFrom: grant.effectiveFrom,
      effectiveUntil: grant.effectiveUntil,
      revokedAt: grant.revokedAt,
    }));
    const subscriptions = user.entitlementGrants.flatMap((grant) =>
      grant.subscription
        ? [
            {
              id: grant.subscription.id,
              status: grant.subscription.status,
              pastDueAt: grant.subscription.pastDueAt,
            },
          ]
        : []
    );

    const rangeStart = planRange?._min.scheduledDate;
    const rangeEnd = planRange?._max.scheduledDate;
    const swapCycle =
      rangeStart && rangeEnd
        ? {
            startsAt: getManilaMidnight(getManilaDateKey(rangeStart)),
            endsAtExclusive: getScheduledMealDate(getManilaMidnight(getManilaDateKey(rangeEnd)), 1),
            swapsUsed: tracker?.swapsUsed ?? 0,
          }
        : null;

    return {
      userEligible: true,
      grants,
      subscriptions,
      activeTestPrice: price?.currency === 'PHP' ? { amountMinor: price.amountMinor, currency: 'PHP' } : null,
      latestCheckout: latestCheckout
        ? {
            status: latestCheckout.status,
            createdAt: latestCheckout.createdAt,
            completedAt: latestCheckout.completedAt,
            projected: Boolean(latestCheckout.subscription),
          }
        : null,
      latestProcessing: event?.processing ?? null,
      hasOpenReconciliationIssue: Boolean(issue),
      swapCycle,
    };
  }
}
