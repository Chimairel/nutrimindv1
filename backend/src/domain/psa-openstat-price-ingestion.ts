import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { COMMON_MEAL_CATALOGUE } from '@/data/common-meal-catalogue';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const httpsUrlSchema = z.string().url().refine((value) => value.startsWith('https://'), 'HTTPS URL required');
const normalizedUnitSchema = z.enum(['MILLIGRAM', 'GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'PIECE', 'PACKAGE']);
const evidenceKindSchema = z.enum([
  'EXTERNAL_IDENTIFIER',
  'REVIEWED_EXACT_DESCRIPTION',
  'REVIEWED_EXACT_ALIAS',
  'CANDIDATE_ONLY',
  'REJECTION_NOTE',
]);

const exactMappingSchema = z.object({
  state: z.literal('EXACT'),
  foodName: z.string().trim().min(1),
  evidenceKind: z.enum(['EXTERNAL_IDENTIFIER', 'REVIEWED_EXACT_DESCRIPTION', 'REVIEWED_EXACT_ALIAS']),
  evidenceReference: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(500),
}).strict();

const ambiguousMappingSchema = z.object({
  state: z.literal('AMBIGUOUS'),
  candidateFoodNames: z.array(z.string().trim().min(1)).min(2),
  evidenceKind: z.literal('CANDIDATE_ONLY'),
  rationale: z.string().trim().min(1).max(500),
}).strict();

const unmappedMappingSchema = z.object({
  state: z.literal('UNMAPPED'),
  evidenceKind: evidenceKindSchema,
  rationale: z.string().trim().min(1).max(500),
}).strict();

const rejectedMappingSchema = z.object({
  state: z.literal('REJECTED'),
  evidenceKind: z.literal('REJECTION_NOTE'),
  rationale: z.string().trim().min(1).max(500),
}).strict();

const mappingSchema = z.discriminatedUnion('state', [
  exactMappingSchema,
  ambiguousMappingSchema,
  unmappedMappingSchema,
  rejectedMappingSchema,
]);

const commoditySchema = z.object({
  externalCode: z.string().trim().min(1).max(80),
  sourceLabel: z.string().trim().min(1).max(240),
  originalUnit: z.string().trim().min(1).max(80),
  normalizedQuantity: z.string().regex(/^\d+(?:\.\d{1,6})?$/).refine((value) => Number(value) > 0),
  normalizedUnit: normalizedUnitSchema,
  catalogueTargetName: z.string().trim().min(1),
  catalogueOccurrences: z.number().int().nonnegative(),
  mapping: mappingSchema,
}).strict();

const fileSchema = z.object({
  matrixId: z.string().regex(/^0042M4ARN\d{2}\.px$/),
  matrixTitle: z.string().trim().min(1),
  requestFile: z.string().regex(/^[A-Za-z0-9.-]+\.request\.json$/),
  requestSha256: sha256Schema,
  dataFile: z.string().regex(/^[A-Za-z0-9.-]+\.csv$/),
  dataSha256: sha256Schema,
  commodities: z.array(commoditySchema).min(1),
}).strict();

const openStatRequestSchema = z.object({
  query: z.array(z.object({
    code: z.enum(['Geolocation', 'Commodity', 'Year', 'Period']),
    selection: z.object({
      filter: z.literal('item'),
      values: z.array(z.string().min(1)).min(1),
    }).strict(),
  }).strict()).length(4),
  response: z.object({ format: z.literal('csv') }).strict(),
}).strict();

export const psaOpenStatManifestSchema = z.object({
  schemaVersion: z.literal(1),
  snapshotId: z.string().regex(/^[a-z0-9-]+$/).max(191),
  retrievedAt: z.string().datetime({ offset: true }),
  source: z.object({
    code: z.string().regex(/^[A-Z0-9_]+$/).max(80),
    agencyName: z.string().trim().min(1).max(160),
    datasetName: z.string().trim().min(1).max(240),
    homepageUrl: httpsUrlSchema,
    apiBaseUrl: httpsUrlSchema,
    termsUrl: httpsUrlSchema,
    licenseCode: z.literal('CC-BY-4.0'),
    attributionText: z.string().trim().min(1).max(300),
    updateCadence: z.literal('Monthly'),
    apiRateLimit: z.literal('10 requests per 10 seconds'),
  }).strict(),
  geography: z.object({
    scheme: z.string().trim().min(1).max(80),
    externalCode: z.string().regex(/^\d{9}$/),
    displayName: z.string().trim().min(1).max(180),
    sourceLabel: z.string().trim().min(1).max(180),
    level: z.literal('CITY'),
  }).strict(),
  catalogue: z.object({
    mealCount: z.number().int().positive(),
    ingredientRowCount: z.number().int().positive(),
    selectedTargetRowCount: z.number().int().nonnegative(),
    selectedTargetMealCount: z.number().int().nonnegative(),
    selectionNote: z.string().trim().min(1),
  }).strict(),
  files: z.array(fileSchema).min(1),
}).strict().superRefine((manifest, context) => {
  const fileNames = new Set<string>();
  const commodityKeys = new Set<string>();
  for (const file of manifest.files) {
    for (const name of [file.requestFile, file.dataFile]) {
      if (fileNames.has(name)) context.addIssue({ code: 'custom', message: `Duplicate snapshot filename: ${name}` });
      fileNames.add(name);
    }
    for (const commodity of file.commodities) {
      const key = `${file.matrixId}:${commodity.externalCode}`;
      if (commodityKeys.has(key)) context.addIssue({ code: 'custom', message: `Duplicate commodity key: ${key}` });
      commodityKeys.add(key);
    }
  }
});

export type PsaOpenStatManifest = z.infer<typeof psaOpenStatManifestSchema>;
export type PsaOpenStatFile = PsaOpenStatManifest['files'][number];
export type PsaOpenStatCommodity = PsaOpenStatFile['commodities'][number];

export type ParsedPsaCell = {
  matrixId: string;
  sourceCommodityKey: string;
  sourceLabel: string;
  geographyCode: string;
  geographyLabel: string;
  periodLabel: string;
  observedFrom: string;
  observedTo: string;
  status: 'AVAILABLE';
  amountCentavos: number;
} | {
  matrixId: string;
  sourceCommodityKey: string;
  sourceLabel: string;
  geographyCode: string;
  geographyLabel: string;
  periodLabel: string;
  observedFrom: string;
  observedTo: string;
  status: 'MISSING';
  missingMarker: '.' | '..';
};

export interface ParsedPsaFile {
  matrixId: string;
  cells: ParsedPsaCell[];
}

export interface LoadedPsaSnapshot {
  root: string;
  manifest: PsaOpenStatManifest;
  parsedFiles: ParsedPsaFile[];
  requestHashes: Record<string, string>;
  dataHashes: Record<string, string>;
}

export interface PsaCoverageReport {
  mealCount: number;
  ingredientRowCount: number;
  selectedTargetRowCount: number;
  selectedTargetRowPercent: number;
  selectedTargetMealCount: number;
  selectedTargetMealPercent: number;
  exactCatalogueIdentityRowCount: number;
  exactCatalogueIdentityRowPercent: number;
  exactCatalogueIdentityMealCount: number;
  exactCatalogueIdentityMealPercent: number;
  availableExactIdentityRowCount: number;
  availableExactIdentityRowPercent: number;
  availableExactIdentityMealCount: number;
  availableExactIdentityMealPercent: number;
  exactMappingCount: number;
  ambiguousMappingCount: number;
  availableObservationCount: number;
  missingObservationCount: number;
  availableCommodityCount: number;
  oldestAvailableObservedTo: string | null;
  latestAvailableObservedTo: string | null;
  freshnessThresholdDays: null;
  commoditiesWithoutAvailableObservations: string[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function parseCsv(content: string): string[][] {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      if (field.length > 0) throw new Error('Malformed CSV: quote inside an unquoted field');
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

function parsePeriodHeader(header: string): { label: string; from: string; to: string } {
  const match = /^(\d{4}) (January|February|March|April|May|June|July|August|September|October|November|December)$/.exec(header);
  if (!match) throw new Error(`Unsupported OpenSTAT period header: ${header}`);
  const year = Number(match[1]);
  const month = MONTHS.indexOf(match[2] as typeof MONTHS[number]);
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  return {
    label: header,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function parsePhpCentavos(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error(`Invalid PHP price cell: ${value}`);
  const pesos = BigInt(match[1]);
  const fractional = BigInt((match[2] ?? '').padEnd(2, '0'));
  const centavos = pesos * 100n + fractional;
  if (centavos <= 0n || centavos > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`PHP price cell is outside the supported positive safe-integer range: ${value}`);
  }
  return Number(centavos);
}

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function stablePriceEvidenceId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${sha256Hex(parts.join('\u001f')).slice(0, 24)}`;
}

export function parsePsaOpenStatCsv(
  content: string,
  file: PsaOpenStatFile,
  geography: PsaOpenStatManifest['geography'],
): ParsedPsaFile {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error(`${file.dataFile}: expected a header and at least one commodity row`);
  const [header, ...dataRows] = rows;
  if (header[0] !== 'Geolocation' || header[1] !== 'Commodity') {
    throw new Error(`${file.dataFile}: first columns must be Geolocation and Commodity`);
  }
  const periods = header.slice(2).map(parsePeriodHeader);
  if (periods.length === 0) throw new Error(`${file.dataFile}: no monthly observation columns`);

  const configuredByLabel = new Map(file.commodities.map((commodity) => [commodity.sourceLabel, commodity]));
  if (configuredByLabel.size !== file.commodities.length) throw new Error(`${file.dataFile}: duplicate configured commodity label`);
  const seen = new Set<string>();
  const cells: ParsedPsaCell[] = [];

  for (const row of dataRows) {
    if (row.length !== header.length) {
      throw new Error(`${file.dataFile}: row has ${row.length} columns; expected ${header.length}`);
    }
    if (row[0] !== geography.sourceLabel) {
      throw new Error(`${file.dataFile}: unexpected geography label ${row[0]}`);
    }
    const commodity = configuredByLabel.get(row[1]);
    if (!commodity) throw new Error(`${file.dataFile}: unreviewed commodity row ${row[1]}`);
    if (seen.has(row[1])) throw new Error(`${file.dataFile}: duplicate commodity row ${row[1]}`);
    seen.add(row[1]);
    const sourceCommodityKey = `${file.matrixId}:${commodity.externalCode}`;

    for (let index = 0; index < periods.length; index += 1) {
      const period = periods[index];
      const raw = row[index + 2];
      const common = {
        matrixId: file.matrixId,
        sourceCommodityKey,
        sourceLabel: commodity.sourceLabel,
        geographyCode: geography.externalCode,
        geographyLabel: geography.sourceLabel,
        periodLabel: period.label,
        observedFrom: period.from,
        observedTo: period.to,
      };
      if (raw === '.' || raw === '..') {
        cells.push({ ...common, status: 'MISSING', missingMarker: raw });
      } else {
        cells.push({ ...common, status: 'AVAILABLE', amountCentavos: parsePhpCentavos(raw) });
      }
    }
  }

  const missingRows = file.commodities.filter((commodity) => !seen.has(commodity.sourceLabel));
  if (missingRows.length > 0) {
    throw new Error(`${file.dataFile}: missing configured rows: ${missingRows.map((item) => item.sourceLabel).join(', ')}`);
  }
  return { matrixId: file.matrixId, cells };
}

export function validatePsaOpenStatRequest(
  request: unknown,
  file: PsaOpenStatFile,
  geography: PsaOpenStatManifest['geography'],
): void {
  const parsed = openStatRequestSchema.parse(request);
  const byCode = new Map(parsed.query.map((item) => [item.code, item.selection.values]));
  if (byCode.size !== 4) throw new Error(`${file.requestFile}: duplicate or missing query dimensions`);
  const geographies = byCode.get('Geolocation') ?? [];
  if (geographies.length !== 1 || geographies[0] !== geography.externalCode) {
    throw new Error(`${file.requestFile}: request must select only exact geography ${geography.externalCode}`);
  }
  const commodityCodes = byCode.get('Commodity') ?? [];
  const configuredCodes = file.commodities.map((commodity) => commodity.externalCode);
  if (new Set(commodityCodes).size !== commodityCodes.length ||
      commodityCodes.length !== configuredCodes.length ||
      configuredCodes.some((code) => !commodityCodes.includes(code))) {
    throw new Error(`${file.requestFile}: commodity selection differs from reviewed manifest`);
  }
  const years = byCode.get('Year') ?? [];
  const periods = byCode.get('Period') ?? [];
  if (years.length !== 1 || new Set(periods).size !== periods.length) {
    throw new Error(`${file.requestFile}: request must select one year and unique monthly periods`);
  }
}

export function loadPsaOpenStatSnapshot(manifestPath: string): LoadedPsaSnapshot {
  const absoluteManifestPath = resolve(manifestPath);
  const root = dirname(absoluteManifestPath);
  const manifest = psaOpenStatManifestSchema.parse(JSON.parse(readFileSync(absoluteManifestPath, 'utf8')));
  const parsedFiles: ParsedPsaFile[] = [];
  const requestHashes: Record<string, string> = {};
  const dataHashes: Record<string, string> = {};

  for (const file of manifest.files) {
    const request = readFileSync(resolve(root, file.requestFile));
    const data = readFileSync(resolve(root, file.dataFile));
    const requestHash = sha256Hex(request);
    const dataHash = sha256Hex(data);
    if (requestHash !== file.requestSha256) {
      throw new Error(`${file.requestFile}: SHA-256 mismatch; expected ${file.requestSha256}, received ${requestHash}`);
    }
    if (dataHash !== file.dataSha256) {
      throw new Error(`${file.dataFile}: SHA-256 mismatch; expected ${file.dataSha256}, received ${dataHash}`);
    }
    const requestJson: unknown = JSON.parse(request.toString('utf8'));
    validatePsaOpenStatRequest(requestJson, file, manifest.geography);
    requestHashes[file.requestFile] = requestHash;
    dataHashes[file.dataFile] = dataHash;
    parsedFiles.push(parsePsaOpenStatCsv(data.toString('utf8'), file, manifest.geography));
  }

  const catalogueRows = COMMON_MEAL_CATALOGUE.flatMap((meal) => meal.ingredients);
  const selectedNames = new Set(manifest.files.flatMap((file) => file.commodities.map((item) => item.catalogueTargetName)));
  const selectedRows = catalogueRows.filter((item) => selectedNames.has(item.foodName));
  const selectedMeals = COMMON_MEAL_CATALOGUE.filter((meal) => meal.ingredients.some((item) => selectedNames.has(item.foodName)));
  if (manifest.catalogue.mealCount !== COMMON_MEAL_CATALOGUE.length ||
      manifest.catalogue.ingredientRowCount !== catalogueRows.length ||
      manifest.catalogue.selectedTargetRowCount !== selectedRows.length ||
      manifest.catalogue.selectedTargetMealCount !== selectedMeals.length) {
    throw new Error('Manifest catalogue selection counts no longer match COMMON_MEAL_CATALOGUE');
  }

  return { root, manifest, parsedFiles, requestHashes, dataHashes };
}

function roundedPercent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round(numerator / denominator * 10_000) / 100;
}

export function buildPsaCoverageReport(snapshot: LoadedPsaSnapshot): PsaCoverageReport {
  const allCommodities = snapshot.manifest.files.flatMap((file) => file.commodities.map((commodity) => ({ file, commodity })));
  const availableKeys = new Set(snapshot.parsedFiles.flatMap((file) => file.cells)
    .filter((cell) => cell.status === 'AVAILABLE')
    .map((cell) => cell.sourceCommodityKey));
  const exactIdentityNames = new Set(allCommodities
    .filter(({ commodity }) => commodity.mapping.state === 'EXACT' && commodity.mapping.foodName === commodity.catalogueTargetName)
    .map(({ commodity }) => commodity.catalogueTargetName));
  const availableIdentityNames = new Set(allCommodities
    .filter(({ file, commodity }) => commodity.mapping.state === 'EXACT' &&
      commodity.mapping.foodName === commodity.catalogueTargetName &&
      availableKeys.has(`${file.matrixId}:${commodity.externalCode}`))
    .map(({ commodity }) => commodity.catalogueTargetName));
  const selectedNames = new Set(allCommodities.map(({ commodity }) => commodity.catalogueTargetName));
  const ingredientRows = COMMON_MEAL_CATALOGUE.flatMap((meal) => meal.ingredients);
  const countRows = (names: Set<string>) => ingredientRows.filter((item) => names.has(item.foodName)).length;
  const countMeals = (names: Set<string>) => COMMON_MEAL_CATALOGUE.filter((meal) => meal.ingredients.some((item) => names.has(item.foodName))).length;
  const selectedRows = countRows(selectedNames);
  const selectedMeals = countMeals(selectedNames);
  const exactRows = countRows(exactIdentityNames);
  const exactMeals = countMeals(exactIdentityNames);
  const availableRows = countRows(availableIdentityNames);
  const availableMeals = countMeals(availableIdentityNames);
  const cells = snapshot.parsedFiles.flatMap((file) => file.cells);
  const availableCells = cells.filter((cell) => cell.status === 'AVAILABLE');
  const availableDates = availableCells.map((cell) => cell.observedTo).sort();

  return {
    mealCount: COMMON_MEAL_CATALOGUE.length,
    ingredientRowCount: ingredientRows.length,
    selectedTargetRowCount: selectedRows,
    selectedTargetRowPercent: roundedPercent(selectedRows, ingredientRows.length),
    selectedTargetMealCount: selectedMeals,
    selectedTargetMealPercent: roundedPercent(selectedMeals, COMMON_MEAL_CATALOGUE.length),
    exactCatalogueIdentityRowCount: exactRows,
    exactCatalogueIdentityRowPercent: roundedPercent(exactRows, ingredientRows.length),
    exactCatalogueIdentityMealCount: exactMeals,
    exactCatalogueIdentityMealPercent: roundedPercent(exactMeals, COMMON_MEAL_CATALOGUE.length),
    availableExactIdentityRowCount: availableRows,
    availableExactIdentityRowPercent: roundedPercent(availableRows, ingredientRows.length),
    availableExactIdentityMealCount: availableMeals,
    availableExactIdentityMealPercent: roundedPercent(availableMeals, COMMON_MEAL_CATALOGUE.length),
    exactMappingCount: allCommodities.filter(({ commodity }) => commodity.mapping.state === 'EXACT').length,
    ambiguousMappingCount: allCommodities.filter(({ commodity }) => commodity.mapping.state === 'AMBIGUOUS').length,
    availableObservationCount: availableCells.length,
    missingObservationCount: cells.filter((cell) => cell.status === 'MISSING').length,
    availableCommodityCount: availableKeys.size,
    oldestAvailableObservedTo: availableDates[0] ?? null,
    latestAvailableObservedTo: availableDates.at(-1) ?? null,
    freshnessThresholdDays: null,
    commoditiesWithoutAvailableObservations: allCommodities
      .filter(({ file, commodity }) => !availableKeys.has(`${file.matrixId}:${commodity.externalCode}`))
      .map(({ commodity }) => commodity.sourceLabel)
      .sort(),
  };
}
