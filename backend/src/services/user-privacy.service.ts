import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export class UserPrivacyService {
  static async exportAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        tosAccepted: true,
        tosAcceptedAt: true,
        acceptedTermsVersion: true,
        acceptedPrivacyVersion: true,
        healthDataConsentedAt: true,
        onboardingDone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        userProfile: true,
        healthConditions: true,
        allergies: true,
        safetyProfileEntries: true,
        nutritionReport: true,
        mealPlans: { include: { ingredients: true } },
        mealLogs: true,
        weightLogs: true,
        waterLogs: true,
        dailyNutritionLogs: true,
        groceryLists: { include: { groceryItems: true } },
        notifications: true,
        weeklyCheckins: true,
        healthProfileRevisions: true,
      },
    });
    if (!user) throw new Error('Account not found.');

    return {
      format: 'NutriMind Account Export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: user,
    };
  }

  static async deleteAccount(userId: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, passwordHash: true },
    });
    if (!user || user.role !== 'USER') throw new Error('Only patient accounts can use self-service deletion.');
    if (!await bcrypt.compare(password, user.passwordHash)) throw new Error('Current password is incorrect.');

    await prisma.$transaction(async (tx) => {
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          action: 'USER_SELF_DELETION',
          entityType: 'User',
          entityId: userId,
          metadata: { initiatedBy: 'SELF_SERVICE' },
        },
      });
      await tx.user.delete({ where: { id: userId } });
    });
  }
}
