import { expect, test } from '@playwright/test';

test.describe('Disposable repair journeys', () => {
  test.skip(
    process.env.NUTRIMIND_REPAIR_E2E !== 'true',
    'Requires explicitly configured disposable API and browser fixtures.'
  );
  async function login(page: import('@playwright/test').Page, role: string) {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('repair-browser-' + role + '@example.invalid');
    await page.getByLabel(/^Password$/).fill('SyntheticBrowser123!');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page).toHaveURL(role === 'user' ? /\/dashboard$/ : new RegExp('/' + role + '/'), { timeout: 20000 });
  }
  test('user swaps a purchased ingredient and sees only the additional amount', async ({ page }) => {
    await login(page, 'user');
    await page.goto('/meals');
    await page
      .getByRole('button', { name: /library/i })
      .first()
      .click();
    await page.getByLabel('Choose slot for Replacement egg plate').selectOption('repair-browser-plan');
    await expect(page.getByText('Your grocery list will update with this swap.')).toBeVisible();
    await expect(page.getByText(/Buy 150 g more/i)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm swap', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirm swap', exact: true })).toBeHidden();
    await page.goto('/grocery');
    await expect(page.getByText(/150 g to buy · 300 purchased \/ 450 needed/)).toBeVisible();
    await page.getByRole('button', { name: 'Enter purchased amount' }).click();
    await page.getByLabel('Total purchased (g)').fill('400');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/50 g to buy · 400 purchased \/ 450 needed/)).toBeVisible();
    await page.goto('/nutrition-report');
    await expect(page.getByRole('heading', { name: 'Nutrition report history' })).toBeVisible();
  });
  for (const [role, route, text] of [
    ['nutritionist', '/nutritionist/library', 'Meal'],
    ['admin', '/admin/data', 'Nutrition data'],
  ] as const) {
    test(role + ' workspace loads at desktop and mobile sizes', async ({ page }) => {
      await login(page, role);
      await page.goto(route);
      await expect(page.getByRole('heading', { name: new RegExp(text, 'i') }).first()).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('body')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }
});
