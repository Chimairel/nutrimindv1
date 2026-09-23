import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { HealthConditionType, MealPlanStatus, PrismaClient } from '@prisma/client';
import { AdminService } from '../src/services/admin.service';
import { ConditionClearanceService } from '../src/services/condition-clearance.service';
import { NutritionistReviewService } from '../src/services/nutritionist-review.service';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';
import { createFixturePlanCycle } from './helpers/plan-cycle-fixture';

const prisma = new PrismaClient();

async function main() {
  const marker = `checkpoint3-${randomUUID()}`;
  const [admin, regular, leadOne, leadTwo, user, food] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'admin@gmail.com' } }),
    prisma.nutritionistProfile.findFirstOrThrow({ where: { user: { email: 'nutritionist@gmail.com' } } }),
    prisma.nutritionistProfile.findFirstOrThrow({ where: { user: { email: 'nutritionist.lead1@gmail.com' } } }),
    prisma.nutritionistProfile.findFirstOrThrow({ where: { user: { email: 'nutritionist.lead2@gmail.com' } } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'testuser@gmail.com' } }),
    prisma.foodItem.findFirstOrThrow({ where: { source: 'FNRI' }, orderBy: { id: 'asc' } }),
  ]);
  assert.equal(regular.canLeadReview, false);
  assert.equal(leadOne.canLeadReview, true);
  assert.equal(leadTwo.canLeadReview, true);

  const recipeSignature = createHash('sha256').update(marker).digest('hex');
  const rulesetVersion = `CHECKPOINT3_${randomUUID()}`;
  const meal = await prisma.mealLibrary.create({
    data: {
      verifiedByNutritionistId: regular.id,
      safetyReviewedByNutritionistId: regular.id,
      mealName: `Checkpoint 3 evidence fixture ${marker}`,
      description: 'Temporary acceptance fixture.',
      mealType: 'LUNCH',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      sodiumMg: 100,
      dietaryTags: ['OMNIVORE'],
      suitableConditions: [],
      allergenFree: [],
      recipeSignature,
      safetyEvidenceStatus: 'COMPLETE',
      safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
      safetyEvidenceRevision: 1,
      certifiedEvidenceRevision: 1,
      safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
      safetyReviewedAt: new Date(),
      conditionDeclarationState: 'NOT_REVIEWED',
      allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
      crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
      ingredients: {
        create: {
          position: 0,
          ingredientName: food.name,
          category: food.category,
          foodItemId: food.id,
          dataSource: 'FNRI',
          quantity: 100,
          unit: 'g',
        },
      },
    },
  });

  let clearanceId: string | null = null;
  let rulesetId: string | null = null;
  const planIds: string[] = [];
  try {
    const primary = await ConditionClearanceService.submitManualDecision({
      nutritionistProfileId: regular.id,
      mealLibraryId: meal.id,
      condition: HealthConditionType.HEART_CONDITION,
      decision: 'APPROVE',
      rationale: 'Primary fixture decision.',
      userScopeId: user.id,
    });
    clearanceId = primary.id;
    assert.equal(primary.state, 'REVIEW_DUE');

    await assert.rejects(
      () =>
        ConditionClearanceService.submitManualDecision({
          nutritionistProfileId: regular.id,
          mealLibraryId: meal.id,
          condition: HealthConditionType.HEART_CONDITION,
          decision: 'APPROVE',
          rationale: 'Self review must fail.',
          userScopeId: user.id,
        }),
      /cannot review this clearance twice/
    );

    const disagreement = await ConditionClearanceService.submitManualDecision({
      nutritionistProfileId: leadOne.id,
      mealLibraryId: meal.id,
      condition: HealthConditionType.HEART_CONDITION,
      decision: 'REJECT',
      rationale: 'Independent disagreement fixture.',
      userScopeId: user.id,
    });
    assert.equal(disagreement.state, 'DISPUTED');

    const resolved = await ConditionClearanceService.resolveDispute({
      nutritionistProfileId: leadTwo.id,
      clearanceId,
      decision: 'APPROVE',
      rationale: 'Independent Lead adjudication fixture.',
    });
    assert.equal(resolved.state, 'ACTIVE');

    await createFixturePlanCycle(prisma, { id: marker, userId: user.id });
    const exposedPlan = await prisma.mealPlan.create({
      data: {
        planGroupId: marker,
        userId: user.id,
        libraryMealId: meal.id,
        nutritionistId: leadTwo.id,
        status: MealPlanStatus.APPROVED,
        mealType: 'LUNCH',
        mealName: meal.mealName,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        scheduledDate: new Date(Date.now() + 86_400_000),
        reviewedAt: new Date(),
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        highRiskReviewRequired: true,
        reviewApprovalCount: 2,
        candidateProvenance: 'CERTIFIED_LIBRARY',
      },
    });
    planIds.push(exposedPlan.id);
    await prisma.mealPlanClearanceUsage.create({
      data: { mealPlanId: exposedPlan.id, clearanceId, condition: HealthConditionType.HEART_CONDITION },
    });

    const blindPlanGroupId = `${marker}-blind`;
    await createFixturePlanCycle(prisma, {
      id: blindPlanGroupId,
      userId: user.id,
      startDate: new Date(Date.now() + 86_400_000),
    });
    const blindPlan = await prisma.mealPlan.create({
      data: {
        planGroupId: blindPlanGroupId,
        userId: user.id,
        status: MealPlanStatus.PENDING_REVIEW,
        mealType: 'DINNER',
        mealName: `Blind second review ${marker}`,
        calories: 500,
        proteinG: 25,
        carbsG: 60,
        fatG: 18,
        scheduledDate: new Date(Date.now() + 86_400_000),
        requiresSafetyRevalidation: true,
        safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        highRiskReviewRequired: true,
        reviewApprovalCount: 1,
        firstApprovedByNutritionistId: regular.id,
        firstApprovedAt: new Date(),
        nutritionistNote: 'FIRST_REVIEW_CONCLUSION_MUST_REMAIN_BLIND',
      },
    });
    planIds.push(blindPlan.id);
    const regularQueue = await NutritionistReviewService.getReviewQueue(regular.id);
    assert.equal(
      regularQueue.some((item) => item.id === blindPlan.id),
      false
    );
    const leadQueue = await NutritionistReviewService.getReviewQueue(leadOne.id);
    const blindItem = leadQueue.find((item) => item.id === blindPlan.id);
    assert.ok(blindItem);
    assert.equal(blindItem.nutritionistNote, null);

    await AdminService.setNutritionistLeadCapability(admin.id, leadTwo.id, false);
    const [suspended, revalidation] = await Promise.all([
      prisma.mealConditionClearance.findUniqueOrThrow({ where: { id: clearanceId } }),
      prisma.mealPlan.findUniqueOrThrow({ where: { id: exposedPlan.id } }),
    ]);
    assert.equal(suspended.state, 'SUSPENDED');
    assert.equal(suspended.suspensionReason, 'REVIEWER_ELIGIBILITY_LAPSED');
    assert.equal(revalidation.requiresSafetyRevalidation, true);
    await AdminService.setNutritionistLeadCapability(admin.id, leadTwo.id, true);

    const hypertensionPolicy = await prisma.conditionRulePolicyVersion.findFirstOrThrow({
      where: { condition: HealthConditionType.HYPERTENSION, state: 'DRAFT' },
    });
    const impact = await ConditionClearanceService.generateRulesetImpact(regular.id, hypertensionPolicy.id);
    assert.equal(impact.state, 'DRAFT');
    assert.ok(impact.impactReport);

    const temporaryRuleset = await prisma.conditionRulePolicyVersion.create({
      data: {
        condition: HealthConditionType.DIABETES,
        policyVersion: rulesetVersion,
        assuranceTier: 'STANDARD',
        automationAllowed: false,
      },
    });
    rulesetId = temporaryRuleset.id;
    await prisma.conditionNutrientRule.create({
      data: {
        id: `checkpoint3-rule-${randomUUID()}`,
        condition: HealthConditionType.DIABETES,
        nutrient: 'SODIUM_MG',
        operator: 'LESS_THAN_OR_EQUAL',
        threshold: 500,
        unit: 'mg',
        basis: 'PER_SERVING',
        severity: 'FLAG',
        rationale: 'Temporary governance acceptance fixture.',
        sourceTitle: 'Acceptance fixture',
        sourceCitation: 'https://example.invalid/checkpoint3-acceptance',
        policyVersion: rulesetVersion,
      },
    });
    await ConditionClearanceService.generateRulesetImpact(regular.id, temporaryRuleset.id);
    const firstRulesetApproval = await ConditionClearanceService.approveRulesetVersion({
      nutritionistProfileId: regular.id,
      policyVersionId: temporaryRuleset.id,
      decision: 'APPROVE',
      rationale: 'Independent first governance approval fixture.',
    });
    assert.equal(firstRulesetApproval.state, 'DRAFT');
    const activatedRuleset = await ConditionClearanceService.approveRulesetVersion({
      nutritionistProfileId: leadOne.id,
      policyVersionId: temporaryRuleset.id,
      decision: 'APPROVE',
      rationale: 'Lead governance approval fixture.',
    });
    assert.equal(activatedRuleset.state, 'ACTIVE');
    assert.equal(
      await prisma.mealConditionClearance.count({ where: { rulePolicyVersionId: temporaryRuleset.id } }),
      0,
      'A non-automated diabetes ruleset must not publish condition clearances.'
    );
    const suspendedRuleset = await ConditionClearanceService.suspendRuleset(
      leadOne.id,
      temporaryRuleset.id,
      'Acceptance cleanup suspension.'
    );
    assert.equal(suspendedRuleset.policy.state, 'SUSPENDED');

    console.log(
      JSON.stringify(
        {
          pass: true,
          assuranceJourney: ['REVIEW_DUE', 'DISPUTED', 'ACTIVE', 'SUSPENDED'],
          blindSecondReview: true,
          dependencyRevalidation: true,
          rulesetImpactRemainedDraft: true,
          rulesetDualApproval: ['DRAFT', 'ACTIVE', 'SUSPENDED'],
          nonAutomatedDiabetesClearances: 0,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.mealPlanClearanceUsage.deleteMany({ where: { mealPlanId: { in: planIds } } });
    await prisma.mealPlanReviewDecision.deleteMany({ where: { mealPlanId: { in: planIds } } });
    await prisma.mealIngredient.deleteMany({ where: { mealPlanId: { in: planIds } } });
    await prisma.mealPlan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.mealPlanCycle.deleteMany({ where: { id: { in: [marker, `${marker}-blind`] } } });
    if (clearanceId) {
      await prisma.mealConditionClearanceDecision.deleteMany({ where: { clearanceId } });
      await prisma.mealConditionClearance.deleteMany({ where: { id: clearanceId } });
    }
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { entityType: 'MealConditionClearance', entityId: clearanceId ?? undefined },
          { entityType: 'MealPlan', entityId: { in: planIds } },
          { entityType: 'ConditionRulePolicyVersion', entityId: rulesetId ?? undefined },
        ],
      },
    });
    if (rulesetId) {
      await prisma.conditionRulePolicyApproval.deleteMany({ where: { policyVersionId: rulesetId } });
      await prisma.conditionNutrientRule.deleteMany({ where: { policyVersion: rulesetVersion } });
      await prisma.conditionIngredientRule.deleteMany({ where: { policyVersion: rulesetVersion } });
      await prisma.conditionRulePolicyVersion.delete({ where: { id: rulesetId } });
    }
    await prisma.mealLibrary.delete({ where: { id: meal.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
