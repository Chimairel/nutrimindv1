import {
  AssuranceTier,
  ClearanceDecisionStage,
  ClearanceDecisionValue,
  ConditionClearanceProvenance,
  ConditionClearanceState,
  ConditionRulePolicyState,
  HealthConditionType,
  Prisma,
  RuleApprovalDecision,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { evaluateMealLibrarySafetyEvidence } from '@/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import {
  conditionAllowsRulesetAutomation,
  conditionRequiresUserScopedClearance,
  getConditionAssuranceTier,
} from '@/domain/assurance-tier.policy';
import { evaluateConditionNutrientRule } from '@/domain/condition-rule-evaluation.policy';

const STANDARD_AUDIT_MS = 365 * 24 * 60 * 60 * 1000;
const ENHANCED_AUDIT_MS = 180 * 24 * 60 * 60 * 1000;

function dailyAuditSampleKey(clearanceId: string, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return createHash('sha256').update(`${day}:${clearanceId}`).digest('hex');
}

async function requireEligibleReviewer(nutritionistProfileId: string, leadRequired = false) {
  const reviewer = await prisma.nutritionistProfile.findUnique({
    where: { id: nutritionistProfileId },
    include: { user: { select: { id: true, role: true, isSuspended: true } } },
  });
  if (!reviewer || !isNutritionistEligibleForReview(reviewer)) {
    throw new Error('Only a currently verified nutritionist with a current license may perform this action.');
  }
  if (leadRequired && !reviewer.canLeadReview) throw new Error('Lead review capability is required for this action.');
  return reviewer;
}

function auditDueAt(tier: AssuranceTier, now: Date): Date {
  return new Date(now.getTime() + (tier === AssuranceTier.ENHANCED ? ENHANCED_AUDIT_MS : STANDARD_AUDIT_MS));
}

