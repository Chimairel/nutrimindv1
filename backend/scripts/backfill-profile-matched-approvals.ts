import { MealCandidateProvenance, MealPlanStatus } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { mealApprovalSafetyScope } from '../src/domain/meal-approval-scope.policy';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';
import { publishProfileMatchedMealApproval } from '../src/services/meal-profile-approval-publication.service';

async function main() {
  const apply = process.argv.includes('--apply');
  const plans = await prisma.mealPlan.findMany({
    where: {
      status: MealPlanStatus.APPROVED,
      requiresSafetyRevalidation: false,
      nutritionistId: { not: null },
      highRiskReviewRequired: false,
      candidateProvenance: { not: MealCandidateProvenance.CERTIFIED_LIBRARY },
      clinicalEvidence: { none: {} },
    },
    include: {
      ingredients: true,
      user: { include: { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true } },
      cycle: { include: { snapshot: true } },
      sourceRawRecipeCandidate: { select: { sourceName: true } },
    },
    orderBy: { reviewedAt: 'asc' },
  });
  const candidates = plans.filter((plan) => {
    const profile = plan.user.userProfile;
    if (!profile || !plan.nutritionistId ||
      plan.cycle.profileAdaptationState !== 'CURRENT' ||
      plan.cycle.snapshot?.profileRevision !== profile.revision ||
      plan.cycle.snapshot?.safetyRevision !== profile.safetyRevision ||
      plan.safetyPolicyVersion !== MEAL_PLAN_SAFETY_POLICY_VERSION ||
      plan.sourceRawRecipeCandidate?.sourceName === 'USER_OBSERVED') return false;
    const safety = {
      conditions: plan.user.healthConditions.map((item) => item.condition),
      allergens: plan.user.allergies.map((item) => item.allergen),
      otherConditions: profile.otherConditions,
      otherAllergies: profile.otherAllergies,
      safetyEntries: plan.user.safetyProfileEntries,
    };
    if (!mealApprovalSafetyScope(safety).supported || !plan.ingredients.length) return false;
    const restrictions = adaptUserSafetyRestrictions({
      safetyEntries: safety.safetyEntries,
      healthConditions: safety.conditions,
      allergies: safety.allergens,
      otherConditions: safety.otherConditions,
      otherAllergies: safety.otherAllergies,
    });
    if (restrictions.conditions.some((condition) => condition !== 'NONE')) return false;
    const facts = classifyMealIngredients(plan.ingredients.map((item) => ({
      name: item.ingredientName,
      category: item.category,
    })));
    return (!restrictions.allergies.length || facts.status === 'COMPLETE') &&
      !facts.detectedAllergens.some((allergen) => restrictions.allergies.includes(allergen));
  });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', approvedPlans: plans.length, eligibleCandidates: candidates.length }));
  if (!apply) return;
  let published = 0;
  let skipped = 0;
  let failed = 0;
  for (const plan of candidates) {
    try {
      if (await publishProfileMatchedMealApproval({
        mealPlanId: plan.id,
        nutritionistProfileId: plan.nutritionistId!,
        approvedProfileRevision: plan.user.userProfile!.revision,
      })) published += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }
  console.log(JSON.stringify({ published, skipped, failed }));
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Backfill failed');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
