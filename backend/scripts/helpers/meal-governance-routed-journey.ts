import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { HealthConditionType, MealLibrary, NutritionistProfile, Role, User } from '@prisma/client';
import prisma from '../../src/lib/prisma';
import { ClinicalEvidenceService } from '../../src/services/clinical-evidence.service';
import { ReviewRoutingService } from '../../src/services/review-routing.service';
import { isUserActionableMealPlan } from '../../src/domain/meal-actionability.policy';

type Actor = User;
type Fixture = {
  admin: Actor;
  rnds: { user: Actor; profile: NutritionistProfile }[];
  account: (role: Role) => Promise<User>;
  meal: (name: string, grams?: number) => Promise<MealLibrary>;
  foodId: string;
  request: (
    user: Actor,
    path: string,
    method?: string,
    body?: unknown
  ) => Promise<{
    status: number;
    body: { success?: boolean; data?: any; error?: string };
  }>;
};

/** Parent verifies a fresh, task-owned loopback database before calling this journey. */
export async function mealGovernanceRoutedJourney({ admin, rnds, account, meal, foodId, request }: Fixture) {
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.success, true);
    return result.body.data;
  };
  const expertise: HealthConditionType[][] = [
    [],
    ['HEART_CONDITION'],
    ['HEART_CONDITION'],
    ['HEART_CONDITION'],
    ['KIDNEY_DISEASE'],
    [],
    [],
    ['DIABETES'],
    ['HEART_CONDITION'],
    ['HEART_CONDITION'],
  ];
  const years = [0, 5, 15, 1, 30, 40, 30, 8, 20, 25];
  for (let index = 0; index < rnds.length; index++) {
    await prisma.nutritionistProfile.update({
      where: { id: rnds[index].profile.id },
      data: { yearsOfExperience: years[index], acceptingReviews: false },
    });
    if (index !== 5)
      await ok(
        request(admin, `/admin/review-routing/expertise/${rnds[index].profile.id}`, 'PUT', {
          conditions: expertise[index],
          experienceYears: years[index],
          evidence: 'Fictional qualification and employment evidence for disposable software tests only.',
        })
      );
  }
  await prisma.user.update({ where: { id: rnds[8].user.id }, data: { isSuspended: true } });
  assert.equal((await request(admin, '/admin/review-routing', 'PATCH', { enabled: true })).status, 410);
  assert.equal((await ReviewRoutingService.config()).retired, true);

  const root = await meal('Synthetic routed journey plate', 300);
  await prisma.mealLibrary.update({ where: { id: root.id }, data: { verifiedByNutritionistId: null } });
  const initialRationale = 'Initial independent verification of measured 300 g serving: 600 kcal.';
  await ok(request(rnds[2].user, `/nutritionist/meal-verification/LIBRARY_MEAL/${root.id}/claim`, 'POST', {}));
  await ok(
    request(rnds[2].user, `/nutritionist/meal-verification/LIBRARY_MEAL/${root.id}/decision`, 'POST', {
      decision: 'VERIFIED',
      rationale: initialRationale,
    })
  );

  const member = async (conditions: HealthConditionType[]) => {
    const user = await account('USER');
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        age: 26,
        biologicalSex: conditions.includes('PREGNANT') ? 'FEMALE' : 'MALE',
        heightCm: 170,
        weightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
      },
    });
    await prisma.healthCondition.createMany({ data: conditions.map((condition) => ({ userId: user.id, condition })) });
    await prisma.safetyProfileEntry.createMany({
      data: [
        ...conditions.map((canonicalCode) => ({ domain: 'CONDITION' as const, canonicalCode })),
        { domain: 'ALLERGY' as const, canonicalCode: 'NONE' },
      ].map((entry) => ({
        ...entry,
        userId: user.id,
        displayName: entry.canonicalCode,
        originalText: entry.canonicalCode,
        normalizedText: entry.canonicalCode.toLowerCase(),
        provenance: 'PREDEFINED' as const,
        supportState: 'SUPPORTED' as const,
        policyReference: 'SYNTHETIC_FIXTURE',
      })),
    });
    await prisma.nutritionReport.create({
      data: {
        userId: user.id,
        profileRevision: 0,
        acknowledgedAt: new Date(),
        generalSummary: 'Synthetic software fixture',
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        basedOnConditions: conditions,
        basedOnAllergies: [],
      },
    });
    for (const condition of conditions)
      if (condition !== 'NONE')
        await ClinicalEvidenceService.saveHealthDetails(user.id, {
          area: condition === 'PREGNANT' ? 'PREGNANCY' : (condition as 'HEART_CONDITION' | 'DIABETES'),
          expectedSafetyRevision: 0,
          conditionDetails: 'Fictional condition details for acceptance testing.',
          medications: 'None',
          dietaryAdvice: 'Unknown',
          recentSymptoms: 'None',
          measurements: '',
        });
    return user;
  };
  const definitions: { label: string; conditions: HealthConditionType[]; expected: number[]; reviewer: number }[] = [
    { label: 'Heart A', conditions: ['HEART_CONDITION'], expected: [0, 1, 2, 3, 4, 5, 6, 7], reviewer: 2 },
    { label: 'Heart B', conditions: ['HEART_CONDITION'], expected: [0, 1, 2, 3, 4, 5, 6, 7], reviewer: 3 },
    { label: 'Healthy control', conditions: ['NONE'], expected: [0, 1, 2, 3, 4, 5, 6, 7], reviewer: 4 },
    { label: 'Diabetes', conditions: ['DIABETES'], expected: [0, 1, 2, 3, 4, 5, 6, 7], reviewer: 7 },
    {
      label: 'Pregnancy without specialist',
      conditions: ['PREGNANT'],
      expected: [0, 1, 2, 3, 4, 5, 6, 7],
      reviewer: 6,
    },
  ];
  const scenarios = [];
  for (const definition of definitions) {
    const user = await member(definition.conditions);
    await ok(request(rnds[definition.reviewer].user, '/nutritionist/profile-work'));
    await ReviewRoutingService.resolve({ userId: user.id });
    assert.equal(await prisma.reviewRoutingEpisode.count({ where: { userId: user.id } }), 0);
    if (definition.conditions[0] !== 'NONE') {
      await ok(request(rnds[definition.reviewer].user, `/nutritionist/profile-reviews/${user.id}/claim`, 'POST', {}));
      const profile = await ok(request(rnds[definition.reviewer].user, `/nutritionist/profile-reviews/${user.id}`));
      await ok(
        request(rnds[definition.reviewer].user, `/nutritionist/profile-reviews/${user.id}/decision`, 'POST', {
          decision: 'APPROVED',
          notes: 'Synthetic member profile decision for this software journey.',
          profileRevision: profile.profileRevision,
          scopeKey: profile.scopeKey,
        })
      );
    }
    const start = new Date(Date.now() + 7 * 86400_000);
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        planType: 'WEEKLY',
        startDate: start,
        endDate: new Date(start.getTime() + 6 * 86400_000),
        preparationOpensAt: new Date(),
        shoppingDeadlineAt: start,
        expectedSlotCount: 1,
        snapshot: {
          create: {
            userId: user.id,
            profileRevision: 0,
            safetyRevision: 0,
            weightKg: 65,
            activityLevel: 'SEDENTARY',
            goal: 'MAINTAIN',
            dailyCalorieTarget: 2000,
            dailyMacroTargets: {},
            planningGeographyLevel: 'NATIONAL',
          },
        },
      },
    });
    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        planGroupId: cycle.id,
        libraryMealId: root.id,
        mealName: root.mealName,
        description: root.description,
        mealType: 'DINNER',
        calories: 600,
        proteinG: 30,
        carbsG: 60,
        fatG: 15,
        scheduledDate: start,
        status: 'PENDING_REVIEW',
        candidateProvenance: 'CERTIFIED_LIBRARY',
        requiresSafetyRevalidation: true,
        ingredients: {
          create: {
            foodItemId: foodId,
            ingredientName: 'Synthetic measured squash',
            quantity: 300,
            unit: 'g',
            dataSource: 'FNRI',
          },
        },
      },
    });
    for (let index = 0; index < rnds.length; index++) {
      const queued = await request(rnds[index].user, '/nutritionist/queue');
      const direct = await request(rnds[index].user, `/nutritionist/queue/${plan.id}`);
      if (index >= 8) {
        assert.ok(queued.status >= 400);
        assert.ok(direct.status >= 400);
        continue;
      }
      assert.equal(queued.status, 200);
      assert.equal(
        queued.body.data.some((item: { id: string }) => item.id === plan.id),
        definition.expected.includes(index),
        `${definition.label}: RND ${index} queue visibility`
      );
      assert.equal(
        direct.status,
        definition.expected.includes(index) ? 200 : 404,
        `${definition.label}: RND ${index} direct visibility`
      );
    }
    scenarios.push({ ...definition, user, plan });
    console.log(
      `PASS shared-pool journey visibility: ${definition.label}; eligible reviewer indices ${definition.expected.join(', ')}`
    );
  }
  const heart = scenarios[0],
    healthy = scenarios[2];
  for (const scenario of [heart, healthy]) {
    await ok(request(rnds[scenario.reviewer].user, `/nutritionist/queue/${scenario.plan.id}/claim`, 'POST', {}));
    await ok(
      request(rnds[scenario.reviewer].user, `/nutritionist/review/${scenario.plan.id}`, 'PATCH', {
        action: 'approve',
        note: 'Synthetic exact-serving approval before flagging the shared recipe.',
      })
    );
    const saved = await prisma.mealPlan.findUniqueOrThrow({ where: { id: scenario.plan.id } });
    assert.equal(saved.status, 'APPROVED');
    assert.equal(saved.requiresSafetyRevalidation, false);
    assert.equal(isUserActionableMealPlan(saved), true);
  }
  const detail = (index = 3) => ok(request(rnds[index].user, `/nutritionist/meal-review-cases/${root.id}`));
  const notes = {
    category: 'NUTRITION',
    affectedFields: ['calories', 'quantity'],
    explanation: 'Synthetic serving was measured as 300 g; verify whether the intended serving is 325 g.',
    reference: 'Fictional measured-portion reference for disposable software acceptance.',
    proposedCorrection: 'Use 325 g measured edible squash and recompute nutrition from the mapped composition.',
  };
  const first = await ok(
    request(rnds[1].user, `/nutritionist/library/${root.id}/flag`, 'POST', {
      expectedVersion: (await detail()).recipeVersion,
      notes,
    })
  );
  assert.equal(first.incidentNumber, 1);
  assert.equal(first.reviewState, 'PENDING_REREVIEW');
  const pending = await detail();
  assert.equal(pending.currentSnapshot[0].verifiedByNutritionistId, rnds[2].profile.id);
  assert.equal(pending.currentSnapshot[0].calories, 600);
  assert.deepEqual(pending.incident.reports[0].notes, notes);
  const withheld = pending.history[0].decisions.find((decision: { action: string }) => decision.action === 'WITHHELD');
  assert.equal(withheld.snapshot.meals[0].calories, 600);
  assert.equal(withheld.snapshot.meals[0].verifiedByNutritionistId, rnds[2].profile.id);
  const globalQueue = await ok(request(rnds[4].user, '/nutritionist/meal-review-cases'));
  assert.ok(
    globalQueue.some((item: { id: string }) => item.id === root.id),
    'Recipe-wide re-review is shared work; it does not expose member clinical details.'
  );
  for (const scenario of [heart, healthy]) {
    const held = await prisma.mealPlan.findUniqueOrThrow({ where: { id: scenario.plan.id } });
    assert.equal(held.requiresSafetyRevalidation, true);
    assert.equal(isUserActionableMealPlan(held), false);
  }
  const corrected = {
    mealName: root.mealName,
    mealType: 'DINNER',
    summary: 'Synthetic corrected measured serving.',
    instructions: 'Measure edible squash, cook fully and divide into the documented serving.',
    nutritionBasis: 'Synthetic FNRI composition for one measured recipe serving.',
    nutritionServingDescription: '325 g measured serving',
    calories: 650,
    proteinG: 32.5,
    carbsG: 65,
    fatG: 16.25,
    sodiumMg: null,
    sugarG: null,
    fiberG: null,
    potassiumMg: null,
    phosphorusMg: null,
    saturatedFatG: null,
    ingredients: [{ foodItemId: foodId, gramsPerServing: 325 }],
  };
  await ok(
    request(rnds[0].user, `/nutritionist/meal-review-cases/${root.id}/correct`, 'POST', {
      expectedVersion: pending.reviewVersion,
      rationale: 'Correct the serving to the measured 325 g portion.',
      meal: corrected,
    })
  );
  const correctedDetail = await detail();
  assert.equal(correctedDetail.currentSnapshot[0].calories, 650);
  const confirm = async (index: number) => {
    const current = await detail(index);
    await ok(
      request(rnds[index].user, `/nutritionist/meal-review-cases/${root.id}/claim`, 'POST', {
        expectedVersion: current.reviewVersion,
      })
    );
    return ok(
      request(rnds[index].user, `/nutritionist/meal-review-cases/${root.id}/confirm`, 'POST', {
        expectedVersion: current.reviewVersion,
        evidenceReviewed: true,
        riceRoleReviewed: true,
        rationale: 'Independent verification of corrected 325 g serving and all recorded concerns.',
        resolutions: current.incident.reports.map((report: { id: string }) => ({
          reportId: report.id,
          rationale: 'Measured 325 g portion and recomputed composition address this recorded concern.',
        })),
      })
    );
  };
  await confirm(3);
  assert.equal((await detail()).state, 'PUBLISHED');
  assert.equal(
    (await prisma.mealLibrary.findUniqueOrThrow({ where: { id: root.id } })).verifiedByNutritionistId,
    rnds[3].profile.id
  );
  const secondNotes = {
    ...notes,
    explanation: 'A second independent challenge of the republished corrected recipe.',
    proposedCorrection: 'Keep the recipe withheld until an admin decides this second incident.',
  };
  const second = await ok(
    request(rnds[1].user, `/nutritionist/library/${root.id}/flag`, 'POST', {
      expectedVersion: (await detail()).recipeVersion,
      notes: secondNotes,
    })
  );
  assert.equal(second.incidentNumber, 2);
  assert.equal(second.reviewState, 'QUARANTINED');
  const quarantine = await ok(request(admin, `/admin/meal-review-cases/${root.id}`));
  assert.equal(quarantine.state, 'QUARANTINED');
  assert.equal(quarantine.canAdminRelease, true);
  assert.equal(quarantine.history.length, 2);
  assert.deepEqual(
    quarantine.history.map((incident: { reports: { notes: unknown }[] }) => incident.reports[0].notes),
    [notes, secondNotes]
  );
  const decisions = quarantine.history.flatMap((incident: { decisions: any[] }) => incident.decisions);
  for (const [action, calories] of [
    ['CORRECTION_BEFORE', 600],
    ['CORRECTED', 650],
    ['REVERIFIED', 650],
  ] as const)
    assert.ok(
      decisions.some((decision: any) => decision.action === action && decision.snapshot.meals[0].calories === calories),
      `Admin history must retain ${action} at ${calories} kcal`
    );
  const audit = await ok(request(admin, '/admin/audit-history?view=nutritionist&limit=50'));
  assert.ok(
    audit.rows.some(
      (row: { actionCode: string; targetId: string }) =>
        row.actionCode === 'MEAL_REVIEW_FLAGGED' && row.targetId === root.id
    )
  );
  const baseEvent = await prisma.auditEvent.findFirstOrThrow({
    where: { entityId: root.id, action: 'BASE_MEAL_VERIFIED' },
  });
  const original = await ok(request(admin, `/admin/audit-history/${baseEvent.id}`));
  assert.equal(original.reason, initialRationale);
  assert.equal(original.effective.calories, 600);
  const memberDecision = await prisma.auditEvent.findFirstOrThrow({
    where: { entityId: heart.plan.id, action: 'MEAL_PLAN_APPROVED' },
  });
  const clinical = await ok(request(admin, `/admin/audit-history/${memberDecision.id}/review-context`));
  assert.equal(clinical.currentProfile.name, heart.user.name);
  assert.equal(clinical.currentProfile.healthConditions[0].condition, 'HEART_CONDITION');
  assert.ok(
    await prisma.auditEvent.count({
      where: { actorUserId: admin.id, action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED', entityId: heart.plan.id },
    })
  );
  assert.equal(
    (
      await request(admin, `/admin/meal-review-cases/${root.id}/release`, 'POST', {
        expectedVersion: 'f'.repeat(64),
        rationale: 'A stale version release must be blocked in this fixture.',
      })
    ).status,
    409
  );
  assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: root.id } })).status, 'FLAGGED');
  console.log(
    'PASS integrated journey: real base verification and member approval -> first flag -> measured correction -> independent re-verification -> second flag -> quarantine'
  );
  console.log(
    'PASS integrated admin audit: original 600 kcal, corrected 650 kcal, both flag notes, actors, decisions and case-scoped health context'
  );
  console.log(
    'PASS integrated re-review context: previous verifier and immutable 600 kcal version plus structured flagger notes'
  );
  return {
    members: scenarios.length,
    rnds: rnds.length,
    quarantine: true,
    recipeIncidentCount: 2,
    memberSpecificPriority: false,
    recipeRereviewPool: 'shared eligible RND pool',
    sharedDatabaseWrites: 0,
  };
}
