import { BillingProcessingWorkerConfig } from '@/domain/billing-processing-worker.policy';
import { PaymentWorkerResult } from '@/services/paymongo-payment-projection.service';

export interface PaymentProjectionProcessor {
  processNext(signal?: AbortSignal): Promise<PaymentWorkerResult>;
}

export interface BillingWorkerRunSummary {
  outcome: 'COMPLETED' | 'SKIPPED_DISABLED' | 'SKIPPED_OVERLAP' | 'ABORTED' | 'FAILED';
  attempted: number;
  succeeded: number;
  replayed: number;
  retryScheduled: number;
  quarantined: number;
  providerCallBudgetUpperBound: number;
}

export interface BillingProcessingWorkerStatus {
  enabled: boolean;
  lifecycle: 'STOPPED' | 'IDLE' | 'RUNNING' | 'STOPPING';
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastRun: BillingWorkerRunSummary | null;
}

interface WorkerScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

interface WorkerLogger {
  info(record: Readonly<Record<string, unknown>>): void;
  error(record: Readonly<Record<string, unknown>>): void;
}

const defaultScheduler: WorkerScheduler = {
  schedule(callback, delayMs) { return setTimeout(callback, delayMs); },
  cancel(handle) { clearTimeout(handle as ReturnType<typeof setTimeout>); },
};

const defaultLogger: WorkerLogger = {
  info(record) { console.log(JSON.stringify(record)); },
  error(record) { console.error(JSON.stringify(record)); },
};

function emptySummary(outcome: BillingWorkerRunSummary['outcome']): BillingWorkerRunSummary {
  return {
    outcome,
    attempted: 0,
    succeeded: 0,
    replayed: 0,
    retryScheduled: 0,
    quarantined: 0,
    providerCallBudgetUpperBound: 0,
  };
}

export class BillingProcessingWorker {
  private started = false;
  private lifecycle: BillingProcessingWorkerStatus['lifecycle'] = 'STOPPED';
  private timer: unknown;
  private activeRun: Promise<BillingWorkerRunSummary> | null = null;
  private abortController: AbortController | null = null;
  private lastRunStartedAt: Date | null = null;
  private lastRunCompletedAt: Date | null = null;
  private lastRun: BillingWorkerRunSummary | null = null;
  private consecutiveTickFailures = 0;

  constructor(
    private readonly config: BillingProcessingWorkerConfig,
    private readonly processor: PaymentProjectionProcessor | null,
    private readonly scheduler: WorkerScheduler = defaultScheduler,
    private readonly logger: WorkerLogger = defaultLogger,
    private readonly clock: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
  ) {}

  start(): boolean {
    if (!this.config.enabled) return false;
    if (!this.processor) throw new Error('BILLING_PROCESSING_WORKER_PROCESSOR_UNAVAILABLE');
    if (this.lifecycle !== 'STOPPED') return false;
    this.started = true;
    this.lifecycle = 'IDLE';
    this.scheduleNext(0);
    return true;
  }

  async stop(): Promise<void> {
    if (this.lifecycle === 'STOPPED') return;
    this.lifecycle = 'STOPPING';
    if (this.timer !== undefined) {
      this.scheduler.cancel(this.timer);
      this.timer = undefined;
    }
    this.abortController?.abort();
    if (this.activeRun) await this.activeRun;
    this.started = false;
    this.lifecycle = 'STOPPED';
  }

  snapshot(): BillingProcessingWorkerStatus {
    return {
      enabled: this.config.enabled,
      lifecycle: this.lifecycle,
      lastRunStartedAt: this.lastRunStartedAt?.toISOString() || null,
      lastRunCompletedAt: this.lastRunCompletedAt?.toISOString() || null,
      lastRun: this.lastRun ? { ...this.lastRun } : null,
    };
  }

