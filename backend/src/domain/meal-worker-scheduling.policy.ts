export const MEAL_WORKER_ACTIVE_DELAY_MS = 30_000;
export const MEAL_WORKER_IDLE_DELAY_MS = 15 * 60_000;

/** Keep persisted future retries on time, but let an empty queue sleep. */
export function mealWorkerDelay(worked: boolean, nextAttemptAt: Date | null, now = new Date()): number {
  if (worked) return MEAL_WORKER_ACTIVE_DELAY_MS;
  if (nextAttemptAt)
    return Math.max(
      MEAL_WORKER_ACTIVE_DELAY_MS,
      Math.min(MEAL_WORKER_IDLE_DELAY_MS, nextAttemptAt.getTime() - now.getTime())
    );
  return MEAL_WORKER_IDLE_DELAY_MS;
}
