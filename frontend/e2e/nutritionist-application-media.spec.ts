import { expect, test } from '@playwright/test';

type ApplicationMedia = {
  email: string;
  officialHeadshot: string;
  digitalSignature: string;
  status?: string;
};

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test('live camera photo and drawn signature survive full application submission and admin review', async ({ page }) => {
  const apiBase = process.env.NUTRIMIND_E2E_API_BASE;
  const adminEmail = process.env.NUTRIMIND_E2E_ADMIN_EMAIL;
  test.skip(!apiBase || !adminEmail, 'Requires the disposable local application database and test admin.');
  expect(new URL(apiBase!).port).toBe('5555');

  const stamp = Date.now();
  const applicantEmail = `browser-media-${stamp}@example.test`;
  let submittedBody: ApplicationMedia | undefined;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/nutritionist-applications')) {
      submittedBody = request.postDataJSON() as ApplicationMedia;
    }
  });

  await page.goto('/nutritionist-apply');
  await page.locator('#fullName').fill('Browser Camera Applicant');
  await page.locator('#applicationEmail').fill(applicantEmail);
  await page.locator('#phoneNumber').fill('+63 917 555 0123');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('A camera photo is required. Please capture it using your camera.')).toBeVisible();
  await expect(page.locator('video')).toBeVisible();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return Boolean(video && video.readyState >= 2 && video.videoWidth > 0);
  });
  await page.getByRole('button', { name: 'Snap Live Photo' }).click();
  await expect(page.getByText('Camera Photo Captured')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#prcLicenseNumber').fill(`CAMERA-${stamp}`);
  await page.locator('#prcLicenseExpiry').fill('2029-12-31');
  await page.locator('#specialization').fill('Clinical nutrition');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Digital handwritten signature is required. Please draw and confirm your signature in the box provided.')).toBeVisible();
  const canvas = page.locator('canvas[aria-label="Digital signature drawing pad"]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 60, box!.y + 50);
  await page.mouse.down();
  await page.mouse.move(box!.x + 180, box!.y + 95, { steps: 12 });
  await page.mouse.move(box!.x + 260, box!.y + 55, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Confirm Signature' }).click();
  await expect(page.getByText('Signature Confirmed & Locked')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('#yearsOfExperience').fill('4');
  await page.locator('#university').fill('Synthetic University');
  await page.locator('#professionalBio').fill('Synthetic applicant used only to verify the live camera and signature application form.');
  await page.getByRole('button', { name: 'Continue' }).click();

  const toLocalInput = (time: number) => {
    const date = new Date(time);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  await page.locator('#callSlotOne').fill(toLocalInput(Date.now() + 86400000));
  await page.locator('#callSlotTwo').fill(toLocalInput(Date.now() + 172800000));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review your application' })).toBeVisible();
  await expect(page.getByAltText('Digital signature preview')).toBeVisible();
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText(/NM-[A-F0-9]{12}/)).toBeVisible();

  if (!submittedBody) throw new Error('Application submission request was not observed.');
  const sent = submittedBody as ApplicationMedia;
  expect(sent.email).toBe(applicantEmail);
  expect(sent.officialHeadshot).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.digitalSignature).toMatch(/^data:image\/png;base64,/);
  expect(sent.officialHeadshot.length).toBeGreaterThan(1000);
  expect(sent.digitalSignature.length).toBeGreaterThan(1000);

  const login = await page.request.post(`${apiBase}/auth/login`, {
    data: { email: adminEmail, password: 'JourneyPass123!' },
  });
  expect(login.status()).toBe(200);
  const adminToken = (await login.json()).data.accessToken as string;
  const applications = await page.request.get(`${apiBase}/admin/nutritionist-applications`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(applications.status()).toBe(200);
  const applicationResponse = (await applications.json()) as { data: ApplicationMedia[] };
  const record = applicationResponse.data.find((item) => item.email === applicantEmail);
  if (!record) throw new Error('Submitted application was absent from the admin queue.');
  expect(record.status).toBe('SUBMITTED');
  expect(record.officialHeadshot).toBe(sent.officialHeadshot);
  expect(record.digitalSignature).toBe(sent.digitalSignature);

  await page.goto('/login');
  await page.locator('#email').fill(adminEmail!);
  await page.locator('#password').fill('JourneyPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/admin\//);
  await page.goto('/admin/nutritionists');
  const card = page.getByText(applicantEmail, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
  await expect(card.getByAltText('Browser Camera Applicant official headshot')).toBeVisible();
  await expect(card.getByAltText('Browser Camera Applicant digital signature')).toBeVisible();
});
