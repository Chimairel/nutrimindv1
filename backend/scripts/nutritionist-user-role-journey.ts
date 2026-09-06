import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import prisma from '../src/lib/prisma';

const API_BASE = process.env.NUTRIMIND_E2E_API_BASE || 'http://localhost:5000/api';
const capturePath = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH?.trim();
const statePath = process.env.NUTRIMIND_ROLE_JOURNEY_STATE_PATH?.trim();
const acknowledgement = process.env.NUTRIMIND_ROLE_JOURNEY_ACK;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const applicantEmail = `journey.nutritionist.${runId}@example.com`;
const userEmail = `journey.user.${runId}@example.com`;
const applicantPassword = 'JourneyNutri123!';
const userPassword = 'JourneyUser123!';

type JsonObject = Record<string, any>;
type CapturedMail = { type: string; to: string; token: string };

function requireSafeEnvironment() {
  assert.equal(process.env.NODE_ENV, 'test', 'The role journey requires NODE_ENV=test.');
  assert.equal(acknowledgement, 'shared-development-test-data', 'Explicit role-journey acknowledgement is missing.');
  assert.equal(API_BASE, 'http://localhost:5000/api', 'The role journey may call only the local NutriMind API.');
  assert.ok(capturePath && path.isAbsolute(capturePath), 'An absolute test mail-capture path is required.');
  assert.ok(statePath && path.isAbsolute(statePath), 'An absolute role-journey state path is required.');
}

async function request(
  route: string,
  options: { method?: string; token?: string; body?: JsonObject } = {}
): Promise<JsonObject> {
  const response = await fetch(`${API_BASE}${route}`, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = (await response.json()) as JsonObject;
  if (!response.ok) {
    throw new Error(
      `${options.method || (options.body ? 'POST' : 'GET')} ${route} returned ${response.status}: ${payload.error || 'unknown error'}`
    );
  }
  return payload.data;
}

async function login(email: string, password: string) {
  const data = await request('/auth/login', { body: { email, password } });
  assert.equal(typeof data.accessToken, 'string');
  return data.accessToken as string;
}

async function waitForMail(type: string, to: string): Promise<CapturedMail> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const lines = (await readFile(capturePath!, 'utf8')).trim().split('\n').filter(Boolean);
      const match = lines
        .map((line) => JSON.parse(line) as CapturedMail)
        .reverse()
        .find((message) => message.type === type && message.to === to);
      if (match) return match;
    } catch {
      // The capture file is created lazily by the local test-only email seam.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for locally captured ${type} mail.`);
}

