import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import { parseCsv } from '@/domain/psa-openstat-price-ingestion';
import {
  ENNS_FOOD_GROUPS,
  resolveEnnsPlanningGeography,
  type EnnsFoodGroupCode,
} from '@/domain/enns-food-group.policy';

const DELIVERY_DIRECTORY = path.resolve(process.cwd(), 'data/enns/2018-2019-2021-dietary-individual/source-delivery');
const DERIVED_DIRECTORY = path.resolve(process.cwd(), 'data/enns/2018-2019-2021-dietary-individual/derived');
const DATASET_FILE = path.join(DELIVERY_DIRECTORY, '2018-2019-2021 ENNS_data-set_dietary_indiv.csv');
const DICTIONARY_FILE = path.join(DELIVERY_DIRECTORY, '2018-2019-2021 ENNS_data-dictionary_dietary_indiv.csv');
const OUTPUT_FILE = path.join(DERIVED_DIRECTORY, 'enns-food-group-locality-v1.csv');
const EXPECTED_DATASET_SHA256 = '68bfb57cc5254fa773b7b864b00b07f86408a2f15ebfb4c87152ed99a9101e6e';
const EXPECTED_DICTIONARY_SHA256 = 'f9ad8da623100b1c5deb88181760b7f5552fa2f7b3220e0d8e0e0ff2937ffd4d';

type GeographyLevel = 'NATIONAL' | 'REGION' | 'PROVINCE_HUC';

interface Aggregate {
  geographyLevel: GeographyLevel;
  regionName: string | null;
  provinceHucCode: string | null;
  provinceHucName: string | null;
  foodGroupCode: EnnsFoodGroupCode;
  sourceVariable: string;
  foodName: string;
  weightSum: number;
  consumerWeightSum: number;
  weightedIntakeSum: number;
  sampleSize: number;
  years: Set<number>;
}

function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function aggregateKey(
  geographyLevel: GeographyLevel,
  regionName: string | null,
  provinceHucName: string | null,
  foodGroupCode: EnnsFoodGroupCode
): string {
  return [geographyLevel, regionName ?? '', provinceHucName ?? '', foodGroupCode].join('|');
}

function addObservation(
  aggregates: Map<string, Aggregate>,
  geography: Omit<
    Aggregate,
    | 'foodGroupCode'
    | 'sourceVariable'
    | 'foodName'
    | 'weightSum'
    | 'consumerWeightSum'
    | 'weightedIntakeSum'
    | 'sampleSize'
    | 'years'
  >,
  group: (typeof ENNS_FOOD_GROUPS)[number],
  intakeG: number,
  weight: number,
  year: number
) {
  const key = aggregateKey(geography.geographyLevel, geography.regionName, geography.provinceHucName, group.code);
  const aggregate = aggregates.get(key) ?? {
    ...geography,
    foodGroupCode: group.code,
    sourceVariable: group.sourceVariable,
    foodName: group.label,
    weightSum: 0,
    consumerWeightSum: 0,
    weightedIntakeSum: 0,
    sampleSize: 0,
    years: new Set<number>(),
  };
  aggregate.weightSum += weight;
  aggregate.weightedIntakeSum += intakeG * weight;
  if (intakeG > 0) aggregate.consumerWeightSum += weight;
  aggregate.sampleSize += 1;
  aggregate.years.add(year);
  aggregates.set(key, aggregate);
}

