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
    },
  });
  console.log('   └─ NutritionistProfile ready (verified, PRC-RND-NM-0001)\n');

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
