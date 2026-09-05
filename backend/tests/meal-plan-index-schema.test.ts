import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260831090000_production_workflow_hardening/migration.sql'),
  'utf8',
);
const revalidationScript = readFileSync(
  resolve(process.cwd(), 'scripts/enqueue-legacy-plan-revalidation.ts'),
  'utf8',
);
const nutritionistService = readFileSync(
  resolve(process.cwd(), 'src/services/nutritionist.service.ts'),
  'utf8',
);

const mealPlanModel = schema.match(/model MealPlan \{[\s\S]*?\n\}/)?.[0] ?? '';

test('[TEST-098] MealPlan index declarations retain exact historical database names and column order', () => {
  assert.match(
    mealPlanModel,
    /@@index\(\[requiresSafetyRevalidation, status\], map: "MealPlan_revalidation_status_idx"\)/,
  );
  assert.match(
    mealPlanModel,
    /@@index\(\[highRiskReviewRequired, reviewApprovalCount, status\], map: "MealPlan_highRisk_review_idx"\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX "MealPlan_revalidation_status_idx" ON "MealPlan"\("requiresSafetyRevalidation", "status"\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX "MealPlan_highRisk_review_idx" ON "MealPlan"\("highRiskReviewRequired", "reviewApprovalCount", "status"\)/,
  );
});

test('[TEST-098] current query evidence distinguishes direct revalidation use from in-memory review priority', () => {
  assert.match(
    revalidationScript,
    /status: MealPlanStatus\.APPROVED,[\s\S]*?requiresSafetyRevalidation: true/,
  );
  assert.match(
    nutritionistService,
    /where: getNutritionistReviewableMealPlanWhere\(\)[\s\S]*?pendingMeals\.sort\([\s\S]*?highRiskReviewRequired[\s\S]*?reviewApprovalCount/,
  );
});
