import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  buildPsaCoverageReport,
  loadPsaOpenStatSnapshot,
  parsePhpCentavos,
  parsePsaOpenStatCsv,
  stablePriceEvidenceId,
  validatePsaOpenStatRequest,
} from '../src/domain/psa-openstat-price-ingestion';

const snapshotRoot = resolve(process.cwd(), 'data/psa-openstat/2026-09-06-cebu-city');
const snapshot = loadPsaOpenStatSnapshot(resolve(snapshotRoot, 'manifest.json'));

test('[TEST-099] committed PSA snapshot has verified checksums, attribution, and exact Cebu City scope', () => {
  assert.equal(snapshot.manifest.source.licenseCode, 'CC-BY-4.0');
  assert.equal(snapshot.manifest.source.agencyName, 'Philippine Statistics Authority (PSA)');
  assert.equal(snapshot.manifest.geography.externalCode, '072217000');
  assert.equal(snapshot.manifest.geography.displayName, 'City of Cebu');
  assert.equal(snapshot.manifest.geography.level, 'CITY');
  assert.equal(snapshot.manifest.files.length, 6);
  assert.equal(snapshot.manifest.files.flatMap((file) => file.commodities).length, 8);
  assert.equal(Object.keys(snapshot.requestHashes).length, 6);
  assert.equal(Object.keys(snapshot.dataHashes).length, 6);
});

test('[TEST-099] parser preserves official values as integer PHP centavos and missing markers', () => {
  const cells = snapshot.parsedFiles.flatMap((file) => file.cells);
  const riceJanuary = cells.find((cell) =>
    cell.sourceLabel === 'RICE, WELL-MILLED, 1 KG' && cell.periodLabel === '2026 January');
  assert.deepEqual(riceJanuary, {
    matrixId: '0042M4ARN01.px',
    sourceCommodityKey: '0042M4ARN01.px:0',
    sourceLabel: 'RICE, WELL-MILLED, 1 KG',
    geographyCode: '072217000',
    geographyLabel: '....City of Cebu',
    periodLabel: '2026 January',
    observedFrom: '2026-01-01',
    observedTo: '2026-01-31',
    status: 'AVAILABLE',
    amountCentavos: 5933,
  });
  const missing = cells.find((cell) =>
    cell.sourceLabel === 'MONGGO, GREEN, 1 KG' && cell.periodLabel === '2026 January');
  assert.equal(missing?.status, 'MISSING');
  if (missing?.status === 'MISSING') assert.equal(missing.missingMarker, '..');
  assert.equal(cells.filter((cell) => cell.status === 'AVAILABLE').length, 40);
  assert.equal(cells.filter((cell) => cell.status === 'MISSING').length, 24);
});

test('[TEST-099] decimal parser avoids binary-money rounding and rejects unsafe values', () => {
  assert.equal(parsePhpCentavos('1'), 100);
  assert.equal(parsePhpCentavos('1.2'), 120);
  assert.equal(parsePhpCentavos('152.38'), 15_238);
  assert.throws(() => parsePhpCentavos('0'), /positive safe-integer range/);
  assert.throws(() => parsePhpCentavos('1.234'), /Invalid PHP price cell/);
  assert.throws(() => parsePhpCentavos('1,234.50'), /Invalid PHP price cell/);
  assert.throws(() => parsePhpCentavos('-1.00'), /Invalid PHP price cell/);
});

test('[TEST-099] parser refuses geography substitution, unreviewed commodities, and malformed missing cells', () => {
  const file = snapshot.manifest.files.find((candidate) => candidate.matrixId === '0042M4ARN01.px');
  assert.ok(file);
  const header = '"Geolocation","Commodity","2026 August"\r\n';
  assert.throws(
    () => parsePsaOpenStatCsv(`${header}"....Cebu","RICE, WELL-MILLED, 1 KG",64.12\r\n`, file, snapshot.manifest.geography),
    /unexpected geography label/,
  );
  assert.throws(
    () => parsePsaOpenStatCsv(`${header}"....City of Cebu","RICE, SPECIAL, 1 KG",64.12\r\n`, file, snapshot.manifest.geography),
    /unreviewed commodity row/,
  );
  assert.throws(
    () => parsePsaOpenStatCsv(`${header}"....City of Cebu","RICE, WELL-MILLED, 1 KG",\r\n`, file, snapshot.manifest.geography),
    /Invalid PHP price cell/,
  );
});

