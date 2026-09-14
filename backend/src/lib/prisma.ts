import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  const extended = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const isConnectionReset = (err: any): boolean => {
            if (!err) return false;
            if (err.code === 'P1017') return true;
            const msg = typeof err.message === 'string' ? err.message : '';
            return (
              msg.includes('closed the connection') ||
              msg.includes('forcibly closed') ||
              msg.includes('ConnectionReset') ||
              msg.includes('10054')
            );
          };

          try {
            return await query(args);
          } catch (error: any) {
            let lastError = error;
            for (let attempt = 1; attempt <= 3; attempt++) {
              if (isConnectionReset(lastError)) {
                console.warn(
                  `[Prisma] Connection severed by database host (attempt ${attempt}/3). Purging pool and reconnecting...`
                );
                await baseClient.$disconnect().catch(() => undefined);
                await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
                await baseClient.$connect().catch(() => undefined);
                try {
                  return await query(args);
                } catch (retryErr: any) {
                  lastError = retryErr;
                  continue;
                }
              }
              break;
            }
            throw lastError;
          }
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
