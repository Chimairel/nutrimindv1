/** Read/write audit probes for a disposable database only. Observations are not acceptance claims. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../src/lib/prisma';
import app from '../src/app';
import { NutritionistApplicationService } from '../src/services/nutritionist-application.service';
import { NutritionistService } from '../src/services/nutritionist.service';
import { MealSwapService } from '../src/services/meal-swap.service';
import { GroceryService } from '../src/services/grocery.service';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { WeightLogService } from '../src/services/weight-log.service';
import { ProgressService } from '../src/services/progress.service';
import { certifyMealLibrarySafetySchema } from '../src/domain/meal-library-safety-review.schema';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55463');
  assert.equal(target.pathname, '/nutrimind_audit');
  assert.equal(process.env.NODE_ENV, 'test');
  const run = randomUUID();
  const directory = await mkdtemp(path.join(tmpdir(), 'nutrimind-journey-audit-'));
  process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = path.join(directory, 'mail.jsonl');
  const observations: Record<string, unknown> = {};
  const password = 'SyntheticJourneyAudit123!';
  const passwordHash = await bcrypt.hash(password, 12);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  async function request(route: string, method = 'GET', body?: unknown, token?: string) {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    const admin = await prisma.user.create({
      data: {
        email: `audit-admin-${run}@example.invalid`,
        name: 'Audit Admin',
        passwordHash,
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    const application = await NutritionistApplicationService.submit({
      fullName: 'Audit Applicant',
      email: `audit-rnd-${run}@example.invalid`,
      phoneNumber: '09170000000',
      prcLicenseNumber: `AUDIT-${run}`,
      prcLicenseExpiry: '2099-12-31',
      specialization: 'General nutrition',
      yearsOfExperience: 3,
      university: 'Synthetic University',
      professionalBio: 'Synthetic audit fixture.',
      availableCallSlots: ['Monday afternoon'],
      consent: true,
    });
    const stored = await prisma.nutritionistApplication.findUniqueOrThrow({
      where: { referenceCode: application.referenceCode },
    });
    await assert.rejects(() => NutritionistApplicationService.decide(admin.id, stored.id, { decision: 'approve' }));
    await NutritionistApplicationService.setStage(admin.id, stored.id, 'UNDER_REVIEW');
    await NutritionistApplicationService.setStage(admin.id, stored.id, 'CALL_REQUIRED');
    await NutritionistApplicationService.scheduleCall(admin.id, stored.id, {
      scheduledCallAt: new Date(Date.now() - 60_000).toISOString(),
      meetingUrl: 'https://example.invalid/audit-call',
    });
    await NutritionistApplicationService.decide(admin.id, stored.id, { decision: 'approve' });
    const captured = JSON.parse((await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH, 'utf8')).trim());
    await NutritionistApplicationService.acceptInvitation(captured.token, password);
    await assert.rejects(() => NutritionistApplicationService.acceptInvitation(captured.token, password));
    observations.nutritionistApplication =
      'PASS: staged approval, captured invitation, activation, replay rejection; no external email';

    const registration = await request('/api/auth/register', 'POST', {
      name: 'Onboarding Audit',
      email: `audit-onboard-${run}@example.invalid`,
      password,
    });
    assert.equal(registration.status, 201);
    const onboardingToken = z.object({ data: z.object({ accessToken: z.string() }) }).parse(registration.body)
      .data.accessToken;
    assert.equal((await request('/api/user/onboarding/profile', 'POST', { age: 28 }, onboardingToken)).status, 403);
    const mailRows = (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH, 'utf8')).trim().split('\n');
    const otp = z.object({ token: z.string() }).parse(JSON.parse(mailRows.at(-1)!)).token;
    assert.equal((await request('/api/auth/verify-email', 'POST', { otp }, onboardingToken)).status, 200);
    const steps: Array<[string, Record<string, unknown>]> = [
      [
        'profile',
        {
          age: 28,
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
      ],
      ['conditions', { conditions: ['NONE'] }],
      ['allergies', { allergies: ['NONE'] }],
      ['shopping-day', { shoppingDayOfWeek: 6 }],
      [
        'tos',
        {
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
          medicalDisclaimerAccepted: true,
          privacyPolicyAccepted: true,
          healthDataProcessingAccepted: true,
        },
      ],
      ['complete', {}],
    ];
    for (const [step, body] of steps) {
      const response = await request(`/api/user/onboarding/${step}`, 'POST', body, onboardingToken);
      assert.equal(response.status, 200, `Onboarding ${step}: ${JSON.stringify(response.body)}`);
    }
    assert.equal((await request('/api/user/grocery/current', 'GET', undefined, onboardingToken)).status, 409);
    observations.onboarding =
      'PASS: registration, captured OTP, verified-email gate, all onboarding writes, report acknowledgement gate; AI report generation not exercised';

    const reviewer = await prisma.nutritionistProfile.findUniqueOrThrow({
      where: { prcLicenseNumber: `AUDIT-${run}`.toUpperCase() },
    });
    const user = await prisma.user.create({
      data: {
        name: 'Audit User',
        email: `audit-user-${run}@example.invalid`,
        passwordHash,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
        userProfile: {
          create: {
            age: 28,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 70,
            targetWeightKg: 70,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            carbPreference: 'MODERATE',
            foodCulture: 'Filipino',
            dailyCalorieTarget: 2000,
            shoppingDayOfWeek: 6,
            shoppingDayGroup: 'WEEKEND',
          },
        },
        healthConditions: { create: { condition: 'NONE' } },
        allergies: { create: { allergen: 'NONE' } },
        nutritionReport: {
          create: {
            generalSummary: 'Original profile report',
            foodsToAvoid: [],
            foodsToLimit: [],
            foodsRecommended: ['Original recommendation'],
            drinksGuidance: [],
            basedOnConditions: ['NONE'],
            basedOnAllergies: ['NONE'],
            acknowledgedAt: new Date(),
          },
        },
      },
    });
    const login = await request('/api/auth/login', 'POST', { email: user.email, password });
    assert.equal(login.status, 200);
    const token = z.object({ data: z.object({ accessToken: z.string() }) }).parse(login.body).data.accessToken;
    assert.equal(typeof token, 'string');
    assert.equal((await request('/api/admin/analytics', 'GET', undefined, token)).status, 403);
    assert.equal((await request('/api/nutritionist/queue', 'GET', undefined, token)).status, 403);
    observations.roleIsolation = 'PASS: real login; USER denied ADMIN and NUTRITIONIST routes';
    const routeStatuses: Record<string, number> = {};
    for (const [email, routes] of [
      [
        admin.email,
        [
          '/api/admin/analytics',
          '/api/admin/users',
          '/api/admin/nutritionists',
          '/api/admin/nutritionist-applications',
          '/api/admin/data',
          '/api/admin/billing-operations',
          '/api/admin/compensation',
        ],
      ],
      [
        `audit-rnd-${run}@example.invalid`,
        [
          '/api/nutritionist/queue',
          '/api/nutritionist/library',
          '/api/nutritionist/approved',
          '/api/nutritionist/profile',
          '/api/nutritionist/compensation',
          '/api/nutritionist/outside-meal-reviews',
        ],
      ],
      [
        user.email,
        ['/api/user/profile', '/api/user/progress/history', '/api/user/water/today', '/api/user/account/export'],
      ],
    ] as Array<[string, string[]]>) {
      const roleLogin = await request('/api/auth/login', 'POST', { email, password });
      assert.equal(roleLogin.status, 200);
      const roleToken = z.object({ data: z.object({ accessToken: z.string() }) }).parse(roleLogin.body)
        .data.accessToken;
      for (const route of routes) {
        routeStatuses[route] = (await request(route, 'GET', undefined, roleToken)).status;
        assert.equal(routeStatuses[route], 200, route);
      }
    }
    observations.authenticatedReadRoutes = routeStatuses;

    const food = await prisma.foodItem.findFirstOrThrow({
      where: { name: { equals: 'Egg, chicken, whole', mode: 'insensitive' } },
    });
    const library = await prisma.mealLibrary.create({
      data: {
        mealName: `Audit oversized egg meal ${run}`,
        mealType: 'BREAKFAST',
        calories: 3000,
        proteinG: 20,
        carbsG: 40,
        fatG: 10,
        status: 'APPROVED',
        verifiedByNutritionistId: reviewer.id,
        dietaryTags: ['OMNIVORE', 'MAINTAIN'],
        ingredients: {
          create: {
            position: 0,
            ingredientName: food.name,
            foodItemId: food.id,
            dataSource: 'FNRI',
            quantity: 100,
            unit: 'g',
          },
        },
      },
    });
    await NutritionistService.certifyLibraryMealSafety(
      reviewer.id,
      library.id,
      certifyMealLibrarySafetySchema.parse({
        expectedRevision: 0,
        conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
        allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
        crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
        suitableConditions: [],
        allergensPresent: [],
        allergensReviewedAbsent: [],
      })
    );
    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        planGroupId: `audit-${run}`,
        mealType: 'BREAKFAST',
        mealName: 'Original breakfast',
        calories: 600,
        proteinG: 20,
        carbsG: 60,
        fatG: 20,
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
        scheduledDate: new Date(),
        ingredients: { create: { ingredientName: 'Original grocery item', quantity: 100, unit: 'g' } },
      },
    });
    await GroceryService.generateGroceryList(user.id);
    const pdf = await fetch(base + '/api/user/grocery/pdf', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-type') || '', /application\/pdf/);
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      '%PDF-'
    );
    observations.groceryPdf = 'PASS: authenticated endpoint returns a PDF document (visual layout not tested)';
    const compatible = await MealSwapService.getCompatibleLibraryMeals(user.id);
    assert.ok(compatible.some((meal) => meal.id === library.id));
    observations.libraryCalorieFiltering =
      'GAP REPRODUCED: 3000 kcal breakfast returned for a 2000 kcal daily target (600 kcal breakfast allocation)';
    const preview = await MealSwapService.getSwapPreview(user.id, plan.id, library.id);
    assert.equal(preview.warningRequired, true);
    const originalGenerate = GroceryService.generateGroceryList;
    GroceryService.generateGroceryList = async () => {
      throw new Error('Synthetic grocery projection outage');
    };
    try {
      await MealSwapService.swapMeal(user.id, plan.id, library.id, false, false);
    } finally {
      GroceryService.generateGroceryList = originalGenerate;
    }
    const swapped = await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(swapped.libraryMealId, library.id);
    const grocery = await GroceryService.getGroceryList(user.id);
    assert.ok(grocery?.groceryItems.some((item) => item.ingredientName === 'Original grocery item'));
    observations.sameDaySwap = 'GAP REPRODUCED: same-day swap accepted';
    observations.swapWarning = 'DEFECT REPRODUCED: warning-required preview can be committed without acknowledgement';
    observations.swapGroceryFailure =
      'DEFECT REPRODUCED: swap reports success while old grocery contents remain after projection failure';

    const profileUpdate = await request('/api/user/onboarding/profile', 'POST', { dietaryPreference: 'VEGAN' }, token);
    assert.equal(profileUpdate.status, 200);
    const afterDiet = await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(afterDiet.status, 'APPROVED');
    assert.equal(afterDiet.requiresSafetyRevalidation, false);
    observations.dietUpdate =
      'DEFECT REPRODUCED: successful VEGAN profile update leaves egg meal approved and actionable';
    await WeightLogService.logWeight(user.id, 90);
    const firstWeightPath = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    await ProgressService.logWeight(user.id, 90);
    const secondWeightPath = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    assert.notEqual(firstWeightPath.dailyCalorieTarget, secondWeightPath.dailyCalorieTarget);
    observations.weightPaths =
      'DEFECT REPRODUCED: the two weight logging services produce different calorie targets for the same weight';
    const beforeReport = await NutritionReportService.getReport(user.id);
    await SafetyIntakeService.save(user.id, [{ domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED' }]);
    const staleReport = await NutritionReportService.getReport(user.id);
    assert.equal(staleReport?.generalSummary, beforeReport?.generalSummary);
    assert.equal(staleReport?.acknowledgedAt, null);
    await NutritionReportService.acknowledgeReport(user.id);
    observations.reportFreshness =
      'DEFECT REPRODUCED: changed condition clears acknowledgement but old report text remains and can be acknowledged again';
    console.log(JSON.stringify({ target: 'disposable-loopback', observations }, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
