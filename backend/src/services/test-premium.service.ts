import prisma from '@/lib/prisma';
import { resolveUserBillingEntitlement } from './user-entitlement-reader.service';

export class TestPremiumPermissionError extends Error {}

export const testPremiumSourceKey = (userId: string) => `sandbox-demo-checkout:${userId}:premium`;

export class TestPremiumService {
  static async setPermission(adminId: string, userId: string, allowed: boolean) {
    return prisma.$transaction(async (tx) => {
      const admin = await tx.user.findUniqueOrThrow({ where: { id: adminId } });
      if (admin.role !== 'ADMIN' || admin.isSuspended) throw new TestPremiumPermissionError('Administrator required.');
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const target = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (target.role !== 'USER') throw new TestPremiumPermissionError('Select a user account.');
      await tx.user.update({ where: { id: userId }, data: { testPremiumAllowed: allowed } });
      if (!allowed) {
        await tx.entitlementGrant.updateMany({
          where: { userId, sourceKey: testPremiumSourceKey(userId), source: 'ADMIN_ADJUSTMENT', revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: 'TEST_PERMISSION_WITHDRAWN' },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: adminId,
          action: allowed ? 'TEST_PREMIUM_PERMISSION_GRANTED' : 'TEST_PREMIUM_PERMISSION_REVOKED',
          entityType: 'User',
          entityId: userId,
          metadata: { allowed },
        },
      });
      return { testPremiumAllowed: allowed };
    });
  }

  static async toggle(userId: string, action: 'grant' | 'revoke') {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.testPremiumAllowed || user.isSuspended || user.role !== 'USER') {
        throw new TestPremiumPermissionError('Ask an administrator to enable Premium testing for your account.');
      }
      const now = new Date();
      const sourceKey = testPremiumSourceKey(userId);
      if (action === 'revoke') {
        await tx.entitlementGrant.updateMany({
          where: { userId, sourceKey, source: 'ADMIN_ADJUSTMENT', revokedAt: null },
          data: { revokedAt: now, revocationReason: 'TEST_GRANT_REVOKED' },
        });
      } else {
        const effectiveUntil = new Date(now.getTime() + 30 * 86400000);
        await tx.entitlementGrant.upsert({
          where: { sourceKey },
          update: { effectiveFrom: now, effectiveUntil, revokedAt: null, revocationReason: null },
          create: {
            userId,
            billingSubjectKey: userId,
            entitlementKey: 'PREMIUM',
            source: 'ADMIN_ADJUSTMENT',
            sourceKey,
            effectiveFrom: now,
            effectiveUntil,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          action: action === 'grant' ? 'TEST_PREMIUM_ACTIVATED' : 'TEST_PREMIUM_REVOKED',
          entityType: 'User',
          entityId: userId,
          metadata: { sourceKey },
        },
      });
      const entitlement = await resolveUserBillingEntitlement(tx, userId, now);
      return {
        isPremium: entitlement.tier === 'PREMIUM',
        expiresAt: entitlement.effectiveUntil?.toISOString() ?? null,
      };
    });
  }
}
