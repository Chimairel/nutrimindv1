import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCT_ID = 'prod_test_premium_monthly_01';
const PRICE_ID = 'price_test_premium_monthly_01';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(target.hostname))
    throw new Error('Synthetic prices may only be seeded into a local test database.');
  const existingProduct = await prisma.billingProduct.findUnique({ where: { code: 'PREMIUM' } });
  if (!existingProduct) {
    await prisma.billingProduct.create({
      data: {
        id: PRODUCT_ID,
        code: 'PREMIUM',
        displayName: 'Premium monthly sandbox demo',
        description: 'Sandbox-only placeholder; not an approved commercial price.',
        status: 'ACTIVE',
        featureSetVersion: 'sandbox-demo-v1',
      },
    });
    console.log('Created BillingProduct: PREMIUM');
  } else {
    console.log('BillingProduct already exists:', existingProduct.id);
  }

  const existingPrice = await prisma.billingPrice.findFirst({
    where: {
      provider: 'PAYMONGO',
      environment: 'TEST',
      currency: 'PHP',
      interval: 'MONTH',
      intervalCount: 1,
      isActive: true,
      product: { code: 'PREMIUM' },
    },
  });

  if (!existingPrice) {
    const product = (await prisma.billingProduct.findUnique({ where: { code: 'PREMIUM' } }))!;
    await prisma.billingPrice.create({
      data: {
        id: PRICE_ID,
        productId: product.id,
        provider: 'PAYMONGO',
        environment: 'TEST',
        currency: 'PHP',
        amountMinor: 19_900,
        interval: 'MONTH',
        intervalCount: 1,
        version: 1,
        isActive: true,
      },
    });
    console.log('Created BillingPrice: 19900 PHP (₱199.00)');
  } else {
    console.log('BillingPrice already exists:', existingPrice.id, existingPrice.amountMinor);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