async function main() {
  requireSafeEnvironment();

  const health = await fetch('http://localhost:5000/health');
  assert.equal(health.ok, true, 'The local backend must be running.');

  const adminToken = await login('admin@gmail.com', 'Admin123');
  const now = Date.now();
  const application = await request('/nutritionist-applications', {
    body: {
      fullName: 'Mara Santos RND',
      email: applicantEmail,
      phoneNumber: '+63 917 555 0123',
      prcLicenseNumber: `PRC-JOURNEY-${runId}`,
      prcLicenseExpiry: '2028-12-31T23:59:59.000Z',
      specialization: 'Clinical and Community Nutrition',
      yearsOfExperience: 5,
      university: 'University of San Carlos',
      professionalBio:
        'Fictional capstone test professional focused on practical Filipino meal planning and evidence-aware nutrition review.',
      availableCallSlots: [new Date(now + 3_600_000).toISOString(), new Date(now + 7_200_000).toISOString()],
      consent: true,
    },
  });
  assert.equal(application.status, 'SUBMITTED');

  // Public submissions intentionally omit database identifiers. Resolve the
  // exact record by the unique reference returned to the applicant before the
  // authenticated administrator continues the workflow.
  const applicationRecord = await prisma.nutritionistApplication.findUnique({
    where: { referenceCode: application.referenceCode },
    select: { id: true },
  });
  assert.ok(applicationRecord, 'The submitted nutritionist application must be persisted.');
  const applicationId = applicationRecord.id;

  await request(`/admin/nutritionist-applications/${applicationId}/stage`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'UNDER_REVIEW' },
  });
  await request(`/admin/nutritionist-applications/${applicationId}/stage`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'CALL_REQUIRED' },
  });
  const scheduledCallAt = new Date(Date.now() + 1_200).toISOString();
  await request(`/admin/nutritionist-applications/${applicationId}/schedule`, {
    method: 'PATCH',
    token: adminToken,
    body: { scheduledCallAt, meetingUrl: 'https://meet.example.com/nutrimind-capstone-test' },
  });
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const decision = await request(`/admin/nutritionist-applications/${applicationId}/decision`, {
    method: 'PATCH',
    token: adminToken,
    body: { decision: 'approve' },
  });
  assert.equal(decision.application.status, 'APPROVED');
  assert.equal(decision.invitationEmailSent, true);

  const invitation = await waitForMail('NUTRITIONIST_INVITATION', applicantEmail);
  await request('/nutritionist-applications/activate', {
    body: { token: invitation.token, password: applicantPassword },
  });
  const nutritionistToken = await login(applicantEmail, applicantPassword);

  const registration = await request('/auth/register', {
    body: { name: 'Journey User', email: userEmail, password: userPassword },
  });
  assert.equal(registration.verificationEmailSent, true);
  const verification = await waitForMail('EMAIL_VERIFICATION', userEmail);
  await request('/auth/verify-email', {
    token: registration.accessToken,
    body: { otp: verification.token },
  });
  const userToken = await login(userEmail, userPassword);

  await request('/user/onboarding/profile', {
    token: userToken,
    body: {
      age: 25,
      biologicalSex: 'MALE',
      heightCm: 170,
      weightKg: 70,
      targetWeightKg: 70,
      goal: 'MAINTAIN',
      activityLevel: 'LIGHTLY_ACTIVE',
      dietaryPreference: 'OMNIVORE',
      carbPreference: 'MODERATE',
      foodCulture: 'Filipino',
    },
  });
  await request('/user/onboarding/conditions', { token: userToken, body: { conditions: ['NONE'] } });
  await request('/user/onboarding/allergies', { token: userToken, body: { allergies: ['NONE'] } });
  const safetyPreview = await request('/user/onboarding/safety-preview', {
    token: userToken,
    body: { entries: [{ domain: 'AVOIDED_INGREDIENT', value: 'sesame seeds', provenance: 'CUSTOM' }] },
  });
  assert.equal(safetyPreview.canSave, true);
  await request('/user/onboarding/safety', {
    token: userToken,
    body: { entries: [{ domain: 'AVOIDED_INGREDIENT', value: 'sesame seeds', provenance: 'CUSTOM' }], confirmed: true },
  });
  const nextShoppingDay = (new Date().getDay() + 1) % 7;
  await request('/user/onboarding/shopping-day', { token: userToken, body: { shoppingDayOfWeek: nextShoppingDay } });
  await request('/user/onboarding/tos', {
    token: userToken,
    body: {
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      medicalDisclaimerAccepted: true,
      privacyPolicyAccepted: true,
      healthDataProcessingAccepted: true,
    },
  });
  await request('/user/onboarding/complete', { token: userToken, body: {} });

  const report = await request('/user/nutrition-report/generate', { token: userToken, body: {} });
  assert.equal(typeof report.generalSummary, 'string');
  await request('/user/nutrition-report/acknowledge', { token: userToken, body: {} });

  const generation = await request('/user/meals/generate', { token: userToken, body: {} });
  assert.ok(generation.generatedMealCount > 0);
  assert.ok(
    generation.pendingReview?.mealCount > 0,
    'The custom restriction should require generated meals to enter review.'
  );

  const pendingMeal = await prisma.mealPlan.findFirst({
    where: { user: { email: userEmail }, planGroupId: generation.planGroupId, status: 'PENDING_REVIEW' },
    orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
  });
  assert.ok(pendingMeal, 'A generated meal must be available for the same nutritionist to review.');

  const reviewDetail = await request(`/nutritionist/queue/${pendingMeal.id}`, { token: nutritionistToken });
  assert.equal(reviewDetail.user.name, 'Journey User');
  await request(`/nutritionist/review/${pendingMeal.id}`, {
    method: 'PATCH',
    token: nutritionistToken,
    body: { action: 'approve', note: 'Reviewed in the isolated role-journey acceptance test.' },
  });

  const mealDetail = await request(`/user/meals/${pendingMeal.id}`, { token: userToken });
  assert.equal(mealDetail.status, 'APPROVED');
  assert.equal(mealDetail.verifier?.name, 'Mara Santos RND');
  assert.match(mealDetail.verifier?.prcLicenseNumber || '', /^PRC-JOURNEY-/);
  const publicPayload = JSON.stringify(mealDetail);
  assert.equal(
    publicPayload.includes(applicantEmail),
    false,
    'The user meal payload must not expose the nutritionist email.'
  );
  assert.equal(
    publicPayload.includes('+63 917 555 0123'),
    false,
    'The user meal payload must not expose the nutritionist phone number.'
  );

  const nutritionist = await prisma.user.findUnique({
    where: { email: applicantEmail },
    include: { nutritionistProfile: true },
  });
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  assert.ok(nutritionist?.nutritionistProfile && user);
  await writeFile(
    statePath!,
    JSON.stringify(
      {
        runId,
        applicationId,
        applicantEmail,
        applicantUserId: nutritionist.id,
        nutritionistProfileId: nutritionist.nutritionistProfile.id,
        userEmail,
        userId: user.id,
        planGroupId: generation.planGroupId,
        reviewedMealId: pendingMeal.id,
      },
      null,
      2
    ),
    { encoding: 'utf8', flag: 'wx' }
  );

  console.log(
    JSON.stringify({
      outcome: 'PASSED',
      application: 'SUBMITTED_TO_ACTIVATED',
      firstUserJourney: 'REGISTERED_VERIFIED_ONBOARDED',
      geminiNutritionReport: 'GENERATED',
      mealPlan: { generated: generation.generatedMealCount, pendingReview: generation.pendingReview.mealCount },
      sameNutritionistReview: 'APPROVED',
      userVerifierAttribution: 'VISIBLE_AND_PRIVACY_ALLOWLISTED',
      stateRecordedForExactCleanup: true,
    })
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Role journey failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
