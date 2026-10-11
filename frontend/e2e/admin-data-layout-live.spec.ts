import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DataWorkspace } from '../src/features/admin-data/types';

test.skip(!process.env.SYNTHETIC_JOURNEY_GUIDE, 'Requires the private marked-account guide and normal localhost API.');

test('admin summaries retain evidence and navigation across themes and viewport sizes', async ({ page }) => {
  test.setTimeout(240_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(test.info().project.use.baseURL!).hostname);
  const guide = JSON.parse(readFileSync(process.env.SYNTHETIC_JOURNEY_GUIDE!, 'utf8')) as {
    status: string;
    newAccountPassword: string;
    accounts: Array<{ email: string; role: string }>;
  };
  const admin = guide.accounts.find(
    (account) => account.email === 'sleep-admin@example.test' && account.role === 'ADMIN'
  );
  expect(guide.status).toBe('COMPLETE');
  expect(admin).toBeTruthy();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 500)
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill(admin!.email);
  await page.getByLabel('Password', { exact: true }).fill(guide.newAccountPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview(?:\?.*)?$/, { timeout: 60_000 });

  let workspace: DataWorkspace | undefined;
  for (const [width, height, theme] of [
    [1440, 1000, 'light'],
    [1440, 1000, 'dark'],
    [1280, 900, 'light'],
    [390, 844, 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate((value) => localStorage.setItem('nutrimind-theme', value), theme);
    const loaded = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/admin/data' && response.request().method() === 'GET'
    );
    await page.goto('/admin/data');
    const response = await loaded;
    expect(response.ok()).toBe(true);
    workspace = (await response.json()).data as DataWorkspace;
    await expect(page.getByRole('heading', { name: 'Publishing workspace' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/);
    await expect(page.getByText(workspace.summary.foodItems.toLocaleString('en-PH'), { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(2);
    const workflow = page.locator('summary').filter({ hasText: 'Four-step publishing workflow' });
    await workflow.scrollIntoViewIfNeeded();
    await workflow.focus();
    await page.keyboard.press('Enter');
    await expect(workflow.locator('..')).toHaveAttribute('open');
    await page.keyboard.press('Enter');
    await expect(workflow.locator('..')).not.toHaveAttribute('open');
    await page.getByRole('heading', { name: 'Nutrition data center' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`data-${width}-${theme}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'View releases', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sources & releases' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Manage imports & publishing' }).click();
  await expect(page.getByRole('tab', { name: 'Import & publish' })).toHaveAttribute('aria-selected', 'true');

  // Real login/API above; only the following layout extremes use controlled data.
  expect(workspace).toBeTruthy();
  const fixture = structuredClone(workspace!);
  fixture.summary = { ...fixture.summary, dataSources: 0, activeReleases: 0, consumptionStats: 0 };
  fixture.sources = [];
  fixture.releases = [];
  await page.route('**/api/admin/data', (route) => route.fulfill({ json: { success: true, data: fixture } }));
  await page.goto('/admin/data');
  await expect(page.getByRole('button', { name: 'Register the first source' })).toBeVisible();
  await expect(page.getByText('No active reference-data release is recorded in this workspace.')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('data-empty.png') });
  await page.getByRole('button', { name: 'Register the first source' }).click();
  await expect(page.getByRole('tab', { name: 'Sources & releases' })).toHaveAttribute('aria-selected', 'true');
  await page.unroute('**/api/admin/data');
  const longData = structuredClone(workspace!);
  for (const release of longData.releases) {
    release.source.name =
      'Government food composition and aggregate consumption survey for extended regional reference coverage';
    release.versionLabel = 'LONG_RECORDED_RELEASE_IDENTIFIER_'.repeat(8);
  }
  await page.route('**/api/admin/data', (route) => route.fulfill({ json: { success: true, data: longData } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/data');
  await expect(
    page
      .getByText(
        'Government food composition and aggregate consumption survey for extended regional reference coverage'
      )
      .first()
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(2);
  await page.getByRole('heading', { name: 'Active evidence freshness' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('data-long-mobile.png') });
  await page.unroute('**/api/admin/data');

  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate((value) => localStorage.setItem('nutrimind-theme', value), theme);
    await page.goto('/admin/overview?tab=summary');
    await expect(page.getByRole('heading', { name: 'Food catalogue & serving records' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('link', { name: 'View fnri food records', exact: true })).toHaveAttribute(
      'href',
      '/admin/data'
    );
    await page.getByRole('heading', { name: 'Food catalogue & serving records' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`overview-${theme}.png`) });
  }
  expect(errors).toEqual([]);
});