function evidenceSnapshot(meal: {
  id: string;
  recipeSignature: string | null;
  safetyEvidenceRevision: number;
  safetyPolicyVersion: string | null;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  return {
    mealLibraryId: meal.id,
    recipeSignature: meal.recipeSignature,
    evidenceRevision: meal.safetyEvidenceRevision,
    safetyPolicyVersion: meal.safetyPolicyVersion,
    mealName: meal.mealName,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
  };
}

export class ConditionClearanceService {
  static async submitManualDecision(input: {
    nutritionistProfileId: string;
    mealLibraryId: string;
    condition: HealthConditionType;
    decision: ClearanceDecisionValue;
    rationale?: string;
    userScopeId?: string | null;
  }) {
    if (input.condition === HealthConditionType.NONE) throw new Error('NONE does not require a condition clearance.');
    const tier = getConditionAssuranceTier(input.condition);
    const reviewer = await requireEligibleReviewer(input.nutritionistProfileId);
    if (conditionRequiresUserScopedClearance(input.condition) && !input.userScopeId) {
      throw new Error(
        `${input.condition} clearance requires an explicit user scope until structured clinical detail exists.`
      );
    }
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: input.mealLibraryId },
      include: {
        ingredients: true,
        safetyDeclarations: true,
        safetyReviewedByNutritionist: { include: { user: { select: { role: true, isSuspended: true } } } },
      },
    });
    if (!meal) throw new Error('Library meal not found.');
    if (!meal.recipeSignature || meal.safetyEvidenceRevision <= 0) {
      throw new Error('The meal requires a stable recipe signature and evidence revision before condition review.');
    }
    const safety = evaluateMealLibrarySafetyEvidence({
      ...meal,
      reviewerEligible: meal.safetyReviewedByNutritionist
        ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
        : false,
    });
    if (!safety.complete) throw new Error('Base recipe evidence must be complete before condition clearance.');

    const existing = await prisma.mealConditionClearance.findFirst({
      where: {
        mealLibraryId: meal.id,
        condition: input.condition,
        recipeSignature: meal.recipeSignature,
        evidenceRevision: meal.safetyEvidenceRevision,
        userScopeId: input.userScopeId ?? null,
        state: { in: ['REVIEW_DUE', 'ACTIVE', 'DISPUTED'] },
      },
      include: { decisions: { orderBy: { submittedAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.state === ConditionClearanceState.ACTIVE)
      throw new Error('An active clearance already exists for this scope.');
    if (existing?.decisions.some((decision) => decision.nutritionistProfileId === input.nutritionistProfileId)) {
      throw new Error('The same nutritionist cannot review this clearance twice.');
    }
    if (existing?.decisions.length && tier === AssuranceTier.ENHANCED && !reviewer.canLeadReview) {
      throw new Error('Lead review capability is required for the independent second enhanced review.');
    }

    const now = new Date();
    return prisma.$transaction(
      async (tx) => {
        const clearance =
          existing ??
          (await tx.mealConditionClearance.create({
            data: {
              mealLibraryId: meal.id,
              userScopeId: input.userScopeId ?? null,
              condition: input.condition,
              recipeSignature: meal.recipeSignature!,
              evidenceRevision: meal.safetyEvidenceRevision,
              policyVersion: meal.safetyPolicyVersion,
              assuranceTier: tier,
              provenance: ConditionClearanceProvenance.MANUAL_REVIEW,
              state: ConditionClearanceState.REVIEW_DUE,
              evidenceSnapshot: evidenceSnapshot(meal),
            },
            include: { decisions: true },
          }));
        const stage = clearance.decisions.length ? ClearanceDecisionStage.SECONDARY : ClearanceDecisionStage.PRIMARY;
        await tx.mealConditionClearanceDecision.create({
          data: {
            clearanceId: clearance.id,
            nutritionistProfileId: input.nutritionistProfileId,
            stage,
            decision: input.decision,
            rationale: input.rationale?.trim() || null,
            evidenceSnapshot: evidenceSnapshot(meal),
          },
        });

        const priorDecision = clearance.decisions[0]?.decision;
        let state: ConditionClearanceState = ConditionClearanceState.REVIEW_DUE;
        if (tier === AssuranceTier.STANDARD) {
          state =
            input.decision === ClearanceDecisionValue.APPROVE
              ? ConditionClearanceState.ACTIVE
              : ConditionClearanceState.REVOKED;
        } else if (!priorDecision) {
          state =
            input.decision === ClearanceDecisionValue.REJECT
              ? ConditionClearanceState.REVOKED
              : ConditionClearanceState.REVIEW_DUE;
        } else if (priorDecision === input.decision) {
          state =
            input.decision === ClearanceDecisionValue.APPROVE
              ? ConditionClearanceState.ACTIVE
              : ConditionClearanceState.REVOKED;
        } else {
          state = ConditionClearanceState.DISPUTED;
        }
        const updated = await tx.mealConditionClearance.update({
          where: { id: clearance.id },
          data: {
            state,
            activatedAt: state === ConditionClearanceState.ACTIVE ? now : null,
            auditDueAt: state === ConditionClearanceState.ACTIVE ? auditDueAt(tier, now) : null,
            suspendedAt: state === ConditionClearanceState.DISPUTED ? now : null,
            suspensionReason: state === ConditionClearanceState.DISPUTED ? 'INDEPENDENT_REVIEW_DISAGREEMENT' : null,
          },
          include: { decisions: { select: { id: true, stage: true, decision: true, submittedAt: true } } },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: `CONDITION_CLEARANCE_${state}`,
            entityType: 'MealConditionClearance',
            entityId: clearance.id,
            metadata: { condition: input.condition, tier, userScoped: Boolean(input.userScopeId) },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  static async resolveDispute(input: {
    nutritionistProfileId: string;
    clearanceId: string;
    decision: ClearanceDecisionValue;
    rationale: string;
  }) {
    const reviewer = await requireEligibleReviewer(input.nutritionistProfileId, true);
    const clearance = await prisma.mealConditionClearance.findUnique({
      where: { id: input.clearanceId },
      include: { decisions: true },
    });
    if (!clearance || clearance.state !== ConditionClearanceState.DISPUTED) {
      throw new Error('A disputed clearance was not found.');
    }
    if (clearance.decisions.some((decision) => decision.nutritionistProfileId === input.nutritionistProfileId)) {
      throw new Error('Dispute adjudication requires a nutritionist who did not submit either disputed decision.');
    }
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.mealConditionClearanceDecision.create({
        data: {
          clearanceId: clearance.id,
          nutritionistProfileId: input.nutritionistProfileId,
          stage: ClearanceDecisionStage.DISPUTE_RESOLUTION,
          decision: input.decision,
          rationale: input.rationale.trim(),
          evidenceSnapshot: clearance.evidenceSnapshot as Prisma.InputJsonValue,
        },
      });
      const state =
        input.decision === ClearanceDecisionValue.APPROVE
          ? ConditionClearanceState.ACTIVE
          : ConditionClearanceState.REVOKED;
      const updated = await tx.mealConditionClearance.update({
        where: { id: clearance.id },
        data: {
          state,
          resolvedByNutritionistId: input.nutritionistProfileId,
          activatedAt: state === ConditionClearanceState.ACTIVE ? now : null,
          auditDueAt: state === ConditionClearanceState.ACTIVE ? auditDueAt(clearance.assuranceTier, now) : null,
          suspendedAt: null,
          suspensionReason: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CONDITION_CLEARANCE_DISPUTE_RESOLVED',
          entityType: 'MealConditionClearance',
          entityId: clearance.id,
          metadata: { decision: input.decision },
        },
      });
      return updated;
    });
  }

  static async suspendClearance(nutritionistProfileId: string, clearanceId: string, reason: string) {
    const reviewer = await requireEligibleReviewer(nutritionistProfileId, true);
    return prisma.$transaction(async (tx) => {
      const clearance = await tx.mealConditionClearance.update({
        where: { id: clearanceId },
        data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.trim().slice(0, 240) },
      });
      await tx.mealPlan.updateMany({
        where: { clearanceUsages: { some: { clearanceId } }, status: 'APPROVED' },
        data: { requiresSafetyRevalidation: true },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CONDITION_CLEARANCE_SUSPENDED',
          entityType: 'MealConditionClearance',
          entityId: clearanceId,
          metadata: { reason: clearance.suspensionReason },
        },
      });
      return clearance;
    });
  }

  static async getGovernanceQueue(nutritionistProfileId: string, view: 'audit' | 'disputed') {
    const reviewer = await requireEligibleReviewer(nutritionistProfileId);
    const now = new Date();
    if (view === 'disputed') {
      const [clearances, plans] = await Promise.all([
        prisma.mealConditionClearance.findMany({
          where: { state: 'DISPUTED' },
          include: {
            mealLibrary: { select: { mealName: true } },
            _count: { select: { planUsages: true } },
          },
          orderBy: { updatedAt: 'asc' },
          take: 100,
        }),
        prisma.mealPlan.findMany({
          where: { status: 'DISPUTED' },
          select: { id: true, mealName: true, mealType: true, scheduledDate: true, user: { select: { name: true } } },
          orderBy: { reviewedAt: 'asc' },
          take: 100,
        }),
      ]);
      return { canLeadReview: reviewer.canLeadReview, clearances, plans };
    }

    const clearances = await prisma.mealConditionClearance.findMany({
      where: { state: { in: ['ACTIVE', 'REVIEW_DUE', 'SUSPENDED'] } },
      include: {
        mealLibrary: { select: { mealName: true } },
        _count: { select: { planUsages: true } },
      },
      take: 250,
    });
    const usageRows = clearances.length
      ? await prisma.mealPlanClearanceUsage.findMany({
          where: { clearanceId: { in: clearances.map((clearance) => clearance.id) } },
          select: { clearanceId: true, mealPlan: { select: { userId: true } } },
        })
      : [];
    const usersByClearance = new Map<string, Set<string>>();
    for (const usage of usageRows) {
      const users = usersByClearance.get(usage.clearanceId) ?? new Set<string>();
      users.add(usage.mealPlan.userId);
      usersByClearance.set(usage.clearanceId, users);
    }
    const ranked = clearances
      .map((clearance) => {
        const uniqueUserExposure = usersByClearance.get(clearance.id)?.size ?? 0;
        const overdue = Boolean(clearance.auditDueAt && clearance.auditDueAt <= now);
        const priority =
          clearance.state === 'SUSPENDED'
            ? 0
            : clearance.provenance === 'APPROVED_RULESET'
              ? 1
              : clearance.assuranceTier === 'ENHANCED'
                ? 2
                : uniqueUserExposure >= 100
                  ? 3
                  : overdue
                    ? 4
                    : 5;
        const reason =
          clearance.state === 'SUSPENDED'
            ? `Suspended: ${clearance.suspensionReason || 'safety circuit breaker'}`
            : clearance.provenance === 'APPROVED_RULESET'
              ? `Ruleset-derived evidence · used by ${uniqueUserExposure} users`
              : clearance.assuranceTier === 'ENHANCED'
                ? `Enhanced assurance · used by ${uniqueUserExposure} users`
                : uniqueUserExposure >= 100
                  ? `High exposure: used by ${uniqueUserExposure} users`
                  : overdue
                    ? `Audit overdue since ${clearance.auditDueAt!.toISOString().slice(0, 10)}`
                    : `Routine sample · used by ${uniqueUserExposure} users`;
        return {
          ...clearance,
          uniqueUserExposure,
          auditPriority: priority,
          auditReason: reason,
          auditSampleKey: dailyAuditSampleKey(clearance.id, now),
        };
      })
      .sort(
        (a, b) =>
          a.auditPriority - b.auditPriority ||
          b.uniqueUserExposure - a.uniqueUserExposure ||
          a.auditSampleKey.localeCompare(b.auditSampleKey)
      );
    return { canLeadReview: reviewer.canLeadReview, clearances: ranked.slice(0, 100) };
  }

  static async generateRulesetImpact(nutritionistProfileId: string, policyVersionId: string) {
    await requireEligibleReviewer(nutritionistProfileId);
    const policy = await prisma.conditionRulePolicyVersion.findUnique({ where: { id: policyVersionId } });
    if (!policy || policy.state !== ConditionRulePolicyState.DRAFT) throw new Error('Draft ruleset version not found.');
    const [nutrientRules, ingredientRules, meals] = await Promise.all([
      prisma.conditionNutrientRule.findMany({
        where: { condition: policy.condition, policyVersion: policy.policyVersion },
      }),
      prisma.conditionIngredientRule.findMany({
        where: { condition: policy.condition, policyVersion: policy.policyVersion },
      }),
      prisma.mealLibrary.findMany({
        where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE' },
        select: {
          id: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          sodiumMg: true,
          sugarG: true,
          fiberG: true,
          potassiumMg: true,
          phosphorusMg: true,
          saturatedFatG: true,
          ingredients: { select: { ingredientName: true } },
        },
        take: 5000,
      }),
    ]);
    let cleared = 0;
    let blocked = 0;
    let unevaluable = 0;
    for (const meal of meals) {
      const evaluations = nutrientRules.map((rule) =>
        evaluateConditionNutrientRule(
          { ...rule, reviewStatus: 'APPROVED', active: true, approvedByNutritionistId: 'DRY_RUN' },
          meal
        )
      );
      const ingredientText = meal.ingredients.map((item) => item.ingredientName.toLowerCase()).join(' | ');
      const ingredientBlocked = ingredientRules.some((rule) => {
        const terms = Array.isArray(rule.matchingTerms)
          ? rule.matchingTerms.filter((term): term is string => typeof term === 'string')
          : [];
        return terms.some((term) => ingredientText.includes(term.toLowerCase()));
      });
      if (ingredientBlocked || evaluations.some((result) => result.decision === 'FAIL')) blocked += 1;
      else if (evaluations.some((result) => result.decision === 'NOT_EVALUABLE')) unevaluable += 1;
      else cleared += 1;
    }
    const impactReport = {
      evaluatedAt: new Date().toISOString(),
      mealCount: meals.length,
      rules: nutrientRules.length + ingredientRules.length,
      newlyClearable: cleared,
      blocked,
      unevaluable,
    };
    return prisma.conditionRulePolicyVersion.update({
      where: { id: policy.id },
      data: { impactReport },
    });
  }

  static async approveRulesetVersion(input: {
    nutritionistProfileId: string;
    policyVersionId: string;
    decision: RuleApprovalDecision;
    rationale?: string;
  }) {
    const reviewer = await requireEligibleReviewer(input.nutritionistProfileId);
    const policy = await prisma.conditionRulePolicyVersion.findUnique({
      where: { id: input.policyVersionId },
      include: { approvals: { include: { nutritionistProfile: { select: { canLeadReview: true } } } } },
    });
    if (!policy || policy.state !== 'DRAFT') throw new Error('Draft ruleset version not found.');
    if (!policy.impactReport) throw new Error('A dry-run impact report is required before ruleset approval.');
    if (policy.approvals.some((approval) => approval.nutritionistProfileId === input.nutritionistProfileId)) {
      throw new Error('The same nutritionist cannot approve a ruleset version twice.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.conditionRulePolicyApproval.create({
        data: {
          policyVersionId: policy.id,
          nutritionistProfileId: input.nutritionistProfileId,
          decision: input.decision,
          rationale: input.rationale?.trim() || null,
        },
      });
      const approvals = [
        ...policy.approvals.map((approval) => ({
          decision: approval.decision,
          canLeadReview: approval.nutritionistProfile.canLeadReview,
          nutritionistProfileId: approval.nutritionistProfileId,
        })),
        {
          decision: input.decision,
          canLeadReview: reviewer.canLeadReview,
          nutritionistProfileId: input.nutritionistProfileId,
        },
      ];
      const rejected = approvals.some((approval) => approval.decision === 'REJECT');
      const mayActivate =
        approvals.filter((approval) => approval.decision === 'APPROVE').length >= 2 &&
        approvals.some((approval) => approval.decision === 'APPROVE' && approval.canLeadReview);
      if (rejected) {
        return tx.conditionRulePolicyVersion.update({
          where: { id: policy.id },
          data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'RND_APPROVAL_REJECTED' },
        });
      }
      if (!mayActivate) return tx.conditionRulePolicyVersion.findUniqueOrThrow({ where: { id: policy.id } });
      const leadApprover = approvals.find((approval) => approval.decision === 'APPROVE' && approval.canLeadReview)!;
      await Promise.all([
        tx.conditionNutrientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: {
            reviewStatus: 'APPROVED',
            active: true,
            approvedByNutritionistId: leadApprover.nutritionistProfileId,
          },
        }),
        tx.conditionIngredientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: {
            reviewStatus: 'APPROVED',
            active: true,
            approvedByNutritionistId: leadApprover.nutritionistProfileId,
          },
        }),
      ]);
      const activatedPolicy = await tx.conditionRulePolicyVersion.update({
        where: { id: policy.id },
        data: { state: 'ACTIVE', activatedAt: new Date() },
      });
      if (policy.automationAllowed && conditionAllowsRulesetAutomation(policy.condition)) {
        const [rules, meals] = await Promise.all([
          tx.conditionNutrientRule.findMany({
            where: { condition: policy.condition, policyVersion: policy.policyVersion, active: true },
          }),
          tx.mealLibrary.findMany({
            where: {
              status: 'APPROVED',
              safetyEvidenceStatus: 'COMPLETE',
              recipeSignature: { not: null },
            },
            select: {
              id: true,
              mealName: true,
              recipeSignature: true,
              safetyEvidenceRevision: true,
              safetyPolicyVersion: true,
              calories: true,
              proteinG: true,
              carbsG: true,
              fatG: true,
              sodiumMg: true,
              sugarG: true,
              fiberG: true,
              potassiumMg: true,
              phosphorusMg: true,
              saturatedFatG: true,
            },
            take: 5000,
          }),
        ]);
        const automaticClearances: Prisma.MealConditionClearanceCreateManyInput[] = [];
        for (const meal of meals) {
          const evaluations = rules.map((rule) => evaluateConditionNutrientRule(rule, meal));
          if (!evaluations.length || evaluations.some((evaluation) => evaluation.decision !== 'PASS')) continue;
          const activatedAt = new Date();
          automaticClearances.push({
            mealLibraryId: meal.id,
            condition: policy.condition,
            recipeSignature: meal.recipeSignature!,
            evidenceRevision: meal.safetyEvidenceRevision,
            policyVersion: policy.policyVersion,
            rulePolicyVersionId: policy.id,
            assuranceTier: policy.assuranceTier,
            provenance: 'APPROVED_RULESET',
            state: 'ACTIVE',
            evidenceSnapshot: {
              ...evidenceSnapshot(meal),
              ruleEvaluations: evaluations,
              rulePolicyVersionId: policy.id,
            } as unknown as Prisma.InputJsonValue,
            activatedAt,
            auditDueAt: auditDueAt(policy.assuranceTier, activatedAt),
          });
        }
        for (let offset = 0; offset < automaticClearances.length; offset += 250) {
          await tx.mealConditionClearance.createMany({
            data: automaticClearances.slice(offset, offset + 250),
            skipDuplicates: true,
          });
        }
      }
      return activatedPolicy;
    });
  }

  static async suspendRuleset(nutritionistProfileId: string, policyVersionId: string, reason: string) {
    const reviewer = await requireEligibleReviewer(nutritionistProfileId, true);
    return prisma.$transaction(async (tx) => {
      const policy = await tx.conditionRulePolicyVersion.update({
        where: { id: policyVersionId },
        data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.trim().slice(0, 240) },
      });
      await Promise.all([
        tx.conditionNutrientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: { active: false },
        }),
        tx.conditionIngredientRule.updateMany({
          where: { condition: policy.condition, policyVersion: policy.policyVersion },
          data: { active: false },
        }),
      ]);
      const affected = await tx.mealConditionClearance.findMany({
        where: { rulePolicyVersionId: policy.id, state: 'ACTIVE' },
        select: { id: true },
      });
      const clearanceIds = affected.map((clearance) => clearance.id);
      if (clearanceIds.length) {
        await tx.mealConditionClearance.updateMany({
          where: { id: { in: clearanceIds } },
          data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'SOURCE_RULESET_SUSPENDED' },
        });
        await tx.mealPlan.updateMany({
          where: { clearanceUsages: { some: { clearanceId: { in: clearanceIds } } }, status: 'APPROVED' },
          data: { requiresSafetyRevalidation: true },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: reviewer.userId,
          action: 'CONDITION_RULESET_SUSPENDED',
          entityType: 'ConditionRulePolicyVersion',
          entityId: policy.id,
          metadata: { affectedClearances: clearanceIds.length, reason: policy.suspensionReason },
        },
      });
      return { policy, affectedClearances: clearanceIds.length };
    });
  }
}

