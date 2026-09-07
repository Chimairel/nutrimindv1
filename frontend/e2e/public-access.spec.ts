import { expect, test } from '@playwright/test';

test('landing page exposes public entry points without console failures', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/NutriMind/i);
  await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('registration rejects empty, whitespace-only, and mismatched input', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByText(/first name is required/i)).toBeVisible();

  await page.getByLabel(/first name/i).fill('   ');
  await page.getByLabel(/last name/i).fill('   ');
  await page.getByLabel(/email address/i).fill('not-an-email');
  const password = page.getByLabel(/^password$/i);
  const confirmation = page.getByLabel(/confirm password/i);

  await password.fill('ValidPassword1');
  await password.focus();
  await page.keyboard.press('Tab');
  await expect(confirmation).toBeFocused();

  await confirmation.fill('DifferentPassword1');
  await expect(confirmation).toHaveAttribute('data-validation-state', 'error');
  await confirmation.fill('ValidPassword1');
  await expect(confirmation).toHaveAttribute('data-validation-state', 'success');
  await confirmation.fill('DifferentPassword1');
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  await expect(page.getByText(/valid email address/i)).toBeVisible();
});
