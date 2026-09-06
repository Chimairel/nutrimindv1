import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  MAX_WEIGHT_KG,
  MAX_WEIGHT_NOTE_LENGTH,
  MIN_WEIGHT_KG,
  isSupportedWeightKg,
  normalizeWeightNote,
} from '../src/policies/weight-entry.policy';
import { isNutritionistReviewConflict } from '../src/domain/nutritionist-review-http.policy';
import { sendNutritionistInvitationEmail, sendPasswordResetEmail, sendVerificationEmail } from '../src/lib/email';
import {
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  normalizePagination,
  normalizeSearch,
} from '../src/policies/pagination.policy';

test('[TEST-143][DEF-034] every weight-entry path shares finite 30-300 kg bounds', () => {
  assert.equal(MIN_WEIGHT_KG, 30);
  assert.equal(MAX_WEIGHT_KG, 300);
  for (const rejected of [NaN, -Infinity, Infinity, 0, 29.999, 300.001, '70', null]) {
    assert.equal(isSupportedWeightKg(rejected), false, String(rejected));
  }
  for (const accepted of [30, 70.5, 300]) assert.equal(isSupportedWeightKg(accepted), true);

  const checkin = require('node:fs').readFileSync('src/validation/checkin.schemas.ts', 'utf8');
  const userRoutes = require('node:fs').readFileSync('src/routes/user.routes.ts', 'utf8');
  assert.match(checkin, /\.min\(30\)\.max\(300\)/);
  assert.match(userRoutes, /min: 30, max: 300/);
});

test('[TEST-144][DEF-034] weight notes are trimmed, bounded, and services transact profile and history writes', () => {
  assert.equal(normalizeWeightNote('  steady progress  '), 'steady progress');
  assert.equal(normalizeWeightNote('   '), undefined);
  assert.throws(() => normalizeWeightNote(42), /must be text/);
  assert.throws(() => normalizeWeightNote('x'.repeat(MAX_WEIGHT_NOTE_LENGTH + 1)), /characters or fewer/);

  for (const service of ['src/services/progress.service.ts', 'src/services/weight-log.service.ts']) {
    const source = require('node:fs').readFileSync(service, 'utf8');
    assert.match(source, /prisma\.\$transaction/);
    assert.match(source, /isSupportedWeightKg/);
  }
});

test('[TEST-145][DEF-033] expected review contention and replay failures map to conflict semantics', () => {
  for (const message of [
    'Meal plan is already claimed by another nutritionist.',
    'Meal plan was already reviewed.',
    'Unable to acquire an active claim for this meal plan.',
    'Only PENDING_REVIEW plans can be approved.',
    'A different nutritionist must perform the second review.',
  ])
    assert.equal(isNutritionistReviewConflict(message), true, message);
  assert.equal(isNutritionistReviewConflict('Database connection failed.'), false);
});

test('[TEST-146] local mail capture is test-only, absolute-path-only, and avoids SMTP', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCapture = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
  const directory = await mkdtemp(path.join(tmpdir(), 'nutrimind-mail-capture-'));
  const capturePath = path.join(directory, 'messages.jsonl');
  try {
    process.env.NODE_ENV = 'test';
    process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = capturePath;
    await sendVerificationEmail('verify@example.invalid', '123456', 'Audit');
    await sendPasswordResetEmail('reset@example.invalid', 'reset-token', 'Audit');
    await sendNutritionistInvitationEmail('invite@example.invalid', 'invite-token', 'Audit');

    const messages = (await readFile(capturePath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      messages.map(({ type, to, token }) => ({ type, to, token })),
      [
        { type: 'EMAIL_VERIFICATION', to: 'verify@example.invalid', token: '123456' },
        { type: 'PASSWORD_RESET', to: 'reset@example.invalid', token: 'reset-token' },
        { type: 'NUTRITIONIST_INVITATION', to: 'invite@example.invalid', token: 'invite-token' },
      ]
    );

    process.env.NODE_ENV = 'production';
    await assert.rejects(sendVerificationEmail('blocked@example.invalid', '000000', 'Audit'), /requires NODE_ENV=test/);
    process.env.NODE_ENV = 'test';
    process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = 'relative.jsonl';
    await assert.rejects(sendVerificationEmail('blocked@example.invalid', '000000', 'Audit'), /must be absolute/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousCapture === undefined) delete process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
    else process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = previousCapture;
    await rm(directory, { recursive: true, force: true });
  }
});

test('[TEST-147][DEF-032/035] library reuse follows the catalogue and public copy does not claim budget support', () => {
  const script = require('node:fs').readFileSync('scripts/library-reuse-acceptance.ts', 'utf8');
  const landing = require('node:fs').readFileSync('../frontend/src/app/page.tsx', 'utf8');
  assert.match(script, /COMMON_MEAL_CATALOGUE\.length/);
  assert.match(script, /example\.invalid/);
  assert.doesNotMatch(script, /assert\.equal\(\s*catalogue\.length,\s*30/);
  assert.doesNotMatch(landing, /budget shapes every planning decision/i);
  assert.match(landing, /shopping routines shape every planning decision/i);
});

test('[TEST-148][DEF-036] list inputs have stable positive pagination and bounded search', () => {
  assert.deepEqual(normalizePagination(-5, -10, 20), { page: 1, limit: 20 });
  assert.deepEqual(normalizePagination('2', '50', 20), { page: 2, limit: 50 });
  assert.deepEqual(normalizePagination(1, Number.MAX_SAFE_INTEGER, 20), { page: 1, limit: MAX_PAGE_SIZE });
  assert.deepEqual(normalizePagination(Infinity, NaN, 20), { page: 1, limit: 20 });
  assert.equal(normalizeSearch('   '), undefined);
  assert.equal(normalizeSearch('  alice  '), 'alice');
  assert.equal(normalizeSearch('x'.repeat(MAX_SEARCH_LENGTH + 1))?.length, MAX_SEARCH_LENGTH);
});
