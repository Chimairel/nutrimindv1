import assert from 'node:assert/strict';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const { default: app } = await import('../src/app');
  const { default: prisma } = await import('../src/lib/prisma');
  const { signAccessToken } = await import('../src/lib/jwt');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  let userId: string | undefined;
  try {
    const user = await prisma.user.create({
      data: {
        email: `report-flow-${Date.now()}@example.test`,
        name: 'Disposable report flow',
        passwordHash: 'no-login',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: '2026-08-27',
        acceptedPrivacyVersion: '2026-08-27',
      },
    });
    userId = user.id;
    const profile = await prisma.userProfile.create({
      data: {
        userId,
        age: 25,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        targetWeightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'ACTIVE',
        dietaryPreference: 'OMNIVORE',
        carbPreference: 'MODERATE',
        foodCulture: 'Filipino',
        dailyCalorieTarget: 2200,
        shoppingDayOfWeek: 6,
      },
    });
    await prisma.healthCondition.create({ data: { userId, condition: 'NONE' } });
    await prisma.allergy.create({ data: { userId, allergen: 'NONE' } });
    const token = signAccessToken({ userId, email: user.email, role: 'USER' });
    const request = async (route: string, method = 'GET', body?: unknown) => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api${route}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    await prisma.nutritionReport.create({
      data: {
        userId,
        version: 1,
        profileRevision: profile.revision,
        acknowledgedAt: new Date(),
        generalSummary: 'Synthetic guidance',
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        basedOnConditions: [],
        basedOnAllergies: [],
      },
    });
    const saved = await request('/user/profile', 'PUT', { carbPreference: 'LOW' });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.nutritionReport.isStale, true);
    assert.equal(saved.body.data.nutritionReport.acknowledgedAt, null);
    // Editing again and reading history must not require acknowledging outdated guidance.
    assert.equal((await request('/user/profile', 'PUT', { shoppingDayOfWeek: 0 })).status, 200);
    assert.equal((await request('/user/progress/history')).status, 200);
    assert.equal((await request('/user/nutrition-report/history')).status, 200);
    const blocked = await request('/user/meals/generate', 'POST', {});
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.errorCode, 'REPORT_ACKNOWLEDGEMENT_REQUIRED');
    assert.equal((await request('/user/nutrition-report/acknowledge', 'POST', { version: 1 })).status, 409);
    const latest = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    // Seed the provider output; this test never calls Gemini or invents real guidance.
    await prisma.nutritionReport.update({
      where: { userId },
      data: { version: 2, profileRevision: latest.revision, isStale: false },
    });
    await prisma.nutritionReportVersion.create({
      data: {
        userId,
        version: 2,
        profileRevision: latest.revision,
        content: { generalSummary: 'Synthetic guidance' },
        profileSnapshot: {},
      },
    });
    assert.equal((await request('/user/nutrition-report/acknowledge', 'POST', { version: 1 })).status, 409);
    assert.equal((await request('/user/nutrition-report/acknowledge', 'POST', { version: 2 })).status, 200);
    const current = await request('/user/profile');
    assert(current.body.data.nutritionReport.acknowledgedAt);
    assert.equal(current.body.data.nutritionReport.isStale, false);
    assert((await prisma.nutritionReportVersion.findFirstOrThrow({ where: { userId, version: 2 } })).acknowledgedAt);
    console.log(
      'PASS: profile save → stale report → repeat edit/history access → meal-action gate → current-version acknowledgment and history persistence. No real account or AI provider used.'
    );
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
