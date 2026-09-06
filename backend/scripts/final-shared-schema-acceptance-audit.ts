import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import { loadBillingProcessingWorkerConfig } from '../src/domain/billing-processing-worker.policy';

dotenv.config();

const EXPECTED_TARGET_FINGERPRINT = '6f48da70b1ce';
const AUTHORIZED_PENDING = [
  '20260906234500_ingredient_conversion_evidence',
  '20260906235900_compensation_admin_workflow',
] as const;
const AUTHORIZED_CHECKSUMS: Record<(typeof AUTHORIZED_PENDING)[number], string> = {
  '20260906234500_ingredient_conversion_evidence': 'cf6c15f3f6de31b9b4b7120f3fd716e846cccb0d003a5bffa7b13b5fc24af2a1',
  '20260906235900_compensation_admin_workflow': '56ab3fa1c8d631282383d5a27dc62dba9471796d58ad1c64f442b0ae8c332232',
};
const PRE_MIGRATION_COUNT = 21;
const POST_MIGRATION_COUNT = 23;
const PRE_DOMAIN_TABLE_COUNT = 64;
const POST_DOMAIN_TABLE_COUNT = 66;

const COMPENSATION_COLUMNS = [
  'CompensationPolicy.createdByAdminId',
  'CompensationPolicy.approvedByAdminId',
  'CompensationPeriod.openedByAdminId',
  'CompensationPeriod.closedByAdminId',
  'CompensationStatement.preparedByAdminId',
  'CompensationAdjustment.status',
  'CompensationAdjustment.rejectedByAdminId',
  'CompensationAdjustment.rejectedAt',
  'CompensationAdjustment.rejectionReason',
] as const;

const COMPENSATION_INDEXES = [
  'CompensationPolicy_createdByAdminId_idx',
  'CompensationPolicy_approvedByAdminId_idx',
  'CompensationPeriod_openedByAdminId_idx',
  'CompensationPeriod_closedByAdminId_idx',
  'CompensationStatement_preparedByAdminId_idx',
  'CompensationAdjustment_status_createdAt_idx',
  'CompensationAdjustment_rejectedByAdminId_idx',
  'CompensationPolicy_one_active_key',
] as const;

const COMPENSATION_CONSTRAINTS = [
  'CompensationPolicy_createdByAdminId_fkey',
  'CompensationPolicy_approvedByAdminId_fkey',
  'CompensationPeriod_openedByAdminId_fkey',
  'CompensationPeriod_closedByAdminId_fkey',
  'CompensationStatement_preparedByAdminId_fkey',
  'CompensationAdjustment_rejectedByAdminId_fkey',
  'CompensationPolicy_actor_lifecycle',
  'CompensationPeriod_actor_lifecycle',
  'CompensationStatement_actor_lifecycle',
  'CompensationStatement_maker_checker',
  'CompensationAdjustment_status_shape',
  'CompensationPayout_manual_shape',
  'CompensationPayout_actor_lifecycle',
] as const;

const COMPENSATION_TRIGGERS = [
  'NutritionistWorkCredit_append_only',
  'CompensationStatementWorkCredit_append_only',
  'CompensationPayoutEvent_append_only',
  'CompensationStatement_snapshot_guard',
] as const;

const CONVERSION_ENUMS = [
  'IngredientConversionBasis',
  'IngredientConversionKind',
  'IngredientConversionDirection',
  'IngredientConversionUnit',
  'IngredientConversionReviewStatus',
  'IngredientConversionRedistributionStatus',
] as const;

let auditStage = 'START';

class SharedSchemaAuditError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SharedSchemaAuditError';
  }
}

interface MigrationRow {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
}

interface TableSnapshot {
  rowCount: number;
  contentHash: string;
}

interface SchemaSnapshot {
  tables: Array<Record<string, unknown>>;
  columns: Array<Record<string, unknown>>;
  enums: Array<Record<string, unknown>>;
  indexes: Array<Record<string, unknown>>;
  constraints: Array<Record<string, unknown>>;
  triggers: Array<Record<string, unknown>>;
  routines: Array<Record<string, unknown>>;
}

