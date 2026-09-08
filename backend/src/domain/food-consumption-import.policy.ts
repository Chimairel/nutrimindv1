import { createHash } from 'node:crypto';
import { parseCsv } from '@/domain/psa-openstat-price-ingestion';
import { normalizeFoodName } from '@/domain/fnri-match.policy';

export type ConsumptionGeography = 'NATIONAL' | 'REGION' | 'PROVINCE_HUC';

export interface ParsedConsumptionRow {
  sourceRowKey: string;
  populationGroup: string;
  geographyLevel: ConsumptionGeography;
  regionCode: string | null;
  regionName: string | null;
  provinceHucCode: string | null;
  provinceHucName: string | null;
  placeType: string | null;
  foodNameRaw: string;
  rank: number | null;
  percentConsuming: number | null;
  meanIntakeG: number | null;
  sampleSize: number | null;
}

const REQUIRED_HEADERS = ['population_group', 'geography_level', 'food_name'] as const;
const OPTIONAL_HEADERS = [
  'region_code',
  'region_name',
  'province_huc_code',
  'province_huc_name',
  'place_type',
  'rank',
  'percent_consuming',
  'mean_intake_g',
  'sample_size',
] as const;

export const CONSUMPTION_IMPORT_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;
export const CONSUMPTION_IMPORT_MAX_ROWS = 1_000;

function clean(value: string | undefined, maximum: number): string | null {
  const result = value?.trim() || '';
  if (!result) return null;
  if (result.length > maximum) throw new Error(`Value exceeds the ${maximum}-character limit.`);
  return result;
}

function numberOrNull(value: string | undefined, field: string): number | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a finite number.`);
  return parsed;
}

function integerOrNull(value: string | undefined, field: string): number | null {
  const parsed = numberOrNull(value, field);
  if (parsed === null) return null;
  if (!Number.isSafeInteger(parsed)) throw new Error(`${field} must be a whole number.`);
  return parsed;
}

function geography(value: string): ConsumptionGeography {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');
  if (normalized === 'PROVINCE' || normalized === 'HUC' || normalized === 'PROVINCE_OR_HUC') {
    return 'PROVINCE_HUC';
  }
  if (normalized === 'NATIONAL' || normalized === 'REGION' || normalized === 'PROVINCE_HUC') return normalized;
  throw new Error('geography_level must be NATIONAL, REGION, or PROVINCE_HUC.');
}

function stableRowKey(row: Omit<ParsedConsumptionRow, 'sourceRowKey'>): string {
  const identity = [
    row.populationGroup,
    row.geographyLevel,
    row.regionCode,
    row.regionName,
    row.provinceHucCode,
    row.provinceHucName,
    row.placeType,
    normalizeFoodName(row.foodNameRaw),
  ]
    .map((part) => part || '')
    .join('\u001f');
  return createHash('sha256').update(identity).digest('hex').slice(0, 32);
}

function assertRow(row: Omit<ParsedConsumptionRow, 'sourceRowKey'>, rowNumber: number): void {
  const prefix = `CSV row ${rowNumber}`;
  if (!row.populationGroup) throw new Error(`${prefix}: population_group is required.`);
  if (!row.foodNameRaw) throw new Error(`${prefix}: food_name is required.`);
  if (row.rank === null && row.percentConsuming === null && row.meanIntakeG === null) {
    throw new Error(`${prefix}: provide rank, percent_consuming, or mean_intake_g.`);
  }
  if (row.rank !== null && row.rank <= 0) throw new Error(`${prefix}: rank must be greater than zero.`);
  if (row.percentConsuming !== null && (row.percentConsuming < 0 || row.percentConsuming > 100)) {
    throw new Error(`${prefix}: percent_consuming must be between 0 and 100.`);
  }
  if (row.meanIntakeG !== null && row.meanIntakeG < 0) {
    throw new Error(`${prefix}: mean_intake_g cannot be negative.`);
  }
  if (row.sampleSize !== null && row.sampleSize <= 0) {
    throw new Error(`${prefix}: sample_size must be greater than zero.`);
  }
  if (row.geographyLevel === 'NATIONAL' && (row.regionName || row.provinceHucName)) {
    throw new Error(`${prefix}: national rows cannot include a region or province/HUC.`);
  }
  if (row.geographyLevel === 'REGION' && (!row.regionName || row.provinceHucName)) {
    throw new Error(`${prefix}: regional rows require region_name and cannot include province_huc_name.`);
  }
  if (row.geographyLevel === 'PROVINCE_HUC' && (!row.regionName || !row.provinceHucName)) {
    throw new Error(`${prefix}: province/HUC rows require both region_name and province_huc_name.`);
  }
}

export function parseFoodConsumptionCsv(content: string): ParsedConsumptionRow[] {
  if (!content.trim()) throw new Error('The CSV file is empty.');
  const parsed = parseCsv(content.replace(/^\uFEFF/, ''));
  if (parsed.length < 2) throw new Error('The CSV must contain a header and at least one data row.');

  const headers = parsed[0].map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('The CSV contains duplicate headers.');
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) throw new Error(`Missing required CSV header: ${required}.`);
  }
  const allowed = new Set<string>(CONSUMPTION_IMPORT_HEADERS);
  const unknown = headers.filter((header) => !allowed.has(header));
  if (unknown.length > 0) throw new Error(`Unsupported CSV header: ${unknown[0]}.`);

  const dataRows = parsed.slice(1).filter((cells) => cells.some((cell) => cell.trim()));
  if (dataRows.length > CONSUMPTION_IMPORT_MAX_ROWS) {
    throw new Error(`A single aggregate import is limited to ${CONSUMPTION_IMPORT_MAX_ROWS} rows.`);
  }

  const seen = new Set<string>();
  return dataRows.map((cells, index) => {
    if (cells.length !== headers.length)
      throw new Error(`CSV row ${index + 2}: column count does not match the header.`);
    const value = (header: string) => cells[headers.indexOf(header)];
    const row = {
      populationGroup: clean(value('population_group'), 120) || '',
      geographyLevel: geography(value('geography_level')),
      regionCode: clean(value('region_code'), 40),
      regionName: clean(value('region_name'), 120),
      provinceHucCode: clean(value('province_huc_code'), 40),
      provinceHucName: clean(value('province_huc_name'), 160),
      placeType: clean(value('place_type'), 40)?.toUpperCase() || null,
      foodNameRaw: clean(value('food_name'), 240) || '',
      rank: integerOrNull(value('rank'), 'rank'),
      percentConsuming: numberOrNull(value('percent_consuming'), 'percent_consuming'),
      meanIntakeG: numberOrNull(value('mean_intake_g'), 'mean_intake_g'),
      sampleSize: integerOrNull(value('sample_size'), 'sample_size'),
    } satisfies Omit<ParsedConsumptionRow, 'sourceRowKey'>;
    assertRow(row, index + 2);
    const sourceRowKey = stableRowKey(row);
    if (seen.has(sourceRowKey)) throw new Error(`CSV row ${index + 2}: duplicate food/geography/population row.`);
    seen.add(sourceRowKey);
    return { ...row, sourceRowKey };
  });
}

export function consumptionCsvTemplate(): string {
  return `${CONSUMPTION_IMPORT_HEADERS.join(',')}\nAdults 19-59,NATIONAL,Rice well-milled,,,,,,1,96.6,254,30475\n`;
}
