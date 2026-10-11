import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Person } from '../src/features/nutritionist-profile-review/ProfileWorkPanel.shared';

test.skip(!process.env.SYNTHETIC_JOURNEY_GUIDE, 'Requires the private marked-account guide and normal localhost API.');

test('RND queue rows preserve keyboard preview, themes, search and claim boundaries', async ({ page }) => {
  test.setTimeout(180_000);
  expect(['localhost', '127.0.0.1']).toContain(new URL(test.info().project.use.baseURL!).hostname);
  const guide = JSON.parse(readFileSync(process.env.SYNTHETIC_JOURNEY_GUIDE!, 'utf8')) as {
    status: string;
    newAccountPassword: string;
    accounts: Array<{ email: string; role: string }>;
  };
  expect(guide.status).toBe('COMPLETE');
  expect(
    guide.accounts.some((account) => account.email === 'sleep-rnd-a@example.test' && account.role === 'NUTRITIONIST')
  ).toBe(true);
  const errors: string[] = [];
  const mutations: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 500)
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/nutritionist/') && request.method() !== 'GET')
      mutations.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('sleep-rnd-a@example.test');
  await page.getByLabel('Password', { exact: true }).fill(guide.newAccountPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/nutritionist\/reviews$/, { timeout: 60_000 });

  let people: Person[] = [];
  for (const [width, theme] of [
    [1440, 'light'],
    [1280, 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((value) => localStorage.setItem('nutrimind-theme', value), theme);
    await page.goto('/nutritionist/reviews');
    const caseFilters = page.getByRole('navigation', { name: 'Case approval filters' });
    await expect(caseFilters.getByRole('button')).toHaveCount(2);
    await expect(caseFilters.getByRole('button', { name: 'Pending', exact: true })).toBeVisible();
    await expect(caseFilters.getByRole('button', { name: 'Outside food logs', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Needs resolution', exact: true })).toHaveCount(0);
    const loaded = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/nutritionist/profile-work'
    );
    await page
      .getByRole('navigation', { name: 'RND review queues' })
      .getByRole('button', { name: /Member queue/ })
      .click();
    const response = await loaded;
    expect(response.ok()).toBe(true);
    people = (await response.json()).data;
    expect(people.length).toBeGreaterThan(0);
    const navigation = page.getByRole('complementary', { name: 'Member review navigation' });
    const first = navigation.getByRole('button').first();
    await expect(first).toBeEnabled();
    await navigation.screenshot({ path: test.info().outputPath(`members-${width}-${theme}.png`) });
    const detailLoaded = page.waitForResponse(
      (res) => new URL(res.url()).pathname === `/api/nutritionist/profile-work/${people[0].userId}`
    );
    await first.focus();
    await page.keyboard.press('Enter');
    expect((await detailLoaded).ok()).toBe(true);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(`Profile review · ${people[0].name}`, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(2);
    await page.screenshot({ path: test.info().outputPath(`member-preview-${width}-${theme}.png`) });
    const search = navigation.getByRole('searchbox');
    await search.fill('no-match-queue-fixture');
    await expect(navigation.getByRole('status')).toHaveText('No members match your search.');
    // Filtering the navigator keeps the already opened review intact.
    await expect(page.getByText(`Profile review · ${people[0].name}`, { exact: true })).toBeVisible();
  }
  await page.goto('/nutritionist/reviews');
  await page
    .getByRole('navigation', { name: 'RND review queues' })
    .getByRole('button', { name: /Meal verification/ })
    .click();
  const recipes = page.getByRole('complementary', { name: 'Meal verification navigation' });
  await expect(recipes.getByRole('searchbox')).toBeVisible();
  await expect(recipes.getByLabel('Loading review queue items')).toHaveCount(0, { timeout: 30_000 });
  await recipes.screenshot({ path: test.info().outputPath('recipes-dark.png') });

  // The following long-name and peer-claim layout extremes use controlled queue data only.
  const fixture = [
    {
      ...people[0],
      name: 'Extended member name with multiple words and a long_identifier_that_must_wrap_without_overflow',
      conditions: ['HEART_CONDITION', 'DIABETES'],
      allergies: ['NUTS', 'SHELLFISH'],
      profileStatus: 'PENDING',
      documentCount: 2,
    },
  ];
  await page.route('**/api/nutritionist/profile-work', (route) =>
    route.fulfill({ json: { success: true, data: fixture } })
  );
  await page.goto('/nutritionist/reviews');
  await page
    .getByRole('navigation', { name: 'RND review queues' })
    .getByRole('button', { name: /Member queue/ })
    .click();
  const memberNavigation = page.getByRole('complementary', { name: 'Member review navigation' });
  await expect(memberNavigation.getByRole('button', { name: /Extended member name/ })).toBeVisible();
  await memberNavigation.screenshot({ path: test.info().outputPath('member-long-dark.png') });
  await expect
    .poll(() => memberNavigation.evaluate((element) => element.scrollWidth - element.clientWidth))
    .toBeLessThanOrEqual(2);
  await page.route('**/api/nutritionist/queue', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 'layout-fixture',
            mealName: 'Long recipe name with a full plate and rice accompaniment',
            mealType: 'LUNCH',
            user: { id: 'fixture', name: fixture[0].name },
            calories: 600,
            sourceProvenance: 'RAW_RECIPE_CORPUS',
            scheduledDate: '2026-10-11',
            shoppingDeadlineAt: '2026-10-11',
            cookDeadlineAt: '2026-10-12',
            assuranceTier: 'ENHANCED',
            remainingReviewers: 1,
            coalescedDependentCount: 3,
            highRiskReviewRequired: true,
            requiresSafetyRevalidation: true,
            claimStatus: { claimedByOther: true, claimedByMe: false },
          },
        ],
      },
    })
  );
  await page.goto('/nutritionist/reviews');
  const cases = page.getByRole('list', { name: 'Meals awaiting case approval' });
  await expect(cases.getByRole('button', { name: /Long recipe name/ })).toBeDisabled();
  await expect(cases.getByText('Review health context')).toBeVisible();
  await cases.screenshot({ path: test.info().outputPath('case-long-peer-claim-dark.png') });
  await expect
    .poll(() => cases.evaluate((element) => element.scrollWidth - element.clientWidth))
    .toBeLessThanOrEqual(2);
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});