interface AuditSnapshot {
  version: 2;
  targetFingerprint: string;
  migrationNames: string[];
  tableData: Record<string, TableSnapshot>;
  schema: SchemaSnapshot;
  schemaHashes: Record<keyof SchemaSnapshot, string>;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableHash(rows: unknown[]): string {
  return sha256(JSON.stringify(rows));
}

function fail(code: string): never {
  throw new SharedSchemaAuditError(code);
}

function canonicalMigrationHash(name: string): string {
  const bytes = execFileSync('git', ['show', `HEAD:backend/prisma/migrations/${name}/migration.sql`], {
    cwd: resolve(process.cwd(), '..'),
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return sha256(bytes);
}

function workingMigrationHash(name: string): string {
  return sha256(readFileSync(join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')));
}

function migrationTableNames(name: string): string[] {
  const sql = readFileSync(join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql'), 'utf8');
  return [...sql.matchAll(/CREATE TABLE "([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
}

function validateTarget(): { fingerprint: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail('DATABASE_URL_MISSING');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail('DATABASE_URL_INVALID');
  }
  const fingerprint = sha256(parsed.hostname.toLowerCase()).slice(0, 12);
  if (
    parsed.protocol !== 'postgresql:' ||
    !parsed.hostname.endsWith('.neon.tech') ||
    parsed.pathname.slice(1) !== 'neondb' ||
    (parsed.searchParams.get('schema') || 'public') !== 'public' ||
    parsed.searchParams.get('sslmode') !== 'require' ||
    fingerprint !== EXPECTED_TARGET_FINGERPRINT
  ) {
    fail('SHARED_DEVELOPMENT_TARGET_MISMATCH');
  }

  const paymongo = loadPaymongoConfig(process.env);
  const worker = loadBillingProcessingWorkerConfig(process.env, paymongo);
  if (paymongo.checkout.enabled || paymongo.webhook.enabled || paymongo.reconciliation.enabled || worker.enabled) {
    fail('BILLING_CAPABILITY_MUST_REMAIN_DISABLED');
  }
  return { fingerprint };
}

function validateSnapshotPath(): string {
  const raw = process.env.FINAL_SCHEMA_AUDIT_SNAPSHOT_PATH;
  if (!raw) fail('SNAPSHOT_PATH_MISSING');
  const path = resolve(raw);
  const temporaryRoot = resolve(tmpdir()).toLowerCase();
  if (!path.toLowerCase().startsWith(`${temporaryRoot}\\`)) fail('SNAPSHOT_PATH_NOT_TEMPORARY');
  return path;
}

async function collectSnapshot(
  transaction: Prisma.TransactionClient,
  targetFingerprint: string,
  migrationNames: string[],
): Promise<AuditSnapshot> {
  const tables = await transaction.$queryRaw<Array<Record<string, unknown> & { table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;
  const tableData: Record<string, TableSnapshot> = {};
  for (const { table_name: tableName } of tables) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(tableName)) fail('UNSAFE_TABLE_IDENTIFIER');
    const aggregate = await transaction.$queryRawUnsafe<Array<{ row_count: string; row_hashes: string }>>(
      `SELECT COUNT(*)::text AS row_count, COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '') AS row_hashes ` +
      `FROM (SELECT md5(to_jsonb(source_row)::text) AS row_hash FROM "public"."${tableName}" source_row) hashed_rows`,
    );
    const rowCount = Number(aggregate[0]?.row_count || '-1');
    if (!Number.isSafeInteger(rowCount) || rowCount < 0) fail('TABLE_COUNT_INVALID');
    tableData[tableName] = { rowCount, contentHash: sha256(aggregate[0]?.row_hashes || '') };
  }

  const columns = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name, column_name, ordinal_position, is_nullable, data_type, udt_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    ORDER BY table_name, ordinal_position
  `;
  const enums = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT type_name.typname AS enum_name, enum_value.enumlabel AS enum_value,
           enum_value.enumsortorder::text AS sort_order
    FROM pg_type type_name
    JOIN pg_enum enum_value ON enum_value.enumtypid = type_name.oid
    JOIN pg_namespace namespace ON namespace.oid = type_name.typnamespace
    WHERE namespace.nspname = 'public'
    ORDER BY type_name.typname, enum_value.enumsortorder
  `;
  const indexes = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name.relname AS table_name, index_name.relname AS index_name,
           pg_get_indexdef(index_name.oid) AS definition
    FROM pg_class table_name
    JOIN pg_namespace namespace ON namespace.oid = table_name.relnamespace
    JOIN pg_index index_record ON index_record.indrelid = table_name.oid
    JOIN pg_class index_name ON index_name.oid = index_record.indexrelid
    WHERE namespace.nspname = 'public' AND table_name.relname <> '_prisma_migrations'
    ORDER BY table_name.relname, index_name.relname
  `;
  const constraints = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name.relname AS table_name, constraint_record.conname AS constraint_name,
           constraint_record.contype::text AS constraint_type,
           pg_get_constraintdef(constraint_record.oid, true) AS definition,
           constraint_record.convalidated AS validated
    FROM pg_constraint constraint_record
    JOIN pg_class table_name ON table_name.oid = constraint_record.conrelid
    JOIN pg_namespace namespace ON namespace.oid = table_name.relnamespace
    WHERE namespace.nspname = 'public' AND table_name.relname <> '_prisma_migrations'
    ORDER BY table_name.relname, constraint_record.conname
  `;
  const triggers = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name.relname AS table_name, trigger_record.tgname AS trigger_name,
           pg_get_triggerdef(trigger_record.oid, true) AS definition
    FROM pg_trigger trigger_record
    JOIN pg_class table_name ON table_name.oid = trigger_record.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = table_name.relnamespace
    WHERE namespace.nspname = 'public' AND NOT trigger_record.tgisinternal
    ORDER BY table_name.relname, trigger_record.tgname
  `;
  const routines = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT routine_record.proname AS routine_name,
           pg_get_function_identity_arguments(routine_record.oid) AS arguments,
           pg_get_function_result(routine_record.oid) AS result,
           pg_get_functiondef(routine_record.oid) AS definition
    FROM pg_proc routine_record
    JOIN pg_namespace namespace ON namespace.oid = routine_record.pronamespace
    WHERE namespace.nspname = 'public'
    ORDER BY routine_record.proname, arguments
  `;
  const schema: SchemaSnapshot = { tables, columns, enums, indexes, constraints, triggers, routines };
  return {
    version: 2,
    targetFingerprint,
    migrationNames,
    tableData,
    schema,
    schemaHashes: Object.fromEntries(
      Object.entries(schema).map(([name, rows]) => [name, stableHash(rows)]),
    ) as Record<keyof SchemaSnapshot, string>,
  };
}

function names(rows: Array<Record<string, unknown>>, key: string): Set<string> {
  return new Set(rows.map((row) => String(row[key])));
}

function requireTargetObjectState(snapshot: AuditSnapshot, mode: 'preflight' | 'postflight'): void {
  const shouldExist = mode === 'postflight';
  const tableNames = new Set(Object.keys(snapshot.tableData));
  const enumNames = names(snapshot.schema.enums, 'enum_name');
  const indexNames = names(snapshot.schema.indexes, 'index_name');
  const constraintNames = names(snapshot.schema.constraints, 'constraint_name');
  const triggerNames = names(snapshot.schema.triggers, 'trigger_name');
  const columnNames = new Set(snapshot.schema.columns.map((row) => `${row.table_name}.${row.column_name}`));

  const checks: Array<[string, boolean]> = [
    ...migrationTableNames(AUTHORIZED_PENDING[0]).map((name) => [`table:${name}`, tableNames.has(name)] as [string, boolean]),
    ...CONVERSION_ENUMS.map((name) => [`enum:${name}`, enumNames.has(name)] as [string, boolean]),
    ['enum:CompensationAdjustmentStatus', enumNames.has('CompensationAdjustmentStatus')],
    ...COMPENSATION_COLUMNS.map((name) => [`column:${name}`, columnNames.has(name)] as [string, boolean]),
    ...COMPENSATION_INDEXES.map((name) => [`index:${name}`, indexNames.has(name)] as [string, boolean]),
    ...COMPENSATION_CONSTRAINTS.map((name) => [`constraint:${name}`, constraintNames.has(name)] as [string, boolean]),
    ...COMPENSATION_TRIGGERS.map((name) => [`trigger:${name}`, triggerNames.has(name)] as [string, boolean]),
  ];
  if (checks.some(([, exists]) => exists !== shouldExist)) {
    fail(shouldExist ? 'AUTHORIZED_OBJECT_MISSING' : 'PENDING_OBJECT_ALREADY_EXISTS');
  }
}

async function main(): Promise<void> {
  auditStage = 'VALIDATE_INPUT';
  const mode = process.argv[2];
  if (mode !== 'preflight' && mode !== 'postflight') fail('MODE_INVALID');
  const { fingerprint } = validateTarget();
  const snapshotPath = validateSnapshotPath();
  const migrationRoot = join(process.cwd(), 'prisma', 'migrations');
  const repositoryMigrations = readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (
    repositoryMigrations.length !== POST_MIGRATION_COUNT ||
    JSON.stringify(repositoryMigrations.slice(-2)) !== JSON.stringify([...AUTHORIZED_PENDING])
  ) {
    fail('REPOSITORY_MIGRATION_SET_UNEXPECTED');
  }
  for (const name of AUTHORIZED_PENDING) {
    if (workingMigrationHash(name) !== AUTHORIZED_CHECKSUMS[name]) fail('AUTHORIZED_MIGRATION_FILE_CHANGED');
  }

  const prisma = new PrismaClient();
  try {
    auditStage = 'READ_SHARED_DATABASE';
    const result = await prisma.$transaction(async (transaction) => {
      auditStage = 'SET_READ_ONLY';
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      auditStage = 'READ_IDENTITY';
      const identity = await transaction.$queryRaw<Array<{ database_name: string; schema_name: string }>>`
        SELECT current_database() AS database_name, current_schema() AS schema_name
      `;
      if (identity[0]?.database_name !== 'neondb') fail('DATABASE_NAME_MISMATCH');
      if (identity[0]?.schema_name !== 'public') fail('DATABASE_SCHEMA_MISMATCH');

      auditStage = 'READ_MIGRATIONS';
      const migrations = await transaction.$queryRaw<MigrationRow[]>`
        SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count
        FROM "_prisma_migrations"
        ORDER BY migration_name
      `;
      if (migrations.some((row) => !row.finished_at || row.rolled_back_at || row.applied_steps_count !== 1)) {
        fail('MIGRATION_HISTORY_NOT_CLEAN');
      }
      const completedNames = migrations.map((row) => row.migration_name);
      const pending = repositoryMigrations.filter((name) => !completedNames.includes(name));
      const expectedCount = mode === 'preflight' ? PRE_MIGRATION_COUNT : POST_MIGRATION_COUNT;
      if (
        migrations.length !== expectedCount ||
        (mode === 'preflight' && JSON.stringify(pending) !== JSON.stringify([...AUTHORIZED_PENDING])) ||
        (mode === 'postflight' && pending.length !== 0)
      ) {
        fail('MIGRATION_HISTORY_UNEXPECTED');
      }

      auditStage = 'VALIDATE_CHECKSUMS';
      for (const row of migrations) {
        if (!repositoryMigrations.includes(row.migration_name)) fail('UNKNOWN_APPLIED_MIGRATION');
        const canonical = canonicalMigrationHash(row.migration_name);
        const working = workingMigrationHash(row.migration_name);
        if (row.checksum !== canonical && row.checksum !== working) fail('MIGRATION_CHECKSUM_MISMATCH');
      }
      if (mode === 'postflight') {
        for (const name of AUTHORIZED_PENDING) {
          const row = migrations.find((candidate) => candidate.migration_name === name);
          if (row?.checksum !== AUTHORIZED_CHECKSUMS[name]) fail('AUTHORIZED_STORED_CHECKSUM_MISMATCH');
        }
      }

      auditStage = 'COLLECT_SNAPSHOT';
      const snapshot = await collectSnapshot(transaction, fingerprint, completedNames);
      const expectedTableCount = mode === 'preflight' ? PRE_DOMAIN_TABLE_COUNT : POST_DOMAIN_TABLE_COUNT;
      if (Object.keys(snapshot.tableData).length !== expectedTableCount) fail('DOMAIN_TABLE_COUNT_UNEXPECTED');

      const billingTables = [
        ...migrationTableNames('20260905180000_billing_foundation'),
        ...migrationTableNames('20260906193000_paymongo_sandbox_checkout'),
      ];
      if (billingTables.length !== 24) fail('BILLING_TABLE_INVENTORY_INVALID');
      for (const tableName of billingTables) {
        if (!snapshot.tableData[tableName] || snapshot.tableData[tableName].rowCount !== 0) {
          fail('BILLING_OR_FINANCE_TABLE_NOT_EMPTY');
        }
      }
      for (const tableName of migrationTableNames(AUTHORIZED_PENDING[0])) {
        if (mode === 'postflight' && snapshot.tableData[tableName]?.rowCount !== 0) fail('CONVERSION_TABLE_NOT_EMPTY');
      }
      requireTargetObjectState(snapshot, mode);
      return { snapshot, pending, migrations };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 180_000 });

    auditStage = 'COMPARE_OR_WRITE_SNAPSHOT';
    if (mode === 'preflight') {
      writeFileSync(snapshotPath, `${JSON.stringify(result.snapshot)}\n`, { encoding: 'utf8', flag: 'wx' });
    } else {
      const baseline = JSON.parse(readFileSync(snapshotPath, 'utf8')) as AuditSnapshot;
      if (
        baseline.version !== 2 ||
        baseline.targetFingerprint !== fingerprint ||
        baseline.migrationNames.length !== PRE_MIGRATION_COUNT ||
        Object.keys(baseline.tableData).length !== PRE_DOMAIN_TABLE_COUNT
      ) {
        fail('BASELINE_SNAPSHOT_INVALID');
      }
      for (const [tableName, before] of Object.entries(baseline.tableData)) {
        const after = result.snapshot.tableData[tableName];
        if (!after || after.rowCount !== before.rowCount || after.contentHash !== before.contentHash) {
          fail('PREEXISTING_TABLE_CHANGED');
        }
      }
    }

    auditStage = 'REPORT';
    const byteForms = result.migrations.reduce((counts, row) => {
      const form = row.checksum === canonicalMigrationHash(row.migration_name) ? 'canonical' : 'working';
      counts[form] += 1;
      return counts;
    }, { canonical: 0, working: 0 });
    const authorizedChecksums = Object.fromEntries(
      result.migrations
        .filter((row) => AUTHORIZED_PENDING.includes(row.migration_name as (typeof AUTHORIZED_PENDING)[number]))
        .map((row) => [row.migration_name, row.checksum]),
    );
    process.stdout.write(JSON.stringify({
      success: true,
      mode,
      targetFingerprint: fingerprint,
      database: 'neondb',
      schema: 'public',
      tlsRequiredByConfiguration: true,
      completedMigrations: result.migrations.length,
      pendingMigrations: result.pending,
      checksumByteForms: byteForms,
      authorizedChecksums,
      domainTables: Object.keys(result.snapshot.tableData).length,
      billingAndFinanceTablesEmpty: true,
      conversionTablesEmpty: mode === 'postflight',
      snapshotFile: basename(snapshotPath),
      snapshotHash: sha256(JSON.stringify(result.snapshot)),
      schemaHashes: result.snapshot.schemaHashes,
      preexistingTablesPreserved: mode === 'postflight',
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const code = error instanceof SharedSchemaAuditError ? error.code : 'FINAL_SHARED_SCHEMA_AUDIT_FAILED';
  const infrastructureCode = error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : error instanceof Prisma.PrismaClientInitializationError
      ? error.errorCode || 'PRISMA_INITIALIZATION_FAILED'
      : error instanceof Prisma.PrismaClientUnknownRequestError
        ? 'PRISMA_UNKNOWN_REQUEST_FAILED'
        : null;
  process.stderr.write(`${JSON.stringify({ success: false, code, stage: auditStage, infrastructureCode })}\n`);
  process.exitCode = 1;
});
