import assert from 'node:assert/strict';
import test from 'node:test';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../src/domain/deterministic-nutrition-report.policy';

test('recovery queues completed partial jobs once and leaves blocked or complete cycles alone', async (t) => {
  const shared = globalThis as unknown as { prisma: unknown };
  const previous = shared.prisma;
  const now = new Date('2026-10-09T04:00:00Z');
  const startDate = new Date('2026-10-08T16:00:00Z');
  const profile = {
    revision: 1,
    safetyRevision: 1,
    age: 25,
    dailyCalorieTarget: 2000,
    goal: 'MAINTAIN',
    heightCm: 168,
    weightKg: 65,
    activityLevel: 'SEDENTARY',
    planningReportVersion: 1,
  };
  const complete = ['BREAKFAST', 'LUNCH', 'DINNER'].map((mealType) => ({ mealType, scheduledDate: startDate }));
  const base = {
    startDate,
    endDate: startDate,
    shoppingDeadlineAt: startDate,
    status: 'ACTIVE',
    expectedSlotCount: 3,
    profileAdaptationState: 'CURRENT',
    shoppingStartedAt: null,
    incompleteAcknowledgedAt: null,
    snapshot: { profileRevision: 1, safetyRevision: 1 },
    user: { userProfile: profile },
    mealPlans: [],
  };
  const rows = [
    { ...base, id: 'partial', userId: 'eligible', generationJob: { id: 'job-partial' } },
    { ...base, id: 'complete', userId: 'complete', generationJob: { id: 'job-complete' }, mealPlans: complete },
    {
      ...base,
      id: 'stale',
      userId: 'stale',
      generationJob: { id: 'job-stale' },
      snapshot: { profileRevision: 1, safetyRevision: 0 },
    },
    { ...base, id: 'frozen', userId: 'frozen', generationJob: { id: 'job-frozen' }, shoppingStartedAt: now },
    { ...base, id: 'blocked', userId: 'blocked', generationJob: { id: 'job-blocked' } },
  ];
  const queued: string[] = [];
  shared.prisma = {
    // Recovery now checks retained meal history before queuing a missing slot.
    mealPlan: { findMany: async () => [] },
    mealPlanCycle: { findMany: async () => rows.filter((row) => !queued.includes(row.generationJob.id)) },
    user: {
      findUnique: async () => ({ userProfile: profile, healthConditions: [], allergies: [], safetyProfileEntries: [] }),
    },
    nutritionReportVersion: {
      findFirst: async () => ({
        profileRevision: 1,
        profileSnapshot: { profile },
        acknowledgedAt: now,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
      }),
    },
    mealPlanGenerationJob: {
      updateMany: async (args: { where: { id: string; status: string; cycle: unknown }; data: { status: string } }) => {
        assert.ok('OR' in args.where, 'Only completed jobs or source-unavailable failures may be recovered');
        assert.ok(args.where.cycle, 'The update must recheck the cycle and profile relationship');
        assert.equal(args.data.status, 'WAITING_FOR_AI');
        queued.push(args.where.id);
        return { count: 1 };
      },
    },
  };
  t.after(() => {
    shared.prisma = previous;
  });
  const { ClinicalEvidenceService } = await import('../src/services/clinical-evidence.service');
  const { ClinicalProfileReviewService } = await import('../src/services/clinical-profile-review.service');
  t.mock.method(ClinicalEvidenceService, 'assertReadyForMealPlanning', async (id: string) => {
    if (id === 'blocked') throw new Error('Clinical information pending');
    return [];
  });
  t.mock.method(ClinicalProfileReviewService, 'assertReadyForMealPlanning', async () => undefined);
  const { recoverPartialPlanJobs } = await import('../src/services/partial-plan-recovery.service');
  const { loadPlanningNutritionContext } = await import('../src/domain/user-nutrition-context');
  assert.equal(
    (await loadPlanningNutritionContext(shared.prisma as never, 'eligible', 'Missing fixture')).profile.revision,
    1
  );
  assert.equal(await recoverPartialPlanJobs(now), 1);
  assert.deepEqual(queued, ['job-partial']);
  assert.equal(await recoverPartialPlanJobs(now), 0);
});
