import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import prisma from '../src/lib/prisma';

const statePath = process.env.NUTRIMIND_ROLE_JOURNEY_STATE_PATH?.trim();

type JourneyState = {
  applicationId: string;
  applicantEmail: string;
  applicantUserId: string;
  nutritionistProfileId: string;
  userEmail: string;
  userId: string;
  planGroupId: string;
  reviewedMealId: string;
};

async function main() {
  assert.equal(process.env.NODE_ENV, 'test', 'Finalization requires NODE_ENV=test.');
  assert.equal(process.env.NUTRIMIND_ROLE_JOURNEY_ACK, 'shared-development-test-data');
  assert.ok(statePath && path.isAbsolute(statePath), 'An absolute role-journey state path is required.');
  const state = JSON.parse(await readFile(statePath, 'utf8')) as JourneyState;
  assert.match(state.applicantEmail, /^journey\.nutritionist\.[a-z0-9-]+@example\.com$/);
  assert.match(state.userEmail, /^journey\.user\.[a-z0-9-]+@example\.com$/);

  // A completed review creates append-only compensation evidence. Preserve the
  // linked actors and source meal as an auditable fixture, but revoke every
  // session and suspend both known-password accounts after browser acceptance.
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: { in: [state.applicantUserId, state.userId] } } });
    await tx.user.updateMany({
      where: { id: { in: [state.applicantUserId, state.userId] } },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: `Retained append-only role-journey fixture ${state.planGroupId}`,
      },
    });
  });

  const [actors, workCredits, reviewedMeal, application] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [state.applicantUserId, state.userId] } },
      select: { id: true, isSuspended: true, sessions: { select: { id: true } } },
    }),
    prisma.nutritionistWorkCredit.count({ where: { nutritionistProfileId: state.nutritionistProfileId } }),
    prisma.mealPlan.findUnique({ where: { id: state.reviewedMealId }, select: { status: true } }),
    prisma.nutritionistApplication.findUnique({ where: { id: state.applicationId }, select: { status: true } }),
  ]);
  assert.equal(actors.length, 2);
  assert.ok(actors.every((actor) => actor.isSuspended && actor.sessions.length === 0));
  assert.ok(workCredits > 0, 'The append-only review credit must remain auditable.');
  assert.equal(reviewedMeal?.status, 'APPROVED');
  assert.equal(application?.status, 'ACTIVATED');

  await unlink(statePath);
  console.log(JSON.stringify({
    outcome: 'RETAINED_AS_SUSPENDED_AUDIT_FIXTURE',
    actorsSuspended: actors.length,
    sessionsRevoked: true,
    appendOnlyWorkCreditsPreserved: workCredits,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Role journey finalization failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
