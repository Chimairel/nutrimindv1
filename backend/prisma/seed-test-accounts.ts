/**
 * Seed script to create ADMIN and NUTRITIONIST test accounts.
 *
 * Usage: npx tsx prisma/seed-test-accounts.ts
 *
 * Accounts created:
 *   - admin@gmail.com / Admin123 (ADMIN role)
 *   - nutritionist@gmail.com / Nutritionist123 (NUTRITIONIST role, with a complete fictional professional profile)
 *
 * Both accounts skip email verification and onboarding so you can log in directly.
 */

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test accounts...\n');

  // ── ADMIN ACCOUNT ──
  const adminPassword = await bcrypt.hash('Admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {}, // Don't overwrite if it already exists
    create: {
      name: 'Admin User',
      email: 'admin@gmail.com',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      tosAcceptedAt: new Date(),
    },
  });
  console.log(`✅ ADMIN account ready: admin@gmail.com / Admin123 (id: ${admin.id})`);

  // ── NUTRITIONIST ACCOUNT ──
  const nutriPassword = await bcrypt.hash('Nutritionist123', 12);
  const nutritionist = await prisma.user.upsert({
    where: { email: 'nutritionist@gmail.com' },
    update: {
      name: 'Andrea Reyes, RND',
      role: Role.NUTRITIONIST,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
    },
    create: {
      name: 'Andrea Reyes, RND',
      email: 'nutritionist@gmail.com',
      passwordHash: nutriPassword,
      role: Role.NUTRITIONIST,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      tosAcceptedAt: new Date(),
    },
  });
  console.log(`✅ NUTRITIONIST account ready: nutritionist@gmail.com / Nutritionist123 (id: ${nutritionist.id})`);

  // Create NutritionistProfile (required for the nutritionist portal to work)
  await prisma.nutritionistProfile.upsert({
    where: { userId: nutritionist.id },
    update: {
      verifiedByAdminId: admin.id,
      prcLicenseNumber: 'PRC-RND-NM-0001',
      prcLicenseExpiry: new Date('2028-12-31'),
      specialization: 'Clinical and Community Nutrition',
      yearsOfExperience: 6,
      university: 'University of San Carlos',
      bio: 'Registered nutritionist-dietitian focused on practical meal planning, food accessibility, and evidence-informed nutrition education for Filipino adults.',
      isVerified: true,
      verifiedAt: new Date(),
      canLeadReview: false,
    },
    create: {
      userId: nutritionist.id,
      prcLicenseNumber: 'PRC-RND-NM-0001',
      prcLicenseExpiry: new Date('2028-12-31'),
      specialization: 'Clinical and Community Nutrition',
      yearsOfExperience: 6,
      university: 'University of San Carlos',
      bio: 'Registered nutritionist-dietitian focused on practical meal planning, food accessibility, and evidence-informed nutrition education for Filipino adults.',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedByAdminId: admin.id,
      canLeadReview: false,
    },
  });

  // Two distinct Lead fixtures are required to exercise independent enhanced
  // review and third-party dispute adjudication without weakening the checks.
  for (const lead of [
    {
      email: 'nutritionist.lead1@gmail.com',
      name: 'Beatriz Cruz, RND',
      license: 'PRC-RND-NM-0002',
      university: 'University of the Philippines Manila',
    },
    {
      email: 'nutritionist.lead2@gmail.com',
      name: 'Carlo Mendoza, RND',
      license: 'PRC-RND-NM-0003',
      university: 'University of Santo Tomas',
    },
  ]) {
    const leadUser = await prisma.user.upsert({
      where: { email: lead.email },
      update: {
        name: lead.name,
        passwordHash: nutriPassword,
        role: Role.NUTRITIONIST,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
      },
      create: {
        name: lead.name,
        email: lead.email,
        passwordHash: nutriPassword,
        role: Role.NUTRITIONIST,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        tosAcceptedAt: new Date(),
      },
    });
    await prisma.nutritionistProfile.upsert({
      where: { userId: leadUser.id },
      update: {
        prcLicenseNumber: lead.license,
        prcLicenseExpiry: new Date('2028-12-31'),
        specialization: 'Clinical Nutrition and Safety Review',
        yearsOfExperience: 8,
        university: lead.university,
        bio: 'Fixture Lead RND for independent enhanced review, ruleset governance, and dispute testing.',
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByAdminId: admin.id,
        canLeadReview: true,
      },
      create: {
        userId: leadUser.id,
        prcLicenseNumber: lead.license,
        prcLicenseExpiry: new Date('2028-12-31'),
        specialization: 'Clinical Nutrition and Safety Review',
        yearsOfExperience: 8,
        university: lead.university,
        bio: 'Fixture Lead RND for independent enhanced review, ruleset governance, and dispute testing.',
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByAdminId: admin.id,
        canLeadReview: true,
      },
    });
    console.log(`✅ LEAD NUTRITIONIST ready: ${lead.email} / Nutritionist123 (id: ${leadUser.id})`);
  }
  // ── TEST REGULAR USER (NO MEAL PLAN) ──
  const userPassword = await bcrypt.hash('Password123!', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'testuser@gmail.com' },
    update: {
      passwordHash: userPassword,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
    },
    create: {
      name: 'Maria Santos',
      email: 'testuser@gmail.com',
      passwordHash: userPassword,
      role: Role.USER,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      tosAcceptedAt: new Date(),
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: testUser.id },
    update: {
      age: 26,
      heightCm: 162,
      weightKg: 58,
      biologicalSex: 'FEMALE',
      goal: 'MAINTAIN',
      activityLevel: 'LIGHTLY_ACTIVE',
      dailyCalorieTarget: 1850,
      shoppingDayGroup: 'WEEKEND',
      shoppingDayOfWeek: 6,
    },
    create: {
      userId: testUser.id,
      age: 26,
      heightCm: 162,
      weightKg: 58,
      biologicalSex: 'FEMALE',
      goal: 'MAINTAIN',
      activityLevel: 'LIGHTLY_ACTIVE',
      dailyCalorieTarget: 1850,
      shoppingDayGroup: 'WEEKEND',
      shoppingDayOfWeek: 6,
    },
  });

  await prisma.nutritionReport.upsert({
    where: { userId: testUser.id },
    update: {
      acknowledgedAt: new Date(),
      isStale: false,
    },
    create: {
      userId: testUser.id,
      profileRevision: 0,
      isStale: false,
      version: 1,
      acknowledgedAt: new Date(),
      generalSummary: 'Baseline profile ready. Target: 1,850 kcal/day.',
      foodsToAvoid: [],
      foodsToLimit: [],
      foodsRecommended: [],
      drinksGuidance: ['Stay hydrated with 8 glasses of water daily.'],
      basedOnConditions: [],
      basedOnAllergies: [],
    },
  });
  console.log(`✅ TEST USER account ready: testuser@gmail.com / Password123! (id: ${testUser.id})\n`);

  console.log('🎉 Done! You can now log in with:');
  console.log('   ADMIN:        admin@gmail.com / Admin123');
  console.log('   NUTRITIONIST: nutritionist@gmail.com / Nutritionist123');
  console.log('   USER:         testuser@gmail.com / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
