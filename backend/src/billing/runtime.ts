import {
  BillingGateway,
  CheckoutIntentRepository,
  WebhookInboxRepository,
} from '@/billing/contracts';
import { loadPaymongoConfig } from '@/domain/paymongo-config.policy';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '@/services/billing-checkout-boundary.service';
import { PaymongoWebhookBoundary } from '@/services/paymongo-webhook-boundary.service';

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

// Phase 3A deliberately leaves both persistence and network transports disconnected.
// Later sandbox acceptance must inject reviewed adapters without changing these policies.
export const billingCheckoutBoundary = new BillingCheckoutBoundary(
  paymongoConfig,
  unavailableCheckoutRepository,
  unavailableGateway,
);

export const paymongoWebhookBoundary = new PaymongoWebhookBoundary(
  paymongoConfig,
  unavailableWebhookRepository,
);