test('[TEST-099] parser rejects file-shape drift and duplicate commodity rows', () => {
  const file = snapshot.manifest.files.find((candidate) => candidate.matrixId === '0042M4ARN01.px');
  assert.ok(file);
  const validRow = '"....City of Cebu","RICE, WELL-MILLED, 1 KG",64.12';
  assert.throws(
    () => parsePsaOpenStatCsv(`"Location","Commodity","2026 August"\r\n${validRow}\r\n`, file, snapshot.manifest.geography),
    /first columns must be Geolocation and Commodity/,
  );
  assert.throws(
    () => parsePsaOpenStatCsv(`"Geolocation","Commodity","2026 August"\r\n${validRow}\r\n${validRow}\r\n`, file, snapshot.manifest.geography),
    /duplicate commodity row/,
  );
  assert.throws(
    () => parsePsaOpenStatCsv(`"Geolocation","Commodity","2026 Annual"\r\n${validRow}\r\n`, file, snapshot.manifest.geography),
    /Unsupported OpenSTAT period header/,
  );
});

test('[TEST-099] request validation binds exact geography and reviewed commodity codes', () => {
  const file = snapshot.manifest.files.find((candidate) => candidate.matrixId === '0042M4ARN02.px');
  assert.ok(file);
  const request = JSON.parse(readFileSync(resolve(snapshotRoot, file.requestFile), 'utf8'));
  assert.doesNotThrow(() => validatePsaOpenStatRequest(request, file, snapshot.manifest.geography));
  const regionalRequest = structuredClone(request);
  regionalRequest.query.find((item: { code: string }) => item.code === 'Geolocation').selection.values = ['070000000'];
  assert.throws(
    () => validatePsaOpenStatRequest(regionalRequest, file, snapshot.manifest.geography),
    /request must select only exact geography/,
  );
  const extraCommodityRequest = structuredClone(request);
  extraCommodityRequest.query.find((item: { code: string }) => item.code === 'Commodity').selection.values.push('4');
  assert.throws(
    () => validatePsaOpenStatRequest(extraCommodityRequest, file, snapshot.manifest.geography),
    /commodity selection differs from reviewed manifest/,
  );
});

test('[TEST-099] coverage keeps selection, exact identity, and actually available price cells separate', () => {
  const coverage = buildPsaCoverageReport(snapshot);
  assert.deepEqual(coverage, {
    mealCount: 51,
    ingredientRowCount: 195,
    selectedTargetRowCount: 93,
    selectedTargetRowPercent: 47.69,
    selectedTargetMealCount: 44,
    selectedTargetMealPercent: 86.27,
    exactCatalogueIdentityRowCount: 49,
    exactCatalogueIdentityRowPercent: 25.13,
    exactCatalogueIdentityMealCount: 37,
    exactCatalogueIdentityMealPercent: 72.55,
    availableExactIdentityRowCount: 43,
    availableExactIdentityRowPercent: 22.05,
    availableExactIdentityMealCount: 35,
    availableExactIdentityMealPercent: 68.63,
    exactMappingCount: 7,
    ambiguousMappingCount: 1,
    availableObservationCount: 40,
    missingObservationCount: 24,
    availableCommodityCount: 5,
    oldestAvailableObservedTo: '2026-01-31',
    latestAvailableObservedTo: '2026-08-31',
    freshnessThresholdDays: null,
    commoditiesWithoutAvailableObservations: [
      'FRESH CHICKEN, BREAST, 1 KG',
      'FRESH FISH, TILAPIA, MEDIUM, 1 KG',
      'MONGGO, GREEN, 1 KG',
    ],
  });
});

test('[TEST-099] munggo remains ambiguous while reviewed exact mappings carry evidence', () => {
  const commodities = snapshot.manifest.files.flatMap((file) => file.commodities);
  const munggo = commodities.find((commodity) => commodity.sourceLabel === 'MONGGO, GREEN, 1 KG');
  assert.equal(munggo?.mapping.state, 'AMBIGUOUS');
  if (munggo?.mapping.state === 'AMBIGUOUS') {
    assert.deepEqual(munggo.mapping.candidateFoodNames, [
      'Mung bean seed, green, dried',
      'Mung bean seed, fresh',
    ]);
  }
  for (const commodity of commodities.filter((item) => item.mapping.state === 'EXACT')) {
    assert.equal(commodity.mapping.state, 'EXACT');
    assert.ok(commodity.mapping.evidenceReference.length > 0);
    assert.ok(commodity.mapping.foodName.length > 0);
  }
});

test('[TEST-099] evidence IDs are deterministic and domain-separated', () => {
  const first = stablePriceEvidenceId('price_observation', 'publication', 'row');
  assert.equal(first, stablePriceEvidenceId('price_observation', 'publication', 'row'));
  assert.notEqual(first, stablePriceEvidenceId('price_mapping', 'publication', 'row'));
  assert.match(first, /^price_observation_[0-9a-f]{24}$/);
});

test('[TEST-099] snapshot CSV bytes remain the exact committed source response', () => {
  const csv = readFileSync(resolve(snapshotRoot, '0042M4ARN05.px.csv'), 'utf8');
  assert.match(csv, /"\.\.\.\.City of Cebu","CUCUMBER \(PIPINO\), 1 KG",68\.33/);
  assert.match(csv, /"\.\.\.\.City of Cebu","TOMATO, 1 KG",151\.75/);
});
