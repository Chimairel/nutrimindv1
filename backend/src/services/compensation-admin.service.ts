import {
  CompensationPeriodStatus,
  CompensationPolicyStatus,
  CompensationStatementStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  assertCompensationPayoutAmount,
  assertMakerCheckerActors,
  calculateCompensation,
  decideWorkCreditReversal,
  WorkloadBand,
} from '@/domain/nutritionist-compensation.policy';
import {
  CreateCompensationAdjustmentInput,
  CreateCompensationPeriodInput,
  CreateCompensationPolicyInput,
  DecideCompensationAdjustmentInput,
} from '@/validation/compensation.schemas';

const TX_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;
const COMMITTED_PAYOUT_STATUSES = ['DRAFT', 'APPROVED', 'MANUAL_RECORDED', 'SUBMITTED', 'SUCCEEDED'] as const;

function bandsFromJson(value: Prisma.JsonValue): WorkloadBand[] {
  if (!Array.isArray(value)) throw new Error('The compensation policy has invalid workload bands.');
  return value.map((band) => {
    if (!band || typeof band !== 'object' || Array.isArray(band))
      throw new Error('The compensation policy has invalid workload bands.');
    const record = band as Record<string, unknown>;
    return { minimumUnitsMillis: Number(record.minimumUnitsMillis), allowanceMinor: Number(record.allowanceMinor) };
  });
}

async function audit(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue
) {
  await tx.auditEvent.create({ data: { actorUserId, action, entityType, entityId, metadata } });
}

async function recomputeStatement(tx: Prisma.TransactionClient, statementId: string) {
  const statement = await tx.compensationStatement.findUnique({
    where: { id: statementId },
    include: {
      period: { include: { policy: true } },
      workCredits: true,
      adjustments: { where: { status: 'APPROVED' } },
    },
  });
  if (!statement) throw new Error('Compensation statement not found.');
  const calculation = calculateCompensation({
    currency: statement.currency,
    baseRetainerMinor: statement.period.policy.baseRetainerMinor,
    workloadUnitCapMillis: statement.period.policy.workloadUnitCapMillis,
    workloadBands: bandsFromJson(statement.period.policy.workloadBands),
    creditEntries: statement.workCredits.map((credit) => ({ unitsMillis: credit.unitsMillisSnapshot })),
    approvedAdjustmentsMinor: statement.adjustments.map((adjustment) => adjustment.amountMinor),
  });
  return { statement, calculation };
}

const statementInclude = {
  period: { include: { policy: { select: { id: true, version: true, currency: true } } } },
  nutritionistProfile: { select: { id: true, user: { select: { name: true } } } },
  workCredits: { orderBy: { createdAt: 'asc' as const }, include: { workCredit: true } },
  adjustments: { orderBy: { createdAt: 'asc' as const } },
  payouts: { orderBy: { createdAt: 'asc' as const }, include: { events: { orderBy: { createdAt: 'asc' as const } } } },
} satisfies Prisma.CompensationStatementInclude;

