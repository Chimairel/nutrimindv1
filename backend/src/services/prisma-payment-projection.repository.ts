import { createHash, randomBytes } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  PaymentProjectionBinding,
  PaymentProjectionClaim,
  PaymentProjectionRepository,
  PaymentProjectionResult,
  ReconciledPaymongoCheckout,
} from '@/billing/contracts';
import { PaymentReconciliationError } from '@/domain/paymongo-payment-reconciliation.policy';

const CLAIM_LEASE_MS = 60_000;
const MAX_ATTEMPTS = 5;
const SERIALIZABLE_RETRIES = 3;

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function resourceId(payload: Prisma.JsonValue): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const resource = (payload as Record<string, unknown>).resource;
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) return '';
  return typeof (resource as Record<string, unknown>).id === 'string' ? (resource as Record<string, string>).id : '';
}

function retryableTransaction(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function sameInstant(left: Date | null, right: Date): boolean {
  return left instanceof Date && left.getTime() === right.getTime();
}

export class PrismaPaymentProjectionRepository implements PaymentProjectionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async claimNext(): Promise<PaymentProjectionClaim> {
    for (let attempt = 1; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
      try {
        return await this.claimOnce();
      } catch (error) {
        if (retryableTransaction(error) && attempt < SERIALIZABLE_RETRIES) continue;
        throw error;
      }
    }
    throw new Error('Payment projection claim retry limit exceeded.');
  }

  private async claimOnce(): Promise<PaymentProjectionClaim> {
    const claimed = await this.prisma.$transaction(
      async (transaction) => {
        const now = this.clock();
        const work = await transaction.webhookEventProcessing.findFirst({
          where: {
            webhookEvent: {
              provider: 'PAYMONGO',
              environment: 'TEST',
              livemode: false,
              eventType: 'checkout_session.payment.paid',
            },
            OR: [
              { status: 'PENDING' },
              { status: 'FAILED', nextAttemptAt: { lte: now } },
              { status: 'PROCESSING', claimExpiresAt: { lte: now } },
            ],
          },
          include: { webhookEvent: true },
          orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
        });
        if (!work) return null;
        const claimToken = `pclaim_${randomBytes(24).toString('hex')}`;
        const updated = await transaction.webhookEventProcessing.updateMany({
          where: {
            id: work.id,
            OR: [
              { status: 'PENDING' },
              { status: 'FAILED', nextAttemptAt: { lte: now } },
              { status: 'PROCESSING', claimExpiresAt: { lte: now } },
            ],
          },
          data: {
            status: 'PROCESSING',
            attemptCount: { increment: 1 },
            handlerVersion: 'paymongo-payment-projection-v1',
            lockedAt: now,
            claimTokenHash: tokenHash(claimToken),
            claimExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
            nextAttemptAt: null,
            lastErrorCode: null,
            completedAt: null,
          },
        });
        return updated.count === 1 ? { work, claimToken } : null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (!claimed) return { decision: 'NO_WORK' };

    const sessionId = resourceId(claimed.work.webhookEvent.sanitizedPayload);
    const checkout = sessionId
      ? await this.prisma.billingCheckoutRequest.findUnique({
          where: {
            provider_environment_providerSessionId: {
              provider: 'PAYMONGO',
              environment: 'TEST',
              providerSessionId: sessionId,
            },
          },
          include: {
            user: { select: { id: true, role: true, isSuspended: true } },
            billingPrice: { include: { product: true } },
            subscription: { include: { paymentAttempts: { orderBy: { providerUpdatedAt: 'desc' }, take: 1 } } },
          },
        })
      : null;

    const event = claimed.work.webhookEvent;
    const fallbackDate = event.providerCreatedAt || event.receivedAt;
    const binding: PaymentProjectionBinding = checkout
      ? {
          checkoutFound: true,
          processingId: claimed.work.id,
          claimToken: claimed.claimToken,
          webhookEventId: event.id,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          eventLivemode: event.livemode,
          eventProviderCreatedAt: fallbackDate,
          eventReceivedAt: event.receivedAt,
          providerSessionId: sessionId,
          checkoutRequestId: checkout.id,
          checkoutUserId: checkout.userId,
          userEligible: checkout.user?.role === 'USER',
          billingSubjectKey: checkout.billingSubjectKey,
          billingPriceId: checkout.billingPriceId,
          productCode: checkout.billingPrice.product.code,
          productStatus: checkout.billingPrice.product.status,
          priceEnvironment: checkout.billingPrice.environment,
          priceAmountMinor: checkout.billingPrice.amountMinor,
          priceCurrency: checkout.billingPrice.currency,
          priceInterval: checkout.billingPrice.interval,
          priceIntervalCount: checkout.billingPrice.intervalCount,
          checkoutStatus: checkout.status,
          requestHash: checkout.requestHash,
          referenceNumber: checkout.referenceNumber,
          checkoutCreatedAt: checkout.createdAt,
          checkoutCompletedAt: checkout.completedAt,
          latestProviderUpdatedAt: checkout.subscription?.paymentAttempts[0]?.providerUpdatedAt || null,
        }
      : {
          checkoutFound: false,
          processingId: claimed.work.id,
          claimToken: claimed.claimToken,
          webhookEventId: event.id,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          eventLivemode: event.livemode,
          eventProviderCreatedAt: fallbackDate,
          eventReceivedAt: event.receivedAt,
          providerSessionId: sessionId,
          checkoutRequestId: '',
          checkoutUserId: null,
          userEligible: false,
          billingSubjectKey: '',
          billingPriceId: '',
          productCode: '',
          productStatus: 'INACTIVE',
          priceEnvironment: 'TEST',
          priceAmountMinor: 0,
          priceCurrency: '',
          priceInterval: 'MONTH',
          priceIntervalCount: 0,
          checkoutStatus: 'FAILED',
          requestHash: '',
          referenceNumber: '',
          checkoutCreatedAt: fallbackDate,
          checkoutCompletedAt: null,
          latestProviderUpdatedAt: null,
        };
    return { decision: 'CLAIMED', binding };
  }

  async project(
    binding: PaymentProjectionBinding,
    evidence: ReconciledPaymongoCheckout,
    period: { effectiveFrom: Date; effectiveUntil: Date }
  ): Promise<PaymentProjectionResult> {
    for (let attempt = 1; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
      try {
        return await this.projectOnce(binding, evidence, period);
      } catch (error) {
        if (retryableTransaction(error) && attempt < SERIALIZABLE_RETRIES) continue;
        throw error;
      }
    }
    throw new Error('Payment projection transaction retry limit exceeded.');
  }

  private async projectOnce(
    binding: PaymentProjectionBinding,
    evidence: ReconciledPaymongoCheckout,
    period: { effectiveFrom: Date; effectiveUntil: Date }
  ): Promise<PaymentProjectionResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const now = this.clock();
        const processing = await transaction.webhookEventProcessing.findFirst({
          where: {
            id: binding.processingId,
            status: 'PROCESSING',
            claimTokenHash: tokenHash(binding.claimToken),
            claimExpiresAt: { gt: now },
          },
        });
        if (!processing) throw new Error('PAYMENT_PROJECTION_CLAIM_LOST');

        const checkout = await transaction.billingCheckoutRequest.findUniqueOrThrow({
          where: { id: binding.checkoutRequestId },
          include: { billingPrice: { include: { product: true } } },
        });
        if (
          checkout.userId !== binding.checkoutUserId ||
          checkout.billingPriceId !== binding.billingPriceId ||
          checkout.billingSubjectKey !== binding.billingSubjectKey ||
          checkout.requestHash !== binding.requestHash ||
          checkout.referenceNumber !== evidence.referenceNumber ||
          checkout.providerSessionId !== evidence.providerSessionId ||
          checkout.provider !== 'PAYMONGO' ||
          checkout.environment !== 'TEST' ||
          checkout.status !== 'SUCCEEDED' ||
          checkout.billingPrice.environment !== 'TEST' ||
          checkout.billingPrice.amountMinor !== evidence.amountMinor ||
          checkout.billingPrice.currency !== 'PHP' ||
          checkout.billingPrice.interval !== 'MONTH' ||
          checkout.billingPrice.intervalCount !== 1 ||
          checkout.billingPrice.product.code !== 'PREMIUM'
        ) {
          throw new PaymentReconciliationError('REPLAY_CONFLICT');
        }

        const existing = await transaction.userSubscription.findUnique({
          where: { sourceCheckoutRequestId: binding.checkoutRequestId },
        });
        if (existing) {
          const invoice = await transaction.billingInvoice.findUniqueOrThrow({
            where: { sourceCheckoutRequestId: binding.checkoutRequestId },
          });
          const paymentAttempt = await transaction.paymentAttempt.findFirstOrThrow({
            where: { invoiceId: invoice.id },
          });
          const billingTransaction = await transaction.billingTransaction.findUniqueOrThrow({
            where: { paymentAttemptId: paymentAttempt.id },
          });
          const grant = await transaction.entitlementGrant.findFirstOrThrow({
            where: { invoiceId: invoice.id, source: 'PAID_INVOICE' },
          });
          const postings = await transaction.financialLedgerEntry.findMany({
            where: { transactionId: billingTransaction.id },
          });
          const replayMatches =
            existing.userId === binding.checkoutUserId &&
            existing.billingSubjectKey === binding.billingSubjectKey &&
            existing.billingPriceId === binding.billingPriceId &&
            existing.collectionMode === 'ONE_TIME_ACCESS_PERIOD' &&
            existing.status === 'NON_RENEWING' &&
            !existing.renewsAutomatically &&
            !existing.cancelAtPeriodEnd &&
            sameInstant(existing.currentPeriodStart, period.effectiveFrom) &&
            sameInstant(existing.currentPeriodEnd, period.effectiveUntil) &&
            invoice.status === 'PAID' &&
            invoice.currency === 'PHP' &&
            invoice.amountDueMinor === evidence.amountMinor &&
            invoice.amountPaidMinor === evidence.amountMinor &&
            sameInstant(invoice.servicePeriodStart, period.effectiveFrom) &&
            sameInstant(invoice.servicePeriodEnd, period.effectiveUntil) &&
            paymentAttempt.status === 'SUCCEEDED' &&
            paymentAttempt.providerPaymentIntentId === evidence.providerPaymentIntentId &&
            paymentAttempt.providerPaymentId === evidence.providerPaymentId &&
            paymentAttempt.amountMinor === evidence.amountMinor &&
            billingTransaction.providerPaymentId === evidence.providerPaymentId &&
            billingTransaction.amountMinor === evidence.amountMinor &&
            sameInstant(billingTransaction.paidAt, evidence.paidAt) &&
            grant.userId === binding.checkoutUserId &&
            grant.billingSubjectKey === binding.billingSubjectKey &&
            sameInstant(grant.effectiveFrom, period.effectiveFrom) &&
            sameInstant(grant.effectiveUntil, period.effectiveUntil) &&
            postings.length === 2 &&
            postings.some((posting) => posting.direction === 'DEBIT' && posting.account === 'CASH_CLEARING') &&
            postings.some((posting) => posting.direction === 'CREDIT' && posting.account === 'DEFERRED_REVENUE') &&
            postings.reduce(
              (sum, posting) => sum + (posting.direction === 'DEBIT' ? posting.amountMinor : -posting.amountMinor),
              0
            ) === 0;
          if (!replayMatches) throw new PaymentReconciliationError('REPLAY_CONFLICT');
          await transaction.webhookEventProcessing.update({
            where: { id: processing.id },
            data: { status: 'SUCCEEDED', completedAt: now, lockedAt: null, claimTokenHash: null, claimExpiresAt: null },
          });
          return {
            subscriptionId: existing.id,
            invoiceId: invoice.id,
            paymentAttemptId: paymentAttempt.id,
            transactionId: billingTransaction.id,
            entitlementGrantId: grant.id,
            effectiveFrom: grant.effectiveFrom,
            effectiveUntil: grant.effectiveUntil,
            replayed: true,
          };
        }

        const conflictingAttempt = await transaction.paymentAttempt.findFirst({
          where: {
            provider: 'PAYMONGO',
            environment: 'TEST',
            OR: [
              { providerPaymentIntentId: evidence.providerPaymentIntentId },
              { providerPaymentId: evidence.providerPaymentId },
            ],
          },
          select: { subscription: { select: { sourceCheckoutRequestId: true } } },
        });
        if (
          conflictingAttempt &&
          conflictingAttempt.subscription.sourceCheckoutRequestId !== binding.checkoutRequestId
        ) {
          throw new PaymentReconciliationError('REPLAY_CONFLICT');
        }

        const overlap = await transaction.entitlementGrant.findFirst({
          where: {
            billingSubjectKey: binding.billingSubjectKey,
            entitlementKey: 'PREMIUM',
            revokedAt: null,
            effectiveFrom: { lt: period.effectiveUntil },
            effectiveUntil: { gt: period.effectiveFrom },
          },
        });
        if (overlap) throw new PaymentReconciliationError('PAYMENT_PERIOD_OVERLAP');

        const subscription = await transaction.userSubscription.create({
          data: {
            userId: binding.checkoutUserId,
            billingSubjectKey: binding.billingSubjectKey,
            sourceCheckoutRequestId: binding.checkoutRequestId,
            billingPriceId: binding.billingPriceId,
            provider: 'PAYMONGO',
            environment: 'TEST',
            creationIdempotencyKey: `checkout:${binding.checkoutRequestId}`,
            collectionMode: 'ONE_TIME_ACCESS_PERIOD',
            renewsAutomatically: false,
            status: 'NON_RENEWING',
            providerStatus: 'ONE_TIME_PAYMENT_SUCCEEDED',
            currentPeriodStart: period.effectiveFrom,
            currentPeriodEnd: period.effectiveUntil,
            cancelAtPeriodEnd: false,
            providerUpdatedAt: evidence.providerUpdatedAt,
            stateVersion: 1,
          },
        });
        const invoice = await transaction.billingInvoice.create({
          data: {
            subscriptionId: subscription.id,
            provider: 'PAYMONGO',
            environment: 'TEST',
            sourceCheckoutRequestId: binding.checkoutRequestId,
            collectionMode: 'ONE_TIME_ACCESS_PERIOD',
            status: 'PAID',
            currency: 'PHP',
            amountDueMinor: evidence.amountMinor,
            amountPaidMinor: evidence.amountMinor,
            servicePeriodStart: period.effectiveFrom,
            servicePeriodEnd: period.effectiveUntil,
            providerCreatedAt: evidence.paidAt,
            providerUpdatedAt: evidence.providerUpdatedAt,
          },
        });
        const paymentAttempt = await transaction.paymentAttempt.create({
          data: {
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            provider: 'PAYMONGO',
            environment: 'TEST',
            idempotencyKey: `checkout:${binding.checkoutRequestId}:payment`,
            providerPaymentIntentId: evidence.providerPaymentIntentId,
            providerPaymentId: evidence.providerPaymentId,
            status: 'SUCCEEDED',
            amountMinor: evidence.amountMinor,
            currency: 'PHP',
            providerUpdatedAt: evidence.providerUpdatedAt,
          },
        });
        const billingTransaction = await transaction.billingTransaction.create({
          data: {
            invoiceId: invoice.id,
            paymentAttemptId: paymentAttempt.id,
            provider: 'PAYMONGO',
            environment: 'TEST',
            providerPaymentId: evidence.providerPaymentId,
            amountMinor: evidence.amountMinor,
            currency: 'PHP',
            paidAt: evidence.paidAt,
          },
        });
        const batchKey = `payment:${evidence.providerPaymentId}`;
        await transaction.financialLedgerEntry.createMany({
          data: [
            {
              provider: 'PAYMONGO',
              environment: 'TEST',
              sourceKey: `${batchKey}:debit`,
              batchKey,
              entryType: 'CHARGE',
              direction: 'DEBIT',
              account: 'CASH_CLEARING',
              amountMinor: evidence.amountMinor,
              currency: 'PHP',
              invoiceId: invoice.id,
              transactionId: billingTransaction.id,
              providerWebhookEventId: binding.webhookEventId,
              reasonCode: 'CHECKOUT_PAYMENT_RECEIVED',
            },
            {
              provider: 'PAYMONGO',
              environment: 'TEST',
              sourceKey: `${batchKey}:credit`,
              batchKey,
              entryType: 'CHARGE',
              direction: 'CREDIT',
              account: 'DEFERRED_REVENUE',
              amountMinor: evidence.amountMinor,
              currency: 'PHP',
              invoiceId: invoice.id,
              transactionId: billingTransaction.id,
              providerWebhookEventId: binding.webhookEventId,
              reasonCode: 'PREMIUM_PERIOD_DEFERRED',
            },
          ],
        });
        const grant = await transaction.entitlementGrant.create({
          data: {
            userId: binding.checkoutUserId,
            billingSubjectKey: binding.billingSubjectKey,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            entitlementKey: 'PREMIUM',
            source: 'PAID_INVOICE',
            sourceKey: `paid-invoice:${invoice.id}`,
            effectiveFrom: period.effectiveFrom,
            effectiveUntil: period.effectiveUntil,
          },
        });
        await transaction.webhookEventProcessing.update({
          where: { id: processing.id },
          data: { status: 'SUCCEEDED', completedAt: now, lockedAt: null, claimTokenHash: null, claimExpiresAt: null },
        });
        return {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          paymentAttemptId: paymentAttempt.id,
          transactionId: billingTransaction.id,
          entitlementGrantId: grant.id,
          effectiveFrom: period.effectiveFrom,
          effectiveUntil: period.effectiveUntil,
          replayed: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async fail(
    binding: PaymentProjectionBinding,
    failure: { code: string; retryable: boolean; details?: Readonly<Record<string, string>> }
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const now = this.clock();
        const processing = await transaction.webhookEventProcessing.findFirst({
          where: { id: binding.processingId, status: 'PROCESSING', claimTokenHash: tokenHash(binding.claimToken) },
        });
        if (!processing) return;
        const retryable = failure.retryable && processing.attemptCount < MAX_ATTEMPTS;
        if (!retryable) {
          await transaction.billingReconciliationIssue.upsert({
            where: {
              provider_environment_resourceType_providerResourceId_issueCode: {
                provider: 'PAYMONGO',
                environment: 'TEST',
                resourceType: 'checkout_session',
                providerResourceId: binding.providerSessionId || binding.providerEventId,
                issueCode: failure.code,
              },
            },
            create: {
              provider: 'PAYMONGO',
              environment: 'TEST',
              resourceType: 'checkout_session',
              providerResourceId: binding.providerSessionId || binding.providerEventId,
              issueCode: failure.code,
              severity: 'HIGH',
              details: failure.details || undefined,
            },
            update: { lastSeenAt: now, details: failure.details || undefined },
          });
        }
        const retryDelayMs = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, processing.attemptCount - 1));
        await transaction.webhookEventProcessing.update({
          where: { id: processing.id },
          data: {
            status: 'FAILED',
            lockedAt: null,
            claimTokenHash: null,
            claimExpiresAt: null,
            nextAttemptAt: retryable ? new Date(now.getTime() + retryDelayMs) : null,
            lastErrorCode: failure.code,
            completedAt: null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
