import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Opt-in: these tests use ordinary UI login and the real configured development API.
// Provision a fresh marked account set first; never supply real account credentials.
test.skip(!process.env.SYNTHETIC_JOURNEY_GUIDE, 'Requires a private synthetic account credential guide.');
type Guide = { status: string; newAccountPassword: string; accounts: Array<{ email: string; role: string }> };
function guide(): Guide {
  const data = JSON.parse(readFileSync(process.env.SYNTHETIC_JOURNEY_GUIDE!, 'utf8')) as Guide;
  expect(data.status).toBe('COMPLETE');
  expect(data.accounts.every((row) => row.email.endsWith('@example.test'))).toBe(true);
  return data;
}

async function signIn(page: Page, email: string, destination: RegExp) {
  const account = guide();
  expect(account.accounts.some((row) => row.email === email)).toBe(true);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/') && response.status() >= 500)
      failures.push(`${response.status()} ${url.pathname}`);
  });
  expect(['localhost', '127.0.0.1']).toContain(new URL(test.info().project.use.baseURL!).hostname);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(account.newAccountPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(destination, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Your workspace took too long to open' })).toHaveCount(0);
  return failures;
}

async function inspect(page: Page, route: string) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(route.split('?')[0].replaceAll('/', '\\/')), { timeout: 45_000 });
  await expect(page.locator('main').first()).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('main').first()).not.toHaveText(/^\s*$/);
  await expect(page.getByText('Could not load your account profile', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Application error: a client-side exception has occurred')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(2);
}

for (const [width, theme] of [
  [1440, 'light'],
  [390, 'dark'],
] as const) {
  test(`ordinary healthy member login and workspace views: ${width}px ${theme}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((value) => localStorage.setItem('nutrimind-theme', value), theme);
    const errors = await signIn(page, 'sleep-healthy@example.test', /\/dashboard$/);
    for (const route of [
      '/dashboard',
      '/meals',
      '/meals?tab=history',
      '/meals?tab=library',
      '/grocery',
      '/progress',
      '/membership',
      '/profile/personal',
      '/profile/nutrition-report',
    ])
      await inspect(page, route);
    await expect(page.getByRole('heading', { name: /Nutrition report/ })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`member-report-${theme}.png`) });
    expect(errors).toEqual([]);
  });
}

for (const name of ['heart', 'diabetes', 'kidney', 'allergy', 'vegan', 'pregnant']) {
  test(`member ${name}: ordinary login, health details, account settings and report`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await signIn(page, `sleep-${name}@example.test`, /\/dashboard$/);
    for (const route of ['/profile/personal', '/profile/clinical-evidence', '/profile/nutrition-report', '/membership'])
      await inspect(page, route);
    expect(errors).toEqual([]);
  });
}

for (const name of ['a', 'b']) {
  test(`active RND ${name}: ordinary login and desktop review portals`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors = await signIn(page, `sleep-rnd-${name}@example.test`, /\/nutritionist\/reviews$/);
    for (const route of [
      '/nutritionist/reviews',
      '/nutritionist/library',
      '/nutritionist/profile',
      '/nutritionist/audit',
    ])
      await inspect(page, route);
    expect(errors).toEqual([]);
  });
}

test('administrator: ordinary login, audit tabs, data and test-account options', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors = await signIn(page, 'sleep-admin@example.test', /\/admin\/overview(?:\?.*)?$/);
  for (const route of [
    '/admin/overview',
    '/admin/users',
    '/admin/users?tab=nutritionists',
    '/admin/data',
    '/admin/meals',
    '/admin/audit',
  ])
    await inspect(page, route);
  for (const tab of ['Admin activity', 'RND history', 'Member subscriptions', 'Meal logs']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await inspect(page, '/admin/users');
  await page.getByRole('button', { name: 'Create test accounts', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Email name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Age', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Current weight (kg)', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('admin-test-account-options.png') });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('synthetic credentials retain expired/unverified review gates and suspension login denial', async ({
  request,
}) => {
  const account = guide();
  for (const state of ['expired', 'unverified', 'suspended']) {
    const login = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: `sleep-rnd-${state}@example.test`, password: account.newAccountPassword },
    });
    if (state === 'suspended') {
      expect(login.status()).toBe(400);
      expect((await login.json()).error).toMatch(/suspended/i);
    } else {
      expect(login.status()).toBe(200);
      const token = (await login.json()).data.accessToken;
      const queue = await request.get('http://localhost:5000/api/nutritionist/queue', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(queue.status()).toBe(403);
    }
  }
});
