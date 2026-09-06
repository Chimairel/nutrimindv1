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
  '20260906193000_paymongo_sandbox_checkout',
  '20260906230000_paymongo_payment_projection',
] as const;
let auditStage = 'START';

class SharedBillingAuditError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SharedBillingAuditError';
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

interface AuditSnapshot {
  version: 1;
  targetFingerprint: string;
  migrationNames: string[];
  tables: Record<string, TableSnapshot>;
  schema: {
    tableNames: string[];
    columnsHash: string;
    enumsHash: string;
    indexesHash: string;
    constraintsHash: string;
  };
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code: string): never {
  throw new SharedBillingAuditError(code);
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

function validateTarget(): { url: string; fingerprint: string } {
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
  return { url: raw, fingerprint };
}

function validateSnapshotPath(): string {
  const raw = process.env.BILLING_AUDIT_SNAPSHOT_PATH;
  if (!raw) fail('SNAPSHOT_PATH_MISSING');
  const path = resolve(raw);
  const temporaryRoot = resolve(tmpdir()).toLowerCase();
  if (!path.toLowerCase().startsWith(`${temporaryRoot}\\`)) fail('SNAPSHOT_PATH_NOT_TEMPORARY');
  return path;
}

function stableHash(rows: unknown[]): string {
  return sha256(JSON.stringify(rows));
}

async function collectSnapshot(
  transaction: Prisma.TransactionClient,
  targetFingerprint: string,
  migrationNames: string[]
): Promise<AuditSnapshot> {
  const tables = await transaction.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;
  const tableSnapshots: Record<string, TableSnapshot> = {};
  for (const { table_name: tableName } of tables) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(tableName)) fail('UNSAFE_TABLE_IDENTIFIER');
    const aggregate = await transaction.$queryRawUnsafe<Array<{ row_count: string; row_hashes: string }>>(
      `SELECT COUNT(*)::text AS row_count, COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '') AS row_hashes ` +
        `FROM (SELECT md5(to_jsonb(source_row)::text) AS row_hash FROM "public"."${tableName}" source_row) hashed_rows`
    );
    const rowCount = Number(aggregate[0]?.row_count || '-1');
    if (!Number.isSafeInteger(rowCount) || rowCount < 0) fail('TABLE_COUNT_INVALID');
    tableSnapshots[tableName] = { rowCount, contentHash: sha256(aggregate[0]?.row_hashes || '') };
  }

  const columns = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name, column_name, ordinal_position, is_nullable, data_type, udt_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
    ORDER BY table_name, ordinal_position
  `;
  const enums = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT type_name.typname AS enum_name, enum_value.enumlabel AS enum_value, enum_value.enumsortorder::text AS sort_order
    FROM pg_type type_name
    JOIN pg_enum enum_value ON enum_value.enumtypid = type_name.oid
    JOIN pg_namespace namespace ON namespace.oid = type_name.typnamespace
    WHERE namespace.nspname = 'public'
    ORDER BY type_name.typname, enum_value.enumsortorder
  `;
  const indexes = await transaction.$queryRaw<Array<Record<string, unknown>>>`
    SELECT table_name.relname AS table_name, index_name.relname AS index_name, pg_get_indexdef(index_name.oid) AS definition
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
  return {
    version: 1,
    targetFingerprint,
    migrationNames,
    tables: tableSnapshots,
    schema: {
      tableNames: tables.map((row) => row.table_name),
      columnsHash: stableHash(columns),
      enumsHash: stableHash(enums),
      indexesHash: stableHash(indexes),
      constraintsHash: stableHash(constraints),
    },
  };
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
  if (repositoryMigrations.length !== 21 || !AUTHORIZED_PENDING.every((name) => repositoryMigrations.includes(name))) {
    fail('REPOSITORY_MIGRATION_SET_UNEXPECTED');
  }

  const prisma = new PrismaClient();
  try {
    auditStage = 'READ_SHARED_DATABASE';
    const result = await prisma.$transaction(
      async (transaction) => {
        auditStage = 'SET_READ_ONLY';
        await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        auditStage = 'READ_IDENTITY';
        const identity = await transaction.$queryRaw<
          Array<{
            database_name: string;
            schema_name: string;
          }>
        >`
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
        const expectedCount = mode === 'preflight' ? 19 : 21;
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

        auditStage = 'COLLECT_SNAPSHOT';
        const snapshot = await collectSnapshot(transaction, fingerprint, completedNames);
        const foundationTables = migrationTableNames('20260905180000_billing_foundation');
        const checkoutTables = migrationTableNames(AUTHORIZED_PENDING[0]);
        if (foundationTables.length !== 22 || checkoutTables.length !== 2) fail('BILLING_TABLE_INVENTORY_INVALID');
        const expectedBillingTables =
          mode === 'preflight' ? foundationTables : [...foundationTables, ...checkoutTables];
        for (const tableName of expectedBillingTables) {
          if (!snapshot.tables[tableName] || snapshot.tables[tableName].rowCount !== 0) {
            fail('BILLING_TABLE_NOT_EMPTY');
          }
        }
        for (const tableName of checkoutTables) {
          if (mode === 'preflight' && snapshot.tables[tableName]) fail('PENDING_TABLE_ALREADY_EXISTS');
        }
        return { snapshot, pending, migrations };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 }
    );

    auditStage = 'COMPARE_OR_WRITE_SNAPSHOT';
    if (mode === 'postflight') {
      const baseline = JSON.parse(readFileSync(snapshotPath, 'utf8')) as AuditSnapshot;
      if (
        baseline.version !== 1 ||
        baseline.targetFingerprint !== fingerprint ||
        baseline.migrationNames.length !== 19
      ) {
        fail('BASELINE_SNAPSHOT_INVALID');
      }
      for (const [tableName, before] of Object.entries(baseline.tables)) {
        const after = result.snapshot.tables[tableName];
        if (!after || after.rowCount !== before.rowCount || after.contentHash !== before.contentHash) {
          fail('PREEXISTING_TABLE_CHANGED');
        }
      }
    } else {
      writeFileSync(snapshotPath, `${JSON.stringify(result.snapshot)}\n`, { encoding: 'utf8', flag: 'wx' });
    }

    auditStage = 'REPORT';
    const byteForms = result.migrations.reduce(
      (counts, row) => {
        const form = row.checksum === canonicalMigrationHash(row.migration_name) ? 'canonical' : 'working';
        counts[form] += 1;
        return counts;
      },
      { canonical: 0, working: 0 }
    );
    const authorizedChecksums = Object.fromEntries(
      result.migrations
        .filter((row) => AUTHORIZED_PENDING.includes(row.migration_name as (typeof AUTHORIZED_PENDING)[number]))
        .map((row) => [row.migration_name, row.checksum])
    );
    process.stdout.write(
      JSON.stringify({
        success: true,
        mode,
        targetFingerprint: fingerprint,
        tlsRequiredByConfiguration: true,
        completedMigrations: result.migrations.length,
        pendingMigrations: result.pending,
        checksumByteForms: byteForms,
        authorizedChecksums,
        domainTables: Object.keys(result.snapshot.tables).length,
        billingTablesEmpty: true,
        snapshotFile: basename(snapshotPath),
        snapshotHash: sha256(JSON.stringify(result.snapshot)),
        preexistingTablesPreserved: mode === 'postflight',
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const code = error instanceof SharedBillingAuditError ? error.code : 'SHARED_BILLING_AUDIT_FAILED';
  const infrastructureCode =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : error instanceof Prisma.PrismaClientInitializationError
        ? error.errorCode || 'PRISMA_INITIALIZATION_FAILED'
        : error instanceof Prisma.PrismaClientUnknownRequestError
          ? 'PRISMA_UNKNOWN_REQUEST_FAILED'
          : null;
  process.stderr.write(`${JSON.stringify({ success: false, code, stage: auditStage, infrastructureCode })}\n`);
  process.exitCode = 1;
});