async function main() {
  for (const filePath of [DATASET_FILE, DICTIONARY_FILE]) {
    if (!fs.existsSync(filePath)) throw new Error(`Missing ENNS source delivery file: ${filePath}`);
  }
  const [datasetHash, dictionaryHash] = await Promise.all([sha256(DATASET_FILE), sha256(DICTIONARY_FILE)]);
  if (datasetHash !== EXPECTED_DATASET_SHA256 || dictionaryHash !== EXPECTED_DICTIONARY_SHA256) {
    throw new Error('The ENNS source delivery hash does not match the reviewed input.');
  }

  const dictionaryRows = parseCsv(fs.readFileSync(DICTIONARY_FILE, 'utf8'));
  const dictionaryHeader = dictionaryRows[0];
  const variableIndex = dictionaryHeader.indexOf('variable_name');
  const valueIndex = dictionaryHeader.indexOf('var_value');
  const labelIndex = dictionaryHeader.indexOf('value_label');
  const provinceNames = new Map(
    dictionaryRows
      .slice(1)
      .filter((row) => row[variableIndex] === 'provhuc')
      .map((row) => [row[valueIndex], row[labelIndex]] as const)
  );

  const input = fs.createReadStream(DATASET_FILE, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  const aggregates = new Map<string, Aggregate>();
  let indexes: Map<string, number> | null = null;
  let rowCount = 0;
  const representedProvinceHucs = new Set<string>();
  const omittedHistoricalDomains = new Set<string>();

  for await (const line of lines) {
    if (!indexes) {
      const header = line.replace(/^\uFEFF/, '').split(',');
      indexes = new Map(header.map((name, index) => [name, index]));
      for (const required of [
        'regcode',
        'provhuc',
        'enns_year',
        'fwgti_natl2_var',
        'fwgti_prov2',
        ...ENNS_FOOD_GROUPS.map(({ sourceVariable }) => sourceVariable),
      ]) {
        if (!indexes.has(required)) throw new Error(`Missing required ENNS column ${required}.`);
      }
      continue;
    }
    if (!line.trim()) continue;
    const values = line.split(',');
    const value = (name: string) => values[indexes!.get(name)!];
    const sourceRegionCode = value('regcode');
    const sourceProvinceHucCode = value('provhuc');
    const sourceProvinceHucName = provinceNames.get(sourceProvinceHucCode);
    if (!sourceProvinceHucName) throw new Error(`Unknown ENNS province/HUC code ${sourceProvinceHucCode}.`);
    const geography = resolveEnnsPlanningGeography(sourceProvinceHucName, sourceRegionCode);
    const year = Number(value('enns_year'));
    const nationalWeight = Number(value('fwgti_natl2_var'));
    const provincialWeight = Number(value('fwgti_prov2'));
    if (
      ![year, nationalWeight, provincialWeight].every(Number.isFinite) ||
      nationalWeight <= 0 ||
      provincialWeight <= 0
    ) {
      throw new Error(`Invalid survey year or sampling weight on data row ${rowCount + 2}.`);
    }

    for (const group of ENNS_FOOD_GROUPS) {
      const intakeG = Number(value(group.sourceVariable));
      if (!Number.isFinite(intakeG) || intakeG < 0) {
        throw new Error(`Invalid ${group.sourceVariable} on data row ${rowCount + 2}.`);
      }
      addObservation(
        aggregates,
        { geographyLevel: 'NATIONAL', regionName: null, provinceHucCode: null, provinceHucName: null },
        group,
        intakeG,
        nationalWeight,
        year
      );
      addObservation(
        aggregates,
        {
          geographyLevel: 'REGION',
          regionName: geography.regionName,
          provinceHucCode: null,
          provinceHucName: null,
        },
        group,
        intakeG,
        nationalWeight,
        year
      );
      if (geography.provinceHucName) {
        representedProvinceHucs.add(geography.provinceHucName);
        addObservation(
          aggregates,
          {
            geographyLevel: 'PROVINCE_HUC',
            regionName: geography.regionName,
            provinceHucCode: sourceProvinceHucCode,
            provinceHucName: geography.provinceHucName,
          },
          group,
          intakeG,
          provincialWeight,
          year
        );
      } else {
        omittedHistoricalDomains.add(sourceProvinceHucName);
      }
    }
    rowCount += 1;
  }

  const nationalMeanByGroup = new Map<EnnsFoodGroupCode, number>();
  for (const aggregate of aggregates.values()) {
    if (aggregate.geographyLevel === 'NATIONAL') {
      nationalMeanByGroup.set(aggregate.foodGroupCode, aggregate.weightedIntakeSum / aggregate.weightSum);
    }
  }

  const rows = [...aggregates.values()].map((aggregate) => {
    const meanIntakeG = aggregate.weightedIntakeSum / aggregate.weightSum;
    const nationalMean = nationalMeanByGroup.get(aggregate.foodGroupCode);
    if (!nationalMean || nationalMean <= 0) throw new Error(`Missing national mean for ${aggregate.foodGroupCode}.`);
    return {
      ...aggregate,
      meanIntakeG,
      percentConsuming: (aggregate.consumerWeightSum / aggregate.weightSum) * 100,
      relativeToNational: meanIntakeG / nationalMean,
      surveyYears: [...aggregate.years].sort().join('|'),
    };
  });

  const rowsByScope = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = [row.geographyLevel, row.regionName ?? '', row.provinceHucName ?? ''].join('|');
    const scopeRows = rowsByScope.get(key) ?? [];
    scopeRows.push(row);
    rowsByScope.set(key, scopeRows);
  }
  const rankedRows = [...rowsByScope.values()].flatMap((scopeRows) =>
    scopeRows
      .sort(
        (left, right) =>
          right.percentConsuming * Math.log1p(right.meanIntakeG) -
            left.percentConsuming * Math.log1p(left.meanIntakeG) ||
          left.foodGroupCode.localeCompare(right.foodGroupCode)
      )
      .map((row, index) => ({ ...row, rank: index + 1 }))
  );
  rankedRows.sort(
    (left, right) =>
      left.geographyLevel.localeCompare(right.geographyLevel) ||
      (left.regionName ?? '').localeCompare(right.regionName ?? '') ||
      (left.provinceHucName ?? '').localeCompare(right.provinceHucName ?? '') ||
      left.rank - right.rank
  );

  const header = [
    'source_row_key',
    'population_group',
    'geography_level',
    'region_name',
    'province_huc_code',
    'province_huc_name',
    'place_type',
    'food_group_code',
    'source_variable',
    'food_name',
    'rank',
    'percent_consuming',
    'mean_intake_g',
    'sample_size',
    'weighted_population',
    'relative_to_national',
    'survey_years',
  ];
  const output = [
    header.join(','),
    ...rankedRows.map((row) =>
      [
        [row.geographyLevel, row.regionName ?? 'PH', row.provinceHucName ?? '', row.foodGroupCode].join(':'),
        'All surveyed individuals',
        row.geographyLevel,
        row.regionName,
        row.provinceHucCode,
        row.provinceHucName,
        row.geographyLevel === 'PROVINCE_HUC' ? 'PROVINCE_OR_HUC' : row.geographyLevel,
        row.foodGroupCode,
        row.sourceVariable,
        row.foodName,
        row.rank,
        round(row.percentConsuming),
        round(row.meanIntakeG),
        row.sampleSize,
        round(row.weightSum, 3),
        round(row.relativeToNational),
        row.surveyYears,
      ]
        .map(csvCell)
        .join(',')
    ),
  ].join('\n');
  fs.mkdirSync(DERIVED_DIRECTORY, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${output}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        sourceRows: rowCount,
        aggregateRows: rankedRows.length,
        regionCount: new Set(rankedRows.map((row) => row.regionName).filter(Boolean)).size,
        provinceHucCount: representedProvinceHucs.size,
        omittedHistoricalDomains: [...omittedHistoricalDomains].sort(),
        outputFile: OUTPUT_FILE,
        outputSha256: await sha256(OUTPUT_FILE),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
