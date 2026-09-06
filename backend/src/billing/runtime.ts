import { BillingGateway, CheckoutIntentRepository, WebhookInboxRepository } from '@/billing/contracts';
import { loadPaymongoConfig } from '@/domain/paymongo-config.policy';
import { BillingCheckoutBoundary, CheckoutBoundaryError } from '@/services/billing-checkout-boundary.service';
import { NodeHttpsBillingTransport } from '@/services/node-https-billing.transport';
import { PaymongoGateway } from '@/services/paymongo-gateway.service';
import { PrismaCheckoutIntentRepository } from '@/services/prisma-checkout-intent.repository';
import { PrismaWebhookInboxRepository } from '@/services/prisma-webhook-inbox.repository';
import { PaymongoWebhookBoundary } from '@/services/paymongo-webhook-boundary.service';
import { PaymongoPaymentProjectionService } from '@/services/paymongo-payment-projection.service';
import { PrismaPaymentProjectionRepository } from '@/services/prisma-payment-projection.repository';
import { PaymongoReconciliationGateway } from '@/services/paymongo-reconciliation-gateway.service';
import { PrismaUserBillingAccessRepository } from '@/services/prisma-user-billing-access.repository';
import { UserBillingAccessService } from '@/services/user-billing-access.service';
import prisma from '@/lib/prisma';
import { loadBillingProcessingWorkerConfig } from '@/domain/billing-processing-worker.policy';
import { BillingProcessingWorker } from '@/services/billing-processing-worker.service';
import {
  BillingOperationsStatusService,
  PrismaBillingOperationsRepository,
} from '@/services/billing-operations-status.service';

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
  checkoutGateway
);

export const userBillingAccessService = new UserBillingAccessService(
  new PrismaUserBillingAccessRepository(prisma),
  paymongoConfig.checkout.enabled
);

export const paymongoWebhookBoundary = new PaymongoWebhookBoundary(
  paymongoConfig.webhook,
  paymongoConfig.webhook.enabled ? new PrismaWebhookInboxRepository(prisma) : unavailableWebhookRepository
);

// The lifecycle worker below is the only automatic caller and remains separately disabled by default.
export const paymongoPaymentProjectionProcessor = paymongoConfig.reconciliation.enabled
  ? new PaymongoPaymentProjectionService(
      new PrismaPaymentProjectionRepository(prisma),
      new PaymongoReconciliationGateway(paymongoConfig.reconciliation, new NodeHttpsBillingTransport())
    )
  : null;

export const billingProcessingWorkerConfig = loadBillingProcessingWorkerConfig(process.env, paymongoConfig);

export const billingProcessingWorker = new BillingProcessingWorker(
  billingProcessingWorkerConfig,
  paymongoPaymentProjectionProcessor
);

export const billingOperationsStatusService = new BillingOperationsStatusService(
  new PrismaBillingOperationsRepository(prisma),
  () => billingProcessingWorker.snapshot()
);
