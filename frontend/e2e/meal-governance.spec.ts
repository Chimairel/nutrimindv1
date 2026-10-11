import { expect, test } from '@playwright/test';

for (const role of ['ADMIN', 'NUTRITIONIST'] as const) {
  for (const width of [390, 1440]) {
    test(`${role} reviews quarantined evidence without bypassing release at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const user = {
        id: `governance-${role}`,
        name: 'Synthetic staff',
        email: 'fixture@example.invalid',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
        nutritionReport: null,
      };
      const claims = Buffer.from(
        JSON.stringify({ userId: user.id, email: user.email, role, exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      await page.context().addCookies([
        {
          name: 'nutrimind_session',
          value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
          url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
        },
      ]);
      const meal = {
        id: 'held-recipe',
        mealName: 'Measured vegetable soup',
        mealType: 'DINNER',
        calories: 300,
        proteinG: 15,
        carbsG: 40,
        fatG: 10,
        sodiumMg: 150,
        description: 'Recorded soup recipe for review.',
        status: 'FLAGGED',
        reviewLineage: { state: 'QUARANTINED', incidentCount: 2 },
        baseVerification: 'REVIEW_PENDING',
        baseVerificationBasis: 'NUTRITIONIST',
        safetyEvidenceStatus: 'STALE',
        safetyEvidenceRevision: 2,
        certifiedEvidenceRevision: null,
        nutritionServingDescription: 'One measured bowl',
        ingredients: [],
        flags: [],
        usageCount: 0,
        addedAt: '2026-10-08T00:00:00Z',
        conditionDeclarationState: 'NOT_REVIEWED',
        allergenDeclarationState: 'NOT_REVIEWED',
        crossContactAssessment: 'NOT_ASSESSED',
      };
      const report = {
        id: 'concern-1',
        createdAt: '2026-10-08T00:00:00Z',
        actorSnapshot: { name: 'Synthetic flagger', role: 'RND' },
        notes: {
          category: 'NUTRITION',
          affectedFields: ['sodiumMg'],
          explanation: 'The sodium evidence requires measured ingredient confirmation.',
          reference: 'Recorded composition reference from the food catalogue.',
          proposedCorrection: 'Reconcile the edible ingredient grams and source sodium values.',
        },
      };
      const decision = {
        id: 'decision-1',
        action: 'WITHHELD',
        version: 'a'.repeat(64),
        createdAt: '2026-10-08T00:00:00Z',
        actorSnapshot: { name: 'Synthetic flagger', role: 'RND' },
        rationale: report.notes.explanation,
        snapshot: { meals: [meal] },
      };
      const incident = {
        id: 'incident-2',
        number: 2,
        state: 'QUARANTINED',
        reports: [report],
        decisions: [decision],
        confirmations: [],
        claimedByNutritionistId: null,
      };
      const priorIncident = {
        ...incident,
        id: 'incident-1',
        number: 1,
        state: 'RELEASED',
        reports: [
          {
            ...report,
            id: 'prior-concern',
            actorSnapshot: { name: 'Prior flagger', role: 'RND' },
            notes: { ...report.notes, reference: 'Prior recorded composition reference.' },
          },
        ],
        decisions: [
          {
            ...decision,
            id: 'before-correction',
            action: 'CORRECTION_BEFORE',
            snapshot: { meals: [{ ...meal, calories: 200 }] },
          },
          { ...decision, id: 'after-correction', action: 'CORRECTED', snapshot: { meals: [meal] } },
        ],
      };
      const mutations: { path: string; body: Record<string, unknown> }[] = [];
      await page.route('**/api/**', async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        let data: unknown = null;
        if (path.endsWith('/user/profile')) data = user;
        else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
        else if (path.endsWith('/review-work-counts')) data = { meal: 0, case: 0, profile: 0, audit: 0 };
        else if (path.endsWith('/meal-review-cases'))
          data = [{ id: meal.id, mealName: meal.mealName, state: 'QUARANTINED', incidentCount: 2 }];
        else if (path.endsWith('/meal-review-cases/held-recipe'))
          data = {
            mealId: meal.id,
            state: 'QUARANTINED',
            recipeVersion: 'a'.repeat(64),
            reviewVersion: 'b'.repeat(64),
            incidentCount: 2,
            legacyHistoryUnknown: false,
            incident,
            history: [priorIncident, incident],
            validConfirmations: [],
            canAdminRelease: true,
          };
        else if (path.endsWith('/claim') || path.endsWith('/confirm')) {
          const body = request.postDataJSON() as Record<string, unknown>;
          mutations.push({ path, body });
          data = { state: 'QUARANTINED' };
        } else if (path.endsWith('/library/held-recipe/approvals')) data = [];
        else if (path.endsWith('/library/held-recipe')) data = meal;
        else if (path.endsWith('/library')) data = { meals: [meal], total: 1, page: 1, limit: 20 };
        else if (path.endsWith('/coverage') || path.endsWith('/library-coverage'))
          data = { profiles: [], combinationMatrix: [], combinationColumns: [], structuredProfiles: [] };
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto(role === 'ADMIN' ? '/admin/meals' : '/nutritionist/library');
      await page.getByRole('button', { name: 'Review case', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Meal-wide review', exact: true });
      await expect(panel.getByRole('strong').filter({ hasText: /^Quarantined$/ })).toBeVisible();
      await expect(panel.getByText('NUTRITION · Synthetic flagger')).toBeVisible();
      await expect(panel.getByText('Recorded composition reference from the food catalogue.')).toBeVisible();
      await expect(panel.getByText(/Only an admin can release/)).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Claim re-review' })).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Confirm this version' })).toHaveCount(0);
      if (role === 'ADMIN') {
        await expect(panel.getByRole('button', { name: 'Release quarantine' })).toBeDisabled();
        await panel
          .getByLabel('Administrative rationale')
          .fill('Reviewed the current recipe concerns and release evidence.');
        await expect(panel.getByRole('button', { name: 'Release quarantine' })).toBeEnabled();
      } else {
        await expect(panel.getByRole('button', { name: 'Release quarantine' })).toHaveCount(0);
      }
      await panel.getByText(/Only an admin can release/).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`quarantine-controls-${role}-${width}.png`) });
      await expect(panel.getByRole('heading', { name: 'Recipe withheld', exact: true })).toBeVisible();
      await expect(panel.getByText('Immutable values recorded for this decision.', { exact: false })).toBeVisible();
      await expect(panel.getByText('150 mg sodium', { exact: true })).toBeVisible();
      await panel.getByRole('combobox', { name: 'Review change' }).click();
      await page.getByRole('option', { name: /Incident 1 · Recipe corrected/ }).click();
      const comparison = panel.getByRole('table', { name: 'Recorded correction comparison' });
      await expect(comparison.getByText('200 kcal')).toBeVisible();
      await expect(comparison.getByText('300 kcal')).toBeVisible();
      await panel.getByText(/Prior flagger · nutrition/).click();
      await expect(panel.getByText('Prior recorded composition reference.')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`review-${role}-${width}.png`), fullPage: true });
      expect(mutations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 1440]) {
  test(`admin previews and imports JSON drafts at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const user = {
      id: 'batch-admin',
      name: 'Synthetic admin',
      email: 'batch@example.invalid',
      role: 'ADMIN',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      onboardingStatus: { acceptedCurrentConsent: true, nextPath: null },
    };
    const claims = Buffer.from(
      JSON.stringify({ userId: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url');
    await page.context().addCookies([
      {
        name: 'nutrimind_session',
        value: `eyJhbGciOiJIUzI1NiJ9.${claims}.fixture`,
        url: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin,
      },
    ]);
    let previewReads = 0,
      imports = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = null;
      if (path.endsWith('/user/profile')) data = user;
      else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
      else if (path.endsWith('/library')) data = { meals: [], total: 0, page: 1, limit: 20 };
      else if (path.endsWith('/batch/preview')) {
        previewReads++;
        data =
          previewReads === 1
            ? {
                valid: false,
                previewId: null,
                alreadyImported: false,
                results: [
                  {
                    index: 0,
                    mealName: 'Vegetable soup',
                    errors: [
                      'ingredients.0.foodItemId: Select an FNRI food.',
                      'ingredients.0.gramsPerServing: Measured grams are required.',
                    ],
                  },
                ],
              }
            : {
                valid: true,
                previewId: 'preview-1',
                alreadyImported: false,
                results: [{ index: 0, mealName: 'Vegetable soup', errors: [] }],
              };
      } else if (path.endsWith('/batch/import')) {
        imports++;
        expect(route.request().postDataJSON()).toEqual({ previewId: 'preview-1' });
        data = { replayed: false, meals: [{ id: 'new-draft', safetyEvidenceStatus: 'INCOMPLETE' }] };
      }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/admin/meals?tab=batch');
    await page.getByLabel('Upload meal JSON').setInputFiles({
      name: 'synthetic-meals.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'KAINARA_MEALS_V1', meals: [{ mealName: 'Vegetable soup' }] })),
    });
    await page.getByRole('button', { name: 'Preview and validate' }).click();
    await expect(page.getByText('ingredients.0.gramsPerServing: Measured grams are required.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import all as drafts' })).toBeDisabled();
    await page.getByLabel('Recipe JSON').fill(
      JSON.stringify({
        format: 'KAINARA_MEALS_V1',
        meals: [{ mealName: 'Vegetable soup', ingredients: [{ foodItemId: 'fnri-1', gramsPerServing: 100 }] }],
      })
    );
    await page.getByRole('button', { name: 'Preview and validate' }).click();
    await expect(page.getByText('Ready to import as unverified drafts')).toBeVisible();
    await page.getByRole('button', { name: 'Import all as drafts' }).click();
    await expect(
      page.getByText('1 unverified drafts imported. RND review is required before member use.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import all as drafts' })).toBeDisabled();
    expect(imports).toBe(1);
    expect(previewReads).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`batch-${width}.png`), fullPage: true });
  });
}
