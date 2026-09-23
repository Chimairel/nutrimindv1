import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MealType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AppError } from '../src/errors/AppError';
import { ObservedMealService } from '../src/services/observed-meal.service';
import { OutsideMealCaptureService } from '../src/services/outside-meal-capture.service';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';
import { assertObservedSourceStillAvailable } from '../src/services/nutritionist-review.service';

async function rejectsCode(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (error: unknown) => error instanceof AppError && error.errorCode === code);
}

async function main() {
  const marker = randomUUID();
  const users: string[] = [];
  const submissions: string[] = [];
  const references: string[] = [];
  const candidates: string[] = [];
  const detailsOnly = { detailsConsent: true, imageReuseConsent: false, imageRightsConfirmed: false };
  const withImage = { detailsConsent: true, imageReuseConsent: true, imageRightsConfirmed: true };
  try {
    for (const suffix of ['a', 'b']) {
      const user = await prisma.user.create({
        data: {
          email: `batch9-${suffix}-${marker}@example.invalid`,
          name: `Batch 9 ${suffix}`,
          passwordHash: 'disabled',
          emailVerified: true,
        },
      });
      users.push(user.id);
    }
    const rndUser = await prisma.user.create({
      data: {
        email: `batch9-rnd-${marker}@example.invalid`,
        name: 'Batch 9 RND',
        passwordHash: 'disabled',
        role: 'NUTRITIONIST',
        emailVerified: true,
      },
    });
    users.push(rndUser.id);
    const rnd = await prisma.nutritionistProfile.create({
      data: {
        userId: rndUser.id,
        prcLicenseNumber: `BATCH9-${marker}`,
        prcLicenseExpiry: new Date('2030-12-31T00:00:00Z'),
        isVerified: true,
      },
    });

    async function confirmed(userId: string, name: string, portionGrams: number) {
      const log = await prisma.mealLog.create({
        data: {
          userId,
          source: 'USER_LOGGED',
          status: 'DONE',
          mealName: name,
          mealType: MealType.LUNCH,
          calories: 400,
          proteinG: 30,
          carbsG: 45,
          fatG: 12,
          dataSource: 'NUTRITIONIST_REVIEWED',
          notes: `Private note ${marker}`,
          estimationContext: 'Simmer chicken, carrots, and water until cooked.',
          outsideImage: Buffer.from('private photo'),
          outsideImageMime: 'image/png',
          outsideItems: {
            create: {
              position: 0,
              name,
              portionGrams,
              source: 'NUTRITIONIST_REVIEWED',
              nutritionStatus: 'VERIFIED',
              compatibilityStatus: 'INSUFFICIENT_EVIDENCE',
              includedInTotals: true,
              calories: 400,
              proteinG: 30,
              carbsG: 45,
              fatG: 12,
              currentRevision: 1,
              review: { create: { status: 'VERIFIED', reviewedRevision: 0, reviewedAt: new Date() } },
            },
          },
        },
        include: { outsideItems: true },
      });
      return { logId: log.id, itemId: log.outsideItems[0].id };
    }

    const refA = await confirmed(users[0], `Batch9 food ${marker}`, 250);
    assert.equal(await prisma.observedMealSubmission.count({ where: { sourceOutsideMealItemId: refA.itemId } }), 0);
    await rejectsCode(
      () =>
        ObservedMealService.consent(users[0], refA.logId, refA.itemId, { ...withImage, imageRightsConfirmed: false }),
      'REUSE_CONSENT_REQUIRED'
    );
    await rejectsCode(
      () => ObservedMealService.consent(users[1], refA.logId, refA.itemId, detailsOnly),
      'OUTSIDE_ITEM_NOT_FOUND'
    );
    const consentA = await ObservedMealService.consent(users[0], refA.logId, refA.itemId, detailsOnly);
    submissions.push(consentA.id);
    assert.equal(consentA.imageReuseConsentedAt, null);
    const sharedName = `Batch9 plain food ${marker}`;
    const admittedA = await ObservedMealService.admit(rnd.id, consentA.id, {
      kind: 'FOOD_REFERENCE',
      canonicalName: sharedName,
    });
    references.push(admittedA.id);
    assert.equal(admittedA.duplicate, false);
    const reference = await prisma.observedFoodReference.findUniqueOrThrow({ where: { id: admittedA.id } });
    assert.equal(reference.name, sharedName);
    assert.equal(JSON.stringify(reference).includes(marker + '@example.invalid'), false);
    assert.equal(JSON.stringify(reference).includes('Private note'), false);

    const refB = await confirmed(users[1], `Batch9 food ${marker}`, 250);
    const consentB = await ObservedMealService.consent(users[1], refB.logId, refB.itemId, detailsOnly);
    submissions.push(consentB.id);
    const admittedB = await ObservedMealService.admit(rnd.id, consentB.id, {
      kind: 'FOOD_REFERENCE',
      canonicalName: sharedName,
    });
    assert.equal(admittedB.id, admittedA.id);
    assert.equal(admittedB.duplicate, true);
    assert.equal(
      await prisma.observedMealSubmission.count({
        where: {
          foodReferenceId: admittedA.id,
          status: 'ADMITTED_REFERENCE',
        },
      }),
      2
    );

    const recipeA = await confirmed(users[0], `Batch9 stew ${marker}`, 300);
    const recipeConsentA = await ObservedMealService.consent(users[0], recipeA.logId, recipeA.itemId, withImage);
    submissions.push(recipeConsentA.id);
    assert.ok(recipeConsentA.imageReuseConsentedAt);
    const ingredients = [
      { name: 'chicken', quantity: 100, unit: 'g' },
      { name: 'carrot', quantity: 50, unit: 'g' },
      { name: 'water', quantity: 200, unit: 'ml' },
    ];
    const recipeInput = {
      kind: 'RECIPE_CANDIDATE' as const,
      canonicalName: `Batch9 chicken stew ${marker}`,
      ingredients,
      preparation: 'Simmer the chicken, carrot, and water until completely cooked.',
      mealTypes: [MealType.LUNCH, MealType.DINNER],
    };
    await rejectsCode(
      () =>
        ObservedMealService.admit(rnd.id, recipeConsentA.id, {
          ...recipeInput,
          ingredients: [{ name: 'chicken', quantity: 0, unit: 'g' }],
        }),
      'RECIPE_EVIDENCE_INCOMPLETE'
    );
    const admittedRecipeA = await ObservedMealService.admit(rnd.id, recipeConsentA.id, recipeInput);
    candidates.push(admittedRecipeA.id);
    const candidate = await prisma.rawRecipeCandidate.findUniqueOrThrow({
      where: { id: admittedRecipeA.id },
      include: { applicableMealTypes: true, mealPlans: true },
    });
    await prisma.$transaction((tx) => assertObservedSourceStillAvailable(tx, candidate.id));
    assert.equal(candidate.sourceName, 'USER_OBSERVED');
    assert.equal(candidate.sourceImageUrl, null, 'Separate image consent does not publish private media.');
    assert.equal(candidate.mealPlans.length, 0);
    assert.equal(candidate.applicableMealTypes.length, 2);
    assert.equal(await prisma.mealLibrary.count({ where: { mealName: candidate.recipeName } }), 0);
    const page = await databaseRecipeCandidateProvider.list({
      mealType: MealType.LUNCH,
      dietaryPreference: 'OMNIVORE',
      sourceKind: 'USER_OBSERVED',
      search: candidate.recipeName,
      limit: 10,
    });
    assert.equal(page.items.find((row) => row.id === candidate.id)?.provenance, 'USER_OBSERVED');

    const recipeB = await confirmed(users[1], `Batch9 stew ${marker}`, 300);
    const recipeConsentB = await ObservedMealService.consent(users[1], recipeB.logId, recipeB.itemId, detailsOnly);
    submissions.push(recipeConsentB.id);
    const admittedRecipeB = await ObservedMealService.admit(rnd.id, recipeConsentB.id, recipeInput);
    assert.equal(admittedRecipeB.id, candidate.id);
    assert.equal(admittedRecipeB.duplicate, true);
    assert.equal(
      await prisma.observedMealSubmission.count({
        where: {
          rawRecipeCandidateId: candidate.id,
          status: 'ADMITTED_RECIPE',
        },
      }),
      2
    );
    const variant = await confirmed(users[0], `Batch9 stew ${marker}`, 300);
    const variantConsent = await ObservedMealService.consent(users[0], variant.logId, variant.itemId, detailsOnly);
    submissions.push(variantConsent.id);
    const variantAdmission = await ObservedMealService.admit(rnd.id, variantConsent.id, {
      ...recipeInput,
      preparation: 'Roast the chicken and carrot first, then add water and simmer until cooked.',
    });
    candidates.push(variantAdmission.id);
    assert.notEqual(variantAdmission.id, candidate.id);

    const toVoid = await confirmed(users[1], `Batch9 stew ${marker}`, 300);
    const voidConsent = await ObservedMealService.consent(users[1], toVoid.logId, toVoid.itemId, detailsOnly);
    submissions.push(voidConsent.id);
    const voidAdmission = await ObservedMealService.admit(rnd.id, voidConsent.id, {
      ...recipeInput,
      preparation: 'Steam the chicken and carrot, then simmer briefly in water.',
    });
    candidates.push(voidAdmission.id);
    await OutsideMealCaptureService.voidLog(users[1], toVoid.logId, 'Recorded by mistake');
    assert.equal(
      (await prisma.observedMealSubmission.findUniqueOrThrow({ where: { id: voidConsent.id } })).status,
      'WITHDRAWN'
    );
    assert.equal(
      (await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: voidAdmission.id } })).status,
      'RETIRED'
    );

    await ObservedMealService.withdraw(users[0], recipeConsentA.id);
    assert.equal(
      (await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidate.id } })).status,
      'AVAILABLE'
    );
    await ObservedMealService.withdraw(users[1], recipeConsentB.id);
    assert.equal(
      (await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidate.id } })).status,
      'RETIRED'
    );
    await assert.rejects(
      () => prisma.$transaction((tx) => assertObservedSourceStillAvailable(tx, candidate.id)),
      /observed recipe was withdrawn/i
    );
    await prisma.user.delete({ where: { id: users[0] } });
    users.splice(0, 1);
    const afterDelete = await prisma.observedMealSubmission.findUniqueOrThrow({ where: { id: variantConsent.id } });
    assert.equal(afterDelete.sourceUserId, null);
    assert.equal(afterDelete.sourceOutsideMealItemId, null);
    assert.equal(
      (await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: variantAdmission.id } })).status,
      'AVAILABLE',
      'A deidentified admitted candidate survives source account deletion.'
    );
    console.log('[Batch 9 observed corpus acceptance] PASS');
  } finally {
    await prisma.observedMealSubmission.deleteMany({ where: { id: { in: submissions } } });
    await prisma.rawRecipeCandidate.deleteMany({ where: { id: { in: candidates } } });
    await prisma.observedFoodReference.deleteMany({ where: { id: { in: references } } });
    for (const id of users) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 9 observed corpus acceptance] FAIL', error);
  process.exitCode = 1;
});
