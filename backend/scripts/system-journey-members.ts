import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { harness, password } from './helpers/system-audit-harness';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import type { SafetyEntryInput } from '../src/domain/safety-intake.policy';

const predefined = (domain: SafetyEntryInput['domain'], value: string): SafetyEntryInput => ({
  domain,
  value,
  provenance: 'PREDEFINED',
});
const custom = (domain: SafetyEntryInput['domain'], value: string): SafetyEntryInput => ({
  domain,
  value,
  provenance: 'CUSTOM',
});
const none = [predefined('CONDITION', 'NONE'), predefined('ALLERGY', 'NONE')];
const cases = [
  { key: 'none', entries: none },
  { key: 'shellfish', entries: [predefined('CONDITION', 'NONE'), predefined('ALLERGY', 'SHELLFISH')] },
  {
    key: 'multi-allergy',
    entries: [
      predefined('CONDITION', 'NONE'),
      ...['NUTS', 'EGGS', 'DAIRY'].map((value) => predefined('ALLERGY', value)),
    ],
  },
  { key: 'diabetes', entries: [predefined('CONDITION', 'DIABETES'), predefined('ALLERGY', 'NONE')] },
  { key: 'hypertension', entries: [predefined('CONDITION', 'HYPERTENSION'), predefined('ALLERGY', 'NONE')] },
  { key: 'kidney-shellfish', entries: [predefined('CONDITION', 'KIDNEY_DISEASE'), predefined('ALLERGY', 'SHELLFISH')] },
  {
    key: 'heart-nuts-msg',
    entries: [predefined('CONDITION', 'HEART_CONDITION'), predefined('ALLERGY', 'NUTS'), custom('INTOLERANCE', 'MSG')],
  },
  { key: 'pregnant', entries: [predefined('CONDITION', 'PREGNANT'), predefined('ALLERGY', 'NONE')], sex: 'FEMALE' },
  { key: 'gout', entries: [predefined('CONDITION', 'GOUT'), predefined('ALLERGY', 'NONE')] },
  {
    key: 'unknown',
    entries: [custom('CONDITION', 'Unlisted synthetic condition'), custom('ALLERGY', 'Unlisted synthetic allergy')],
  },
  { key: 'pollen', entries: [predefined('CONDITION', 'NONE'), custom('ALLERGY', 'Pollen')] },
  { key: 'non-food', entries: [custom('CONDITION', 'Myopia'), custom('ALLERGY', 'Dust mites')] },
  {
    key: 'intolerance',
    entries: [...none, custom('INTOLERANCE', 'Lactose intolerance'), custom('AVOIDED_INGREDIENT', 'Pork')],
  },
  { key: 'vegan', entries: none, diet: 'VEGAN' },
  { key: 'vegetarian', entries: none, diet: 'VEGETARIAN' },
  { key: 'pescatarian', entries: none, diet: 'PESCATARIAN', rice: 'NO_RICE' },
];

