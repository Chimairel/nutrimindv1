import assert from 'node:assert/strict';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const { default: prisma } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { TestPremiumService } = await import('../src/services/test-premium.service');
  const stamp = Date.now();
  const admin = await prisma.user.create({
    data: { name: 'Synthetic admin', email: `admin-${stamp}@example.test`, passwordHash: 'not-a-login', role: 'ADMIN' },
  });
  const user = await prisma.user.create({
    data: { name: 'Synthetic tester', email: `tester-${stamp}@example.test`, passwordHash: 'not-a-login' },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const request = (actor: typeof user, path: string, method: string, body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`,
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await request(user, '/user/test-premium', 'POST', { action: 'grant' })).status, 403);
    assert.equal(
      (await request(user, `/admin/users/${user.id}/test-premium-permission`, 'PATCH', { allowed: true })).status,
      403
    );
    assert.equal(
      (await request(admin, `/admin/users/${user.id}/test-premium-permission`, 'PATCH', { allowed: true })).status,
      200
    );
    assert.equal((await request(user, '/user/test-premium', 'POST', { action: 'invalid' })).status, 400);
    assert.equal((await request(user, '/user/test-premium', 'POST', { action: 'grant' })).status, 200);
    await TestPremiumService.toggle(user.id, 'grant');
    assert.equal(await prisma.entitlementGrant.count({ where: { userId: user.id } }), 1);
    const independent = await prisma.entitlementGrant.create({
      data: {
        userId: user.id,
        billingSubjectKey: user.id,
        entitlementKey: 'PREMIUM',
        source: 'ADMIN_ADJUSTMENT',
        sourceKey: `independent-${stamp}`,
        effectiveFrom: new Date(),
        effectiveUntil: new Date(Date.now() + 86400000),
      },
    });
    const revoked = await TestPremiumService.toggle(user.id, 'revoke');
    assert.equal(revoked.isPremium, true);
    assert.equal((await prisma.entitlementGrant.findUniqueOrThrow({ where: { id: independent.id } })).revokedAt, null);
    await TestPremiumService.toggle(user.id, 'grant');
    await TestPremiumService.setPermission(admin.id, user.id, false);
    await assert.rejects(TestPremiumService.toggle(user.id, 'grant'));
    assert.equal((await prisma.entitlementGrant.findUniqueOrThrow({ where: { id: independent.id } })).revokedAt, null);
    assert((await prisma.auditEvent.count({ where: { entityId: user.id } })) >= 5);
    console.log(
      'PASS: admin-only permission, denied self-authorization, validated actions, idempotent test grants, scoped revocation and audit history. Disposable database only.'
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
