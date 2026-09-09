import assert from 'node:assert/strict';
import test from 'node:test';
import { consumptionCsvTemplate, parseFoodConsumptionCsv } from '../src/domain/food-consumption-import.policy';

test('[TEST-184] aggregate consumption CSV preserves national, regional, and province/HUC evidence', () => {
  const csv = [
    'population_group,geography_level,region_code,region_name,province_huc_code,province_huc_name,place_type,food_name,rank,percent_consuming,mean_intake_g,sample_size',
    'Adults 19-59,NATIONAL,,,,,,Rice well-milled,1,96.6,254,30475',
    'Adults 19-59,REGION,07,Central Visayas,,,URBAN,Egg chicken whole,2,31.3,15,1200',
    'Adults 19-59,PROVINCE_HUC,07,Central Visayas,0722,Cebu City,URBAN,Pandesal,3,14.6,10,400',
  ].join('\n');
  const rows = parseFoodConsumptionCsv(csv);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => ({ level: row.geographyLevel, region: row.regionName, province: row.provinceHucName })),
    [
      { level: 'NATIONAL', region: null, province: null },
      { level: 'REGION', region: 'Central Visayas', province: null },
      { level: 'PROVINCE_HUC', region: 'Central Visayas', province: 'Cebu City' },
    ]
  );
  assert.equal(rows[0].percentConsuming, 96.6);
  assert.match(rows[0].sourceRowKey, /^[0-9a-f]{32}$/);
});

test('[TEST-184] published template is accepted and source row keys are deterministic', () => {
  const first = parseFoodConsumptionCsv(consumptionCsvTemplate());
  const second = parseFoodConsumptionCsv(consumptionCsvTemplate());
  assert.equal(first.length, 1);
  assert.equal(first[0].sourceRowKey, second[0].sourceRowKey);
  assert.equal(first[0].foodNameRaw, 'Rice well-milled');
});

test('[TEST-184] import rejects misleading geography, invalid measures, and duplicate identities', () => {
  const header =
    'population_group,geography_level,region_code,region_name,province_huc_code,province_huc_name,place_type,food_name,rank,percent_consuming,mean_intake_g,sample_size\n';
  assert.throws(
    () => parseFoodConsumptionCsv(`${header}Adults,NATIONAL,07,Central Visayas,,,,Rice,1,90,200,100`),
    /national rows cannot include/
  );
  assert.throws(
    () => parseFoodConsumptionCsv(`${header}Adults,REGION,07,Central Visayas,,,,Rice,1,101,200,100`),
    /between 0 and 100/
  );
  const duplicate = 'Adults,REGION,07,Central Visayas,,,URBAN,Rice,1,90,200,100';
  assert.throws(() => parseFoodConsumptionCsv(`${header}${duplicate}\n${duplicate}`), /duplicate food\/geography/);
});

test('[TEST-184] import accepts quoted food names but rejects unknown columns and row-shape drift', () => {
  const quoted =
    'population_group,geography_level,food_name,rank,percent_consuming\nAdults,NATIONAL,"Rice, well-milled",1,96.6\n';
  assert.equal(parseFoodConsumptionCsv(quoted)[0].foodNameRaw, 'Rice, well-milled');
  assert.throws(
    () => parseFoodConsumptionCsv('population_group,geography_level,food_name,secret\nAdults,NATIONAL,Rice,no\n'),
    /Unsupported CSV header/
  );
  assert.throws(
    () => parseFoodConsumptionCsv('population_group,geography_level,food_name,rank\nAdults,NATIONAL,Rice\n'),
    /column count/
  );
});
