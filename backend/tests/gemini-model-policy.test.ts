import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeminiGenerationConfig,
  GEMINI_MODEL_SEQUENCE,
} from '../src/domain/gemini-model.policy';

test('[TEST-150] Gemini fallback policy uses explicit current GA model IDs', () => {
  assert.deepEqual(GEMINI_MODEL_SEQUENCE, [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ]);
  assert.equal(new Set(GEMINI_MODEL_SEQUENCE).size, GEMINI_MODEL_SEQUENCE.length);
  assert.ok(GEMINI_MODEL_SEQUENCE.every((model) => !model.includes('preview')));
  assert.ok(GEMINI_MODEL_SEQUENCE.every((model) => !model.endsWith('-latest')));
});

test('[TEST-150] Gemini 3 generation config excludes deprecated sampling parameters', () => {
  const config = buildGeminiGenerationConfig();
  assert.deepEqual(config, { responseMimeType: 'application/json' });
  assert.equal('temperature' in config, false);
  assert.equal('topP' in config, false);
  assert.equal('topK' in config, false);
});
