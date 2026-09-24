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

test('a new email account completes onboarding with national planning and opens its baseline report', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const expectStep = (path: RegExp) => expect(page).toHaveURL(path, { timeout: 25_000 });
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`batch10-browser-onboarding-${runId}@example.invalid`);
  await page.getByLabel(/^Password$/).fill('SyntheticBrowser123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expectStep(/\/onboarding\/stats$/);
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByLabel('Age (Years)').fill('28');
  await page.getByLabel('Height (cm)').fill('160');
  await page.getByRole('spinbutton', { name: 'Weight (kg)', exact: true }).fill('60');
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();
  await expectStep(/\/onboarding\/preferences$/);

  await expect(page.getByRole('combobox', { name: 'Region' })).toHaveJSProperty('required', false);
  await page.getByRole('button', { name: 'Continue to Step 3' }).click();
  await expectStep(/\/onboarding\/conditions$/);

  await page.getByRole('button', { name: 'No diagnosed condition' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('checkbox', { name: /I reviewed these entries/i }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectStep(/\/onboarding\/allergies$/);

  for (const category of ['Food Allergies', 'Intolerances', 'Foods to Avoid']) {
    await page.getByRole('tab', { name: category }).click();
    await page.getByRole('button', { name: 'No food restriction' }).click();
  }
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('checkbox', { name: /I reviewed these entries/i }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectStep(/\/onboarding\/shopping-day$/);

  await page.locator('#shopping-day-6').click();
  await page.getByRole('button', { name: 'Continue to Step 6' }).click();
  await expectStep(/\/onboarding\/tos$/);
  await page.locator('#medicalDisclaimer').check();
  await page.locator('#healthDataProcessing').check();
  await page.locator('#privacyPolicy').check();
  await page.getByRole('button', { name: 'Complete Onboarding & Go to Dashboard' }).click();
  await expectStep(/\/dashboard$/);
  await page.goto('/nutrition-report');
  await expect(page.getByRole('heading', { name: 'Nutrition report history' })).toBeVisible();
});

test('an unacknowledged persisted report gates login until the patient acknowledges it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`batch10-browser-report-${runId}@example.invalid`);
  await page.getByLabel(/^Password$/).fill('SyntheticBrowser123!');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page).toHaveURL(/\/nutrition-report$/, { timeout: 25_000 });
  await expect(page.getByText('Synthetic unacknowledged report for browser gate testing.')).toBeVisible();
  await page.getByRole('button', { name: 'I Acknowledge Report' }).click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 25_000 });
  await page.goto('/dashboard');
  await expect(page.getByText('We could not load this page.')).toHaveCount(0);
});

test('patient workspace opens the plan, groceries, library, and history at desktop and mobile sizes', async ({
  page,
}) => {
  await signIn(page, 'user');
  await visitAtBothSizes(page, '/dashboard');
  await visitAtBothSizes(page, '/meals');
  await visitAtBothSizes(page, '/grocery');
});

test('patient swaps a current and prepared upcoming breakfast with a favorite certified meal', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, 'user');
  await page.goto('/meals');

  const swapVisibleMeal = async () => {
    await page
      .getByRole('button', { name: /^Open .* details$/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Swap Meal' }).click();
    const dialog = page.getByRole('dialog', { name: /^Swap / });
    await expect(dialog.getByRole('button', { name: 'Select' }).first()).toBeVisible({ timeout: 25_000 });
    const firstOption = dialog.locator('h4').first();
    const favoriteName = await firstOption.innerText();
    await expect(firstOption.locator('..')).toContainText('Favorite');
    await dialog.getByRole('button', { name: 'Select' }).first().click();
    await expect(dialog.getByRole('button', { name: 'Confirm swap' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm swap' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 25_000 });
    await expect(page.getByRole('button', { name: `Open ${favoriteName} details` })).toBeVisible();
    return favoriteName;
  };

  const favoriteName = await swapVisibleMeal();
  await page.getByRole('button', { name: 'Next plan day' }).click();
  await expect(page.getByRole('button', { name: /^Open .* details$/ }).first()).toBeVisible();
  expect(await swapVisibleMeal()).toBe(favoriteName);
  await page.goto('/grocery');
  await expect(page.getByText('We could not load this page.')).toHaveCount(0);
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
  await page.goto('/admin/nutritionists');
  await page.getByRole('button', { name: /Active professionals/i }).click();
  const professional = page
    .getByText(`batch10-browser-nutritionist-${runId}@example.invalid`)
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]')
    .first();
  await professional.getByRole('button', { name: 'Lead enabled' }).click();
  await expect(professional.getByRole('button', { name: 'Enable Lead' })).toBeVisible();
  await professional.getByRole('button', { name: 'Enable Lead' }).click();
  await expect(professional.getByRole('button', { name: 'Lead enabled' })).toBeVisible();
});

test('patient and nutritionist correct an outside meal and admit a consented recipe candidate', async ({ browser }) => {
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
    await expect(correctedCard).toBeVisible({ timeout: 20_000 });
    await correctedCard.locator('[role="button"]').first().click();
    await expect(correctedCard.getByText('Corrected and confirmed nutrition estimate')).toBeVisible();
    await expect(correctedCard.getByText('420 kcal', { exact: true }).first()).toBeVisible();
    await correctedCard.getByRole('button', { name: 'Optionally share deidentified food details' }).click();
    await correctedCard.getByRole('button', { name: 'Allow deidentified details' }).click();
    await expect(correctedCard.getByText(/Deidentified food-detail reuse: submitted/)).toBeVisible();

    await nutritionist.reload();
    const observation = nutritionist.getByRole('region', { name: 'Observed food admissions' });
    await observation.getByRole('button', { name: new RegExp(mealName) }).click();
    await observation.getByRole('combobox', { name: 'Outcome' }).selectOption('RECIPE_CANDIDATE');
    await observation
      .getByRole('textbox', { name: 'Deidentified canonical name' })
      .fill('Home-cooked chicken and carrot stew');
    await observation
      .getByRole('textbox', { name: /Ingredients, one per line/ })
      .fill('Chicken | 150 | g\nCarrots | 50 | g\nBroth | 50 | ml');
    await observation
      .getByRole('textbox', { name: 'Preparation method' })
      .fill('Simmer the chicken and carrots in broth until cooked through, then serve one bowl.');
    await observation.getByRole('checkbox', { name: 'lunch' }).check();
    await observation.getByRole('button', { name: 'Admit deidentified candidate' }).click();
    await expect(observation.getByRole('button', { name: new RegExp(mealName) })).toHaveCount(0);
    await expect(observation.getByText('No observations awaiting classification.')).toBeVisible();

    await patient.reload();
    const admittedCard = patient.locator('article').filter({ hasText: mealName });
    await admittedCard.locator('[role="button"]').first().click();
    await expect(admittedCard.getByText(/Deidentified food-detail reuse: admitted recipe/)).toBeVisible();
  } finally {
    await patient.close();
    await nutritionist.close();
  }
});
