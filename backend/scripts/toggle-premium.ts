import 'dotenv/config';
import { TestPremiumService } from '../src/services/test-premium.service';
import prisma from '../src/lib/prisma';
async function main() {
  const [email, action] = process.argv.slice(2);
  if (!email || !['grant', 'revoke'].includes(action))
    throw new Error('Usage: toggle-premium <email> <grant|revoke>. Administrator permission is required.');
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await TestPremiumService.toggle(user.id, action as 'grant' | 'revoke');
  console.log('Test grant updated; unrelated access preserved.');
}
main()
  .catch(() => {
    console.error('Unable to update test access. Check the account and administrator permission.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
