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

test('patient and nutritionist complete an outside-meal clarification and correction', async ({ browser }) => {
  test.setTimeout(120_000);
  const patient = await browser.newPage();
  const nutritionist = await browser.newPage();
  const mealName = `Batch 10 home-cooked stew ${runId}-${Date.now()}`;
  try {
    await signIn(patient, 'user');
    await patient.getByRole('button', { name: /Log an outside meal/i }).click();
    const dialog = patient.getByRole('dialog', { name: 'LOG OUTSIDE FOOD' });
    await dialog.getByLabel('Foods eaten').fill(mealName);
    await dialog.getByLabel('Approximate portion in grams (if known)').fill('250');
    await dialog.getByRole('checkbox', { name: /I have nutrition-label or menu values/i }).check();
    await dialog.getByLabel('Calories').fill('400');
    await dialog.getByLabel('Protein (g)').fill('30');
    await dialog.getByLabel('Carbs (g)').fill('45');
    await dialog.getByLabel('Fat (g)').fill('12');
    await dialog.getByRole('button', { name: 'Check nutrition sources' }).click();
    await expect(dialog.getByText('Review before logging')).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm and log' }).click();
    await expect(dialog.getByText('Meal recorded')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();

    await patient.goto('/meals?tab=history');
    const historyCard = patient.locator('article').filter({ hasText: mealName });
    await expect(historyCard).toBeVisible();
    await historyCard.locator('[role="button"]').first().click();
    await historyCard.getByRole('button', { name: 'Request nutrition estimate review' }).click();
    await expect(historyCard.getByText('Queued for nutrition estimate review')).toBeVisible({ timeout: 20_000 });

    await signIn(nutritionist, 'nutritionist');
    await nutritionist.goto('/nutritionist/outside-meals');
    await nutritionist.getByRole('button').filter({ hasText: mealName }).first().click();
    await nutritionist.getByLabel('Review reason').fill('Please confirm the serving size and cooking ingredients.');
    await nutritionist.getByRole('button', { name: 'Need info' }).click();

    await patient.reload();
    const askedCard = patient.locator('article').filter({ hasText: mealName });
    await askedCard.locator('[role="button"]').first().click();
    await expect(askedCard.getByText('Nutritionist needs more information')).toBeVisible();
    await askedCard.getByLabel('Clarification reply').fill('One 250 g bowl with chicken, carrots, and broth.');
    await askedCard.getByRole('button', { name: 'Send clarification' }).click();

    await nutritionist.reload();
    await nutritionist.getByRole('button').filter({ hasText: mealName }).first().click();
    await nutritionist.getByLabel('calories', { exact: true }).fill('420');
    await nutritionist.getByLabel('proteinG', { exact: true }).fill('32');
    await nutritionist.getByLabel('carbsG', { exact: true }).fill('46');
    await nutritionist.getByLabel('fatG', { exact: true }).fill('13');
    await nutritionist.getByLabel('Review reason').fill('Adjusted after the patient clarified the bowl.');
    await nutritionist.getByRole('button', { name: 'Save correction' }).click();

    await patient.reload();
    const correctedCard = patient.locator('article').filter({ hasText: mealName });
    await correctedCard.locator('[role="button"]').first().click();
    await expect(correctedCard.getByText('Corrected and confirmed nutrition estimate')).toBeVisible();
    await expect(correctedCard.getByText('420 kcal', { exact: true }).first()).toBeVisible();
  } finally {
    await patient.close();
    await nutritionist.close();
  }
});