  async runOnce(): Promise<BillingWorkerRunSummary> {
    if (!this.config.enabled) return emptySummary('SKIPPED_DISABLED');
    if (!this.processor) return emptySummary('FAILED');
    if (this.activeRun) return emptySummary('SKIPPED_OVERLAP');

    this.lastRunStartedAt = this.clock();
    this.lifecycle = 'RUNNING';
    this.abortController = new AbortController();
    const run = this.runBatch(this.abortController.signal);
    this.activeRun = run;
    try {
      const summary = await run;
      this.lastRun = summary;
      this.consecutiveTickFailures = 0;
      this.logInfo({ type: 'billing_worker_run', ...summary });
      return summary;
    } catch {
      const summary = emptySummary(this.abortController.signal.aborted ? 'ABORTED' : 'FAILED');
      this.lastRun = summary;
      this.consecutiveTickFailures += 1;
      this.logError({ type: 'billing_worker_run', outcome: summary.outcome, code: 'BILLING_WORKER_TICK_FAILED' });
      return summary;
    } finally {
      this.lastRunCompletedAt = this.clock();
      this.activeRun = null;
      this.abortController = null;
      if (!this.isStopping()) this.lifecycle = this.started ? 'IDLE' : 'STOPPED';
    }
  }

  private async runBatch(signal: AbortSignal): Promise<BillingWorkerRunSummary> {
    if (!this.config.enabled || !this.processor) return emptySummary('SKIPPED_DISABLED');
    const maximumAttempts = Math.min(this.config.batchSize, this.config.providerCallBudget);
    const summary = emptySummary('COMPLETED');
    let nextAttempt = 0;
    let noWork = false;

    const consume = async () => {
      while (!signal.aborted && !noWork) {
        const attempt = nextAttempt;
        nextAttempt += 1;
        if (attempt >= maximumAttempts) return;
        summary.attempted += 1;
        summary.providerCallBudgetUpperBound += 1;
        const result = await this.processor!.processNext(signal);
        if (result.decision === 'NO_WORK') {
          noWork = true;
          continue;
        }
        if (result.decision === 'SUCCEEDED') {
          summary.succeeded += 1;
          if (result.projection.replayed) summary.replayed += 1;
        } else if (result.decision === 'RETRY_SCHEDULED') {
          summary.retryScheduled += 1;
        } else {
          summary.quarantined += 1;
        }
      }
    };

    const consumers = await Promise.allSettled(
      Array.from({ length: Math.min(this.config.concurrency, maximumAttempts) }, consume),
    );
    if (consumers.some((result) => result.status === 'rejected')) {
      throw new Error('BILLING_WORKER_BATCH_FAILED');
    }
    if (signal.aborted) summary.outcome = 'ABORTED';
    return summary;
  }

  private scheduleNext(delayMs: number): void {
    if (!this.config.enabled || !this.started || this.lifecycle === 'STOPPING') return;
    this.timer = this.scheduler.schedule(() => {
      this.timer = undefined;
      void this.runScheduledTick().catch(() => {
        this.consecutiveTickFailures += 1;
        this.logError({
          type: 'billing_worker_run', outcome: 'FAILED', code: 'BILLING_WORKER_SCHEDULER_FAILED',
        });
        if (this.config.enabled && this.started && !this.isStopping()) {
          const delay = Math.min(60_000, this.config.pollIntervalMs * 2);
          this.lifecycle = 'IDLE';
          this.scheduleNext(delay);
        }
      });
    }, delayMs);
  }

  private isStopping(): boolean {
    return this.lifecycle === 'STOPPING';
  }

  private logInfo(record: Readonly<Record<string, unknown>>): void {
    try { this.logger.info(record); } catch { /* Logging cannot control financial processing. */ }
  }

  private logError(record: Readonly<Record<string, unknown>>): void {
    try { this.logger.error(record); } catch { /* Logging cannot control financial processing. */ }
  }

  private async runScheduledTick(): Promise<void> {
    const summary = await this.runOnce();
    if (!this.config.enabled || !this.started || this.lifecycle === 'STOPPING') return;
    const failureMultiplier = summary.outcome === 'FAILED'
      ? 2 ** Math.min(3, this.consecutiveTickFailures)
      : 1;
    const baseDelay = Math.min(60_000, this.config.pollIntervalMs * failureMultiplier);
    const jitter = Math.floor(Math.max(0, Math.min(0.999999, this.random())) * (this.config.jitterMs + 1));
    this.lifecycle = 'IDLE';
    this.scheduleNext(baseDelay + jitter);
  }
}