async function main() {
  const half = Number(process.argv[2] || 0);
  const h = await harness(`1${half ? 'b' : 'a'}`);
  try {
    await h.staff('admin', 'ADMIN');
    await h.staff('rnd-a', 'NUTRITIONIST');
    await h.staff('rnd-b', 'NUTRITIONIST');
    await h.staff('unverified-rnd', 'NUTRITIONIST', false);
    if (!half) {
      await h.check('Contradictory NONE plus restriction rejected', async () => {
        assert.equal(
          SafetyIntakeService.preview([predefined('CONDITION', 'NONE'), predefined('CONDITION', 'DIABETES')]).canSave,
          false
        );
      });
      await h.check('Custom aliases and duplicates resolve without losing allergy', async () => {
        const result = SafetyIntakeService.preview([
          custom('CONDITION', 'Type 2 diabetes'),
          custom('ALLERGY', 'peanuts'),
          custom('ALLERGY', 'Nuts'),
        ]);
        assert.equal(result.canSave, true);
        assert.ok(result.entries.some((row) => row.canonicalCode === 'DIABETES'));
        assert.ok(result.entries.some((row) => row.canonicalCode === 'NUTS'));
        return result.entries.map((row) => ({ domain: row.domain, code: row.canonicalCode, state: row.supportState }));
      });
    }
    for (const scenario of cases.slice(half ? 8 : 0, half ? undefined : 8)) {
      await h.check(`${scenario.key}: register, OTP, onboarding and planning gates`, async () => {
        const key = scenario.key;
        const email = `system-audit-${key}-${Date.now()}@example.invalid`;
        let f = h.state.fixtures[key];
        if (!f) {
          const registered = await h.request('/api/auth/register', 'POST', {
            name: `Synthetic ${key}`,
            email,
            password,
          });
          assert.equal(registered.status, 201, JSON.stringify(registered.body));
          const user = await prisma.user.findUniqueOrThrow({ where: { email } });
          f = h.state.fixtures[key] = { id: user.id, email, token: registered.body.data.accessToken };
          assert.equal((await h.request('/api/user/onboarding/profile', 'POST', { age: 28 }, f.token)).status, 403);
          const otp = (await h.mails(email, 'EMAIL_VERIFICATION')).at(-1).token;
          assert.equal((await h.request('/api/auth/verify-email', 'POST', { otp }, f.token)).status, 200);
        } else await h.login(key);
        const profile = await h.request(
          '/api/user/onboarding/profile',
          'POST',
          {
            age: 28,
            biologicalSex: scenario.sex || 'MALE',
            heightCm: 170,
            weightKg: 70,
            targetWeightKg: 70,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: scenario.diet || 'OMNIVORE',
            ricePreference: scenario.rice || 'WITH_RICE',
            foodCulture: 'Filipino',
            shoppingDayOfWeek: 6,
          },
          f.token
        );
        assert.equal(profile.status, 200, JSON.stringify(profile.body));
        const schedule = await h.request(
          '/api/user/meal-reminders',
          'PUT',
          {
            breakfastTime: '07:00',
            lunchTime: '12:00',
            dinnerTime: '18:00',
            timeZone: 'Asia/Manila',
            remindersEnabled: false,
            prepareEnabled: false,
            logEnabled: false,
          },
          f.token
        );
        assert.equal(schedule.status, 200, JSON.stringify(schedule.body));
        const safety = await h.request(
          '/api/user/onboarding/safety',
          'POST',
          {
            entries: scenario.entries,
            editableDomains: ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
            confirmed: true,
          },
          f.token
        );
        assert.equal(safety.status, 200, JSON.stringify(safety.body));
        const requirements = await ClinicalEvidenceService.requirementsForUser(f.id);
        const saved = await prisma.userProfile.findUniqueOrThrow({ where: { userId: f.id } });
        for (const requirement of requirements) {
          const details = await h.request(
            '/api/user/onboarding/clinical-evidence/details',
            'PUT',
            {
              area: requirement.area,
              expectedSafetyRevision: saved.safetyRevision,
              conditionDetails: `Synthetic software fixture for ${key}; no real patient.`,
              medications: 'Unknown',
              dietaryAdvice: 'Unknown',
              recentSymptoms: 'Unknown',
              measurements: 'No clinical measurement in this fixture',
            },
            f.token
          );
          assert.equal(details.status, 200, JSON.stringify(details.body));
        }
        assert.equal(
          (
            await h.request(
              '/api/user/onboarding/tos',
              'POST',
              {
                termsVersion: CURRENT_TERMS_VERSION,
                privacyVersion: CURRENT_PRIVACY_VERSION,
                medicalDisclaimerAccepted: true,
                privacyPolicyAccepted: true,
                healthDataProcessingAccepted: true,
              },
              f.token
            )
          ).status,
          200
        );
        const complete = await h.request('/api/user/onboarding/complete', 'POST', {}, f.token);
        assert.equal(complete.status, 200, JSON.stringify(complete.body));
        const beforeReport = await h.request('/api/user/meals/generate', 'POST', {}, f.token);
        assert.notEqual(beforeReport.status, 200);
        assert.equal(await prisma.mealPlanGenerationJob.count({ where: { userId: f.id } }), 0);
        const report = await h.request('/api/user/nutrition-report/generate', 'POST', {}, f.token);
        assert.equal(report.status, 200, JSON.stringify(report.body));
        const review = await h.request('/api/user/clinical-profile-review/status', 'GET', undefined, f.token);
        assert.equal(review.status, 200);
        assert.equal(
          review.body.data.required,
          !['none', 'shellfish', 'multi-allergy', 'vegan', 'vegetarian', 'pescatarian'].includes(key)
        );
        for (const route of ['/api/admin/analytics', '/api/nutritionist/queue'])
          assert.equal((await h.request(route, 'GET', undefined, f.token)).status, 403);
        const entries = await prisma.safetyProfileEntry.findMany({ where: { userId: f.id } });
        return {
          healthDetailsAreas: requirements.map((row) => row.area),
          profileReview: review.body.data,
          safetyStates: entries.map((row) => ({
            domain: row.domain,
            code: row.canonicalCode,
            state: row.supportState,
          })),
          generationBeforeAcknowledgment: beforeReport.status,
          jobs: 0,
        };
      });
    }
  } finally {
    await h.close();
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
