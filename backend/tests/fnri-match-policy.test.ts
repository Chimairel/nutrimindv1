import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFoodName,
  scoreStrongFNRIMatch,
  selectStrongFNRIMatch,
} from '../src/domain/fnri-match.policy';

test('[TEST-053] punctuation-only differences retain a strong FNRI match', () => {
  assert.equal(normalizeFoodName('Chicken, breast (raw)'), 'chicken breast raw');
  assert.ok(scoreStrongFNRIMatch('chicken breast', 'Chicken, breast, raw'));
});

test('[TEST-054] generic ingredients reject processed and specialty substring collisions', () => {
  assert.equal(scoreStrongFNRIMatch('chicken', 'Puffs, chicken flvr'), null);
  assert.equal(scoreStrongFNRIMatch('egg', 'Cracker, egg'), null);
  assert.equal(scoreStrongFNRIMatch('beef', 'Beef blood'), null);
});

test('[TEST-055] the strongest safe candidate wins deterministically', () => {
  const candidates = [
    { name: 'Chicken, meat, whole, raw', id: 'whole' },
    { name: 'Puffs, chicken flvr', id: 'puffs' },
    { name: 'Chicken, breast, raw', id: 'breast' },
  ];

  assert.equal(selectStrongFNRIMatch('chicken breast', candidates)?.id, 'breast');
  assert.equal(selectStrongFNRIMatch('chicken', candidates)?.id, 'whole');
});
