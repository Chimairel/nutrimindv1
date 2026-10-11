import { expect, test } from '@playwright/test';

for (const scenario of [
  { kind: 'database-limit', theme: 'light', width: 1440, message: 'database service has reached its usage limit' },
  { kind: 'server', theme: 'light', width: 1440, message: 'HTTP 503' },
  { kind: 'server', theme: 'dark', width: 1440, message: 'HTTP 503' },
  { kind: 'connection', theme: 'light', width: 390, message: 'received no response from the server' },
  { kind: 'timeout', theme: 'dark', width: 1440, message: 'did not finish within 60 seconds' },
]) {
  test(`account profile ${scenario.kind} recovery in ${scenario.theme} at ${scenario.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 1000 });
    const owner = 'profile-recovery-fixture';
    const token = Buffer.from(
      JSON.stringify({
        userId: owner,
        email: 'fixture@example.test',
        role: 'NUTRITIONIST',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    await page.context().addCookies([{ name: 'nutrimind_session', value: `fixture.${token}.fixture`, url: origin }]);
    await page.addInitScript((theme) => localStorage.setItem('nutrimind-theme', theme), scenario.theme);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let recover = false;
    let profileRequests = 0;
    let releaseStall!: () => void;
    const stalled = new Promise<void>((resolve) => {
      releaseStall = resolve;
    });
    if (scenario.kind === 'timeout') await page.clock.install();
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api/, '');
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      };
      if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      if (path === '/user/profile') {
        profileRequests++;
        if (!recover) {
          if (scenario.kind === 'connection') return route.abort('failed');
          if (scenario.kind === 'timeout') {
            await stalled;
            return route.abort('failed');
          }
          return route.fulfill({
            status: 503,
            headers,
            json: {
              success: false,
              error: 'Private raw diagnostic must never render',
              requestId: 'profile-browser-request',
              ...(scenario.kind === 'database-limit' ? { errorCode: 'DATABASE_QUOTA_EXCEEDED' } : {}),
            },
          });
        }
        data = {
          id: owner,
          name: 'Synthetic reviewer',
          email: 'fixture@example.test',
          role: 'NUTRITIONIST',
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          reportAcknowledged: true,
        };
      } else if (path === '/nutritionist/review-work-counts') data = { meal: 0, case: 0, profile: 0 };
      else if (path.includes('notifications')) data = { notifications: [], unreadCount: 0 };
      await route.fulfill({ headers, json: { success: true, data } });
    });
    try {
      await page.goto('/nutritionist/reviews');
      await expect.poll(() => profileRequests).toBeGreaterThan(0);
      if (scenario.kind === 'timeout') await page.clock.fastForward(60_001);
      const alert = page
        .getByRole('alert')
        .filter({ has: page.getByRole('heading', { name: 'Could not load your account profile' }) });
      await expect(alert).toContainText(scenario.message, { timeout: 15000 });
      await expect(alert).not.toContainText('Private raw diagnostic');
      if (scenario.kind === 'server') {
        expect(profileRequests).toBe(4);
        await expect(alert).toContainText('Request ID: profile-browser-request');
      }
      expect(page.url()).toContain('/nutritionist/reviews');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('failure.png') });
      recover = true;
      releaseStall();
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(alert).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
      if (scenario.width >= 1024)
        await expect(page.getByRole('region', { name: 'A clear path to every review' })).toBeVisible();
      else await expect(page.getByText('Use a desktop to review meals')).toBeVisible();
      expect(page.url()).toContain('/nutritionist/reviews');
      expect(errors).toEqual([]);
    } finally {
      releaseStall();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}
