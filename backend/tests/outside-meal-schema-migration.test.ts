import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260908120000_outside_meal_intelligence/migration.sql', 'utf8');
const routes = readFileSync('src/routes/nutritionist.routes.ts', 'utf8');
const outsideMealModal = readFileSync('../frontend/src/features/dashboard/OutsideMealModal.tsx', 'utf8');
const dashboardSummary = readFileSync('../frontend/src/features/dashboard/DashboardSummary.tsx', 'utf8');

test('[TEST-178] outside meals preserve item provenance, revisions, review state, and AI usage', () => {
  for (const model of ['OutsideMealLogItem', 'OutsideMealItemRevision', 'OutsideMealReview', 'OutsideMealAiUsage']) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /calories\s+Float\?/);
  assert.match(schema, /includedInTotals\s+Boolean/);
  assert.match(schema, /@@unique\(\[outsideMealLogItemId, revision\]\)/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test('[TEST-179] nutritionist outside-meal decisions remain authenticated, role-scoped, claimed, and validated', () => {
  assert.match(routes, /router\.use\(authenticate\)/);
  assert.match(routes, /router\.use\(requireRole\('NUTRITIONIST'\)\)/);
  assert.match(routes, /router\.use\(requireEligibleNutritionist\)/);
  assert.match(routes, /outside-meal-reviews\/:id\/claim/);
  assert.match(routes, /outsideMealReviewBodySchema/);
});

test('[TEST-181] user UI explains comma input, sources, provisional totals, and unresolved exclusions', () => {
  assert.match(outsideMealModal, /separate each one with a comma/);
  assert.match(outsideMealModal, /Use Premium AI if unresolved/);
  assert.match(outsideMealModal, /nutrition-label or menu values/);
  assert.match(outsideMealModal, /AI estimate/);
  assert.match(outsideMealModal, /Not counted/);
  assert.doesNotMatch(outsideMealModal, /split\(['"]and['"]\)/);
  assert.match(dashboardSummary, /provisional kcal/);
  assert.match(dashboardSummary, /unresolved food excluded/);
});
