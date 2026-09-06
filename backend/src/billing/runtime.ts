import {
  BillingGateway,
  CheckoutIntentRepository,
  WebhookInboxRepository,
} from '@/billing/contracts';
import { loadPaymongoConfig } from '@/domain/paymongo-config.policy';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '@/services/billing-checkout-boundary.service';
import { NodeHttpsBillingTransport } from '@/services/node-https-billing.transport';
import { PaymongoGateway } from '@/services/paymongo-gateway.service';
import { PrismaCheckoutIntentRepository } from '@/services/prisma-checkout-intent.repository';
import { PaymongoWebhookBoundary } from '@/services/paymongo-webhook-boundary.service';
import prisma from '@/lib/prisma';

export const paymongoConfig = loadPaymongoConfig(process.env);

const unavailableCheckoutRepository: CheckoutIntentRepository = {
  async findEligiblePrice() {
    throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
  },
  async claim() {
    throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
  },
  async complete() {
    throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
  },
  async release() {},
};

const unavailableGateway: BillingGateway = {
  async createHostedCheckout() {
    throw new CheckoutBoundaryError('CHECKOUT_TEMPORARILY_UNAVAILABLE');
  },
};

const unavailableWebhookRepository: WebhookInboxRepository = {
  async ingest() {
    throw new Error('Webhook persistence is not connected in Phase 3A.');
  },
};

const checkoutRepository = paymongoConfig.checkout.enabled
  ? new PrismaCheckoutIntentRepository(prisma)
  : unavailableCheckoutRepository;
const checkoutGateway = paymongoConfig.checkout.enabled
  ? new PaymongoGateway(paymongoConfig.checkout, new NodeHttpsBillingTransport())
  : unavailableGateway;

export const billingCheckoutBoundary = new BillingCheckoutBoundary(
  paymongoConfig.checkout,
  checkoutRepository,
  checkoutGateway,
);

export const paymongoWebhookBoundary = new PaymongoWebhookBoundary(
  paymongoConfig.webhook,
  unavailableWebhookRepository,
);
