import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260909130000_admin_reference_data_management/migration.sql'),
  'utf8'
);
const routes = readFileSync(resolve(process.cwd(), 'src/routes/admin-data.routes.ts'), 'utf8');
const adminRouter = readFileSync(resolve(process.cwd(), 'src/routes/admin.routes.ts'), 'utf8');
const fnriLookup = readFileSync(resolve(process.cwd(), 'src/lib/fnri.ts'), 'utf8');
const consumptionContext = readFileSync(
  resolve(process.cwd(), 'src/services/food-consumption-context.service.ts'),
  'utf8'
);
const mealPrompt = readFileSync(resolve(process.cwd(), 'src/domain/meal-generation-cuisine.policy.ts'), 'utf8');
const adminPage = readFileSync(resolve(process.cwd(), '../frontend/src/app/(admin)/admin/data/page.tsx'), 'utf8');
const adminOverview = readFileSync(
  resolve(process.cwd(), '../frontend/src/features/admin-data/DataWorkspaceOverview.tsx'),
  'utf8'
);
const adminUi = `${adminPage}\n${adminOverview}`;
const adminLayout = readFileSync(resolve(process.cwd(), '../frontend/src/app/(admin)/layout.tsx'), 'utf8');
const openApi = readFileSync(resolve(process.cwd(), 'src/docs/openapi.ts'), 'utf8');

test('[TEST-185] reference data foundation is additive, versioned, and geographically explicit', () => {
  for (const model of [
    'ReferenceDataSource',
    'ReferenceDataRelease',
    'ReferenceDataReleaseActivation',
    'FoodConsumptionStat',
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /enum ConsumptionGeographyLevel \{[\s\S]*?PROVINCE_HUC/);
  assert.match(migration, /ReferenceDataRelease_one_active_per_source/);
  assert.match(migration, /ReferenceDataRelease_sha256_shape/);
  assert.match(migration, /FoodConsumptionStat_geography_shape/);
  assert.match(migration, /FoodConsumptionStat_measure_ranges/);
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/im);
});

test('[TEST-185] staged consumption evidence is immutable and release activation is auditable', () => {
  assert.match(migration, /prevent_published_consumption_stat_mutation/);
  assert.match(migration, /FoodConsumptionStat_draft_only_update/);
  assert.match(schema, /ReferenceDataReleaseActivation/);
  assert.match(schema, /createdByAdminId\s+String/);
  assert.match(schema, /activatedByAdminId\s+String\?/);
});

test('[TEST-186] all data mutations live behind the existing ADMIN router boundary', () => {
  const authIndex = adminRouter.indexOf('router.use(authenticate)');
  const roleIndex = adminRouter.indexOf("router.use(requireRole('ADMIN'))");
  const dataIndex = adminRouter.indexOf("router.use('/data', adminDataRouter)");
  assert.ok(authIndex >= 0 && roleIndex > authIndex && dataIndex > roleIndex);
  assert.match(routes, /router\.post\(\s*'\/sources'/);
  assert.match(routes, /consumption-import/);
  assert.match(routes, /\/stage'/);
  assert.match(routes, /\/publish'/);
  assert.match(routes, /\/rollback'/);
  assert.match(routes, /\/food-aliases'/);
  assert.doesNotMatch(routes, /router\.delete/);
});

test('[TEST-186] runtime FNRI aliases distinguish administrator verification from legacy aliases', () => {
  assert.match(schema, /normalizedAlias\s+String\?\s+@unique/);
  assert.match(schema, /verifiedByAdminId\s+String\?/);
  assert.match(fnriLookup, /aliasMatch\.verifiedAt !== null/);
  assert.match(fnriLookup, /selectStrongFNRIMatch\(cleanName/);
});

test('[TEST-187] only mapped active aggregate evidence can influence unmatched-slot generation', () => {
  assert.match(consumptionContext, /status: 'ACTIVE'/);
  assert.match(consumptionContext, /geographyLevel: 'NATIONAL'/);
  assert.match(consumptionContext, /mappingStatus: \{ in: \['EXACT', 'MANUAL'\] \}/);
  assert.match(mealPrompt, /ACTIVE AGGREGATE FOOD-CONSUMPTION EVIDENCE/);
  assert.match(mealPrompt, /never overrides the patient profile, clinical safeguards, or calorie ranges/);
});

test('[TEST-188] admin UI exposes governed imports without adding a nutritionist approval shortcut', () => {
  assert.match(adminUi, /Nutrition data center/);
  assert.match(adminUi, /Admins govern sources, aggregate survey releases, and FNRI aliases/);
  assert.match(adminLayout, /href: '\/admin\/data'/);
  assert.match(openApi, /\/api\/admin\/data\/releases\/\{id\}\/publish/);
  assert.doesNotMatch(adminUi, /api\.(post|patch)\([^\n]*nutritionist/);
});
