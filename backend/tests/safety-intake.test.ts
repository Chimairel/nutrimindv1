import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPublicSafetyCatalogue,
  resolveSafetyEntries,
  splitSafetyInput,
  validateResolvedSafetyEntries,
} from '../src/domain/safety-intake.policy';
import { structuredSafetyPreviewSchema, structuredSafetySaveSchema } from '../src/validation/onboarding.schemas';
import { buildLegacySafetyProjection, SafetyIntakeService } from '../src/services/safety-intake.service';

test('structured intake splits documented separators but preserves ordinary spaces', () => {
  assert.deepEqual(
    splitSafetyInput('chronic kidney disease, gout; soy / sesame\nlactose intolerance'),
    ['chronic kidney disease', 'gout', 'soy', 'sesame', 'lactose intolerance']
  );
});

test('mixed predefined and custom values normalize approved aliases and retain provenance', () => {
  const entries = resolveSafetyEntries([
    { domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED' },
    { domain: 'CONDITION', value: 'high blood pressure', provenance: 'CUSTOM' },
    { domain: 'ALLERGY', value: 'peanuts', provenance: 'CUSTOM' },
  ]);
  assert.deepEqual(entries.map((entry) => entry.canonicalCode), ['DIABETES', 'HYPERTENSION', 'NUTS']);
  assert.equal(entries[1]?.originalText, 'high blood pressure');
  assert.equal(entries[1]?.provenance, 'CUSTOM');
});

test('approved misspelling aliases are controlled and near matches remain unmapped', () => {
  const entries = resolveSafetyEntries([
    { domain: 'CONDITION', value: 'hypertention', provenance: 'CUSTOM' },
    { domain: 'CONDITION', value: 'hypertenzion', provenance: 'CUSTOM' },
  ]);
  assert.equal(entries[0]?.canonicalCode, 'HYPERTENSION');
  assert.equal(entries[0]?.supportState, 'SUPPORTED');
  assert.equal(entries[1]?.canonicalCode, null);
  assert.equal(entries[1]?.supportState, 'PENDING_REVIEW');
});

test('duplicates merge case-insensitively after approved alias normalization', () => {
  const entries = resolveSafetyEntries([
    { domain: 'CONDITION', value: 'Hypertension, high blood pressure; HYPERTENSION', provenance: 'CUSTOM' },
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.canonicalCode, 'HYPERTENSION');
  assert.equal(entries[0]?.originalText, 'Hypertension');
});

test('condition and food catalogues cannot cross semantic domains', () => {
  const entries = resolveSafetyEntries([
    { domain: 'ALLERGY', value: 'high blood pressure', provenance: 'CUSTOM' },
    { domain: 'CONDITION', value: 'peanut', provenance: 'CUSTOM' },
  ]);
  assert.ok(entries.every((entry) => entry.canonicalCode === null));
  assert.ok(entries.every((entry) => entry.supportState === 'PENDING_REVIEW'));
});

test('invalid and vague entries cannot be saved while unsupported and unknown terms fail closed', () => {
  const entries = resolveSafetyEntries([
    { domain: 'CONDITION', value: 'asdf', provenance: 'CUSTOM' },
    { domain: 'CONDITION', value: 'heart problem', provenance: 'CUSTOM' },
    { domain: 'CONDITION', value: 'Gout', provenance: 'CUSTOM' },
    { domain: 'AVOIDED_INGREDIENT', value: 'bitter melon leaves', provenance: 'CUSTOM' },
  ]);
  assert.deepEqual(entries.map((entry) => entry.supportState), [
    'INVALID', 'NEEDS_CLARIFICATION', 'RECOGNIZED_UNSUPPORTED', 'PENDING_REVIEW',
  ]);
  assert.equal(validateResolvedSafetyEntries(entries).length, 2);
});

test('oversized, whitespace-only, and separator-only values cannot become persisted entries', () => {
  assert.equal(structuredSafetyPreviewSchema.safeParse({ entries: [{
    domain: 'ALLERGY', value: '   ', provenance: 'CUSTOM',
  }] }).success, false);
  const oversized = resolveSafetyEntries([{ domain: 'ALLERGY', value: 'x'.repeat(121), provenance: 'CUSTOM' }]);
  assert.equal(oversized[0]?.supportState, 'INVALID');
  assert.ok(validateResolvedSafetyEntries(oversized).length > 0);
  const separators = resolveSafetyEntries([{ domain: 'ALLERGY', value: ', ; /\n', provenance: 'CUSTOM' }]);
  assert.equal(separators.length, 0);
  assert.equal(SafetyIntakeService.preview([{ domain: 'ALLERGY', value: ', ; /\n', provenance: 'CUSTOM' }]).canSave, false);
});

test('NONE contradictions are rejected per domain but separate domains remain independent', () => {
  const contradiction = resolveSafetyEntries([
    { domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' },
    { domain: 'ALLERGY', value: 'EGGS', provenance: 'PREDEFINED' },
  ]);
  assert.match(validateResolvedSafetyEntries(contradiction).join(' '), /NONE/);

  const valid = resolveSafetyEntries([
    { domain: 'CONDITION', value: 'NONE', provenance: 'PREDEFINED' },
    { domain: 'ALLERGY', value: 'EGGS', provenance: 'PREDEFINED' },
  ]);
  assert.deepEqual(validateResolvedSafetyEntries(valid), []);
});

test('strict API schemas reject forged codes, status, classifications, and unconfirmed saves', () => {
  assert.equal(structuredSafetyPreviewSchema.safeParse({ entries: [{
    domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED', supportState: 'SUPPORTED',
  }] }).success, false);
  assert.equal(structuredSafetySaveSchema.safeParse({ entries: [{
    domain: 'CONDITION', value: 'FORGED_CODE', provenance: 'PREDEFINED', canonicalCode: 'DIABETES',
  }], confirmed: true }).success, false);
  assert.equal(structuredSafetySaveSchema.safeParse({ entries: [], confirmed: false }).success, false);
  const forged = resolveSafetyEntries([{ domain: 'CONDITION', value: 'FORGED_CODE', provenance: 'PREDEFINED' }]);
  assert.equal(forged[0]?.supportState, 'INVALID');
  assert.ok(validateResolvedSafetyEntries(forged).length > 0);
});

test('catalogue exposes stable evidence-bearing entries without merging condition and food catalogues', () => {
  const catalogue = getPublicSafetyCatalogue();
  assert.match(catalogue.version, /^NUTRIMIND_SAFETY_INTAKE_/);
  assert.ok(catalogue.conditions.every((entry) => entry.domains.every((domain) => domain === 'CONDITION')));
  assert.ok(catalogue.foodSafety.every((entry) => entry.domains.every((domain) => domain !== 'CONDITION')));
  assert.ok([...catalogue.conditions, ...catalogue.foodSafety].every((entry) =>
    entry.code && entry.displayName && entry.policyReference && entry.supportState
  ));
});

test('legacy projection keeps every restriction in the authoritative intersection', () => {
  const entries = resolveSafetyEntries([
    { domain: 'CONDITION', value: 'DIABETES, Gout', provenance: 'CUSTOM' },
    { domain: 'ALLERGY', value: 'eggs, soy', provenance: 'CUSTOM' },
    { domain: 'INTOLERANCE', value: 'lactose intolerance', provenance: 'CUSTOM' },
    { domain: 'AVOIDED_INGREDIENT', value: 'pork', provenance: 'CUSTOM' },
  ]);
  const legacy = buildLegacySafetyProjection(entries);
  assert.deepEqual(legacy.conditions, ['DIABETES']);
  assert.deepEqual(legacy.allergies, ['EGGS']);
  assert.match(legacy.otherConditions, /Gout/);
  assert.match(legacy.otherAllergies, /Soy/);
  assert.match(legacy.otherAllergies, /Lactose/);
  assert.match(legacy.otherAllergies, /Pork/);
});

test('resolution is deterministic and leaves its inputs unchanged', () => {
  const inputs = [{ domain: 'ALLERGY' as const, value: 'egg; EGG / eggs', provenance: 'CUSTOM' as const }];
  const before = JSON.stringify(inputs);
  assert.deepEqual(resolveSafetyEntries(inputs), resolveSafetyEntries(inputs));
  assert.equal(JSON.stringify(inputs), before);
});
