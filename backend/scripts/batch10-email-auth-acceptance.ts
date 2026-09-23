import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import prisma from '../src/lib/prisma';
import AuthService from '../src/services/auth.service';
import { UserPrivacyService } from '../src/services/user-privacy.service';

async function main() {
  const marker = randomUUID();
  const email = `batch10-email-${marker}@example.invalid`;
  const password = `Batch10-${marker}`;
  const mailDir = await mkdtemp(path.join(tmpdir(), 'nutrimind-batch10-mail-'));
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCapture = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
  process.env.NODE_ENV = 'test';
  process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = path.join(mailDir, 'mail.jsonl');
  let userId: string | null = null;
  try {
    const registration = await AuthService.register('Batch 10 New User', email, password);
    userId = registration.user.id;
    assert.equal(registration.verificationEmailSent, true);
    assert.equal(registration.user.emailVerified, false);
    assert.equal((await AuthService.login(email, password)).user.emailVerified, false);
    const captured = (await readFile(process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const message = captured.find((item) => item.type === 'EMAIL_VERIFICATION' && item.to === email);
    assert.match(message?.token ?? '', /^\d{6}$/);
    await AuthService.verifyEmail(userId, message.token);
    assert.equal((await AuthService.login(email, password)).user.emailVerified, true);
    assert.equal(await prisma.user.count({ where: { id: userId, emailVerified: true } }), 1);
    await UserPrivacyService.deleteAccount(userId, { password });
    assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
    userId = null;
    console.log('[Batch 10 email auth] PASS: register, captured OTP, verify, login, delete');
  } finally {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalCapture === undefined) delete process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
    else process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = originalCapture;
    await rm(mailDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[Batch 10 email auth] FAIL', error);
  process.exitCode = 1;
});
