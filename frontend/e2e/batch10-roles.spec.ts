import { expect, test, type Page } from '@playwright/test';

const runId = process.env.BATCH10_BROWSER_RUN_ID;
test.skip(!runId, 'Requires disposable Batch 10 role fixtures.');

async function signIn(page: Page, role: 'user' | 'nutritionist' | 'admin') {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`batch10-browser-${role}-${runId}@example.invalid`);
  await page.getByLabel(/^Password$/).fill('SyntheticBrowser123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(role === 'user' ? /\/dashboard$/ : new RegExp(`/${role}/`), { timeout: 25_000 });
}

async function visitAtBothSizes(page: Page, route: string) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('We could not load this page.')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
}

test('patient workspace opens the plan, groceries, library, and history at desktop and mobile sizes', async ({
  page,
}) => {
  await signIn(page, 'user');
  await visitAtBothSizes(page, '/dashboard');
  await visitAtBothSizes(page, '/meals');
  await visitAtBothSizes(page, '/grocery');
});

test('nutritionist can open plan, outside meal, and library review workspaces', async ({ page }) => {
  await signIn(page, 'nutritionist');
  await visitAtBothSizes(page, '/nutritionist/reviews');
  await visitAtBothSizes(page, '/nutritionist/outside-meals');
  await visitAtBothSizes(page, '/nutritionist/library');
});

test('administrator can inspect account, nutritionist, and operations workspaces', async ({ page }) => {
  await signIn(page, 'admin');
  await visitAtBothSizes(page, '/admin/users');
  await visitAtBothSizes(page, '/admin/nutritionists');
  await visitAtBothSizes(page, '/admin/operations');
});
