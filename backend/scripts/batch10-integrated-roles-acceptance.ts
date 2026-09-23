import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MealPlanCycleStatus, MealType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AdminService } from '../src/services/admin.service';
import { MealLogService } from '../src/services/meal-log.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';
import { ObservedMealService } from '../src/services/observed-meal.service';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';
import { UserPrivacyService } from '../src/services/user-privacy.service';
import { createFixturePlanCycle } from './helpers/plan-cycle-fixture';
import { NutritionistReviewService } from '../src/services/nutritionist-review.service';
import { createOrReuseLibraryDraftFromApprovedPlan } from '../src/services/meal-library-publication.service';
import { NutritionistLibraryService } from '../src/services/nutritionist-library.service';
import { certifyLibraryMealSafety } from '../src/services/nutritionist-library-certification.service';
import { certifyMealLibrarySafetySchema } from '../src/domain/meal-library-safety-review.schema';
import { queryEligibleLibraryMeals } from '../src/services/meal-library-candidate-query.service';
import { validateGeneratedMealCandidate } from '../src/domain/generated-meal-validation.policy';

async function main() {
  const databaseHost = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.BATCH10_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost'].includes(databaseHost)) {
    throw new Error(
      'This approval journey writes append-only work credits. Run it only against a disposable local database.'
    );
  }
  const marker = randomUUID();
  const accounts: string[] = [];
  let submissionId: string | null = null;
  let candidateId: string | null = null;
  let planId: string | null = null;
  let cycleId: string | null = null;
  let libraryMealId: string | null = null;
  async function removePublishedFixture() {
    if (planId) {
      await prisma.mealPlanReviewDecision.deleteMany({ where: { mealPlanId: planId } });
      await prisma.mealPlan.updateMany({ where: { id: planId }, data: { libraryMealId: null } });
      await prisma.mealPlan.deleteMany({ where: { id: planId } });
      planId = null;
    }
    if (cycleId) {
      await prisma.mealPlanCycle.deleteMany({ where: { id: cycleId } });
      cycleId = null;
    }
    if (libraryMealId) {
      await prisma.mealLibrarySafetyReview.deleteMany({ where: { mealLibraryId: libraryMealId } });
      await prisma.mealLibrary.deleteMany({ where: { id: libraryMealId } });
      libraryMealId = null;
    }
  }
  try {
    const admin = await prisma.user.create({
      data: {
        email: `batch10-admin-${marker}@example.invalid`,
        name: 'Batch 10 Admin',
        passwordHash: 'disabled',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    accounts.push(admin.id);
    const rndUser = await prisma.user.create({
      data: {
        email: `batch10-rnd-${marker}@example.invalid`,
        name: 'Batch 10 RND',
        passwordHash: 'disabled',
        role: 'NUTRITIONIST',
        emailVerified: true,
      },
    });
    accounts.push(rndUser.id);
    const rnd = await prisma.nutritionistProfile.create({
      data: {
        userId: rndUser.id,
        prcLicenseNumber: `BATCH10-${marker}`,
        prcLicenseExpiry: new Date('2030-12-31T00:00:00Z'),
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    const lead = await AdminService.setNutritionistLeadCapability(admin.id, rnd.id, true);
    assert.equal(lead.canLeadReview, true);
    assert.equal(
      await prisma.auditEvent.count({
        where: {
          actorUserId: admin.id,
          entityId: rnd.id,
          action: 'NUTRITIONIST_LEAD_CAPABILITY_GRANTED',
        },
      }),
      1
    );

    const password = `Batch10-${marker}`;
    const patient = await prisma.user.create({
      data: {
        email: `batch10-patient-${marker}@example.invalid`,
        name: 'Batch 10 Patient',
        passwordHash: await bcrypt.hash(password, 12),
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 60,
            targetWeightKg: 60,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            dailyCalorieTarget: 1200,
          },
        },
      },
    });
    accounts.push(patient.id);
    const historicalReviewId = randomUUID();
    await prisma.clinicalProfileReview.create({
      data: {
        id: historicalReviewId,
        userId: patient.id,
        profileRevision: 1,
        policyVersion: 'BATCH10_HISTORICAL',
        reasonCodes: [],
        profileSnapshot: {},
        reviewerId: rnd.id,
      },
    });

    const mealName = `Batch 10 chicken stew ${marker}`;
    const preview = await MealLogService.logOutsideMeal({
      userId: patient.id,
      mealType: MealType.LUNCH,
      consumedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      notes: `Private patient note ${marker}`,
      items: [
        { name: mealName, portionGrams: 250, reportedNutrition: { calories: 400, proteinG: 30, carbsG: 45, fatG: 12 } },
      ],
    });
    assert.ok('previewRequired' in preview);
    const committed = await MealLogService.logOutsideMeal({
      userId: patient.id,
      mealType: MealType.LUNCH,
      warningAcknowledged: true,
      confirmationId: preview.confirmationId,
    });
    assert.ok('log' in committed);
    const logId = committed.log.id;
    const itemId = committed.log.outsideItems[0].id;
    const requested = await OutsideMealReviewService.requestByUser(patient.id, logId, itemId);
    assert.ok((await OutsideMealReviewService.queue(rnd.id)).some((row) => row.id === requested.id));
    await OutsideMealReviewService.claim(rnd.id, requested.id);
    await OutsideMealReviewService.resolve(rnd.id, requested.id, {
      action: 'NEEDS_MORE_INFO',
      reason: 'Please confirm the serving size and ingredients.',
    });
    await OutsideMealReviewService.replyByUser(
      patient.id,
      logId,
      itemId,
      'One 250 g bowl with chicken, carrots, and broth.'
    );
    await OutsideMealReviewService.claim(rnd.id, requested.id);
    const corrected = await OutsideMealReviewService.resolve(rnd.id, requested.id, {
      action: 'CORRECT',
      calories: 420,
      proteinG: 32,
      carbsG: 46,
      fatG: 13,
      reason: 'Adjusted from the clarified bowl and ingredients.',
    });
    assert.equal(corrected.summary.totals.calories, 420);
    assert.equal(corrected.summary.provisionalCalories, 0);
    const revisions = await prisma.outsideMealItemRevision.findMany({
      where: { outsideMealLogItemId: itemId },
      orderBy: { revision: 'asc' },
    });
    assert.ok(revisions.length >= 4);

    const consent = await ObservedMealService.consent(patient.id, logId, itemId, {
      detailsConsent: true,
      imageReuseConsent: false,
      imageRightsConfirmed: false,
    });
    submissionId = consent.id;
    assert.equal(
      (await ObservedMealService.pending()).some((row) => row.id === submissionId),
      true
    );
    const admitted = await ObservedMealService.admit(rnd.id, consent.id, {
      kind: 'RECIPE_CANDIDATE',
      canonicalName: mealName,
      ingredients: [
        { name: 'Chicken breast', quantity: 100, unit: 'g' },
        { name: 'Carrot', quantity: 50, unit: 'g' },
      ],
      preparation: 'Simmer the chicken and carrots in water until fully cooked.',
      mealTypes: [MealType.LUNCH],
    });
    candidateId = admitted.id;
    const candidate = await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidateId } });
    assert.equal(candidate.sourceName, 'USER_OBSERVED');
    assert.equal(candidate.status, 'AVAILABLE');
    assert.equal(
      await prisma.mealLibrary.count({ where: { mealName } }),
      0,
      'RND observation admission must not certify a library meal.'
    );
    const rawPage = await databaseRecipeCandidateProvider.list({
      mealType: MealType.LUNCH,
      dietaryPreference: 'OMNIVORE',
      sourceKind: 'USER_OBSERVED',
      search: mealName,
      limit: 10,
    });
    assert.equal(rawPage.items.find((row) => row.id === candidateId)?.provenance, 'USER_OBSERVED');
    assert.equal(JSON.stringify(candidate).includes(patient.email), false);
    assert.equal(JSON.stringify(candidate).includes('Private patient note'), false);

    const candidateIngredients = [
      { name: 'Chicken breast', category: 'PROTEIN' },
      { name: 'Carrot', category: 'PRODUCE' },
    ];
    const precheck = validateGeneratedMealCandidate({
      ingredients: candidateIngredients,
      dietaryPreference: 'OMNIVORE',
      allergens: [],
    });
    assert.equal(precheck.accepted, true);
    assert.equal(precheck.classification.status, 'COMPLETE');
    assert.equal(
      validateGeneratedMealCandidate({ ingredients: candidateIngredients, dietaryPreference: 'VEGAN', allergens: [] })
        .accepted,
      false,
      'The same raw recipe must fail a definite dietary conflict before review.'
    );

    const chicken =
      (await prisma.foodItem.findFirst({ where: { name: { equals: 'Chicken breast', mode: 'insensitive' } } })) ??
      (await prisma.foodItem.create({
        data: { name: 'Chicken breast', category: 'POULTRY', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      }));
    const carrot =
      (await prisma.foodItem.findFirst({ where: { name: { equals: 'Carrot', mode: 'insensitive' } } })) ??
      (await prisma.foodItem.create({
        data: { name: 'Carrot', category: 'VEGETABLES', calories: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2 },
      }));
    cycleId = `batch10-observed-${marker}`;
    const cycle = await createFixturePlanCycle(prisma, {
      id: cycleId,
      userId: patient.id,
      status: MealPlanCycleStatus.ACTIVE,
    });
    const plan = await prisma.mealPlan.create({
      data: {
        planGroupId: cycle.id,
        userId: patient.id,
        mealType: MealType.LUNCH,
        mealName,
        description: 'Simmer the chicken and carrots in water until fully cooked.',
        calories: 420,
        proteinG: 32,
        carbsG: 46,
        fatG: 13,
        scheduledDate: cycle.startDate,
        candidateProvenance: 'RAW_RECIPE_CORPUS',
        sourceRawRecipeCandidateId: candidateId,
        claimedByNutritionistId: rnd.id,
        claimedAt: new Date(),
        ingredients: {
          create: [
            {
              ingredientName: 'Chicken breast',
              category: 'PROTEIN',
              foodItemId: chicken.id,
              dataSource: 'FNRI',
              quantity: 100,
              unit: 'g',
            },
            {
              ingredientName: 'Carrot',
              category: 'PRODUCE',
              foodItemId: carrot.id,
              dataSource: 'FNRI',
              quantity: 50,
              unit: 'g',
            },
          ],
        },
      },
    });
    planId = plan.id;
    const approved = await NutritionistReviewService.approveMealPlan(
      rnd.id,
      plan.id,
      'Reviewed the observed recipe for this patient.'
    );
    assert.equal(approved.success, true);
    const draft = await createOrReuseLibraryDraftFromApprovedPlan(rnd.id, plan.id);
    assert.equal(draft.deduplicated, false);
    libraryMealId = draft.meal.id;
    assert.equal(draft.meal.safetyEvidenceStatus, 'INCOMPLETE');
    const eligibleQuery = {
      mealType: MealType.LUNCH,
      dailyCalorieTarget: 1200,
      userConditions: [],
      userAllergens: [],
      profile: { userId: patient.id, dietaryPreference: 'OMNIVORE', otherConditions: null, otherAllergies: null },
      search: mealName,
      limit: 10,
    } as const;
    assert.equal(
      (await queryEligibleLibraryMeals(eligibleQuery)).some((meal) => meal.id === libraryMealId),
      false
    );
    const edited = await NutritionistLibraryService.editLibraryMeal(rndUser.id, 'NUTRITIONIST', libraryMealId, {
      mealName,
      description: plan.description,
      calories: 420,
      proteinG: 32,
      carbsG: 46,
      fatG: 13,
      applicableMealTypes: [MealType.LUNCH],
      riceRole: 'PAIR_WITH_RICE',
    });
    const certified = await certifyLibraryMealSafety(
      rnd.id,
      libraryMealId,
      certifyMealLibrarySafetySchema.parse({
        expectedRevision: edited.safetyEvidenceRevision,
        conditionDeclarationState: 'NOT_REVIEWED',
        allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
        crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
        suitableConditions: [],
        allergensPresent: [],
        allergensReviewedAbsent: ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS'],
      })
    );
    assert.equal(certified?.safetyEvidenceStatus, 'COMPLETE');
    assert.equal(
      (await queryEligibleLibraryMeals(eligibleQuery)).some((meal) => meal.id === libraryMealId),
      true
    );
    await removePublishedFixture();

    await UserPrivacyService.deleteAccount(patient.id, { password });
    accounts.splice(accounts.indexOf(patient.id), 1);
    assert.equal(await prisma.user.count({ where: { id: patient.id } }), 0);
    assert.equal(await prisma.clinicalProfileReview.count({ where: { id: historicalReviewId } }), 0);
    assert.equal(await prisma.mealLog.count({ where: { id: logId } }), 0);
    assert.equal(await prisma.outsideMealItemRevision.count({ where: { outsideMealLogItemId: itemId } }), 0);
    const deidentified = await prisma.observedMealSubmission.findUniqueOrThrow({ where: { id: consent.id } });
    assert.equal(deidentified.sourceUserId, null);
    assert.equal(deidentified.sourceOutsideMealItemId, null);
    assert.equal(
      (await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidateId } })).status,
      'AVAILABLE'
    );
    assert.equal(
      await prisma.auditEvent.count({
        where: {
          entityId: patient.id,
          action: 'USER_SELF_DELETION',
        },
      }),
      1
    );
    console.log(
      '[Batch 10 integrated roles] PASS: admin Lead, user log, RND clarification/correction, observed candidate plan approval, explicit reusable certification, privacy deletion'
    );
  } finally {
    await removePublishedFixture();
    if (submissionId) await prisma.observedMealSubmission.deleteMany({ where: { id: submissionId } });
    if (candidateId) await prisma.rawRecipeCandidate.deleteMany({ where: { id: candidateId } });
    for (const id of accounts) {
      const reviewer = await prisma.nutritionistProfile.findUnique({ where: { userId: id }, select: { id: true } });
      if (reviewer) continue; // work credits are append-only; the disposable database is destroyed after this run.
      await prisma.user.delete({ where: { id } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 10 integrated roles] FAIL', error);
  process.exitCode = 1;
});
