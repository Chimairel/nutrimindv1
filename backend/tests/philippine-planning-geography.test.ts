import assert from 'node:assert/strict';
import test from 'node:test';
import { PSGC_PLANNING_GEOGRAPHY, PSGC_PROVINCE_HUCS, PSGC_REGIONS } from '../src/data/philippine-planning-geography';

test('[TEST-201] bundled PSGC planning snapshot is attributed and structurally complete', () => {
  assert.equal(PSGC_PLANNING_GEOGRAPHY.sourceVersion, '2Q 2026');
  assert.match(PSGC_PLANNING_GEOGRAPHY.sourceUrl, /^https:\/\/psa\.gov\.ph\//);
  assert.equal(PSGC_REGIONS.length, 18);
  assert.equal(PSGC_PROVINCE_HUCS.length, 115);
  assert.equal(new Set(PSGC_REGIONS.map((name) => name.toLowerCase())).size, 18);
  assert.equal(
    new Set(PSGC_PROVINCE_HUCS.map((item) => `${item.regionName.toLowerCase()}:${item.name.toLowerCase()}`)).size,
    115
  );
});

test('[TEST-201] representative province/HUC mappings follow the current coarse hierarchy', () => {
  const has = (regionName: string, name: string) =>
    PSGC_PROVINCE_HUCS.some((item) => item.regionName === regionName && item.name === name);
  assert.equal(has('Central Visayas', 'Cebu'), true);
  assert.equal(has('Central Visayas', 'Cebu City'), true);
  assert.equal(has('Negros Island Region', 'Negros Occidental'), true);
  assert.equal(has('Negros Island Region', 'Bacolod'), true);
});