export class CompensationAdminService {
  static async getWorkspace() {
    const [policies, periods, statements, pendingAdjustments, payouts, totals] = await Promise.all([
      prisma.compensationPolicy.findMany({ orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] }),
      prisma.compensationPeriod.findMany({
        orderBy: { periodStart: 'desc' },
        include: { policy: { select: { version: true } }, _count: { select: { statements: true } } },
      }),
      prisma.compensationStatement.findMany({ orderBy: { createdAt: 'desc' }, include: statementInclude }),
      prisma.compensationAdjustment.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: { statement: { select: { nutritionistProfile: { select: { user: { select: { name: true } } } } } } },
      }),
      prisma.compensationPayout.findMany({
        orderBy: { createdAt: 'desc' },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.compensationStatement.aggregate({
        _sum: { grossMinor: true },
        where: { status: { in: ['APPROVED', 'PAYOUT_PENDING', 'PAID'] } },
      }),
    ]);
    const paidMinor = payouts
      .filter((payout) => payout.status === 'MANUAL_RECORDED' || payout.status === 'SUCCEEDED')
      .reduce((sum, payout) => sum + payout.amountMinor, 0);
    const committedMinor = payouts
      .filter((payout) =>
        COMMITTED_PAYOUT_STATUSES.includes(payout.status as (typeof COMMITTED_PAYOUT_STATUSES)[number])
      )
      .reduce((sum, payout) => sum + payout.amountMinor, 0);
    return {
      policies,
      periods,
      statements,
      pendingAdjustments,
      payouts,
      reconciliation: {
        approvedStatementGrossMinor: totals._sum.grossMinor ?? 0,
        committedPayoutMinor: committedMinor,
        recordedPaidMinor: paidMinor,
        outstandingApprovedMinor: Math.max(0, (totals._sum.grossMinor ?? 0) - paidMinor),
        mismatchMinor: Math.max(0, committedMinor - (totals._sum.grossMinor ?? 0)),
        currency: 'PHP',
      },
    };
  }

  static async createPolicy(actorUserId: string, input: CreateCompensationPolicyInput) {
    calculateCompensation({
      currency: input.currency,
      baseRetainerMinor: input.baseRetainerMinor,
      workloadUnitCapMillis: input.workloadUnitCapMillis,
      workloadBands: input.workloadBands,
      creditEntries: [],
    });
    return prisma.$transaction(async (tx) => {
      const policy = await tx.compensationPolicy.create({
        data: {
          version: input.version,
          currency: input.currency,
          baseRetainerMinor: input.baseRetainerMinor,
          workloadUnitCapMillis: input.workloadUnitCapMillis,
          workloadBands: input.workloadBands,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
          createdByAdminId: actorUserId,
        },
      });
      await audit(tx, actorUserId, 'COMPENSATION_POLICY_DRAFTED', 'CompensationPolicy', policy.id, {
        version: policy.version,
      });
      return policy;
    }, TX_OPTIONS);
  }

  static async activatePolicy(actorUserId: string, policyId: string) {
    return prisma.$transaction(async (tx) => {
      const policy = await tx.compensationPolicy.findUnique({ where: { id: policyId } });
      if (!policy) throw new Error('Compensation policy not found.');
      if (policy.status === CompensationPolicyStatus.ACTIVE && policy.approvedByAdminId === actorUserId) return policy;
      if (policy.status !== CompensationPolicyStatus.DRAFT)
        throw new Error('Only a draft compensation policy can be activated.');
      if (!policy.createdByAdminId || policy.createdByAdminId === actorUserId)
        throw new Error('A different administrator must activate this policy.');
      await tx.compensationPolicy.updateMany({
        where: { status: CompensationPolicyStatus.ACTIVE },
        data: { status: CompensationPolicyStatus.RETIRED },
      });
      const activated = await tx.compensationPolicy.update({
        where: { id: policyId },
        data: { status: CompensationPolicyStatus.ACTIVE, approvedAt: new Date(), approvedByAdminId: actorUserId },
      });
      await audit(tx, actorUserId, 'COMPENSATION_POLICY_ACTIVATED', 'CompensationPolicy', policyId, {
        version: policy.version,
      });
      return activated;
    }, TX_OPTIONS);
  }

  static async openPeriod(actorUserId: string, input: CreateCompensationPeriodInput) {
    return prisma.$transaction(async (tx) => {
      const start = new Date(input.periodStart);
      const end = new Date(input.periodEnd);
      const policy = await tx.compensationPolicy.findUnique({ where: { id: input.policyId } });
      if (!policy || policy.status !== CompensationPolicyStatus.ACTIVE)
        throw new Error('An active compensation policy is required.');
      if (start < policy.effectiveFrom || (policy.effectiveUntil && end > policy.effectiveUntil)) {
        throw new Error('The compensation period must fall within the active policy dates.');
      }
      const exact = await tx.compensationPeriod.findUnique({
        where: { policyId_periodStart_periodEnd: { policyId: input.policyId, periodStart: start, periodEnd: end } },
      });
      if (exact) {
        if (exact.openedByAdminId !== actorUserId)
          throw new Error('This compensation period was opened by another administrator.');
        return exact;
      }
      const overlap = await tx.compensationPeriod.findFirst({
        where: { periodStart: { lt: end }, periodEnd: { gt: start } },
      });
      if (overlap) throw new Error('The compensation period overlaps an existing period.');
      const period = await tx.compensationPeriod.create({
        data: { policyId: input.policyId, periodStart: start, periodEnd: end, openedByAdminId: actorUserId },
      });
      await audit(tx, actorUserId, 'COMPENSATION_PERIOD_OPENED', 'CompensationPeriod', period.id, {
        policyVersion: policy.version,
      });
      return period;
    }, TX_OPTIONS);
  }

  static async closePeriod(actorUserId: string, periodId: string) {
    return prisma.$transaction(async (tx) => {
      const period = await tx.compensationPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new Error('Compensation period not found.');
      if (period.status !== CompensationPeriodStatus.OPEN && period.closedByAdminId === actorUserId) return period;
      if (period.status !== CompensationPeriodStatus.OPEN)
        throw new Error('Only an open compensation period can be closed for calculation.');
      if (!period.openedByAdminId || period.openedByAdminId === actorUserId)
        throw new Error('A different administrator must close this period.');
      if (period.periodEnd > new Date()) throw new Error('A compensation period cannot close before its end time.');
      const updated = await tx.compensationPeriod.update({
        where: { id: periodId },
        data: { status: CompensationPeriodStatus.CALCULATING, closedAt: new Date(), closedByAdminId: actorUserId },
      });
      await audit(tx, actorUserId, 'COMPENSATION_PERIOD_CLOSED', 'CompensationPeriod', periodId);
      return updated;
    }, TX_OPTIONS);
  }

  static async generateStatements(actorUserId: string, periodId: string) {
    return prisma.$transaction(async (tx) => {
      const period = await tx.compensationPeriod.findUnique({ where: { id: periodId }, include: { policy: true } });
      if (!period) throw new Error('Compensation period not found.');
      if (
        [CompensationPeriodStatus.REVIEW, CompensationPeriodStatus.APPROVED, CompensationPeriodStatus.CLOSED].includes(
          period.status as 'REVIEW' | 'APPROVED' | 'CLOSED'
        )
      ) {
        return tx.compensationStatement.findMany({ where: { periodId }, orderBy: { nutritionistProfileId: 'asc' } });
      }
      if (period.status !== CompensationPeriodStatus.CALCULATING)
        throw new Error('The period is not ready for statement calculation.');
      const profiles = await tx.nutritionistProfile.findMany({
        where: { isVerified: true, prcLicenseExpiry: { gte: period.periodEnd }, user: { isSuspended: false } },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      const credits = await tx.nutritionistWorkCredit.findMany({
        where: { earnedAt: { gte: period.periodStart, lt: period.periodEnd }, statementLinks: { none: {} } },
        orderBy: [{ nutritionistProfileId: 'asc' }, { earnedAt: 'asc' }, { id: 'asc' }],
      });
      const creditsByProfile = new Map<string, typeof credits>();
      for (const credit of credits) {
        const group = creditsByProfile.get(credit.nutritionistProfileId) ?? [];
        group.push(credit);
        creditsByProfile.set(credit.nutritionistProfileId, group);
      }
      const eligibleIds = new Set(profiles.map((profile) => profile.id));
      for (const profileId of creditsByProfile.keys()) eligibleIds.add(profileId);
      if (eligibleIds.size === 0)
        throw new Error('No eligible nutritionists or completed work credits exist for this period.');
      const statements = [];
      for (const nutritionistProfileId of [...eligibleIds].sort()) {
        const profileCredits = creditsByProfile.get(nutritionistProfileId) ?? [];
        const calculation = calculateCompensation({
          currency: period.policy.currency,
          baseRetainerMinor: period.policy.baseRetainerMinor,
          workloadUnitCapMillis: period.policy.workloadUnitCapMillis,
          workloadBands: bandsFromJson(period.policy.workloadBands),
          creditEntries: profileCredits,
        });
        const statement = await tx.compensationStatement.create({
          data: {
            periodId,
            nutritionistProfileId,
            status: CompensationStatementStatus.CALCULATED,
            ...calculation,
            calculatedAt: new Date(),
            preparedByAdminId: actorUserId,
            workCredits: {
              create: profileCredits.map((credit) => ({
                workCreditId: credit.id,
                unitsMillisSnapshot: credit.unitsMillis,
              })),
            },
          },
        });
        statements.push(statement);
      }
      await tx.compensationPeriod.update({
        where: { id: periodId },
        data: { status: CompensationPeriodStatus.REVIEW },
      });
      await audit(tx, actorUserId, 'COMPENSATION_STATEMENTS_CALCULATED', 'CompensationPeriod', periodId, {
        statementCount: statements.length,
      });
      return statements;
    }, TX_OPTIONS);
  }

  static async createAdjustment(actorUserId: string, statementId: string, input: CreateCompensationAdjustmentInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.compensationAdjustment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (
          existing.statementId !== statementId ||
          existing.amountMinor !== input.amountMinor ||
          existing.currency !== input.currency ||
          existing.reasonCode !== input.reasonCode ||
          existing.note !== (input.note ?? null)
        ) {
          throw new Error('The adjustment idempotency key is already used for different input.');
        }
        return existing;
      }
      const statement = await tx.compensationStatement.findUnique({ where: { id: statementId } });
      if (!statement) throw new Error('Compensation statement not found.');
      if (statement.status !== CompensationStatementStatus.CALCULATED)
        throw new Error('Adjustments can only be proposed while a statement is calculated.');
      if (statement.currency !== input.currency) throw new Error('Adjustment currency must match the statement.');
      const adjustment = await tx.compensationAdjustment.create({
        data: { statementId, ...input, createdByAdminId: actorUserId },
      });
      await audit(tx, actorUserId, 'COMPENSATION_ADJUSTMENT_PROPOSED', 'CompensationAdjustment', adjustment.id, {
        statementId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        reasonCode: input.reasonCode,
      });
      return adjustment;
    }, TX_OPTIONS);
  }

  static async decideAdjustment(actorUserId: string, adjustmentId: string, input: DecideCompensationAdjustmentInput) {
    return prisma.$transaction(async (tx) => {
      const adjustment = await tx.compensationAdjustment.findUnique({
        where: { id: adjustmentId },
        include: { statement: true },
      });
      if (!adjustment) throw new Error('Compensation adjustment not found.');
      if (adjustment.status !== 'PENDING') throw new Error('This adjustment already has a decision.');
      if (!adjustment.createdByAdminId || adjustment.createdByAdminId === actorUserId)
        throw new Error('A different administrator must decide this adjustment.');
      if (adjustment.statement.status !== CompensationStatementStatus.CALCULATED)
        throw new Error('The statement can no longer accept an adjustment decision.');
      const now = new Date();
      const decided =
        input.decision === 'APPROVE'
          ? await tx.compensationAdjustment.update({
              where: { id: adjustmentId },
              data: { status: 'APPROVED', approvedByAdminId: actorUserId, approvedAt: now },
            })
          : await tx.compensationAdjustment.update({
              where: { id: adjustmentId },
              data: {
                status: 'REJECTED',
                rejectedByAdminId: actorUserId,
                rejectedAt: now,
                rejectionReason: input.reason,
              },
            });
      if (input.decision === 'APPROVE') {
        const { calculation } = await recomputeStatement(tx, adjustment.statementId);
        await tx.compensationStatement.update({ where: { id: adjustment.statementId }, data: calculation });
      }
      await audit(
        tx,
        actorUserId,
        `COMPENSATION_ADJUSTMENT_${input.decision}D`,
        'CompensationAdjustment',
        adjustmentId,
        { statementId: adjustment.statementId }
      );
      return decided;
    }, TX_OPTIONS);
  }

  static async reviewStatement(actorUserId: string, statementId: string) {
    return prisma.$transaction(async (tx) => {
      const { statement, calculation } = await recomputeStatement(tx, statementId);
      if (statement.status === CompensationStatementStatus.REVIEWED && statement.reviewedByAdminId === actorUserId)
        return statement;
      if (statement.status !== CompensationStatementStatus.CALCULATED)
        throw new Error('Only a calculated statement can be reviewed.');
      if (!statement.preparedByAdminId || statement.preparedByAdminId === actorUserId)
        throw new Error('A different administrator must review this statement.');
      const pending = await tx.compensationAdjustment.count({ where: { statementId, status: 'PENDING' } });
      if (pending > 0) throw new Error('Resolve every pending adjustment before reviewing the statement.');
      const updated = await tx.compensationStatement.update({
        where: { id: statementId },
        data: {
          ...calculation,
          status: CompensationStatementStatus.REVIEWED,
          reviewedByAdminId: actorUserId,
          reviewedAt: new Date(),
        },
      });
      await audit(tx, actorUserId, 'COMPENSATION_STATEMENT_REVIEWED', 'CompensationStatement', statementId);
      return updated;
    }, TX_OPTIONS);
  }

  static async approveStatement(actorUserId: string, statementId: string) {
    return prisma.$transaction(async (tx) => {
      const { statement, calculation } = await recomputeStatement(tx, statementId);
      if (
        [
          CompensationStatementStatus.APPROVED,
          CompensationStatementStatus.PAYOUT_PENDING,
          CompensationStatementStatus.PAID,
        ].includes(statement.status as 'APPROVED' | 'PAYOUT_PENDING' | 'PAID') &&
        statement.approvedByAdminId === actorUserId
      )
        return statement;
      if (statement.status !== CompensationStatementStatus.REVIEWED)
        throw new Error('Only a reviewed statement can be approved.');
      if (
        !statement.preparedByAdminId ||
        !statement.reviewedByAdminId ||
        [statement.preparedByAdminId, statement.reviewedByAdminId].includes(actorUserId)
      ) {
        throw new Error('Statement preparation, review, and approval require different administrators.');
      }
      const updated = await tx.compensationStatement.update({
        where: { id: statementId },
        data: {
          ...calculation,
          status: CompensationStatementStatus.APPROVED,
          approvedByAdminId: actorUserId,
          approvedAt: new Date(),
        },
      });
      const incomplete = await tx.compensationStatement.count({
        where: {
          periodId: statement.periodId,
          status: {
            notIn: [
              CompensationStatementStatus.APPROVED,
              CompensationStatementStatus.PAYOUT_PENDING,
              CompensationStatementStatus.PAID,
            ],
          },
        },
      });
      if (incomplete === 0)
        await tx.compensationPeriod.update({
          where: { id: statement.periodId },
          data: { status: CompensationPeriodStatus.APPROVED },
        });
      await audit(tx, actorUserId, 'COMPENSATION_STATEMENT_APPROVED', 'CompensationStatement', statementId, {
        grossMinor: calculation.grossMinor,
        currency: calculation.currency,
      });
      return updated;
    }, TX_OPTIONS);
  }

  static async prepareManualPayout(actorUserId: string, statementId: string, idempotencyKey: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.compensationPayout.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (
          existing.statementId !== statementId ||
          existing.submittedByAdminId !== actorUserId ||
          existing.method !== 'MANUAL_OFF_PLATFORM'
        ) {
          throw new Error('The payout idempotency key is already used for different input.');
        }
        return existing;
      }
      const statement = await tx.compensationStatement.findUnique({ where: { id: statementId } });
      if (!statement) throw new Error('Compensation statement not found.');
      if (
        statement.status !== CompensationStatementStatus.APPROVED &&
        statement.status !== CompensationStatementStatus.PAYOUT_PENDING
      )
        throw new Error('Only an approved statement can enter payout preparation.');
      if (!statement.preparedByAdminId || !statement.reviewedByAdminId || !statement.approvedByAdminId)
        throw new Error('The statement lacks complete maker-checker evidence.');
      assertMakerCheckerActors({
        preparedBy: statement.preparedByAdminId,
        reviewedBy: statement.reviewedByAdminId,
        approvedBy: statement.approvedByAdminId,
        submittedBy: actorUserId,
      });
      const committed = await tx.compensationPayout.aggregate({
        where: { statementId, status: { in: [...COMMITTED_PAYOUT_STATUSES] } },
        _sum: { amountMinor: true },
      });
      const remaining = statement.grossMinor - (committed._sum.amountMinor ?? 0);
      assertCompensationPayoutAmount({
        statementGrossMinor: statement.grossMinor,
        alreadyCommittedMinor: committed._sum.amountMinor ?? 0,
        requestedMinor: remaining,
        statementCurrency: statement.currency,
        payoutCurrency: statement.currency,
      });
      const payout = await tx.compensationPayout.create({
        data: {
          statementId,
          method: 'MANUAL_OFF_PLATFORM',
          amountMinor: remaining,
          currency: statement.currency,
          idempotencyKey,
          submittedByAdminId: actorUserId,
          submittedAt: new Date(),
          events: { create: { status: 'DRAFT', actorUserId, reasonCode: 'MANUAL_PAYOUT_PREPARED' } },
        },
      });
      if (statement.status === CompensationStatementStatus.APPROVED)
        await tx.compensationStatement.update({
          where: { id: statementId },
          data: { status: CompensationStatementStatus.PAYOUT_PENDING },
        });
      await audit(tx, actorUserId, 'COMPENSATION_PAYOUT_PREPARED', 'CompensationPayout', payout.id, {
        statementId,
        amountMinor: remaining,
        currency: statement.currency,
        method: 'MANUAL_OFF_PLATFORM',
      });
      return payout;
    }, TX_OPTIONS);
  }

  static async approveManualPayout(actorUserId: string, payoutId: string) {
    return prisma.$transaction(async (tx) => {
      const payout = await tx.compensationPayout.findUnique({ where: { id: payoutId }, include: { statement: true } });
      if (!payout) throw new Error('Compensation payout not found.');
      if (payout.status !== 'DRAFT' && payout.approvedByAdminId === actorUserId) return payout;
      if (payout.method !== 'MANUAL_OFF_PLATFORM' || payout.status !== 'DRAFT')
        throw new Error('Only a draft manual payout can be approved.');
      if (!payout.submittedByAdminId || payout.submittedByAdminId === actorUserId)
        throw new Error('A different administrator must approve this payout.');
      const committed = await tx.compensationPayout.aggregate({
        where: {
          statementId: payout.statementId,
          id: { not: payoutId },
          status: { in: [...COMMITTED_PAYOUT_STATUSES] },
        },
        _sum: { amountMinor: true },
      });
      assertCompensationPayoutAmount({
        statementGrossMinor: payout.statement.grossMinor,
        alreadyCommittedMinor: committed._sum.amountMinor ?? 0,
        requestedMinor: payout.amountMinor,
        statementCurrency: payout.statement.currency,
        payoutCurrency: payout.currency,
      });
      const updated = await tx.compensationPayout.update({
        where: { id: payoutId },
        data: {
          status: 'APPROVED',
          approvedByAdminId: actorUserId,
          approvedAt: new Date(),
          events: { create: { status: 'APPROVED', actorUserId, reasonCode: 'MANUAL_PAYOUT_APPROVED' } },
        },
      });
      await audit(tx, actorUserId, 'COMPENSATION_PAYOUT_APPROVED', 'CompensationPayout', payoutId);
      return updated;
    }, TX_OPTIONS);
  }

  static async recordManualPayout(actorUserId: string, payoutId: string, externalReference: string) {
    return prisma.$transaction(async (tx) => {
      const payout = await tx.compensationPayout.findUnique({ where: { id: payoutId }, include: { statement: true } });
      if (!payout) throw new Error('Compensation payout not found.');
      if (payout.status === 'MANUAL_RECORDED' && payout.externalReference === externalReference) return payout;
      if (payout.method !== 'MANUAL_OFF_PLATFORM' || payout.status !== 'APPROVED')
        throw new Error('Only an approved manual payout can be recorded.');
      const updated = await tx.compensationPayout.update({
        where: { id: payoutId },
        data: {
          status: 'MANUAL_RECORDED',
          externalReference,
          completedAt: new Date(),
          events: {
            create: {
              status: 'MANUAL_RECORDED',
              actorUserId,
              reasonCode: 'OFF_PLATFORM_EVIDENCE_RECORDED',
              metadata: { externalReference },
            },
          },
        },
      });
      const paid = await tx.compensationPayout.aggregate({
        where: { statementId: payout.statementId, status: { in: ['MANUAL_RECORDED', 'SUCCEEDED'] } },
        _sum: { amountMinor: true },
      });
      if ((paid._sum.amountMinor ?? 0) === payout.statement.grossMinor) {
        await tx.compensationStatement.update({
          where: { id: payout.statementId },
          data: { status: CompensationStatementStatus.PAID },
        });
        const remaining = await tx.compensationStatement.count({
          where: { periodId: payout.statement.periodId, status: { not: CompensationStatementStatus.PAID } },
        });
        if (remaining === 0)
          await tx.compensationPeriod.update({
            where: { id: payout.statement.periodId },
            data: { status: CompensationPeriodStatus.CLOSED },
          });
      }
      await audit(tx, actorUserId, 'COMPENSATION_PAYOUT_RECORDED', 'CompensationPayout', payoutId, {
        externalReference,
      });
      return updated;
    }, TX_OPTIONS);
  }

  static async reverseWorkCredit(
    actorUserId: string,
    workCreditId: string,
    reversalActionKey: string,
    reasonCode: string
  ) {
    return prisma.$transaction(async (tx) => {
      const original = await tx.nutritionistWorkCredit.findUnique({ where: { id: workCreditId } });
      if (!original) throw new Error('Work credit not found.');
      const [existingKey, existingReversal] = await Promise.all([
        tx.nutritionistWorkCredit.findUnique({ where: { sourceActionKey: reversalActionKey }, select: { id: true } }),
        tx.nutritionistWorkCredit.findUnique({ where: { reversesCreditId: workCreditId }, select: { id: true } }),
      ]);
      const decision = decideWorkCreditReversal({
        reversalActionKey,
        original,
        existingSourceActionKeys: new Set(existingKey ? [reversalActionKey] : []),
        reversedCreditIds: new Set(existingReversal ? [workCreditId] : []),
      });
      if (decision.decision !== 'REVERSE') {
        if (decision.decision === 'DUPLICATE') return existingKey;
        throw new Error('This work credit already has a reversal.');
      }
      const reversal = await tx.nutritionistWorkCredit.create({
        data: {
          nutritionistProfileId: original.nutritionistProfileId,
          entryType: 'REVERSAL',
          creditKind: decision.creditKind,
          sourceActionKey: reversalActionKey,
          sourceEntityType: original.sourceEntityType,
          sourceEntityId: original.sourceEntityId,
          sourceOutcome: decision.sourceOutcome,
          unitsMillis: decision.unitsMillis,
          policyVersion: original.policyVersion,
          earnedAt: new Date(),
          reversesCreditId: original.id,
          reasonCode,
        },
      });
      await audit(tx, actorUserId, 'NUTRITIONIST_WORK_CREDIT_REVERSED', 'NutritionistWorkCredit', reversal.id, {
        originalCreditId: original.id,
        reasonCode,
      });
      return reversal;
    }, TX_OPTIONS);
  }
}

