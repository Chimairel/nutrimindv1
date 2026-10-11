import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';

process.env.JWT_SECRET ||= 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret';

test('profile bootstrap checks current account status and returns the profile with one user read', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  let reads = 0;
  let suspended = false;
  let unavailable = false;
  globals.prisma = {
    user: {
      findUnique: async ({ select }: { select: Record<string, unknown> }) => {
        reads += 1;
        if (unavailable)
          throw {
            name: 'PrismaClientInitializationError',
            message: 'Your account or project has exceeded the quota. private connection string',
          };
        assert.equal(select.isSuspended, true);
        return {
          id: 'bootstrap-user',
          name: 'Test Admin',
          email: 'admin@example.test',
          role: 'ADMIN',
          isSuspended: suspended,
          emailVerified: true,
          passwordLoginEnabled: true,
          tosAccepted: true,
          tosAcceptedAt: new Date(),
          acceptedTermsVersion: null,
          acceptedPrivacyVersion: null,
          healthDataConsentedAt: null,
          onboardingDone: true,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userProfile: null,
          healthConditions: [],
          allergies: [],
          safetyProfileEntries: [],
          nutritionReport: null,
          accounts: [],
        };
      },
    },
  };
  t.after(() => {
    globals.prisma = previous;
  });

  const { authenticateProfile } = await import('../src/middleware/auth');
  const { UserController } = await import('../src/controllers/user.controller');
  const { signAccessToken } = await import('../src/lib/jwt');
  const token = signAccessToken({ userId: 'bootstrap-user', email: 'admin@example.test', role: 'ADMIN' });
  const makeRequest = () => ({ headers: { authorization: `Bearer ${token}` } }) as AuthenticatedRequest;
  let clearedCookies = 0;
  let status = 200;
  let body: { success?: boolean; data?: Record<string, unknown>; errorCode?: string; requestId?: string } = {};
  const res = {
    locals: { requestId: 'bootstrap-request' },
    clearCookie() {
      clearedCookies++;
      return this;
    },
    set() {
      return this;
    },
    status(value: number) {
      status = value;
      return this;
    },
    json(value: typeof body) {
      body = value;
      return this;
    },
  } as unknown as Response;

  const req = makeRequest();
  let authorized = false;
  await authenticateProfile(req, res, () => {
    authorized = true;
  });
  assert.equal(authorized, true);
  await UserController.getProfile(req, res);
  assert.equal(status, 200);
  assert.equal(reads, 1);
  assert.equal(body.data?.email, 'admin@example.test');
  assert.equal(body.data?.isSuspended, undefined);

  suspended = true;
  authorized = false;
  await authenticateProfile(makeRequest(), { ...res, locals: {} } as Response, () => {
    authorized = true;
  });
  assert.equal(authorized, false);
  assert.equal(status, 401);
  assert.equal(reads, 2);
  suspended = false;
  unavailable = true;
  authorized = false;
  await authenticateProfile(makeRequest(), res, () => {
    authorized = true;
  });
  assert.equal(authorized, false);
  assert.equal(status, 503);
  assert.equal(body.errorCode, 'DATABASE_QUOTA_EXCEEDED');
  assert.equal(body.requestId, 'bootstrap-request');
  assert.doesNotMatch(JSON.stringify(body), /private connection/);

  const { default: AuthService } = await import('../src/services/auth.service');
  const { default: AuthController } = await import('../src/controllers/auth.controller');
  const previousLogin = AuthService.login;
  t.after(() => {
    AuthService.login = previousLogin;
  });
  AuthService.login = async () => {
    throw { name: 'PrismaClientInitializationError', message: 'Your account or project has exceeded the quota.' };
  };
  await AuthController.login({ body: { email: 'fixture@example.test', password: 'synthetic-only' } } as never, res);
  assert.equal(status, 503);
  assert.equal(body.errorCode, 'DATABASE_QUOTA_EXCEEDED');
  AuthService.login = async () => {
    throw new Error('Invalid email or password.');
  };
  await AuthController.login({ body: { email: 'fixture@example.test', password: 'synthetic-only' } } as never, res);
  assert.equal(status, 400);
  const previousRefresh = AuthService.refreshToken;
  t.after(() => {
    AuthService.refreshToken = previousRefresh;
  });
  AuthService.refreshToken = async () => {
    throw Object.assign(new Error('Your account or project has exceeded the quota.'), {
      name: 'PrismaClientInitializationError',
    });
  };
  await AuthController.refresh({ cookies: { nutrimind_refresh: 'synthetic-refresh' }, body: {} } as never, res);
  assert.equal(status, 503);
  assert.equal(body.errorCode, 'DATABASE_QUOTA_EXCEEDED');
  assert.equal(clearedCookies, 0);
  AuthService.refreshToken = async () => {
    throw new Error('Invalid session refresh.');
  };
  await AuthController.refresh({ cookies: { nutrimind_refresh: 'synthetic-refresh' }, body: {} } as never, res);
  assert.equal(status, 401);
  assert.equal(clearedCookies, 1);
});