export async function suspendMealClearancesForEvidenceChange(
  tx: Prisma.TransactionClient,
  mealLibraryId: string,
  reason: string
) {
  const active = await tx.mealConditionClearance.findMany({
    where: { mealLibraryId, state: { in: ['ACTIVE', 'REVIEW_DUE'] } },
    select: { id: true },
  });
  const ids = active.map((clearance) => clearance.id);
  if (!ids.length) return 0;
  await tx.mealConditionClearance.updateMany({
    where: { id: { in: ids } },
    data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.slice(0, 240) },
  });
  await tx.mealPlan.updateMany({
    where: { clearanceUsages: { some: { clearanceId: { in: ids } } }, status: 'APPROVED' },
    data: { requiresSafetyRevalidation: true },
  });
  return ids.length;
}

export async function enforceClearanceCircuitBreakers(now: Date = new Date()) {
  const [manualClearances, activePolicies] = await Promise.all([
    prisma.mealConditionClearance.findMany({
      where: { state: 'ACTIVE', provenance: 'MANUAL_REVIEW' },
      include: {
        decisions: {
          where: { decision: 'APPROVE' },
          include: {
            nutritionistProfile: {
              select: {
                isVerified: true,
                prcLicenseExpiry: true,
                canLeadReview: true,
                user: { select: { isSuspended: true } },
              },
            },
          },
        },
      },
    }),
    prisma.conditionRulePolicyVersion.findMany({
      where: { state: 'ACTIVE' },
      include: {
        approvals: {
          where: { decision: 'APPROVE' },
          include: {
            nutritionistProfile: {
              select: {
                isVerified: true,
                prcLicenseExpiry: true,
                canLeadReview: true,
                user: { select: { isSuspended: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const overdueIds = manualClearances
    .filter((clearance) => !clearance.auditDueAt || clearance.auditDueAt <= now)
    .map((clearance) => clearance.id);
  const ineligibleManualIds = manualClearances
    .filter((clearance) => {
      if (overdueIds.includes(clearance.id)) return false;
      const eligible = clearance.decisions.filter((decision) =>
        isNutritionistEligibleForReview(decision.nutritionistProfile, now)
      );
      if (clearance.assuranceTier === AssuranceTier.ENHANCED) {
        return eligible.length < 2 || !eligible.some((decision) => decision.nutritionistProfile.canLeadReview);
      }
      return eligible.length < 1;
    })
    .map((clearance) => clearance.id);
  const invalidPolicyIds = activePolicies
    .filter((policy) => {
      const eligible = policy.approvals.filter((approval) =>
        isNutritionistEligibleForReview(approval.nutritionistProfile, now)
      );
      return eligible.length < 2 || !eligible.some((approval) => approval.nutritionistProfile.canLeadReview);
    })
    .map((policy) => policy.id);

  if (!overdueIds.length && !ineligibleManualIds.length && !invalidPolicyIds.length) {
    return { suspendedClearances: 0, suspendedPolicies: 0 };
  }

  return prisma.$transaction(async (tx) => {
    const policyDerived = invalidPolicyIds.length
      ? await tx.mealConditionClearance.findMany({
          where: { state: 'ACTIVE', rulePolicyVersionId: { in: invalidPolicyIds } },
          select: { id: true },
        })
      : [];
    const policyClearanceIds = policyDerived.map((clearance) => clearance.id);
    if (overdueIds.length) {
      await tx.mealConditionClearance.updateMany({
        where: { id: { in: overdueIds }, state: 'ACTIVE' },
        data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'AUDIT_OVERDUE' },
      });
    }
    if (ineligibleManualIds.length) {
      await tx.mealConditionClearance.updateMany({
        where: { id: { in: ineligibleManualIds }, state: 'ACTIVE' },
        data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'REVIEWER_ELIGIBILITY_LAPSED' },
      });
    }
    if (invalidPolicyIds.length) {
      await tx.conditionRulePolicyVersion.updateMany({
        where: { id: { in: invalidPolicyIds }, state: 'ACTIVE' },
        data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'APPROVER_ELIGIBILITY_LAPSED' },
      });
      for (const policy of activePolicies.filter((candidate) => invalidPolicyIds.includes(candidate.id))) {
        await Promise.all([
          tx.conditionNutrientRule.updateMany({
            where: { condition: policy.condition, policyVersion: policy.policyVersion },
            data: { active: false },
          }),
          tx.conditionIngredientRule.updateMany({
            where: { condition: policy.condition, policyVersion: policy.policyVersion },
            data: { active: false },
          }),
        ]);
      }
      if (policyClearanceIds.length) {
        await tx.mealConditionClearance.updateMany({
          where: { id: { in: policyClearanceIds }, state: 'ACTIVE' },
          data: { state: 'SUSPENDED', suspendedAt: now, suspensionReason: 'SOURCE_RULESET_SUSPENDED' },
        });
      }
    }
    const allClearanceIds = [...new Set([...overdueIds, ...ineligibleManualIds, ...policyClearanceIds])];
    if (allClearanceIds.length) {
      await tx.mealPlan.updateMany({
        where: { status: 'APPROVED', clearanceUsages: { some: { clearanceId: { in: allClearanceIds } } } },
        data: { requiresSafetyRevalidation: true },
      });
      await tx.auditEvent.createMany({
        data: allClearanceIds.map((id) => ({
          action: 'CONDITION_CLEARANCE_CIRCUIT_BREAKER',
          entityType: 'MealConditionClearance',
          entityId: id,
          metadata: { evaluatedAt: now.toISOString() },
        })),
      });
    }
    return { suspendedClearances: allClearanceIds.length, suspendedPolicies: invalidPolicyIds.length };
  });
}

export function mayAutomateCondition(condition: HealthConditionType): boolean {
  return conditionAllowsRulesetAutomation(condition);
}
