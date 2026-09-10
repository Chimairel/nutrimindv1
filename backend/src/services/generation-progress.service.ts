import prisma from '@/lib/prisma';
import { MealPlanGenerationJobStatus } from '@prisma/client';

export async function updateGenerationProgress(
  jobId: string | undefined,
  progressPct: number,
  stageCode: string,
  stageMessage: string
) {
  if (!jobId) return;
  await prisma.mealPlanGenerationJob.updateMany({
    where: { id: jobId, status: MealPlanGenerationJobStatus.GENERATING },
    data: { progressPct, stageCode, stageMessage },
  });
}
