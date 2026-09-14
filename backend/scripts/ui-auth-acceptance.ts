import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const mailDir = await mkdtemp(path.join(tmpdir(), 'nutrimind-ui-auth-'));
  process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = path.join(mailDir, 'mail.jsonl');
  const { default: app } = await import('../src/app');
  const { default: prisma } = await import('../src/lib/prisma');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const request = async (route: string, body: unknown, token?: string, method = 'POST') => {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  };
  const email = `ui-auth-${Date.now()}@example.test`;
  const oldPassword = 'LocalTestOriginal123!';
  const newPassword = 'LocalTestReplacement456!';
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Disposable UI test',
        role: 'USER',
        emailVerified: true,
        passwordHash: await bcrypt.hash(oldPassword, 4),
      },
    });
    assert.equal(
      (await request('/auth/login', { email: ` ${email.toUpperCase()} `, password: oldPassword })).status,
      200
    );
    assert.equal((await request('/auth/login', { email, password: 'WrongPassword123!' })).status, 400);
    await request('/auth/forgot-password', { email });
    const mails = (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const token = mails.at(-1).token as string;
    // Recovery is public even if a browser sends a stale access token.
    const reset = await request('/auth/reset-password', { token, password: newPassword }, 'stale-session');
    assert.equal(reset.status, 200, JSON.stringify(reset.body));
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
    assert.equal((await request('/auth/reset-password', { token, password: oldPassword })).status, 400);
    assert.equal((await request('/auth/login', { email, password: oldPassword })).status, 400);
    const signedIn = await request('/auth/login', { email, password: newPassword });
    assert.equal(signedIn.status, 200);
    const access = signedIn.body.data.accessToken as string;
    const originalPhoto = 'https://lh3.googleusercontent.com/test-photo';
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: user.id,
        access_token: originalPhoto,
      },
    });
    const customPhoto = 'https://api.dicebear.com/10.x/open-peeps/svg?seed=Custom';
    assert.equal((await request('/user/profile/avatar', { image: customPhoto }, access, 'PUT')).status, 200);
    assert.equal((await prisma.account.findFirstOrThrow({ where: { userId: user.id } })).access_token, originalPhoto);
    const restored = await request('/user/profile/avatar', { image: 'Default' }, access, 'PUT');
    assert.equal(restored.body.data.image, originalPhoto);
    for (const preference of ['NATIONAL_REGIONAL', 'REGIONAL_LOCAL'] as const) {
      const saved = await request(
        '/user/onboarding/profile',
        {
          planningGeographyLevel: 'PROVINCE_HUC',
          planningRegionName: 'Central Visayas',
          planningProvinceHucName: 'Cebu City',
          mealLocalityPreference: preference,
        },
        access
      );
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.equal(
        (await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } })).mealLocalityPreference,
        preference
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: '2026-08-27',
        acceptedPrivacyVersion: '2026-08-27',
      },
    });
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.nutritionReport.create({
      data: {
        userId: user.id,
        profileRevision: profile.revision,
        acknowledgedAt: new Date(),
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        generalSummary: 'Synthetic report',
        basedOnConditions: [],
        basedOnAllergies: [],
      },
    });
    const log = await prisma.mealLog.create({
      data: {
        userId: user.id,
        source: 'USER_LOGGED',
        mealName: 'Synthetic skipped lunch',
        status: 'SKIPPED',
        calories: 500,
        proteinG: 20,
        carbsG: 50,
        fatG: 15,
        dataSource: 'USER_REPORTED',
        mealType: 'LUNCH',
      },
    });
    const notes = await request(
      `/user/meals/logs/${log.id}/notes`,
      { notes: 'Skipped while travelling' },
      access,
      'PATCH'
    );
    assert.equal(notes.status, 200, JSON.stringify(notes.body));
    assert.equal(notes.body.data.notes, 'Skipped while travelling');
    assert.equal(
      (await request(`/user/meals/logs/${log.id}/notes`, { notes: 'a'.repeat(1001) }, access, 'PATCH')).status,
      400
    );
    const other = await prisma.user.create({
      data: { email: `other-${email}`, name: 'Other fixture', passwordHash: user.passwordHash },
    });
    const otherLog = await prisma.mealLog.create({
      data: {
        userId: other.id,
        source: 'USER_LOGGED',
        mealName: 'Private log',
        status: 'DONE',
        calories: 100,
        proteinG: 1,
        carbsG: 20,
        fatG: 1,
        dataSource: 'USER_REPORTED',
      },
    });
    assert.equal(
      (await request(`/user/meals/logs/${otherLog.id}/notes`, { notes: 'Not allowed' }, access, 'PATCH')).status,
      404
    );
    // A token that expires during password hashing must not be consumed.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: await bcrypt.hash('expired', 4), passwordResetExpiry: new Date(Date.now() - 1000) },
    });
    assert.equal((await request('/auth/reset-password', { token: 'expired', password: oldPassword })).status, 400);
    console.log(
      'PASS: normalized login, wrong credentials, public password recovery with stale session, one-use reset, session revocation, new-password login, expiry, custom avatar and Google-photo restoration, both saved locality blends, skipped notes, note length and ownership guards. No real email sent.'
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('UI auth acceptance failed.');
  process.exitCode = 1;
});
