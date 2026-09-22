import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260922150000_add_authoritative_plan_cycles/migration.sql'),
  'utf8'
);
const identityMigration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260922160000_tighten_live_cycle_identity/migration.sql'),
  'utf8'
);
const controller = readFileSync(resolve(process.cwd(), 'src/controllers/meals.controller.ts'), 'utf8');
const grocery = readFileSync(resolve(process.cwd(), 'src/services/grocery.service.ts'), 'utf8');
const checkin = readFileSync(resolve(process.cwd(), 'src/services/checkin.service.ts'), 'utf8');
const cycleService = readFileSync(resolve(process.cwd(), 'src/services/meal-plan-cycle.service.ts'), 'utf8');

test('[BATCH-1] schema makes the cycle root authoritative for slots, snapshots, groceries, and jobs', () => {
  assert.match(schema, /model MealPlanCycle \{/);
  assert.match(schema, /cycle\s+MealPlanCycle\s+@relation\(fields: \[planGroupId\]/);
  assert.match(schema, /planGroupId\s+String\s+@unique[\s\S]*cycle\s+MealPlanCycle/);
  assert.match(schema, /snapshot\s+MealPlanCycleSnapshot\?/);
  assert.match(schema, /generationJob\s+MealPlanGenerationJob\?/);
  assert.match(schema, /incompleteAcknowledgedAt\s+DateTime\?/);
  assert.match(schema, /shoppingStartedAt\s+DateTime\?/);
});

test('[BATCH-1] migration backfills before enforcing relational identity and fails closed on ambiguous groceries', () => {
  const insertCycle = migration.indexOf('INSERT INTO "MealPlanCycle"');
  const mapGrocery = migration.indexOf('UPDATE "GroceryList" gl');
  const requireGrocery = migration.indexOf('ALTER TABLE "GroceryList" ALTER COLUMN "planGroupId" SET NOT NULL');
  const addMealForeignKey = migration.indexOf('ADD CONSTRAINT "MealPlan_planGroupId_fkey"');
  assert.ok(insertCycle >= 0 && mapGrocery > insertCycle && requireGrocery > mapGrocery);
  assert.ok(addMealForeignKey > requireGrocery);
  assert.match(migration, /Cannot enforce GroceryList cycle identity/);
  assert.match(migration, /MealPlanCycle_one_live_identity_key/);
  assert.match(identityMigration, /GROUP BY "userId", "startDate"/);
  assert.match(identityMigration, /ON "MealPlanCycle"\("userId", "startDate"\)/);
});

test('[BATCH-1] current meal, grocery, and check-in reads no longer derive identity from the live shopping profile', () => {
  assert.match(controller, /MealPlanCycleService\.getCurrentCycle/);
  assert.doesNotMatch(controller, /getCurrentWeeklyCycleWindow|getNextWeeklyCycleWindow/);
  assert.match(grocery, /MealPlanCycleService\.getCurrentCycle/);
  assert.doesNotMatch(grocery, /getNextWeeklyCycleWindow/);
  assert.match(checkin, /MealPlanCycleService\.getCurrentCycle/);
  assert.doesNotMatch(checkin, /getCurrentWeeklyCycleWindow/);
});

test('[BATCH-1] deadline reconciliation and explicit shopping gates are centralized on the cycle root', () => {
  assert.match(cycleService, /deriveMealPlanCycleLifecycle/);
  assert.match(cycleService, /acknowledgeIncompleteCycle/);
  assert.match(cycleService, /recordShoppingStarted/);
  assert.match(controller, /acknowledgeIncompleteCycle/);
  assert.match(controller, /startShopping/);
  assert.match(grocery, /cycle\.shoppingStartedAt/);
  assert.match(grocery, /frozen shopping list/);
});
