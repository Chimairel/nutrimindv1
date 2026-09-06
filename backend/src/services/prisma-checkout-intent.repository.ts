import { createHash, randomBytes } from 'node:crypto';
import { BillingCheckoutAuditEventType, BillingCheckoutRequestStatus, Prisma, PrismaClient } from '@prisma/client';
import { CheckoutIntentClaim, CheckoutIntentRepository, HostedCheckoutSession } from '@/billing/contracts';

const CLAIM_LEASE_MS = 60_000;
const PROVIDER_IDEMPOTENCY_SAFETY_WINDOW_MS = 23 * 60 * 60 * 1_000;

function opaque(prefix: string, bytes = 16): string {
  return `${prefix}${randomBytes(bytes).toString('hex')}`;
}

function hashClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function retryableFailure(failureCode: string): boolean {
  return failureCode.startsWith('PROVIDER_TEMPORARILY_UNAVAILABLE');
}

function storedSession(record: {
  providerSessionId: string | null;
  checkoutUrl: string | null;
  environment: 'TEST' | 'LIVE';
}): HostedCheckoutSession | null {
  if (record.environment !== 'TEST' || !record.providerSessionId || !record.checkoutUrl) return null;
  return {
    provider: 'PAYMONGO',
    environment: 'TEST',
    providerSessionId: record.providerSessionId,
    checkoutUrl: record.checkoutUrl,
    livemode: false,
    entitlementGranted: false,
  };
}

