import prisma from '@/lib/prisma';
import { HealthConditionType, AllergenType, HealthProfileRevisionType } from '@prisma/client';

export class UserSafetyIntakeService {
  static async updateHealthConditions(userId: string, conditions: HealthConditionType[]) {
    // Perform operations in a database transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing conditions
      await tx.healthCondition.deleteMany({
        where: { userId },
      });

      // 2. Create the new conditions
      if (conditions.length > 0) {
        await tx.healthCondition.createMany({
          data: conditions.map((cond) => ({
            userId,
            condition: cond,
          })),
        });
      }
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.CONDITIONS_UPDATED,
          snapshot: { conditions },
        },
      });
    });

    // Fetch and return updated conditions
    return prisma.healthCondition.findMany({
      where: { userId },
    });
  }

  static async updateHealthConditionsWithCustom(
    userId: string,
    conditions: HealthConditionType[],
    otherConditions: string
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.healthCondition.deleteMany({ where: { userId } });
      await tx.healthCondition.createMany({
        data: conditions.map((condition) => ({ userId, condition })),
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: { otherConditions },
        create: { userId, otherConditions },
      });
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.CONDITIONS_UPDATED,
          snapshot: { conditions, otherConditions },
        },
      });
    });

    return prisma.healthCondition.findMany({ where: { userId } });
  }

  /**
   * Updates user allergens atomically within a transaction.
   */
  static async updateAllergies(userId: string, allergies: AllergenType[]) {
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing allergies
      await tx.allergy.deleteMany({
        where: { userId },
      });

      // 2. Create the new allergies
      if (allergies.length > 0) {
        await tx.allergy.createMany({
          data: allergies.map((allg) => ({
            userId,
            allergen: allg,
          })),
        });
      }
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.ALLERGIES_UPDATED,
          snapshot: { allergies },
        },
      });
    });

    // Fetch and return updated allergies
    return prisma.allergy.findMany({
      where: { userId },
    });
  }

  static async updateAllergiesWithCustom(userId: string, allergies: AllergenType[], otherAllergies: string) {
    await prisma.$transaction(async (tx) => {
      await tx.allergy.deleteMany({ where: { userId } });
      await tx.allergy.createMany({
        data: allergies.map((allergen) => ({ userId, allergen })),
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: { otherAllergies },
        create: { userId, otherAllergies },
      });
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.ALLERGIES_UPDATED,
          snapshot: { allergies, otherAllergies },
        },
      });
    });

    return prisma.allergy.findMany({ where: { userId } });
  }

  /**
   * Saves the complete clinical restriction profile in one transaction. The
   * caller can then run exactly one safety scan against a coherent snapshot.
   */
  static async updateSafetyProfile(
    userId: string,
    conditions: HealthConditionType[],
    otherConditions: string,
    allergies: AllergenType[],
    otherAllergies: string
  ) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        healthConditions: { select: { condition: true } },
        allergies: { select: { allergen: true } },
        userProfile: { select: { otherConditions: true, otherAllergies: true } },
      },
    });
    if (!current) throw new Error('User not found.');

    const normalized = (values: readonly string[]) => [...new Set(values)].sort();
    const conditionsChanged =
      JSON.stringify(normalized(current.healthConditions.map((item) => item.condition))) !==
        JSON.stringify(normalized(conditions)) || (current.userProfile?.otherConditions || '') !== otherConditions;
    const allergiesChanged =
      JSON.stringify(normalized(current.allergies.map((item) => item.allergen))) !==
        JSON.stringify(normalized(allergies)) || (current.userProfile?.otherAllergies || '') !== otherAllergies;
    const changed = conditionsChanged || allergiesChanged;

    if (!changed) {
      return {
        conditions: current.healthConditions,
        allergies: current.allergies,
        changed: false,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.healthCondition.deleteMany({ where: { userId } });
      await tx.allergy.deleteMany({ where: { userId } });

      if (conditions.length > 0) {
        await tx.healthCondition.createMany({
          data: conditions.map((condition) => ({ userId, condition })),
        });
      }
      if (allergies.length > 0) {
        await tx.allergy.createMany({
          data: allergies.map((allergen) => ({ userId, allergen })),
        });
      }

      await tx.userProfile.upsert({
        where: { userId },
        update: { otherConditions, otherAllergies },
        create: { userId, otherConditions, otherAllergies },
      });
      if (conditionsChanged) {
        await tx.healthProfileRevision.create({
          data: {
            userId,
            revisionType: HealthProfileRevisionType.CONDITIONS_UPDATED,
            snapshot: { conditions, otherConditions },
          },
        });
      }
      if (allergiesChanged) {
        await tx.healthProfileRevision.create({
          data: {
            userId,
            revisionType: HealthProfileRevisionType.ALLERGIES_UPDATED,
            snapshot: { allergies, otherAllergies },
          },
        });
      }

      // A report based on the previous restrictions must be acknowledged only
      // after it is regenerated for the new clinical context.
      await tx.nutritionReport.updateMany({
        where: { userId },
        data: { acknowledgedAt: null },
      });
    });

    const [savedConditions, savedAllergies] = await Promise.all([
      prisma.healthCondition.findMany({ where: { userId } }),
      prisma.allergy.findMany({ where: { userId } }),
    ]);
    return { conditions: savedConditions, allergies: savedAllergies, changed: true };
  }

  /**
   * Saves custom free-text health conditions to the user's profile.
   * This is separate from the enum-based healthConditions table.
   */
  static async updateOtherConditions(userId: string, otherConditions: string) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { otherConditions },
      create: { userId, otherConditions },
    });
  }

  /**
   * Saves custom free-text food allergies to the user's profile.
   * This is separate from the enum-based allergies table.
   */
  static async updateOtherAllergies(userId: string, otherAllergies: string) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { otherAllergies },
      create: { userId, otherAllergies },
    });
  }
}
