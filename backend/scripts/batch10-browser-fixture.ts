import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';

const runId = process.env.BATCH10_BROWSER_RUN_ID;
assert.ok(runId && /^[a-z0-9-]{8,64}$/.test(runId), 'A unique BATCH10_BROWSER_RUN_ID is required.');
const email = (role: string) => `batch10-browser-${role}-${runId}@example.invalid`;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['user', 'nutritionist', 'admin', 'onboarding'].map(email) } },
    select: { id: true },
  });
  for (const user of users) await prisma.user.delete({ where: { id: user.id } });
  console.log(`[Batch 10 browser fixture] removed ${users.length} accounts`);
}

async function create() {
  assert.equal(
    await prisma.user.count({
      where: { email: { in: ['user', 'nutritionist', 'admin', 'onboarding'].map(email) } },
    }),
    0,
    'Fixture identity already exists; clean it before creating again.'
  );
  const passwordHash = await bcrypt.hash('SyntheticBrowser123!', 12);
  try {
    for (const role of ['USER', 'NUTRITIONIST', 'ADMIN'] as const) {
      const account = await prisma.user.create({
        data: {
          email: email(role.toLowerCase()),
          name: `Batch 10 ${role}`,
          passwordHash,
          role,
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          acceptedTermsVersion: CURRENT_TERMS_VERSION,
          acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
          healthDataConsentedAt: new Date(),
          ...(role === 'USER'
            ? {
                userProfile: {
                  create: {
                    age: 28,
                    biologicalSex: 'FEMALE',
                    heightCm: 160,
                    weightKg: 60,
                    targetWeightKg: 60,
                    goal: 'MAINTAIN' as const,
                    activityLevel: 'LIGHTLY_ACTIVE' as const,
                    dietaryPreference: 'OMNIVORE' as const,
                    dailyCalorieTarget: 2000,
                    shoppingDayOfWeek: 6,
                  },
                },
                healthConditions: { create: { condition: 'NONE' as const } },
                allergies: { create: { allergen: 'NONE' as const } },
              }
            : {}),
          ...(role === 'NUTRITIONIST'
            ? {
                nutritionistProfile: {
                  create: {
                    prcLicenseNumber: `BATCH10-BROWSER-${runId}`,
                    prcLicenseExpiry: new Date('2030-12-31T00:00:00Z'),
                    isVerified: true,
                    verifiedAt: new Date(),
                    canLeadReview: true,
                  },
                },
              }
            : {}),
        },
      });
      if (role === 'USER') {
        const report = {
          generalSummary: 'Synthetic report for browser journey testing.',
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          basedOnConditions: ['NONE'],
          basedOnAllergies: ['NONE'],
          profileRevision: 0,
          isStale: false,
          acknowledgedAt: new Date(),
          version: 1,
        };
        await prisma.nutritionReport.create({ data: { userId: account.id, ...report } });
      }
    }
    await prisma.user.create({
      data: {
        email: email('onboarding'),
        name: 'Batch 10 New Patient',
        passwordHash,
        role: 'USER',
        emailVerified: true,
      },
    });
    console.log('[Batch 10 browser fixture] three role accounts and one new patient ready');
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function main() {
  try {
    if (process.argv[2] === 'create') await create();
    else if (process.argv[2] === 'cleanup') await cleanup();
    else throw new Error('Expected create or cleanup.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 10 browser fixture] FAIL', error);
  process.exitCode = 1;
});
