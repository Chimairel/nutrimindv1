import dotenv from 'dotenv';
// Load environment variables as early as possible
dotenv.config();

import app from './app';
import { assertProductionConfig } from '@/domain/production-config.policy';
import prisma from '@/lib/prisma';
import { billingProcessingWorker } from '@/billing/runtime';

const PORT = process.env.PORT || 5000;

assertProductionConfig(process.env);

const server = app.listen(PORT, () => {
  console.log(`[Server] NutriMind API server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  billingProcessingWorker.start();
});

let shutdownPromise: Promise<void> | null = null;

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function shutdown(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.log(JSON.stringify({ type: 'server_shutdown', signal, outcome: 'STARTED' }));
    await billingProcessingWorker.stop();
    await closeServer();
    await prisma.$disconnect();
    console.log(JSON.stringify({ type: 'server_shutdown', signal, outcome: 'COMPLETED' }));
  })();
  return shutdownPromise;
}

function requestShutdown(signal: 'SIGINT' | 'SIGTERM'): void {
  void shutdown(signal).catch(() => {
    process.exitCode = 1;
    console.error(JSON.stringify({ type: 'server_shutdown', signal, outcome: 'FAILED' }));
  });
}

process.once('SIGTERM', () => requestShutdown('SIGTERM'));
process.once('SIGINT', () => requestShutdown('SIGINT'));
