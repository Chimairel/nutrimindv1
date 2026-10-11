import 'dotenv/config';

import app from './app';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { MealAiQueueService } from '@/services/meal-ai-queue.service';
import { triggerMealRemindersInBackground, waitForMealReminders } from '@/services/meal-reminder.service';

const server = app.listen(env.PORT, () => {
  logger.info('server_started', { port: env.PORT, environment: env.NODE_ENV });
  MealAiQueueService.startWorker();
  triggerMealRemindersInBackground();
});

const mealReminderTimer = setInterval(triggerMealRemindersInBackground, 30_000);
mealReminderTimer.unref();

let shutdownPromise: Promise<void> | null = null;

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function shutdown(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    logger.info('server_shutdown', { signal, outcome: 'STARTED' });
    clearInterval(mealReminderTimer);
    // Stop new turns before draining HTTP; release only this process's owned job.
    const workerShutdown = MealAiQueueService.shutdown();
    await Promise.all([closeServer(), workerShutdown]);
    await waitForMealReminders();
    await prisma.$disconnect();
    logger.info('server_shutdown', { signal, outcome: 'COMPLETED' });
  })();
  return shutdownPromise;
}

function requestShutdown(signal: 'SIGINT' | 'SIGTERM'): void {
  void shutdown(signal).catch(() => {
    process.exitCode = 1;
    logger.error('server_shutdown', { signal, outcome: 'FAILED' });
  });
}

process.once('SIGTERM', () => requestShutdown('SIGTERM'));
process.once('SIGINT', () => requestShutdown('SIGINT'));
