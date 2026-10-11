import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import router from '../src/routes/nutritionist.routes';
import { signAccessToken } from '../src/lib/jwt';

test('retired dispute endpoints retain authentication and eligibility but never change decisions', async (context) => {
  process.env.JWT_SECRET ||= 'synthetic-dispute-retirement-secret';
  let role = 'NUTRITIONIST';
  let verified = true;
  const original = {
    user: prisma.user.findUnique,
    profile: prisma.nutritionistProfile.findUnique,
    application: prisma.nutritionistApplication.findUnique,
    transaction: prisma.$transaction,
  };
  context.after(() => {
    prisma.user.findUnique = original.user;
    prisma.nutritionistProfile.findUnique = original.profile;
    prisma.nutritionistApplication.findUnique = original.application;
    prisma.$transaction = original.transaction;
  });
  prisma.user.findUnique = (async () => ({
    role,
    email: 'rnd@example.invalid',
    isSuspended: false,
    emailVerified: true,
  })) as never;
  prisma.nutritionistProfile.findUnique = (async () => ({
    id: 'rnd',
    isVerified: verified,
    prcLicenseExpiry: new Date('2099-01-01'),
  })) as never;
  prisma.nutritionistApplication.findUnique = (async () => null) as never;
  prisma.$transaction = (async () => {
    throw new Error('Retired routes must not write');
  }) as never;
  const app = express();
  app.use(express.json());
  app.use('/rnd', router);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/rnd`;
  const headers = {
    authorization: `Bearer ${signAccessToken({ userId: 'rnd', email: 'rnd@example.invalid', role: 'NUTRITIONIST' })}`,
    'content-type': 'application/json',
  };
  for (const [path, method] of [
    ['/governance/queue?view=disputed', 'GET'],
    ['/condition-clearances/old/resolve', 'POST'],
    ['/review/old/dispute-resolution', 'POST'],
  ]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
    role = 'USER';
    assert.equal((await fetch(base + path, { method, headers })).status, 403);
    role = 'NUTRITIONIST';
    verified = false;
    assert.equal((await fetch(base + path, { method, headers })).status, 403);
    verified = true;
    const response = await fetch(base + path, { method, headers });
    assert.equal(response.status, 410);
    assert.equal(((await response.json()) as { code: string }).code, 'MEAL_DISPUTES_RETIRED');
  }
});
