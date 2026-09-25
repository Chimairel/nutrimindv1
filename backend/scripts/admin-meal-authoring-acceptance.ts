import assert from 'node:assert/strict';
import prisma from '@/lib/prisma';
import { AdminMealAuthoringService } from '@/services/admin-meal-authoring.service';
import { getNutritionistMealLibraryWithFilters } from '@/services/nutritionist-library-query.service';
import { evaluateMealLibrarySafetyEvidence } from '@/domain/meal-library-safety-evidence.policy';
import type { AdminMealInput } from '@/validation/admin-meal.schemas';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55479');
  assert.equal(target.pathname, '/nutrimind_admin_meal');

  const admin = await prisma.user.create({ data: {
    name: 'Fixture Admin', email: 'admin-meal-fixture@nutrimind.invalid',
    passwordHash: 'fixture-only', role: 'ADMIN', emailVerified: true,
  } });
  const fnri = await prisma.foodItem.create({ data: {
    name: 'Fixture cooked rice', category: 'Cereals', source: 'FNRI',
    calories: 130, proteinG: 2, carbsG: 29, fatG: 0.5,
  } });
  const nonFnri = await prisma.foodItem.create({ data: {
    name: 'Fixture external food', category: 'Cereals', source: 'OTHER',
    calories: 130, proteinG: 2, carbsG: 29, fatG: 0.5,
  } });
  const input: AdminMealInput = {
    mealName: 'Fixture rice bowl', mealType: 'LUNCH',
    summary: 'A simple fixture rice bowl for review.',
    instructions: 'Cook the rice thoroughly and serve one portion in a clean bowl.',
    nutritionBasis: 'Per-serving FNRI composition calculation for fixture rice.',
    nutritionServingDescription: 'One bowl',
    calories: 130, proteinG: 2, carbsG: 29, fatG: 0.5,
    sodiumMg: null, sugarG: null, fiberG: null, potassiumMg: null, phosphorusMg: null,
    saturatedFatG: null,
    ingredients: [{ foodItemId: fnri.id, gramsPerServing: 100 }],
  };
  await assert.rejects(
    AdminMealAuthoringService.create(admin.id, { ...input, ingredients: [{ foodItemId: nonFnri.id, gramsPerServing: 100 }] }),
    /FNRI catalogue/
  );
  const created = await AdminMealAuthoringService.create(admin.id, input);
  const row = await prisma.mealLibrary.findUniqueOrThrow({
    where: { id: created.id }, include: { ingredients: true, safetyDeclarations: true, safetyReviews: true },
  });
  assert.equal(row.safetyEvidenceStatus, 'INCOMPLETE');
  assert.equal(row.safetyReviewedByNutritionistId, null);
  assert.equal(row.ingredients[0].foodItemId, fnri.id);
  assert.equal(row.ingredients[0].quantity, 100);
  assert.equal(row.safetyReviews[0].reasonCode, 'ADMIN_AUTHORED_DRAFT');
  assert.equal(evaluateMealLibrarySafetyEvidence({ ...row, reviewerEligible: false }).complete, false);
  const queue = await getNutritionistMealLibraryWithFilters('', { adminDraftsOnly: true });
  assert.equal(queue.meals.some((meal) => meal.id === created.id), true);

  const revised = await AdminMealAuthoringService.update(admin.id, created.id, {
    ...input, summary: 'A revised fixture rice bowl for review.', expectedRevision: 1,
  });
  assert.equal(revised.revision, 2);
  await assert.rejects(AdminMealAuthoringService.update(admin.id, created.id, {
    ...input, expectedRevision: 1,
  }), /Draft changed/);
  await assert.rejects(AdminMealAuthoringService.create(admin.id, {
    ...input, summary: 'Same recipe signature under a different description.',
  }), /exact meal recipe already exists/);
  const listed = await AdminMealAuthoringService.list(1);
  assert.equal(listed.items.find((item) => item.id === created.id)?.canEdit, true);
  assert.equal(listed.items.find((item) => item.id === created.id)?.nutritionBasis, input.nutritionBasis);
  console.log('Admin meal authoring acceptance passed: FNRI gate, incomplete safety, RND visibility, revision lock, dedup.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
