import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildIngredientConversionCoverageReport,
  loadIngredientConversionSourceReview,
} from '../src/domain/ingredient-conversion-source-review';
import { loadPsaOpenStatSnapshot } from '../src/domain/psa-openstat-price-ingestion';

const backendRoot = resolve(__dirname, '..');
const snapshotPath = resolve(backendRoot, 'data/psa-openstat/2026-09-06-cebu-city/manifest.json');
const sourceReviewPath = resolve(backendRoot, 'data/ingredient-conversion-evidence/source-review-2026-09-06.json');
const outputPath = resolve(backendRoot, 'data/ingredient-conversion-evidence/coverage-2026-09-06.json');

const snapshot = loadPsaOpenStatSnapshot(snapshotPath);
const review = loadIngredientConversionSourceReview(sourceReviewPath);
const report = buildIngredientConversionCoverageReport(snapshot, review, new Date('2026-09-06T00:00:00.000Z'));
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(
  `${JSON.stringify({ outputPath, ...report.layers, mealCoverage: report.mealCoverage }, null, 2)}\n`
);
