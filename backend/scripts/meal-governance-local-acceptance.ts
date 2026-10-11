/** Actual HTTP/SQL role acceptance. Synthetic, task-owned PostgreSQL only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Role, NutritionistProfile } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { serializeActionableMeal } from '../src/services/meal-plan-presentation.service';
import { encryptClinicalDocument } from '../src/lib/clinical-document-crypto';
import { mealGovernanceRoutedJourney } from './helpers/meal-governance-routed-journey';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55485');
  assert(['/kainara_meal_governance', '/kainara_governance_comprehensive_20261010'].includes(target.pathname));
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await prisma.user.count(), 0, 'Run against a fresh disposable fixture.');
  const run = randomUUID();
  let sequence = 0;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const account = (role: Role) =>
    prisma.user.create({
      data: {
        role,
        name: `Synthetic ${role} ${++sequence}`,
        email: `${run}-${sequence}@example.invalid`,
        passwordHash: 'unusable-fixture',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
    });
  type User = Awaited<ReturnType<typeof account>>;
  const request = async (user: User, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { success?: boolean; data?: any; error?: string; errorCode?: string },
    };
  };
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.success, true);
    return result.body.data;
  };
  const cases: string[] = [];
  const passed = (name: string) => {
    cases.push(name);
    console.log(`PASS ${name}`);
  };
  try {
    const admin = await account('ADMIN'),
      member = await account('USER'),
      unrelated = await account('USER');
    const rnds: { user: User; profile: NutritionistProfile }[] = [];
    for (let index = 0; index < 10; index++) {
      const user = await account('NUTRITIONIST');
      const profile = await prisma.nutritionistProfile.create({
        data: {
          userId: user.id,
          prcLicenseNumber: `${run}-${index}`,
          prcLicenseExpiry: new Date(index === 9 ? '2000-01-01' : '2099-01-01'),
          isVerified: true,
        },
      });
      rnds.push({ user, profile });
    }
    const food = await prisma.foodItem.create({
      data: {
        name: 'Synthetic measured squash',
        category: 'Vegetables',
        source: 'FNRI',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
        fiber: 2,
        sodium: 10,
        potassium: 100,
        compositionRevision: 1,
      },
    });
    const meal = async (name: string, grams = 100, familyId?: string) => {
      const ingredients = [
        {
          ingredientName: food.name,
          foodItemId: food.id,
          quantity: grams,
          unit: 'g',
          dataSource: 'FNRI' as const,
          position: 0,
        },
      ];
      const nutrition = { calories: 2 * grams, proteinG: grams / 10, carbsG: grams / 5, fatG: grams / 20 };
      return prisma.mealLibrary.create({
        data: {
          mealName: name,
          mealType: 'DINNER',
          ...nutrition,
          nutritionServingDescription: `${grams} g serving`,
          nutritionEvidenceSource: 'FNRI_RECONCILED',
          recipeSignature: buildMealLibraryRecipeSignature({
            mealName: name,
            mealType: 'DINNER',
            ...nutrition,
            ingredients,
          }),
          description: 'Synthetic measured squash recipe with safe preparation instructions.',
          authoredByNutritionistId: rnds[0].profile.id,
          verifiedByNutritionistId: rnds[2].profile.id,
          riceRole: 'STANDALONE',
          riceRoleReviewStatus: 'REVIEWED',
          recipeFamilyId: familyId,
          parentMealId: familyId,
          ingredients: { create: ingredients },
        },
      });
    };
    const root = await meal('Synthetic governed recipe'),
      variant = await meal('Synthetic serving variant', 150, root.id);
    const start = new Date('2090-01-01');
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        planType: 'WEEKLY',
        startDate: start,
        endDate: new Date('2090-01-07'),
        preparationOpensAt: start,
        shoppingDeadlineAt: start,
        expectedSlotCount: 1,
      },
    });
    const grocery = await prisma.groceryList.create({
      data: { userId: member.id, planGroupId: cycle.id, weekLabel: 'Synthetic acceptance week' },
    });
    const plan = await prisma.mealPlan.create({
      data: {
        userId: member.id,
        planGroupId: cycle.id,
        libraryMealId: variant.id,
        mealName: variant.mealName,
        mealType: 'DINNER',
        calories: 300,
        proteinG: 15,
        carbsG: 30,
        fatG: 7.5,
        scheduledDate: start,
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
        nutritionistId: rnds[2].profile.id,
        firstApprovedByNutritionistId: rnds[2].profile.id,
      },
    });
    await prisma.userProfile.create({
      data: {
        userId: member.id,
        age: 26,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        shoppingDayGroup: 'WEEKEND',
      },
    });
    await prisma.healthCondition.create({ data: { userId: member.id, condition: 'HEART_CONDITION' } });
    const notes = {
      category: 'NUTRITION',
      affectedFields: ['sodiumMg'],
      explanation: 'Synthetic sodium evidence needs an independent, documented review.',
      reference: 'Synthetic composition reference for acceptance testing only.',
      proposedCorrection: 'Check measured edible grams and the sodium evidence.',
    };
    const detail = (user = rnds[3].user, id = root.id) => ok(request(user, `/nutritionist/meal-review-cases/${id}`));
    const flag = async (user: User, id: string, expectedVersion?: string) =>
      ok(
        request(user, `${user.role === 'ADMIN' ? '/admin' : '/nutritionist'}/library/${id}/flag`, 'POST', {
          expectedVersion: expectedVersion ?? (await detail(rnds[3].user, id)).recipeVersion,
          notes,
        })
      );
    const confirm = async (index: number, id = root.id) => {
      const current = await detail(rnds[index].user, id);
      await ok(
        request(rnds[index].user, `/nutritionist/meal-review-cases/${id}/claim`, 'POST', {
          expectedVersion: current.reviewVersion,
        })
      );
      return ok(
        request(rnds[index].user, `/nutritionist/meal-review-cases/${id}/confirm`, 'POST', {
          expectedVersion: current.reviewVersion,
          evidenceReviewed: true,
          riceRoleReviewed: true,
          rationale: 'Synthetic independent review of every serving and its measured evidence.',
          resolutions: current.incident.reports.map((report: { id: string }) => ({
            reportId: report.id,
            rationale: 'Synthetic concern resolved by checking the exact measured composition and recipe.',
          })),
        })
      );
    };
    const adminRelease = async () => {
      const current = await ok(request(admin, `/admin/meal-review-cases/${root.id}`));
      return request(admin, `/admin/meal-review-cases/${root.id}/release`, 'POST', {
        expectedVersion: current.reviewVersion,
        rationale: 'Administrative release after independent review of all recorded concerns.',
      });
    };
    assert.equal((await request(member, '/admin/meals/batch/template')).status, 403);
    assert.equal((await request(member, '/nutritionist/meal-review-cases')).status, 403);
    assert.equal((await request(rnds[9].user, '/nutritionist/meal-review-cases')).status, 403);
    assert.equal(
      (await request(admin, `/admin/library/${root.id}/flag`, 'POST', { reason: 'Old unstructured request' })).status,
      400
    );
    passed('Role, current credential and structured flag boundaries');

    const published = await detail();
    const first = await Promise.all([
      flag(rnds[1].user, root.id, published.recipeVersion),
      flag(admin, variant.id, published.recipeVersion),
      flag(rnds[1].user, variant.id, published.recipeVersion),
    ]);
    assert.ok(first.every((row) => row.incidentNumber === 1 && row.reviewState === 'PENDING_REREVIEW'));
    assert.equal(await prisma.mealReviewIncident.count(), 1);
    assert.equal(await prisma.mealReviewReport.count(), 3);
    assert.equal(await prisma.mealLibrary.count({ where: { status: 'FLAGGED' } }), 2);
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation,
      true
    );
    assert.equal((await ok(request(rnds[3].user, '/nutritionist/meal-review-cases'))).length, 1);
    assert.equal((await prisma.groceryList.findUniqueOrThrow({ where: { id: grocery.id } })).isStale, true);
    assert.equal(await prisma.notification.count({ where: { userId: member.id, type: 'MEAL_FLAGGED' } }), 1);
    passed('Concurrent first flags and serving variants produce one incident and hold member slots');
    const pending = await detail();
    for (const index of [0, 1, 2])
      assert.equal(
        (
          await request(rnds[index].user, `/nutritionist/meal-review-cases/${root.id}/claim`, 'POST', {
            expectedVersion: pending.reviewVersion,
          })
        ).status,
        403
      );
    await ok(
      request(rnds[3].user, `/nutritionist/meal-review-cases/${root.id}/claim`, 'POST', {
        expectedVersion: pending.reviewVersion,
      })
    );
    assert.equal(
      (
        await request(rnds[4].user, `/nutritionist/meal-review-cases/${root.id}/claim`, 'POST', {
          expectedVersion: pending.reviewVersion,
        })
      ).status,
      409
    );
    assert.equal(
      (
        await request(rnds[3].user, `/nutritionist/meal-review-cases/${root.id}/confirm`, 'POST', {
          expectedVersion: pending.reviewVersion,
          evidenceReviewed: true,
          riceRoleReviewed: true,
          rationale: 'Incomplete concern resolutions must not release a meal.',
          resolutions: [],
        })
      ).status,
      400
    );
    assert.equal((await adminRelease()).status, 409);
    await confirm(3);
    assert.equal((await detail()).state, 'PUBLISHED');
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation,
      true
    );
    assert.equal(
      (
        await request(rnds[1].user, `/nutritionist/library/${root.id}/flag`, 'POST', {
          expectedVersion: published.recipeVersion,
          notes,
        })
      ).status,
      409
    );
    passed('Uninvolved claimed re-review publishes recipe without restoring old plans; stale flags fail');

    const second = await flag(rnds[1].user, variant.id);
    assert.equal(second.incidentNumber, 2);
    assert.equal(second.reviewState, 'QUARANTINED');
    assert.equal((await detail()).canAdminRelease, true);
    assert.equal((await detail()).validConfirmations.length, 0);
    const quarantineClaim = await request(rnds[4].user, `/nutritionist/meal-review-cases/${root.id}/claim`, 'POST', {
      expectedVersion: (await detail()).reviewVersion,
    });
    assert.equal(quarantineClaim.status, 409);
    passed('Second incident quarantines; only admin can decide release without RND confirmations');
    const originalIncident = (await detail()).incident;
    const decision = await prisma.mealReviewDecision.findFirstOrThrow({ where: { incidentId: originalIncident.id } });
    await assert.rejects(prisma.mealReviewDecision.delete({ where: { id: decision.id } }));
    await assert.rejects(
      prisma.mealReviewReport.update({
        where: { id: originalIncident.reports[0].id },
        data: { notes: { explanation: 'Rewritten report' } },
      })
    );
    const heldVariant = await meal('Synthetic variant created during quarantine', 180, root.id);
    assert.equal(heldVariant.status, 'FLAGGED');
    assert.equal((await detail()).validConfirmations.length, 0);
    await prisma.mealLibrary.update({ where: { id: heldVariant.id }, data: { status: 'APPROVED' } });
    assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: heldVariant.id } })).status, 'FLAGGED');
    await assert.rejects(
      prisma.mealLibrary.update({
        where: { id: heldVariant.id },
        data: { recipeFamilyId: null, reviewLineageId: null, status: 'APPROVED' },
      })
    );
    await prisma.mealLibrary.update({ where: { id: heldVariant.id }, data: { status: 'ARCHIVED' } });
    passed(
      'Database enforces immutable evidence and prevents a new serving or direct status update escaping quarantine'
    );

    const oldVersion = (await detail()).reviewVersion;
    await flag(rnds[1].user, root.id);
    assert.equal((await detail()).incidentCount, 2);
    assert.equal((await detail()).validConfirmations.length, 0);
    assert.equal(
      (
        await request(admin, `/admin/meal-review-cases/${root.id}/release`, 'POST', {
          expectedVersion: oldVersion,
          rationale: 'A stale version cannot be released even with old confirmations.',
        })
      ).status,
      409
    );
    const beforeCorrection = await detail();
    const corrected = {
      mealName: root.mealName,
      mealType: 'DINNER',
      summary: 'Synthetic corrected measured squash recipe.',
      instructions: 'Measure the edible squash, cook fully and portion the cooked recipe.',
      nutritionBasis: 'Measured synthetic FNRI composition for one recipe serving.',
      nutritionServingDescription: '125 g measured serving',
      calories: 250,
      proteinG: 12.5,
      carbsG: 25,
      fatG: 6.25,
      sodiumMg: null,
      sugarG: null,
      fiberG: null,
      potassiumMg: null,
      phosphorusMg: null,
      saturatedFatG: null,
      ingredients: [{ foodItemId: food.id, gramsPerServing: 125 }],
    };
    await ok(
      request(rnds[0].user, `/nutritionist/meal-review-cases/${root.id}/correct`, 'POST', {
        expectedVersion: beforeCorrection.reviewVersion,
        rationale: 'Correct the measured serving while preserving the active quarantine.',
        meal: corrected,
      })
    );
    assert.equal((await detail()).validConfirmations.length, 0);
    assert.equal((await detail()).state, 'QUARANTINED');
    assert.equal((await detail()).canAdminRelease, true);
    const current = await detail();
    const historyValues = current.history.flatMap(
      (incident: { decisions: { action: string; snapshot: { meals: { id: string; calories: number }[] } }[] }) =>
        incident.decisions
          .filter((decision) => decision.action === 'CORRECTION_BEFORE')
          .flatMap((decision) => decision.snapshot.meals)
    );
    assert.equal(historyValues.find((row: { id: string }) => row.id === root.id).calories, 200);
    assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: root.id } })).calories, 250);
    assert.equal((await adminRelease()).status, 200);
    assert.equal((await detail()).state, 'PUBLISHED');
    assert.equal((await flag(rnds[1].user, root.id)).reviewState, 'QUARANTINED');
    assert.equal((await detail()).incidentCount, 3);
    const challenged = await detail();
    for (const index of [0, 1, 3])
      assert.equal(
        (
          await request(rnds[index].user, `/nutritionist/meal-review-cases/${root.id}/claim`, 'POST', {
            expectedVersion: challenged.reviewVersion,
          })
        ).status,
        409,
        'Quarantine review decisions are reserved for admin.'
      );
    passed(
      'Additional reports and corrections require a current admin release version; immutable before/after values; future flags immediately quarantine'
    );

    const draftInput = {
      ...corrected,
      mealName: 'Synthetic new batch draft',
      ingredients: [{ foodItemId: food.id, gramsPerServing: 130 }],
      calories: 260,
    };
    const template = await ok(request(admin, '/admin/meals/batch/template'));
    assert.equal(template.format, 'KAINARA_MEALS_V1');
    const invalid = await ok(
      request(admin, '/admin/meals/batch/preview', 'POST', {
        format: template.format,
        meals: [
          { ...draftInput, ingredients: [{ foodItemId: 'missing-food', gramsPerServing: null }] },
          { ...draftInput, verifiedByNutritionistId: rnds[3].profile.id },
        ],
      })
    );
    assert.equal(invalid.valid, false);
    assert.ok(invalid.results.every((row: { errors: string[] }) => row.errors.length > 0));
    assert.equal(
      (
        await request(admin, '/admin/meals/batch/preview', 'POST', {
          format: template.format,
          meals: Array(101).fill(draftInput),
        })
      ).status,
      422
    );
    assert.equal(
      (
        await request(admin, '/admin/meals/batch/preview', 'POST', {
          format: template.format,
          meals: [{ ...draftInput, summary: 'x'.repeat(2 * 1024 * 1024) }],
        })
      ).status,
      413
    );
    const preview = await ok(
      request(admin, '/admin/meals/batch/preview', 'POST', { format: template.format, meals: [draftInput] })
    );
    assert.equal(preview.valid, true);
    assert.equal(
      (await request(rnds[3].user, '/admin/meals/batch/import', 'POST', { previewId: preview.previewId })).status,
      403
    );
    const imported = await Promise.all([
      ok(request(admin, '/admin/meals/batch/import', 'POST', { previewId: preview.previewId })),
      ok(request(admin, '/admin/meals/batch/import', 'POST', { previewId: preview.previewId })),
    ]);
    assert.equal(imported.filter((row) => row.replayed).length, 1);
    const importedId = imported[0].meals[0].id;
    const draft = await prisma.mealLibrary.findUniqueOrThrow({ where: { id: importedId } });
    assert.equal(draft.safetyEvidenceStatus, 'INCOMPLETE');
    assert.equal(draft.verifiedByNutritionistId, null);
    const exported = await ok(request(admin, '/admin/meals/batch/export', 'POST', { ids: [importedId] }));
    assert.equal(exported.meals[0].nutritionBasis, draftInput.nutritionBasis);
    assert.deepEqual(exported.meals[0].ingredients, draftInput.ingredients);
    for (const key of ['flags', 'verifier', 'verifiedByNutritionistId', 'userId', 'approvals'])
      assert.equal(key in exported.meals[0], false);
    assert.equal((await ok(request(admin, '/admin/meals/batch/preview', 'POST', exported))).alreadyImported, true);
    assert.equal(
      (
        await ok(
          request(admin, '/admin/meals/batch/preview', 'POST', {
            ...exported,
            meals: [
              { ...exported.meals[0], nutritionBasis: 'New description does not allow duplicating the same recipe.' },
            ],
          })
        )
      ).valid,
      false
    );
    const replay = await ok(
      request(admin, '/admin/meals/batch/preview', 'POST', { format: template.format, meals: [draftInput] })
    );
    assert.equal(replay.alreadyImported, true);
    const otherAdmin = await account('ADMIN');
    assert.equal(
      (await request(otherAdmin, '/admin/meals/batch/import', 'POST', { previewId: preview.previewId })).status,
      404
    );
    const atomicInputs = [
      { ...draftInput, mealName: 'Synthetic atomic first', calories: 280 },
      { ...draftInput, mealName: 'Synthetic atomic second', calories: 290 },
    ];
    const atomicPreview = await ok(
      request(admin, '/admin/meals/batch/preview', 'POST', { format: template.format, meals: atomicInputs })
    );
    assert.equal(atomicPreview.valid, true);
    await ok(
      request(admin, '/admin/meals/batch/preview', 'POST', { format: template.format, meals: [atomicInputs[1]] })
    ).then(async (row) => ok(request(admin, '/admin/meals/batch/import', 'POST', { previewId: row.previewId })));
    assert.equal(
      (await request(admin, '/admin/meals/batch/import', 'POST', { previewId: atomicPreview.previewId })).status,
      409
    );
    assert.equal(await prisma.mealLibrary.count({ where: { mealName: atomicInputs[0].mealName } }), 0);
    passed(
      'JSON templates, mapping/quantity errors, limits, selected export, ownership, duplicate checks, atomic failure and retry idempotency'
    );

    const scopedRecipe = await meal('Synthetic scope-specific recipe');
    const approval = await prisma.mealLibraryProfileApproval.create({
      data: {
        mealLibraryId: scopedRecipe.id,
        safetyScopeKey: 'a'.repeat(64),
        recipeSignature: scopedRecipe.recipeSignature!,
        evidenceRevision: scopedRecipe.safetyEvidenceRevision,
        reviewerNutritionistId: rnds[3].profile.id,
        reviewPolicyVersion: 'SYNTHETIC_POLICY',
        sourceProvenance: 'AI_FROM_SCRATCH',
        scopeSnapshot: { conditions: ['HEART_CONDITION'] },
      },
    });
    const scopedPlan = await prisma.mealPlan.create({
      data: {
        userId: member.id,
        planGroupId: cycle.id,
        libraryMealId: scopedRecipe.id,
        profileApprovalId: approval.id,
        mealName: scopedRecipe.mealName,
        mealType: 'DINNER',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
        scheduledDate: start,
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
      },
    });
    const untouchedPlan = await prisma.mealPlan.create({
      data: {
        userId: unrelated.id,
        planGroupId: (
          await prisma.mealPlanCycle.create({
            data: {
              id: randomUUID(),
              userId: unrelated.id,
              planType: 'WEEKLY',
              startDate: start,
              endDate: new Date('2090-01-07'),
              preparationOpensAt: start,
              shoppingDeadlineAt: start,
              expectedSlotCount: 1,
            },
          })
        ).id,
        libraryMealId: scopedRecipe.id,
        mealName: scopedRecipe.mealName,
        mealType: 'DINNER',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
        scheduledDate: start,
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
      },
    });
    const scopedVersion = (await detail(rnds[3].user, scopedRecipe.id)).recipeVersion;
    await ok(
      request(rnds[1].user, `/nutritionist/library/${scopedRecipe.id}/approvals/flag`, 'POST', {
        kind: 'PROFILE',
        approvalId: approval.id,
        expectedVersion: scopedVersion,
        notes,
      })
    );
    assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: scopedRecipe.id } })).status, 'APPROVED');
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: scopedPlan.id } })).requiresSafetyRevalidation,
      true
    );
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: untouchedPlan.id } })).requiresSafetyRevalidation,
      false
    );
    assert.equal((await detail(rnds[3].user, scopedRecipe.id)).incidentCount, 0);
    passed('Approval-specific flags suspend their used approval without withholding the recipe or other member plans');

    const event = await prisma.auditEvent.create({
      data: {
        actorUserId: rnds[2].user.id,
        actorName: rnds[2].user.name,
        actorRole: 'NUTRITIONIST',
        action: 'MEAL_PLAN_APPROVED',
        entityType: 'MealPlan',
        entityId: plan.id,
        metadata: { rationale: 'Synthetic reviewed member case' },
      },
    });
    const contextPath = `/admin/audit-history/${event.id}/review-context`;
    assert.equal((await request(member, contextPath)).status, 403);
    assert.equal((await request(admin, contextPath + `?userId=${unrelated.id}`)).status, 400);
    const auditContext = await ok(request(admin, contextPath));
    assert.equal(auditContext.currentProfile.name, member.name);
    assert.equal(auditContext.currentProfile.healthConditions[0].condition, 'HEART_CONDITION');
    assert.equal(auditContext.historicalInformation.includes('not recorded'), true);
    assert.equal(
      await prisma.auditEvent.count({
        where: { action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED', actorUserId: admin.id, entityId: plan.id },
      }),
      1
    );
    const unrelatedEvent = await prisma.auditEvent.create({
      data: {
        actorUserId: admin.id,
        actorRole: 'ADMIN',
        action: 'USER_REINSTATED',
        entityType: 'User',
        entityId: unrelated.id,
      },
    });
    assert.equal((await request(admin, `/admin/audit-history/${unrelatedEvent.id}/review-context`)).status, 404);
    const clinicalPayload = Buffer.from('%PDF-1.4\nSynthetic clinical evidence for acceptance testing only.');
    const evidence = await prisma.clinicalDocument.create({
      data: {
        userId: member.id,
        area: 'OTHER',
        documentType: 'OTHER',
        originalFileName: 'synthetic.pdf',
        mimeType: 'application/pdf',
        byteSize: clinicalPayload.length,
        consentVersion: 'SYNTHETIC',
        ...encryptClinicalDocument(clinicalPayload),
      },
    });
    await prisma.mealPlanClinicalEvidence.create({
      data: {
        mealPlanId: plan.id,
        clinicalDocumentId: evidence.id,
        documentRevision: evidence.revision,
        documentSha256: evidence.sha256,
      },
    });
    const filePath = `${contextPath}/documents/${evidence.id}/file`;
    const fileResponse = await fetch(base + filePath, {
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: admin.id, email: admin.email, role: admin.role })}`,
      },
    });
    assert.equal(fileResponse.status, 200);
    assert.equal(Buffer.from(await fileResponse.arrayBuffer()).toString(), clinicalPayload.toString());
    assert.equal((await request(admin, `${contextPath}/documents/unrelated-document/file`)).status, 404);
    await prisma.clinicalDocument.update({
      where: { id: evidence.id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    });
    assert.equal((await request(admin, filePath)).status, 404);
    assert.equal(
      await prisma.auditEvent.count({
        where: { actorUserId: admin.id, action: 'ADMIN_REVIEW_SENSITIVE_FILE_ACCESSED', entityId: evidence.id },
      }),
      1
    );
    const retainedPlan = await prisma.mealPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        ingredients: true,
        nutritionist: { include: { user: true } },
        firstApprovedByNutritionist: { include: { user: true } },
        libraryMeal: { include: { verifiedByNutritionist: { include: { user: true } } } },
      },
    });
    const presentation = serializeActionableMeal(retainedPlan);
    assert.equal(presentation.verifier?.name, rnds[2].user.name);
    assert.equal(presentation.verifier?.reviewScope, 'RECORDED');
    assert.equal(presentation.verifier?.university, null);
    assert.equal(presentation.verifier?.yearsOfExperience, null);
    passed(
      'Case-scoped clinical oversight rejects unrelated access, records sensitive reads and retains member review attribution'
    );

    const legacy = await meal('Synthetic legacy held recipe');
    await prisma.mealLibrary.update({ where: { id: legacy.id }, data: { status: 'FLAGGED' } });
    await prisma.mealLibraryFlag.createMany({
      data: [0, 1].map(() => ({
        mealLibraryId: legacy.id,
        flaggedByNutritionistId: rnds[1].profile.id,
        reason: 'Legacy report without structured historical values.',
      })),
    });
    await flag(admin, legacy.id);
    const legacyDetail = await detail(rnds[3].user, legacy.id);
    assert.equal(legacyDetail.incidentCount, 0);
    assert.equal(legacyDetail.legacyHistoryUnknown, true);
    assert.equal(legacyDetail.incident.reports.length, 3);
    const held = await detail();
    await ok(
      request(admin, `/admin/meal-review-cases/${root.id}/archive`, 'POST', {
        expectedVersion: held.reviewVersion,
        rationale: 'Archive unresolved synthetic quarantine after documented administrative review.',
      })
    );
    assert.equal(
      await prisma.mealLibrary.count({ where: { reviewLineageId: held.incident.lineageId, status: 'ARCHIVED' } }),
      3
    );
    passed('Legacy reports retain unknown incident history; administrators can archive held families');
    const integratedJourney = await mealGovernanceRoutedJourney({
      admin,
      rnds,
      account,
      meal,
      foodId: food.id,
      request,
    });
    passed('Integrated member approval, shared-pool visibility, corrected re-review, quarantine and admin audit');
    console.log(
      JSON.stringify(
        {
          cases,
          integratedJourney,
          migrations:
            await prisma.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
          realProviderCalls: 0,
          database: 'task-owned local fixture',
        },
        null,
        2
      )
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  if (error instanceof assert.AssertionError) console.error(error.message);
  console.error(
    'Meal governance acceptance failed. Inspect the bounded assertion output; no shared database was used.'
  );
  process.exitCode = 1;
});
