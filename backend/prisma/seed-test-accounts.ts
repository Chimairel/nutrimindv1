/**
 * Seed script to create ADMIN and NUTRITIONIST test accounts.
 * 
 * Usage: npx tsx prisma/seed-test-accounts.ts
 * 
 * Accounts created:
 *   - admin@gmail.com / Admin123 (ADMIN role)
 *   - nutritionist@gmail.com / Nutritionist123 (NUTRITIONIST role, with NutritionistProfile)
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
    update: {},
    create: {
      name: 'Test Nutritionist',
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
    update: {},
    create: {
      userId: nutritionist.id,
      prcLicenseNumber: 'PRC-TEST-001',
      prcLicenseExpiry: new Date('2028-12-31'),
      specialization: 'Clinical Nutrition',
      yearsOfExperience: 5,
      university: 'University of the Philippines',
      bio: 'Test nutritionist account for development and QA testing.',
      isVerified: true,
      verifiedAt: new Date(),
      verifiedByAdminId: admin.id,
    },
  });
  console.log('   └─ NutritionistProfile created (verified, PRC-TEST-001)\n');

  console.log('🎉 Done! You can now log in with:');
  console.log('   ADMIN:        admin@gmail.com / Admin123');
  console.log('   NUTRITIONIST: nutritionist@gmail.com / Nutritionist123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
