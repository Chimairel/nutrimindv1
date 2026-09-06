import { PrismaClient } from '@prisma/client';
import { BillingProcessingWorkerStatus } from '@/services/billing-processing-worker.service';

export interface BillingOperationsCounts {
  pending: number;
  processing: number;
  failed: number;
  retryable: number;
  deadLetter: number;
  recentSucceeded: number;
  recentFailed: number;
  openReconciliationIssues: number;
  oldestPendingCreatedAt: Date | null;
}

export interface BillingOperationsRepository {
  readCounts(recentSince: Date): Promise<BillingOperationsCounts>;
}

export class PrismaBillingOperationsRepository implements BillingOperationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async readCounts(recentSince: Date): Promise<BillingOperationsCounts> {
    const [
      pending,
      processing,
      failed,
      retryable,
      deadLetter,
      recentSucceeded,
      recentFailed,
      openReconciliationIssues,
      oldestPending,
    ] = await Promise.all([
      this.prisma.webhookEventProcessing.count({
        where: { status: 'PENDING', webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false } },
      }),
      this.prisma.webhookEventProcessing.count({
        where: { status: 'PROCESSING', webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false } },
      }),
      this.prisma.webhookEventProcessing.count({
        where: { status: 'FAILED', webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false } },
      }),
      this.prisma.webhookEventProcessing.count({
        where: {
          status: 'FAILED',
          nextAttemptAt: { not: null },
          webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false },
        },
      }),
      this.prisma.webhookEventProcessing.count({
        where: {
          status: 'FAILED',
          nextAttemptAt: null,
          webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false },
        },
      }),
      this.prisma.webhookEventProcessing.count({
        where: {
          status: 'SUCCEEDED',
          completedAt: { gte: recentSince },
          webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false },
        },
      }),
      this.prisma.webhookEventProcessing.count({
        where: {
          status: 'FAILED',
          updatedAt: { gte: recentSince },
          webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false },
        },
      }),
      this.prisma.billingReconciliationIssue.count({
        where: { status: 'OPEN', provider: 'PAYMONGO', environment: 'TEST' },
      }),
      this.prisma.webhookEventProcessing.findFirst({
        where: {
          status: 'PENDING',
          webhookEvent: { provider: 'PAYMONGO', environment: 'TEST', livemode: false },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      pending,
      processing,
      failed,
      retryable,
      deadLetter,
      recentSucceeded,
      recentFailed,
      openReconciliationIssues,
      oldestPendingCreatedAt: oldestPending?.createdAt || null,
    };
  }
}

export class BillingOperationsStatusService {
  constructor(
    private readonly repository: BillingOperationsRepository,
    private readonly workerStatus: () => BillingProcessingWorkerStatus,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async getStatus() {
    const observedAt = this.clock();
    const recentWindowHours = 24;
    const counts = await this.repository.readCounts(
      new Date(observedAt.getTime() - recentWindowHours * 60 * 60 * 1_000)
    );
    const oldestPendingAgeSeconds = counts.oldestPendingCreatedAt
      ? Math.max(0, Math.floor((observedAt.getTime() - counts.oldestPendingCreatedAt.getTime()) / 1_000))
      : null;
    return {
      observedAt: observedAt.toISOString(),
      environment: 'TEST' as const,
      queue: {
        pending: counts.pending,
        processing: counts.processing,
        failed: counts.failed,
        retryable: counts.retryable,
        deadLetter: counts.deadLetter,
        oldestPendingAgeSeconds,
      },
      recent: {
        windowHours: recentWindowHours,
        succeeded: counts.recentSucceeded,
        failed: counts.recentFailed,
      },
      openReconciliationIssues: counts.openReconciliationIssues,
      worker: this.workerStatus(),
    };
  }
}
