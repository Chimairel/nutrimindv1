import { createHash } from 'node:crypto';
import { BillingGateway, CheckoutIntentRepository, HostedCheckoutSession } from '@/billing/contracts';
import { PaymongoCheckoutConfig } from '@/domain/paymongo-config.policy';
import { PaymongoGatewayError } from '@/services/paymongo-gateway.service';
import { assertPositiveMoney } from '@/domain/billing-money.policy';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const PRICE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/;
const SAFE_DISPLAY_NAME_PATTERN = /^[^\u0000-\u001f\u007f]{1,120}$/;

export type CheckoutBoundaryErrorCode =
  | 'PAYMENTS_UNAVAILABLE'
  | 'CHECKOUT_REQUEST_INVALID'
  | 'CHECKOUT_PRICE_UNAVAILABLE'
  | 'CHECKOUT_IDEMPOTENCY_CONFLICT'
  | 'CHECKOUT_IN_PROGRESS'
  | 'CHECKOUT_PROVIDER_REJECTED'
  | 'CHECKOUT_TEMPORARILY_UNAVAILABLE';

export class CheckoutBoundaryError extends Error {
  constructor(readonly code: CheckoutBoundaryErrorCode) {
    super(code);
    this.name = 'CheckoutBoundaryError';
  }
}

export interface CreateCheckoutInput {
  userId: string;
  priceCode: string;
  requestIdempotencyKey: string;
}

export class BillingCheckoutBoundary {
  constructor(
    private readonly config: PaymongoCheckoutConfig,
    private readonly repository: CheckoutIntentRepository,
    private readonly gateway: BillingGateway
  ) {}

  async create(input: CreateCheckoutInput): Promise<HostedCheckoutSession> {
    if (!this.config.enabled) throw new CheckoutBoundaryError('PAYMENTS_UNAVAILABLE');
    if (
      !input.userId ||
      !PRICE_CODE_PATTERN.test(input.priceCode) ||
      !IDEMPOTENCY_KEY_PATTERN.test(input.requestIdempotencyKey)
    ) {
      throw new CheckoutBoundaryError('CHECKOUT_REQUEST_INVALID');
    }

    let price;
    try {
      price = await this.repository.findEligiblePrice({
        userId: input.userId,
        priceCode: input.priceCode,
        environment: this.config.environment,
      });
    } catch {
      throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
    }
    if (
      !price ||
      price.environment !== 'TEST' ||
      !price.active ||
      price.currency !== 'PHP' ||
      price.productCode !== input.priceCode ||
      !RECORD_ID_PATTERN.test(price.id) ||
      !SAFE_DISPLAY_NAME_PATTERN.test(price.displayName)
    ) {
      throw new CheckoutBoundaryError('CHECKOUT_PRICE_UNAVAILABLE');
    }
    try {
      assertPositiveMoney(price, 'PHP');
    } catch {
      throw new CheckoutBoundaryError('CHECKOUT_PRICE_UNAVAILABLE');
    }

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          provider: 'PAYMONGO',
          environment: this.config.environment,
          priceId: price.id,
          productCode: price.productCode,
          amountMinor: price.amountMinor,
          currency: price.currency,
          paymentMethods: this.config.paymentMethods,
          successUrl: this.config.checkoutSuccessUrl,
          cancelUrl: this.config.checkoutCancelUrl,
        })
      )
      .digest('hex');
    let claim;
    try {
      claim = await this.repository.claim({
        userId: input.userId,
        priceId: price.id,
        requestIdempotencyKey: input.requestIdempotencyKey,
        requestHash,
      });
    } catch {
      throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
    }
    if (claim.decision === 'CONFLICT') throw new CheckoutBoundaryError('CHECKOUT_IDEMPOTENCY_CONFLICT');
    if (claim.decision === 'IN_PROGRESS') throw new CheckoutBoundaryError('CHECKOUT_IN_PROGRESS');
    if (claim.decision === 'FAILED') throw new CheckoutBoundaryError('CHECKOUT_PROVIDER_REJECTED');
    if (claim.decision === 'REPLAY') return { ...claim.session, entitlementGranted: false };

    try {
      const session = await this.gateway.createHostedCheckout({
        idempotencyKey: claim.providerIdempotencyKey,
        referenceNumber: claim.referenceNumber,
        item: {
          name: price.displayName,
          amountMinor: price.amountMinor,
          currency: price.currency,
        },
        paymentMethods: this.config.paymentMethods,
        successUrl: this.config.checkoutSuccessUrl,
        cancelUrl: this.config.checkoutCancelUrl,
      });
      if (session.environment !== 'TEST' || session.livemode || session.entitlementGranted) {
        throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
      }
      await this.repository.complete({
        userId: input.userId,
        priceId: price.id,
        requestIdempotencyKey: input.requestIdempotencyKey,
        claimToken: claim.claimToken,
        session,
      });
      return { ...session, entitlementGranted: false };
    } catch (error) {
      const failureCode =
        error instanceof PaymongoGatewayError
          ? `${error.code}${error.providerCode ? `:${error.providerCode}` : ''}`
          : 'CHECKOUT_BOUNDARY_FAILURE';
      await this.repository
        .release({
          userId: input.userId,
          priceId: price.id,
          requestIdempotencyKey: input.requestIdempotencyKey,
          claimToken: claim.claimToken,
          failureCode,
        })
        .catch(() => undefined);
      if (error instanceof CheckoutBoundaryError) throw error;
      if (error instanceof PaymongoGatewayError && error.code === 'PROVIDER_REQUEST_REJECTED') {
        throw new CheckoutBoundaryError('CHECKOUT_PROVIDER_REJECTED');
      }
      throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
    }
  }
}
