import {
  CheckoutReconciliationGateway,
  CheckoutReconciliationGatewayError,
  PaymentProjectionRepository,
  PaymentProjectionResult,
} from '@/billing/contracts';
import {
  PaymentReconciliationError,
  validateLocalPaymentBinding,
  validatePaymongoPayment,
} from '@/domain/paymongo-payment-reconciliation.policy';

export type PaymentWorkerResult =
  | { decision: 'NO_WORK' }
  | { decision: 'SUCCEEDED'; projection: PaymentProjectionResult }
  | { decision: 'RETRY_SCHEDULED'; code: string }
  | { decision: 'QUARANTINED'; code: string };

export class PaymongoPaymentProjectionService {
  constructor(
    private readonly repository: PaymentProjectionRepository,
    private readonly gateway: CheckoutReconciliationGateway,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async processNext(): Promise<PaymentWorkerResult> {
    const claim = await this.repository.claimNext();
    if (claim.decision === 'NO_WORK') return claim;
    const { binding } = claim;
    try {
      validateLocalPaymentBinding(binding);
      const evidence = await this.gateway.retrieveCheckoutSession(binding.providerSessionId);
      const period = validatePaymongoPayment(binding, evidence, this.clock());
      return { decision: 'SUCCEEDED', projection: await this.repository.project(binding, evidence, period) };
    } catch (error) {
      const knownGatewayError = error instanceof CheckoutReconciliationGatewayError;
      const retryable = knownGatewayError ? error.retryable : !(error instanceof PaymentReconciliationError);
      const code = error instanceof PaymentReconciliationError || knownGatewayError
        ? error.code
        : 'PROVIDER_RECONCILIATION_UNAVAILABLE';
      await this.repository.fail(binding, { code, retryable });
      return retryable ? { decision: 'RETRY_SCHEDULED', code } : { decision: 'QUARANTINED', code };
    }
  }
}
