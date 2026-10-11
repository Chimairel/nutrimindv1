import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { NutritionistWorkCountsService } from '../src/services/nutritionist-work-counts.service';
import { MealBaseVerificationService } from '../src/services/meal-base-verification.service';
import { NutritionistProfileWorkService } from '../src/services/nutritionist-profile-work.service';
import { NutritionistService } from '../src/services/nutritionist.service';

test('work counts include current queues without reading historical disputed plans or clearances', async () => {
  const restore = [
    MealBaseVerificationService.count,
    NutritionistService.getReviewQueueCount,
    NutritionistProfileWorkService.queue,
    prisma.outsideMealReview.count,
    prisma.mealConditionClearance.count,
    prisma.mealLibraryProfileApproval.count,
    prisma.mealPlan.count,
  ] as const;
  MealBaseVerificationService.count = async () => 4;
  Object.defineProperty(NutritionistService, 'getReviewQueueCount', { value: async () => 8, configurable: true });
  NutritionistProfileWorkService.queue = (async () => [{ profileStatus: 'PENDING', documentCount: 2 }]) as never;
  prisma.outsideMealReview.count = (async () => 3) as never;
  prisma.mealConditionClearance.count = (async (args: any) => {
    assert.deepEqual(args.where.state, { in: ['REVIEW_DUE', 'SUSPENDED'] });
    return 2;
  }) as never;
  prisma.mealLibraryProfileApproval.count = (async () => 1) as never;
  prisma.mealPlan.count = (async () => {
    throw new Error('Historical disputes must not inflate active work');
  }) as never;
  try {
    assert.deepEqual(await NutritionistWorkCountsService.get('rnd'), { meal: 4, case: 11, profile: 3, audit: 3 });
  } finally {
    MealBaseVerificationService.count = restore[0];
    NutritionistProfileWorkService.queue = restore[2];
    prisma.outsideMealReview.count = restore[3];
    prisma.mealConditionClearance.count = restore[4];
    prisma.mealLibraryProfileApproval.count = restore[5];
    prisma.mealPlan.count = restore[6];
    Object.defineProperty(NutritionistService, 'getReviewQueueCount', { value: restore[1], configurable: true });
  }
});
