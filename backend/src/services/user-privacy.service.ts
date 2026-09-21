import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { AuthService } from './auth.service';

type AccountDeletionCredential = {
  password?: string;
  googleIdToken?: string;
};

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
        nutritionReportVersions: true,
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
      format: 'KAINARA Account Export',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: user,
    };
  }

  static async deleteAccount(userId: string, credential: AccountDeletionCredential) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        passwordLoginEnabled: true,
        accounts: { where: { provider: 'google' }, select: { providerAccountId: true } },
      },
    });
    if (!user || user.role !== 'USER') throw new Error('Only patient accounts can use self-service deletion.');

    let reauthenticationMethod: 'PASSWORD' | 'GOOGLE';
    if (
      user.passwordLoginEnabled &&
      credential.password &&
      (await bcrypt.compare(credential.password, user.passwordHash))
    ) {
      reauthenticationMethod = 'PASSWORD';
    } else if (credential.googleIdToken) {
      const identity = await AuthService.verifyGoogleIdentity(credential.googleIdToken);
      const verifiedEmail = identity.email?.trim().toLowerCase();
      const subjectMatches = Boolean(
        identity.sub && user.accounts.some((account) => account.providerAccountId === identity.sub)
      );
      if (!subjectMatches && verifiedEmail !== user.email.trim().toLowerCase()) {
        throw new Error('Google account does not match the signed-in KAINARA account.');
      }
      reauthenticationMethod = 'GOOGLE';
    } else {
      throw new Error('Current password is incorrect.');
    }

    const [mealPlans, scopedClearances] = await Promise.all([
      prisma.mealPlan.findMany({ where: { userId }, select: { id: true } }),
      prisma.mealConditionClearance.findMany({ where: { userScopeId: userId }, select: { id: true } }),
    ]);
    const mealPlanIds = mealPlans.map(({ id }) => id);
    const clearanceIds = scopedClearances.map(({ id }) => id);

    // The review graph intentionally uses RESTRICT during ordinary operations.
    // Use a batch transaction here instead of an interactive transaction: the
    // development database is remote, and the default five-second interactive
    // transaction lease can expire between these dependent statements. Prisma
    // sends this ordered batch as one atomic database transaction.
    await prisma.$transaction([
      prisma.mealPlanClearanceUsage.deleteMany({ where: { clearanceId: { in: clearanceIds } } }),
      prisma.mealConditionClearanceDecision.deleteMany({ where: { clearanceId: { in: clearanceIds } } }),
      prisma.mealConditionClearance.deleteMany({ where: { id: { in: clearanceIds } } }),
      prisma.mealPlanReviewDecision.deleteMany({ where: { mealPlanId: { in: mealPlanIds } } }),
      prisma.auditEvent.create({
        data: {
          actorUserId: userId,
          action: 'USER_SELF_DELETION',
          entityType: 'User',
          entityId: userId,
          metadata: { initiatedBy: 'SELF_SERVICE', reauthenticationMethod },
        },
      }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}
