import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`outside-food preview, retry and Sonner feedback at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const owner = `outside-ui-${width}`;
    const token = Buffer.from(
      JSON.stringify({
        userId: owner,
        email: 'outside@example.invalid',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    await page.context().addCookies([
      {
        name: 'nutrimind_session',
        value: `fixture.${token}.fixture`,
        url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      },
    ]);
    const now = new Date().toISOString();
    const macros = { calories: 200, proteinG: 10, carbsG: 25, fatG: 7 };
    const preview = {
      warningRequired: true,
      previewRequired: true,
      confirmationId: 'outside-preview',
      estimate: macros,
      warnings: [],
      reasons: [],
      usedAi: false,
      items: [
        {
          name: 'Synthetic food',
          portionGrams: null,
          source: 'USER_REPORTED',
          includedInTotals: true,
          ...macros,
          calorieLow: null,
          calorieHigh: null,
        },
      ],
      summary: { provisionalCalories: 200, provisionalItemCount: 1, unresolvedItemCount: 0, completeness: 'COMPLETE' },
    };
    let attempts = 0;
    let confirmations = 0;
    let releaseSave!: () => void;
    let saved = false;
    let releaseHistory!: () => void;
    let historyRequested = false;
    const requests: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api/, '');
      const headers = {
        'Access-Control-Allow-Origin': process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      };
      if (request.method() === 'OPTIONS' || path.includes('/live/')) return route.fulfill({ status: 204, headers });
      let data: unknown = [];
      let meta: unknown;
      if (path === '/user/profile')
        data = {
          id: owner,
          name: 'Synthetic member',
          email: 'outside@example.invalid',
          role: 'USER',
          emailVerified: true,
          onboardingDone: true,
          tosAccepted: true,
          reportAcknowledged: true,
          onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
          userProfile: { revision: 1, safetyRevision: 1, dailyCalorieTarget: 2000 },
          healthConditions: [],
          allergies: [],
          safetyEntries: [],
        };
      else if (path === '/user/clinical-profile-review/status') data = { required: false, approved: true };
      else if (path === '/user/membership') data = { enabled: false };
      else if (path.includes('notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path === '/user/checkin/status') data = { required: false };
      else if (path === '/user/water/today') data = { totalMl: 0 };
      else if (path === '/user/meals/current') {
        data = [
          {
            id: 'planned',
            planGroupId: 'cycle',
            userId: owner,
            mealName: 'Scheduled meal',
            mealType: 'BREAKFAST',
            scheduledDate: now,
            status: 'APPROVED',
            calories: 600,
            proteinG: 30,
            carbsG: 70,
            fatG: 20,
            mealLogs: [],
          },
        ];
        meta = {
          cycle: {
            id: 'cycle',
            planType: 'WEEKLY',
            startsAt: now,
            endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          },
          planSnapshot: { dailyCalorieTarget: 2000, dailyMacroTargets: {} },
        };
      } else if (path === '/user/meals/history') {
        data = saved
          ? [
              {
                id: 'outside-log',
                status: 'DONE',
                loggedAt: now,
                ...macros,
                provisionalCalories: 200,
                nutritionCompleteness: 'COMPLETE',
              },
            ]
          : [];
        if (!historyRequested) {
          historyRequested = true;
          await new Promise<void>((resolve) => {
            releaseHistory = resolve;
          });
        }
      } else if (path === '/user/meals/log-outside') {
        const body = request.postDataJSON();
        requests.push(body);
        if (!body.warningAcknowledged) {
          attempts++;
          if (attempts === 1)
            return route.fulfill({
              status: 500,
              headers,
              json: { success: false, error: 'Temporary estimation failure' },
            });
          data = preview;
        } else {
          confirmations++;
          await new Promise<void>((resolve) => {
            releaseSave = resolve;
          });
          saved = true;
          data = {
            warningRequired: false,
            log: {
              id: 'outside-log',
              status: 'DONE',
              loggedAt: now,
              ...macros,
              provisionalCalories: 200,
              nutritionCompleteness: 'COMPLETE',
            },
            safetyFollowUp: { status: 'INSUFFICIENT_EVIDENCE', messages: [] },
          };
        }
      }
      await route.fulfill({ headers, json: { success: true, data, meta } });
    });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Log food or snack' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Food or Meal Eaten (required)').fill('Synthetic food');
    const numbers = dialog.getByRole('spinbutton');
    for (const [index, value] of ['200', '10', '25', '7'].entries()) await numbers.nth(index + 1).fill(value);
    await dialog.getByRole('button', { name: 'Preview nutrition' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Temporary estimation failure' })).toBeVisible();
    await expect(numbers.nth(1)).toHaveValue('200');
    await dialog.getByRole('button', { name: 'Preview nutrition' }).click();
    await expect(dialog.getByRole('button', { name: 'Use estimate' })).toBeVisible();
    expect(requests[0].requestKey).toBe(requests[1].requestKey);
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(numbers.nth(1)).toHaveValue('200');
    await dialog.getByRole('button', { name: 'Preview nutrition' }).click();
    await dialog.getByRole('button', { name: 'Use estimate' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Logging your food' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Use estimate' })).toBeDisabled();
    expect(confirmations).toBe(1);
    releaseSave();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Food logged' })).toBeVisible();
    const olderHistory = page.waitForResponse((response) => response.url().includes('/user/meals/history'));
    releaseHistory();
    await olderHistory;
    await expect(page.getByText(/Includes 200 provisional kcal/)).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
