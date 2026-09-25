import { expect, test } from '@playwright/test';

test('applicant tracking, validation, invitation screen, and admin application list', async ({ page }) => {
  const adminEmail = process.env.NUTRIMIND_E2E_ADMIN_EMAIL;
  const applicantEmail = process.env.NUTRIMIND_E2E_APPLICANT_EMAIL;
  const reference = process.env.NUTRIMIND_E2E_APPLICATION_REFERENCE;
  const apiBase = process.env.NUTRIMIND_E2E_API_BASE;
  test.skip(!adminEmail || !applicantEmail || !reference || !apiBase, 'Requires isolated application-journey fixture variables.');
  expect(new URL(apiBase!).port).toBe('5555');

  await page.goto('/nutritionist-apply');
  await expect(page.getByRole('heading', { name: 'Your identity' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Please correct the highlighted fields before continuing.')).toBeVisible();
  await page.getByRole('button', { name: 'Track application' }).click();
  await page.locator('#tracking-reference').fill(reference!);
  await page.locator('#tracking-email').fill(applicantEmail!);
  await page.getByRole('button', { name: 'Check status' }).click();
  await expect(page.getByText(reference!, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nutritionist account activated' })).toBeVisible();

  await page.goto('/nutritionist-invitation?token=invalid-token');
  await expect(page.getByRole('heading', { name: 'Activate your workspace' })).toBeVisible();
  await page.locator('#nutritionist-password').fill('JourneyPass123!');
  await page.locator('#nutritionist-confirm-password').fill('JourneyPass123!');
  await page.getByRole('button', { name: 'Activate nutritionist account' }).click();
  await expect(page.getByText(/invitation is invalid|failed to activate/i).first()).toBeVisible();

  const stamp = Date.now();
  const newApplicantEmail = `browser-applicant-${stamp}@example.test`;
  const submitted = await page.request.post(`${apiBase}/nutritionist-applications`, {
    data: {
      fullName: 'Browser Journey Applicant', email: newApplicantEmail, phoneNumber: '+63 917 555 0123',
      prcLicenseNumber: `BROWSER-${stamp}`, prcLicenseExpiry: '2029-12-31T23:59:59.000Z',
      specialization: 'Clinical nutrition', yearsOfExperience: 4, university: 'Synthetic University',
      professionalBio: 'Synthetic professional for the isolated browser application journey verification.',
      officialHeadshot: 'data:image/jpeg;base64,/9j/AA==', digitalSignature: 'data:image/png;base64,iVBORw0KGgo=',
      availableCallSlots: [new Date(Date.now() + 3600000).toISOString(), new Date(Date.now() + 7200000).toISOString()],
      consent: true,
    },
  });
  expect(submitted.status()).toBe(201);

  await page.goto('/login');
  await page.locator('#email').fill(adminEmail!);
  await page.locator('#password').fill('JourneyPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/admin\//);
  await page.goto('/admin/nutritionists');
  await expect(page.getByRole('heading', { name: 'Nutritionist onboarding' })).toBeVisible();
  await expect(page.getByText('Active pipeline')).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: 'Completed applications' })).toBeVisible();
  await expect(page.getByText(newApplicantEmail, { exact: true })).toBeVisible();
  const applicantCard = page.getByText(newApplicantEmail, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
  await applicantCard.getByRole('button', { name: 'Begin credential review' }).click();
  await expect(page.getByText('Credential review started.')).toBeVisible();
  await applicantCard.getByRole('button', { name: 'Credentials checked — require call' }).click();
  await expect(page.getByText('Applicant advanced to the required call stage.')).toBeVisible();
});
