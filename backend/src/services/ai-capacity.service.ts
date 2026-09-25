import { AiUsageOperation, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

const PROVIDER = 'GOOGLE_GEMINI';
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const LEASE_MS = 15 * MINUTE_MS;

function positiveLimit(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export class AiCapacityDeferredError extends Error {
  readonly retryAt: Date;

  constructor(message: string, retryAt: Date) {
    super(message);
    this.name = 'AiCapacityDeferredError';
    this.retryAt = retryAt;
  }
}

/**
 * A conservative project-wide admission gate. Every provider attempt reserves
 * capacity before it leaves this process, so separate API instances and the
 * background meal worker share one budget. Rolling 24-hour accounting is
 * stricter than a calendar-day provider quota and does not rely on reset TZ.
 */
export class AiCapacityService {
  static readonly policyVersion = 'GEMINI_PROJECT_CAPACITY_V1';

  static estimateTokens(prompt: string, systemInstruction?: string): number {
    // Reserve generously for both input and a structured output. This is an
    // admission estimate, never a nutrition or billing estimate.
    return Math.ceil((prompt.length + (systemInstruction?.length ?? 0)) / 3) + 6_000;
  }

  static async reserve(input: {
    model: string;
    estimatedTokens: number;
    operation: AiUsageOperation;
    now?: Date;
  }): Promise<string> {
    const now = input.now ?? new Date();
    const rpm = positiveLimit('GEMINI_PROJECT_MAX_RPM', 2);
    const rpd = positiveLimit('GEMINI_PROJECT_MAX_RPD', 40);
    const tpm = positiveLimit('GEMINI_PROJECT_MAX_ESTIMATED_TPM', 50_000);
    const maxInFlight = positiveLimit('GEMINI_PROJECT_MAX_IN_FLIGHT', 1);
    const backgroundRpm = Math.min(rpm, positiveLimit('GEMINI_BACKGROUND_MAX_RPM', 1));
    const backgroundRpd = Math.min(rpd, positiveLimit('GEMINI_BACKGROUND_MAX_RPD', 20));
    if (input.estimatedTokens > tpm) {
      throw new Error('The Gemini request exceeds the configured project token budget.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741021)`;
      await tx.aiQuotaReservation.deleteMany({
        where: { provider: PROVIDER, reservedAt: { lt: new Date(now.getTime() - 2 * DAY_MS) } },
      });
      const minuteStart = new Date(now.getTime() - MINUTE_MS);
      const dayStart = new Date(now.getTime() - DAY_MS);
      const [minuteCount, dayCount, minuteTokens, inFlight, latestQuotaFault, backgroundMinuteCount, backgroundDayCount] = await Promise.all([
        tx.aiQuotaReservation.count({ where: { provider: PROVIDER, reservedAt: { gt: minuteStart } } }),
        tx.aiQuotaReservation.count({ where: { provider: PROVIDER, reservedAt: { gt: dayStart } } }),
        tx.aiQuotaReservation.aggregate({
          where: { provider: PROVIDER, reservedAt: { gt: minuteStart } },
          _sum: { estimatedTokens: true },
        }),
        tx.aiQuotaReservation.count({
          where: { provider: PROVIDER, completedAt: null, reservedAt: { gt: new Date(now.getTime() - LEASE_MS) } },
        }),
        tx.aiUsageEvent.findFirst({
          where: { provider: PROVIDER, errorCode: 'PROVIDER_QUOTA', createdAt: { gt: new Date(now.getTime() - 5 * MINUTE_MS) } },
          orderBy: { createdAt: 'desc' }, select: { createdAt: true },
        }),
        tx.aiQuotaReservation.count({
          where: { provider: PROVIDER, operation: AiUsageOperation.MEAL_PLAN_GENERATION, reservedAt: { gt: minuteStart } },
        }),
        tx.aiQuotaReservation.count({
          where: { provider: PROVIDER, operation: AiUsageOperation.MEAL_PLAN_GENERATION, reservedAt: { gt: dayStart } },
        }),
      ]);
      const capacityReasons: Date[] = [];
      if (latestQuotaFault) capacityReasons.push(new Date(latestQuotaFault.createdAt.getTime() + 5 * MINUTE_MS));
      if (minuteCount >= rpm || (minuteTokens._sum.estimatedTokens ?? 0) + input.estimatedTokens > tpm) {
        const oldest = await tx.aiQuotaReservation.findFirst({
          where: { provider: PROVIDER, reservedAt: { gt: minuteStart } },
          orderBy: { reservedAt: 'asc' },
          select: { reservedAt: true },
        });
        capacityReasons.push(new Date((oldest?.reservedAt.getTime() ?? now.getTime()) + MINUTE_MS + 1_000));
      }
      if (dayCount >= rpd) {
        const oldest = await tx.aiQuotaReservation.findFirst({
          where: { provider: PROVIDER, reservedAt: { gt: dayStart } },
          orderBy: { reservedAt: 'asc' },
          select: { reservedAt: true },
        });
        capacityReasons.push(new Date((oldest?.reservedAt.getTime() ?? now.getTime()) + DAY_MS + 1_000));
      }
      if (inFlight >= maxInFlight) capacityReasons.push(new Date(now.getTime() + 15_000));
      if (input.operation === AiUsageOperation.MEAL_PLAN_GENERATION && backgroundMinuteCount >= backgroundRpm) {
        const oldest = await tx.aiQuotaReservation.findFirst({
          where: { provider: PROVIDER, operation: input.operation, reservedAt: { gt: minuteStart } },
          orderBy: { reservedAt: 'asc' }, select: { reservedAt: true },
        });
        capacityReasons.push(new Date((oldest?.reservedAt.getTime() ?? now.getTime()) + MINUTE_MS + 1_000));
      }
      if (input.operation === AiUsageOperation.MEAL_PLAN_GENERATION && backgroundDayCount >= backgroundRpd) {
        const oldest = await tx.aiQuotaReservation.findFirst({
          where: { provider: PROVIDER, operation: input.operation, reservedAt: { gt: dayStart } },
          orderBy: { reservedAt: 'asc' }, select: { reservedAt: true },
        });
        capacityReasons.push(new Date((oldest?.reservedAt.getTime() ?? now.getTime()) + DAY_MS + 1_000));
      }
      if (capacityReasons.length) {
        throw new AiCapacityDeferredError(
          'AI capacity is temporarily unavailable. Please try again later.',
          new Date(Math.max(...capacityReasons.map((date) => date.getTime())))
        );
      }

      const reservation = await tx.aiQuotaReservation.create({
        data: {
          provider: PROVIDER,
          model: input.model,
          estimatedTokens: input.estimatedTokens,
          operation: input.operation,
          reservedAt: now,
        },
        select: { id: true },
      });
      return reservation.id;
    // READ COMMITTED takes a fresh snapshot after the advisory lock is
    // acquired; SERIALIZABLE could keep a pre-wait snapshot of reservations.
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  static async finish(reservationId: string): Promise<void> {
    await prisma.aiQuotaReservation.updateMany({
      where: { id: reservationId, completedAt: null },
      data: { completedAt: new Date() },
    });
  }
}
