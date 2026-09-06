import { Prisma, PrismaClient } from '@prisma/client';
import { WebhookInboxRecord, WebhookInboxRepository, WebhookIngestDecision } from '@/billing/contracts';

const HANDLER_VERSION = 'paymongo-inbox-v1';
const SERIALIZABLE_RETRIES = 3;

function sanitizedPayload(record: WebhookInboxRecord): Prisma.InputJsonValue {
  return {
    schemaVersion: 1,
    event: {
      id: record.providerEventId,
      type: record.eventType,
      livemode: record.livemode,
      createdAt: record.providerCreatedAt.toISOString(),
    },
    resource: {
      id: record.resource.id,
      type: record.resource.type,
    },
    disposition: record.disposition,
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export class PrismaWebhookInboxRepository implements WebhookInboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ingest(record: WebhookInboxRecord): Promise<WebhookIngestDecision> {
    for (let attempt = 1; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
      try {
        return await this.ingestOnce(record);
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < SERIALIZABLE_RETRIES) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return this.compareExisting(record);
        }
        throw error;
      }
    }
    throw new Error('Webhook inbox transaction retry limit exceeded.');
  }

  private async ingestOnce(record: WebhookInboxRecord): Promise<WebhookIngestDecision> {
    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.providerWebhookEvent.findUnique({
          where: {
            provider_environment_providerEventId: {
              provider: record.provider,
              environment: record.environment,
              providerEventId: record.providerEventId,
            },
          },
          select: { payloadHash: true },
        });
        if (existing) return existing.payloadHash === record.payloadHash ? 'DUPLICATE' : 'CONFLICT';

        await transaction.providerWebhookEvent.create({
          data: {
            provider: record.provider,
            environment: record.environment,
            providerEventId: record.providerEventId,
            eventType: record.eventType,
            livemode: record.livemode,
            payloadHash: record.payloadHash,
            sanitizedPayload: sanitizedPayload(record),
            signatureKeyVersion: record.signatureKeyVersion,
            providerCreatedAt: record.providerCreatedAt,
            receivedAt: record.receivedAt,
            processing: {
              create: {
                handlerVersion: HANDLER_VERSION,
                status: record.disposition === 'PENDING' ? 'PENDING' : 'IGNORED',
                completedAt: record.disposition === 'PENDING' ? null : record.receivedAt,
              },
            },
          },
        });
        return 'INSERTED';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async compareExisting(record: WebhookInboxRecord): Promise<WebhookIngestDecision> {
    const existing = await this.prisma.providerWebhookEvent.findUnique({
      where: {
        provider_environment_providerEventId: {
          provider: record.provider,
          environment: record.environment,
          providerEventId: record.providerEventId,
        },
      },
      select: { payloadHash: true },
    });
    if (!existing) throw new Error('Webhook inbox uniqueness conflict could not be reconciled.');
    return existing.payloadHash === record.payloadHash ? 'DUPLICATE' : 'CONFLICT';
  }
}
