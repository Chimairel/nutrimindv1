import { expect as baseExpect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const expect = baseExpect.configure({ timeout: 30_000 });

test.skip(!process.env.SYNTHETIC_JOURNEY_GUIDE, 'Requires the marked synthetic account set on development.');
async function login(page: Page, email: string, destination: RegExp) {
  const guide = JSON.parse(readFileSync(process.env.SYNTHETIC_JOURNEY_GUIDE!, 'utf8'));
  expect(guide.status).toBe('COMPLETE');
  expect(guide.accounts.some((row: { email: string }) => row.email === email && email.endsWith('@example.test'))).toBe(
    true
  );
  expect(['localhost', '127.0.0.1']).toContain(new URL(test.info().project.use.baseURL!).hostname);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(guide.newAccountPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(destination, { timeout: 60_000 });
}

test('real localhost member health details, RND questions, successor resolution and admin audit', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const contexts = await Promise.all(
    [0, 1, 2, 3].map(() => browser.newContext({ viewport: { width: 1440, height: 1000 } }))
  );
  contexts.forEach((context) => context.setDefaultTimeout(30_000));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [member, first, successor, admin] = pages;
  const errors: string[] = [];
  pages.forEach((page) => page.on('pageerror', (error) => errors.push(error.message)));
  const title = `Synthetic handoff ${Date.now()}`;
  const question = `Has your reported heart condition changed? (${title})`;
  const answer = 'Synthetic software fixture: the recorded condition has not changed.';
  const person = '[TEST sleep-oct11] Heart Weight Loss';
  try {
    await login(member, 'sleep-heart@example.test', /\/dashboard$/);
    await member.goto('/profile/clinical-evidence');
    await member
      .getByRole('textbox', { name: 'Condition or restriction details', exact: true })
      .fill('Synthetic software fixture: reported heart condition; further clarification requested.');
    for (const label of [
      'Current medication or supplements',
      'Dietary advice you have received',
      'Recent symptoms or episodes',
    ])
      await member.getByRole('textbox', { name: label, exact: true }).fill('Unknown in this synthetic fixture');
    await member.getByRole('button', { name: 'Save health details', exact: true }).click();
    await expect(member.getByText(/Health details saved for RND review/)).toBeVisible({ timeout: 30_000 });
    const openProfile = async (page: Page) => {
      await page.getByRole('button', { name: /Member queue/ }).click();
      await page.getByRole('button').filter({ hasText: person }).click();
      await expect(page.getByRole('heading', { name: /Profile review.*Heart Weight Loss/ })).toBeVisible();
      if (!(await page.getByRole('button', { name: 'Release profile', exact: true }).isVisible()))
        await page.getByRole('button', { name: 'Claim profile', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Release profile', exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Expand canvas/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    };
    await login(first, 'sleep-rnd-a@example.test', /\/nutritionist\/reviews$/);
    await openProfile(first);
    await first.getByRole('button', { name: /Move Profile clarification forms sheet/ }).focus();
    await first.getByRole('button', { name: 'Fit selected sheet' }).click();
    await first.getByLabel('Form title').fill(title);
    await first.getByRole('button', { name: 'Add question', exact: true }).click();
    await first.getByLabel('Question 1', { exact: true }).fill(question);
    await first.getByRole('button', { name: 'Send questions', exact: true }).click();
    await expect(first.getByRole('button', { name: `Move ${title} sheet` })).toBeAttached({ timeout: 30_000 });
    await first.getByRole('button', { name: 'Release profile', exact: true }).click();
    await member.reload();
    await expect(member.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(member.getByRole('img', { name: 'Sleeping Nara', exact: true })).toHaveCount(0);
    await member.getByRole('textbox', { name: `${question} *`, exact: true }).fill(answer);
    await member.getByRole('button', { name: 'Submit answers', exact: true }).click();
    await expect(member.getByText('Awaiting RND review', { exact: false })).toBeVisible({ timeout: 30_000 });
    await login(successor, 'sleep-rnd-b@example.test', /\/nutritionist\/reviews$/);
    await openProfile(successor);
    await successor.getByRole('button', { name: `Move ${title} sheet` }).focus();
    await successor.getByRole('button', { name: 'Fit selected sheet' }).click();
    await expect(successor.getByRole('textbox', { name: `${question} *`, exact: true })).toHaveValue(answer);
    await successor
      .getByLabel('Resolution notes', { exact: true })
      .fill(
        'Synthetic latest answer reviewed by the successor. No clinical confirmation is made in this software test.'
      );
    await successor.getByRole('button', { name: 'Resolve clarification', exact: true }).click();
    await expect(
      successor.getByRole('article', { name: title, exact: true }).getByText(/Resolved by an RND/)
    ).toBeVisible();
    await successor.screenshot({ path: test.info().outputPath('successor-resolved-form.png') });
    await successor.getByRole('button', { name: 'Release profile', exact: true }).click();
    await member.reload();
    const memberForm = member.getByRole('heading', { name: title, exact: true }).locator('..').locator('..');
    await expect(memberForm.getByText(/Resolved by an RND/)).toBeVisible();
    await login(admin, 'sleep-admin@example.test', /\/admin\/overview(?:\?.*)?$/);
    await admin.goto('/admin/audit');
    await admin.getByRole('button', { name: 'RND history', exact: true }).click();
    await admin.getByLabel('Staff name', { exact: true }).fill('[TEST sleep-oct11] Reviewer B');
    await admin
      .getByRole('button', { name: /Details: Resolved profile clarification/ })
      .first()
      .click();
    await admin.getByRole('button', { name: 'Open related review details', exact: true }).click();
    await expect(admin.getByLabel('Case record')).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByText('Case details could not be loaded.', { exact: true })).toHaveCount(0);
    await admin.screenshot({ path: test.info().outputPath('admin-clarification-audit.png') });
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
