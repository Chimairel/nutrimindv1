import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import AuthService, { GoogleAuthFlowError, type VerifiedGoogleIdentity } from '../src/services/auth.service';

async function main() {
  const marker = randomUUID();
  const identity: VerifiedGoogleIdentity = {
    email: `google-intent-${marker}@example.test`,
    sub: `google-sub-${marker}`,
    given_name: 'Google',
    family_name: 'Fixture',
  };

  let createdUserId: string | null = null;
  try {
    await assert.rejects(
      () => AuthService.completeGoogleAuth(identity, 'LOGIN'),
      (error: unknown) => error instanceof GoogleAuthFlowError && error.code === 'ACCOUNT_NOT_FOUND'
    );
    assert.equal(await prisma.user.count({ where: { email: identity.email } }), 0);

    const registration = await AuthService.completeGoogleAuth(identity, 'REGISTER');
    createdUserId = registration.user.id;
    const created = await prisma.user.findUniqueOrThrow({
      where: { id: createdUserId },
      include: { accounts: true, sessions: true },
    });
    assert.equal(created.emailVerified, true);
    assert.equal(created.passwordLoginEnabled, false);
    assert.equal(created.onboardingDone, false);
    assert.equal(created.accounts.length, 1);
    assert.equal(created.accounts[0].provider, 'google');
    assert.equal(created.accounts[0].providerAccountId, identity.sub);
    assert.equal(created.accounts[0].access_token, null);
    assert.equal(created.sessions.length, 1);

    await AuthService.forgotPassword(identity.email);
    const afterRecoveryAttempt = await prisma.user.findUniqueOrThrow({ where: { id: createdUserId } });
    assert.equal(afterRecoveryAttempt.passwordResetToken, null);
    assert.equal(afterRecoveryAttempt.passwordResetExpiry, null);

    await assert.rejects(
      () => AuthService.completeGoogleAuth(identity, 'REGISTER'),
      (error: unknown) => error instanceof GoogleAuthFlowError && error.code === 'ACCOUNT_EXISTS'
    );

    const login = await AuthService.completeGoogleAuth(identity, 'LOGIN');
    assert.equal(login.user.id, createdUserId);
    assert.equal(await prisma.account.count({ where: { userId: createdUserId, provider: 'google' } }), 1);
    assert.equal(await prisma.session.count({ where: { userId: createdUserId } }), 2);

    console.log(
      JSON.stringify(
        {
          pass: true,
          missingLoginDidNotProvision: true,
          explicitRegistrationCreatedAccount: true,
          googleRegistrationHasNoPasswordLogin: true,
          googleOnlyRecoveryDidNotIssueToken: true,
          googleLinkPersistedWithoutPicture: true,
          repeatRegistrationRejected: true,
          existingAccountLoginSucceeded: true,
        },
        null,
        2
      )
    );
  } finally {
    if (createdUserId) await prisma.user.deleteMany({ where: { id: createdUserId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
