import prisma from '../src/lib/prisma';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { UserService } from '../src/services/user.service';

const email = `structured-safety-${Date.now()}@example.invalid`;

async function main() {
  if (process.env.ALLOW_STRUCTURED_SAFETY_ACCEPTANCE !== 'true') {
    throw new Error('Set ALLOW_STRUCTURED_SAFETY_ACCEPTANCE=true only after the migration target is approved.');
  }

  const user = await prisma.user.create({
    data: {
      name: 'Structured Safety Acceptance Fixture',
      email,
      passwordHash: 'not-a-login-credential',
      emailVerified: true,
      userProfile: { create: {} },
    },
  });

  try {
    const inputs = [
      { domain: 'CONDITION' as const, value: 'DIABETES; Gout', provenance: 'CUSTOM' as const },
      { domain: 'ALLERGY' as const, value: 'egg / soy', provenance: 'CUSTOM' as const },
      { domain: 'INTOLERANCE' as const, value: 'lactose intolerance', provenance: 'CUSTOM' as const },
      { domain: 'AVOIDED_INGREDIENT' as const, value: 'pork', provenance: 'CUSTOM' as const },
    ];
    const first = await SafetyIntakeService.save(user.id, inputs);
    if (!first.changed || first.entries.length !== 6 || !first.requiresReview) {
      throw new Error('Initial structured save did not retain the complete conservative restriction set.');
    }

    const [profile, firstRevisionCount] = await Promise.all([
      UserService.getUserProfileDetails(user.id),
      prisma.healthProfileRevision.count({ where: { userId: user.id, revisionType: 'STRUCTURED_SAFETY_UPDATED' } }),
    ]);
    if (profile?.safetyEntries.length !== 6 || firstRevisionCount !== 1) {
      throw new Error('Structured entries did not survive profile reload with one history revision.');
    }
    if (!profile.userProfile?.otherConditions?.includes('Gout') ||
        !profile.userProfile?.otherAllergies?.includes('Lactose')) {
      throw new Error('Backwards-compatible legacy projection is incomplete.');
    }

    const second = await SafetyIntakeService.save(user.id, inputs);
    const secondRevisionCount = await prisma.healthProfileRevision.count({
      where: { userId: user.id, revisionType: 'STRUCTURED_SAFETY_UPDATED' },
    });
    if (second.changed || secondRevisionCount !== firstRevisionCount) {
      throw new Error('Identical structured safety submission was not idempotent.');
    }

    console.log(JSON.stringify({
      success: true,
      entriesReloaded: profile.safetyEntries.length,
      revisions: secondRevisionCount,
      idempotent: !second.changed,
    }));
  } finally {
    await prisma.user.deleteMany({ where: { email } });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Structured safety acceptance failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
