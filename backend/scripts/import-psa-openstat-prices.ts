import 'dotenv/config';
import { resolve } from 'node:path';
import { prisma } from '@/lib/prisma';
import {
  buildPsaCoverageReport,
  loadPsaOpenStatSnapshot,
} from '@/domain/psa-openstat-price-ingestion';
import { importPsaOpenStatSnapshot } from '@/services/psa-openstat-price-ingestion.service';

const DEFAULT_MANIFEST = resolve(
  __dirname,
  '../data/psa-openstat/2026-09-06-cebu-city/manifest.json',
);

function readArguments(argv: string[]): { apply: boolean; manifestPath: string } {
  const apply = argv.includes('--apply');
  if (apply && argv.includes('--dry-run')) throw new Error('Choose either --apply or --dry-run');
  const snapshotIndex = argv.indexOf('--snapshot');
  if (snapshotIndex >= 0 && !argv[snapshotIndex + 1]) throw new Error('--snapshot requires a manifest path');
  const unknown = argv.filter((value, index) =>
    value !== '--apply' && value !== '--dry-run' && value !== '--snapshot' && argv[index - 1] !== '--snapshot');
  if (unknown.length > 0) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
  return {
    apply,
    manifestPath: snapshotIndex >= 0 ? resolve(argv[snapshotIndex + 1]) : DEFAULT_MANIFEST,
  };
}

function assertLocalDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for --apply');
  const parsed = new URL(databaseUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('--apply is restricted to a local database until a separate shared-import gate is authorized');
  }
}

async function main(): Promise<void> {
  const args = readArguments(process.argv.slice(2));
  const snapshot = loadPsaOpenStatSnapshot(args.manifestPath);
  const summary = {
    mode: args.apply ? 'APPLY_LOCAL' : 'DRY_RUN',
    snapshotId: snapshot.manifest.snapshotId,
    retrievedAt: snapshot.manifest.retrievedAt,
    sourceCode: snapshot.manifest.source.code,
    geography: {
      externalCode: snapshot.manifest.geography.externalCode,
      displayName: snapshot.manifest.geography.displayName,
      level: snapshot.manifest.geography.level,
    },
    matrixCount: snapshot.manifest.files.length,
    commodityCount: snapshot.manifest.files.reduce((sum, file) => sum + file.commodities.length, 0),
    coverage: buildPsaCoverageReport(snapshot),
  };

  if (!args.apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  assertLocalDatabase(process.env.DATABASE_URL);
  const imported = await importPsaOpenStatSnapshot(prisma, snapshot);
  console.log(JSON.stringify({ ...summary, import: imported }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'PSA/OpenSTAT import failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
