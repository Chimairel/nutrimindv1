import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MealType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { MealLogService } from '../src/services/meal-log.service';
import { OutsideMealCaptureService } from '../src/services/outside-meal-capture.service';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';

async function main() {
  const run = randomUUID();
  let userId: string | null = null;
  let foodId: string | null = null;
  let catalogMealId: string | null = null;
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 7 Capture Fixture', email: `batch7-${run}@example.invalid`, passwordHash: 'disabled',
        emailVerified: true, onboardingDone: true, tosAccepted: true,
        userProfile: { create: {
          age: 30, biologicalSex: 'FEMALE', heightCm: 160, weightKg: 60, targetWeightKg: 60,
          goal: 'MAINTAIN', activityLevel: 'LIGHTLY_ACTIVE', dietaryPreference: 'OMNIVORE',
          ricePreference: 'FLEXIBLE', dailyCalorieTarget: 2000,
        } },
      },
    });
    userId = user.id;
    const food = await prisma.foodItem.create({ data: {
      name: `Batch 7 measured rice ${run}`, category: 'Grains', source: 'FNRI',
      calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3,
    } });
    foodId = food.id;

    const known = await prisma.mealLibrary.findFirstOrThrow({
      where: { status: 'APPROVED', safetyEvidenceStatus: 'COMPLETE', verifiedByNutritionistId: { not: null } },
      orderBy: { mealName: 'asc' },
    });
    const suggestions = await OutsideMealCaptureService.suggestions(user.id, known.mealName.slice(0, 6));
    assert.ok(suggestions.eligible.some((meal) => meal.id === known.id), 'Certified recipe should be first-party eligible suggestion.');
    assert.ok(suggestions.custom.name);

    const consumedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const libraryInput = {
      userId: user.id, mealType: MealType.LUNCH, requestKey: `batch7-library-${run}`, consumedAt,
      items: [{ name: known.mealName, mealLibraryId: known.id }], notes: 'Private fixture note',
    };
    const libraryPreview = await MealLogService.logOutsideMeal(libraryInput);
    assert.ok('previewRequired' in libraryPreview);
    assert.equal(libraryPreview.items[0].source, 'VERIFIED_LIBRARY');
    assert.equal(libraryPreview.items[0].calories, known.calories);
    assert.ok(libraryPreview.items[0].servingDescription);
    const libraryCommit = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.LUNCH, warningAcknowledged: true,
      confirmationId: libraryPreview.confirmationId, requestKey: libraryInput.requestKey,
    });
    assert.ok('log' in libraryCommit);
    assert.equal(libraryCommit.log.dataSource, 'VERIFIED_LIBRARY');
    assert.equal(libraryCommit.log.notes, 'Private fixture note');
    assert.equal(libraryCommit.log.loggedAt.toISOString(), consumedAt);
    assert.equal((await prisma.outsideMealItemRevision.findFirstOrThrow({
      where: { outsideMealLogItem: { mealLogId: libraryCommit.log.id } },
    })).snapshot !== null, true);
    const commitReplay = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.LUNCH, warningAcknowledged: true,
      confirmationId: libraryPreview.confirmationId,
    });
    assert.ok('log' in commitReplay && commitReplay.replayed);
    const previewReplay = await MealLogService.logOutsideMeal(libraryInput);
    assert.ok('log' in previewReplay && previewReplay.log.id === libraryCommit.log.id);

    const adjusted = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.DINNER, consumedAt,
      items: [{ name: known.mealName, mealLibraryId: known.id,
        reportedNutrition: { calories: known.calories + 25, proteinG: known.proteinG,
          carbsG: known.carbsG, fatG: known.fatG } }],
    });
    assert.ok('previewRequired' in adjusted);
    assert.equal(adjusted.items[0].source, 'USER_ADJUSTED_LIBRARY');

    const mixed = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.SNACK, consumedAt, requestKey: `batch7-mixed-${run}`,
      items: [
        { name: food.name, portionGrams: 100 },
        { name: 'Packaged biscuit', reportedNutrition: { calories: 150, proteinG: 2, carbsG: 22, fatG: 6 } },
        { name: `Unknown fixture dish ${run}` },
      ],
    });
    assert.ok('previewRequired' in mixed);
    assert.deepEqual(mixed.items.map((item) => item.source), ['FNRI', 'USER_REPORTED', 'UNRESOLVED']);
    assert.equal(mixed.summary.totals.calories, 280);
    assert.equal(mixed.summary.provisionalCalories, 280);
    assert.equal(mixed.summary.completeness, 'PARTIAL');
    const mixedCommit = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.SNACK, warningAcknowledged: true,
      confirmationId: mixed.confirmationId,
    });
    assert.ok('log' in mixedCommit);
    await prisma.dailyNutritionLog.create({ data: {
      userId: user.id,
      logDate: getStartOfManilaBusinessDay(new Date(consumedAt)),
      totalCalories: -1, totalProteinG: -1, totalCarbsG: -1, totalFatG: -1,
      targetCalories: 2000, adherencePct: 0,
    } });
    const unknownItem = mixedCommit.log.outsideItems.find((item) => item.source === 'UNRESOLVED');
    assert.ok(unknownItem);
    const edited = await OutsideMealCaptureService.editItem(user.id, mixedCommit.log.id, unknownItem.id, {
      name: unknownItem.name, portionGrams: 180,
      reportedNutrition: { calories: 200, proteinG: 5, carbsG: 30, fatG: 7 },
      reason: 'Read nutrition label later',
    });
    assert.equal(edited.revision, 1);
    assert.equal(edited.log.calories, 480);
    assert.equal((await prisma.dailyNutritionLog.findFirstOrThrow({ where: { userId: user.id } })).totalCalories,
      libraryCommit.log.calories + 480);
    assert.equal((await prisma.outsideMealItemRevision.count({ where: { outsideMealLogItemId: unknownItem.id } })), 2);
    const image = Buffer.from('fixture image bytes');
    await OutsideMealCaptureService.attachImage(user.id, mixedCommit.log.id, { buffer: image, mimetype: 'image/png' });
    assert.deepEqual((await OutsideMealCaptureService.image(user.id, mixedCommit.log.id)).buffer, image);
    const voided = await OutsideMealCaptureService.voidLog(user.id, mixedCommit.log.id, 'Accidental duplicate');
    assert.equal(voided.replayed, false);
    assert.equal((await OutsideMealCaptureService.voidLog(user.id, mixedCommit.log.id, 'Accidental duplicate')).replayed, true);
    assert.equal((await prisma.mealLog.findUniqueOrThrow({ where: { id: mixedCommit.log.id } })).status, 'VOIDED');
    const dailyAfterVoid = await prisma.dailyNutritionLog.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(dailyAfterVoid.totalCalories, libraryCommit.log.calories);
    assert.equal((await prisma.outsideMealItemRevision.findFirstOrThrow({
      where: { outsideMealLogItemId: unknownItem.id, revision: 2 },
    })).nutritionStatus, 'VOIDED');

    await prisma.allergy.create({ data: { userId: user.id, allergen: 'SHELLFISH' } });
    const catalogMeal = await prisma.mealLibrary.create({ data: {
      mealName: `Batch 7 seafood bowl ${run}`, mealType: MealType.SNACK,
      calories: 260, proteinG: 20, carbsG: 20, fatG: 10,
      ingredients: { create: { position: 0, ingredientName: 'shrimp', dataSource: 'SOURCE_RECIPE' } },
    } });
    catalogMealId = catalogMeal.id;
    const catalogSuggestions = await OutsideMealCaptureService.suggestions(user.id, 'Batch 7 seafood bowl');
    assert.ok(catalogSuggestions.otherKnown.some((meal) => meal.id === catalogMeal.id));
    const catalogPreview = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.SNACK, consumedAt,
      items: [{ name: catalogMeal.mealName, mealLibraryId: catalogMeal.id }],
    });
    assert.ok('previewRequired' in catalogPreview);
    assert.equal(catalogPreview.items[0].source, 'UNRESOLVED');
    assert.equal(catalogPreview.items[0].compatibilityStatus, 'CONFLICT_DETECTED');
    const catalogCommit = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.SNACK, warningAcknowledged: true,
      confirmationId: catalogPreview.confirmationId,
    });
    assert.ok('log' in catalogCommit);
    assert.equal(catalogCommit.safetyFollowUp.status, 'CONFLICT_DETECTED');
    assert.ok(catalogCommit.safetyFollowUp.messages.some((message) => /shrimp/i.test(message)));
    const conflict = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.SNACK, consumedAt,
      items: [{ name: 'Shrimp snack', reportedNutrition: { calories: 120, proteinG: 15, carbsG: 3, fatG: 5 } }],
    });
    assert.ok('previewRequired' in conflict);
    const conflictCommit = await MealLogService.logOutsideMeal({
      userId: user.id, mealType: MealType.SNACK, warningAcknowledged: true,
      confirmationId: conflict.confirmationId,
    });
    assert.ok('log' in conflictCommit);
    assert.equal(conflictCommit.safetyFollowUp.status, 'CONFLICT_DETECTED');
    assert.ok((await prisma.mealLog.findUnique({ where: { id: conflictCommit.log.id } }))?.id);
    console.log('[Batch 7 outside capture acceptance] PASS');
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (catalogMealId) await prisma.mealLibrary.delete({ where: { id: catalogMealId } }).catch(() => undefined);
    if (foodId) await prisma.foodItem.delete({ where: { id: foodId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error('[Batch 7 outside capture acceptance] FAIL', error); process.exitCode = 1; });
