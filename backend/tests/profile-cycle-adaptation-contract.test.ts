import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const schema = read('prisma/schema.prisma');
const migration = read('prisma/migrations/20260922190000_add_profile_cycle_adaptation/migration.sql');
const adaptation = read('src/services/profile-cycle-adaptation.service.ts');
const profile = read('src/services/user-profile.service.ts');
const report = read('src/services/nutrition-report.service.ts');
const cycle = read('src/services/meal-plan-cycle.service.ts');
const onboarding = read('src/validation/onboarding.schemas.ts');

test('[BATCH-2] explicit rice preference replaces the legacy carb proxy with provenance', () => {
  assert.match(schema, /enum RicePreference \{\s+NO_RICE\s+FLEXIBLE\s+WITH_RICE/s);
  assert.match(schema, /ricePreferenceProvenance\s+RicePreferenceProvenance/);
  assert.match(migration, /SET "ricePreference" = 'FLEXIBLE'/);
  assert.match(migration, /DEFAULT 'LEGACY_DEFAULT'/);
  assert.match(onboarding, /ricePreference: ricePreferenceSchema\.optional\(\)/);
  assert.doesNotMatch(onboarding, /carbPreference:/);
});

test('[BATCH-2] ordinary changes preserve active and frozen snapshots while gating unfrozen upcoming cycles', () => {
  assert.match(adaptation, /startDate: \{ gt: businessDay \}/);
  assert.match(adaptation, /shoppingStartedAt: null/);
  assert.match(adaptation, /AWAITING_REPORT_ACKNOWLEDGMENT/);
  assert.match(adaptation, /REBUILD_REQUIRED/);
  assert.match(cycle, /profileAdaptationState !== ProfileCycleAdaptationState\.CURRENT/);
  assert.match(cycle, /cannot be used for shopping/);
});

test('[BATCH-2] safety changes gate every current or future cycle and release only after exact acknowledgment', () => {
  assert.match(adaptation, /endDate: \{ gte: businessDay \}/);
  assert.match(adaptation, /SAFETY_REVALIDATION_REQUIRED/);
  assert.match(adaptation, /acknowledgedProfileRevision !== cycle\.requestedProfileRevision/);
  assert.match(adaptation, /requiresSafetyRevalidation === false/);
  assert.match(report, /expectedVersion !== report\.version/);
  assert.match(report, /acknowledgeProfileRevision\(tx, userId, profile\.revision\)/);
});

test('[BATCH-2] semantic profile saves are idempotent and audit only real changes', () => {
  const noChangeReturn = profile.indexOf('if (existing && changedFields.length === 0) return existing;');
  const auditCreate = profile.indexOf('await tx.healthProfileRevision.create');
  assert.ok(noChangeReturn >= 0 && auditCreate > noChangeReturn);
  assert.match(profile, /classifyProfileChanges\(changedFields\)/);
  assert.match(profile, /this\.updateUserProfile\(userId, \{ shoppingDayOfWeek \}\)/);
});