export class PrismaCheckoutIntentRepository implements CheckoutIntentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async findEligiblePrice(input: { userId: string; priceCode: string; environment: 'TEST' }) {
    const now = this.clock();
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, role: 'USER', isSuspended: false },
      select: { id: true },
    });
    if (!user) return null;
    const price = await this.prisma.billingPrice.findFirst({
      where: {
        provider: 'PAYMONGO',
        environment: input.environment,
        currency: 'PHP',
        interval: 'MONTH',
        intervalCount: 1,
        isActive: true,
        AND: [
          { OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] },
          { OR: [{ activeUntil: null }, { activeUntil: { gt: now } }] },
        ],
        product: { code: input.priceCode, status: 'ACTIVE' },
      },
      include: { product: { select: { code: true, displayName: true } } },
      orderBy: { version: 'desc' },
    });
    if (!price) return null;
    return {
      id: price.id,
      productCode: price.product.code,
      displayName: price.product.displayName,
      amountMinor: price.amountMinor,
      currency: 'PHP' as const,
      environment: 'TEST' as const,
      active: true as const,
    };
  }

  async claim(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    requestHash: string;
  }): Promise<CheckoutIntentClaim> {
    try {
      return await this.claimOnce(input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.claimOnce(input);
      }
      throw error;
    }
  }

  private async claimOnce(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    requestHash: string;
  }): Promise<CheckoutIntentClaim> {
    return this.prisma.$transaction(
      async (transaction) => {
        const now = this.clock();
        let record = await transaction.billingCheckoutRequest.findFirst({
          where: { userId: input.userId, requestIdempotencyKey: input.requestIdempotencyKey },
        });
        if (!record) {
          const claimToken = opaque('claim_', 24);
          record = await transaction.billingCheckoutRequest.create({
            data: {
              userId: input.userId,
              billingSubjectKey: opaque('nmbs_'),
              billingPriceId: input.priceId,
              provider: 'PAYMONGO',
              environment: 'TEST',
              requestIdempotencyKey: input.requestIdempotencyKey,
              requestHash: input.requestHash,
              providerIdempotencyKey: opaque('nm_checkout_'),
              referenceNumber: opaque('nmco_'),
              status: 'CLAIMED',
              claimTokenHash: hashClaimToken(claimToken),
              claimExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
              auditEvents: { create: { eventType: 'CLAIMED', attemptNumber: 1 } },
            },
          });
          return {
            decision: 'CREATE',
            referenceNumber: record.referenceNumber,
            providerIdempotencyKey: record.providerIdempotencyKey,
            claimToken,
          };
        }

        if (record.billingPriceId !== input.priceId || record.requestHash !== input.requestHash) {
          await this.audit(transaction, record.id, 'COLLISION_REJECTED', record.attemptCount);
          return { decision: 'CONFLICT' };
        }
        if (record.status === 'SUCCEEDED') {
          const session = storedSession(record);
          if (!session) return { decision: 'FAILED', failureCode: 'STORED_SESSION_INVALID' };
          await this.audit(transaction, record.id, 'REPLAYED', record.attemptCount);
          return { decision: 'REPLAY', session };
        }
        if (record.status === 'FAILED') {
          return { decision: 'FAILED', failureCode: record.failureCode || 'TERMINAL_FAILURE' };
        }
        if (record.status === 'CLAIMED' && record.claimExpiresAt && record.claimExpiresAt > now) {
          await this.audit(transaction, record.id, 'IN_PROGRESS_REJECTED', record.attemptCount);
          return { decision: 'IN_PROGRESS' };
        }
        if (now.getTime() - record.createdAt.getTime() >= PROVIDER_IDEMPOTENCY_SAFETY_WINDOW_MS) {
          const failureCode = 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED';
          await transaction.billingCheckoutRequest.update({
            where: { id: record.id },
            data: { status: 'FAILED', failureCode, claimTokenHash: null, claimExpiresAt: null },
          });
          await this.audit(transaction, record.id, 'TERMINAL_FAILURE', record.attemptCount, failureCode);
          return { decision: 'FAILED', failureCode };
        }

        const claimToken = opaque('claim_', 24);
        const nextAttempt = record.attemptCount + 1;
        const eligibleStatuses: BillingCheckoutRequestStatus[] = ['CLAIMED', 'RETRYABLE'];
        const updated = await transaction.billingCheckoutRequest.updateMany({
          where: {
            id: record.id,
            status: { in: eligibleStatuses },
            OR: [{ status: 'RETRYABLE' }, { claimExpiresAt: { lte: now } }],
          },
          data: {
            status: 'CLAIMED',
            claimTokenHash: hashClaimToken(claimToken),
            claimExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
            attemptCount: { increment: 1 },
            failureCode: null,
          },
        });
        if (updated.count !== 1) return { decision: 'IN_PROGRESS' };
        await this.audit(transaction, record.id, 'RECLAIMED', nextAttempt);
        return {
          decision: 'CREATE',
          referenceNumber: record.referenceNumber,
          providerIdempotencyKey: record.providerIdempotencyKey,
          claimToken,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async complete(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    claimToken: string;
    session: HostedCheckoutSession;
  }): Promise<void> {
    if (input.session.environment !== 'TEST' || input.session.livemode || input.session.entitlementGranted) {
      throw new Error('Invalid checkout session state.');
    }
    await this.prisma.$transaction(
      async (transaction) => {
        const record = await transaction.billingCheckoutRequest.findFirstOrThrow({
          where: {
            userId: input.userId,
            billingPriceId: input.priceId,
            requestIdempotencyKey: input.requestIdempotencyKey,
          },
        });
        const updated = await transaction.billingCheckoutRequest.updateMany({
          where: { id: record.id, status: 'CLAIMED', claimTokenHash: hashClaimToken(input.claimToken) },
          data: {
            status: 'SUCCEEDED',
            providerSessionId: input.session.providerSessionId,
            checkoutUrl: input.session.checkoutUrl,
            failureCode: null,
            claimTokenHash: null,
            claimExpiresAt: null,
            completedAt: this.clock(),
          },
        });
        if (updated.count !== 1) throw new Error('Checkout claim was lost.');
        await this.audit(transaction, record.id, 'PROVIDER_SESSION_CREATED', record.attemptCount);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async release(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    claimToken: string;
    failureCode: string;
  }): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const record = await transaction.billingCheckoutRequest.findFirstOrThrow({
          where: {
            userId: input.userId,
            billingPriceId: input.priceId,
            requestIdempotencyKey: input.requestIdempotencyKey,
          },
        });
        const retryable = retryableFailure(input.failureCode);
        const updated = await transaction.billingCheckoutRequest.updateMany({
          where: { id: record.id, status: 'CLAIMED', claimTokenHash: hashClaimToken(input.claimToken) },
          data: {
            status: retryable ? 'RETRYABLE' : 'FAILED',
            failureCode: input.failureCode,
            claimTokenHash: null,
            claimExpiresAt: null,
          },
        });
        if (updated.count !== 1) throw new Error('Checkout claim was lost.');
        await this.audit(
          transaction,
          record.id,
          retryable ? 'RETRYABLE_FAILURE' : 'TERMINAL_FAILURE',
          record.attemptCount,
          input.failureCode
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    checkoutRequestId: string,
    eventType: BillingCheckoutAuditEventType,
    attemptNumber: number,
    failureCode?: string
  ): Promise<void> {
    await transaction.billingCheckoutAuditEvent.create({
      data: { checkoutRequestId, eventType, attemptNumber, failureCode },
    });
  }
}