export class NutritionistCompensationService {
  static async getOwn(profileId: string) {
    const [credits, statements] = await Promise.all([
      prisma.nutritionistWorkCredit.findMany({
        where: { nutritionistProfileId: profileId },
        orderBy: [{ earnedAt: 'desc' }, { id: 'desc' }],
        include: { statementLinks: { select: { id: true } } },
      }),
      prisma.compensationStatement.findMany({
        where: { nutritionistProfileId: profileId },
        orderBy: { createdAt: 'desc' },
        include: statementInclude,
      }),
    ]);
    const availableUnitsMillis = Math.max(
      0,
      credits
        .filter((credit) => credit.statementLinks.length === 0)
        .reduce((sum, credit) => sum + credit.unitsMillis, 0)
    );
    return {
      summary: {
        lifetimeNetUnitsMillis: Math.max(
          0,
          credits.reduce((sum, credit) => sum + credit.unitsMillis, 0)
        ),
        statementCount: statements.length,
        approvedGrossMinor: statements
          .filter((statement) => ['APPROVED', 'PAYOUT_PENDING', 'PAID'].includes(statement.status))
          .reduce((sum, statement) => sum + statement.grossMinor, 0),
        recordedPaidMinor: statements
          .flatMap((statement) => statement.payouts)
          .filter((payout) => payout.status === 'MANUAL_RECORDED' || payout.status === 'SUCCEEDED')
          .reduce((sum, payout) => sum + payout.amountMinor, 0),
        availableUnitsMillis,
        currency: 'PHP',
      },
      credits,
      statements,
    };
  }
}
