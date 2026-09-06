import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaUserBillingAccessRepository } from '../src/services/prisma-user-billing-access.repository';
import { UserBillingAccessService } from '../src/services/user-billing-access.service';
import { reserveWeeklySwap } from '../src/services/meal-swap.service';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';

const databaseUrl = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) || databaseUrl.pathname !== '/nutrimind_acceptance') {
  throw new Error('Premium acceptance requires the exact disposable loopback database.');
}
const password = process.env.PREMIUM_ACCEPTANCE_PASSWORD;
if (!password || password.length < 12) throw new Error('A synthetic acceptance password is required.');

const prisma = new PrismaClient();
const at = new Date();
const accessStartsAt = new Date(at.getTime() - 24 * 60 * 60 * 1000);
const accessExpiresAt = new Date(accessStartsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
const scheduleStart = new Date(at.getTime() + 24 * 60 * 60 * 1000);
let passwordHash = '';

async function readyUser(id: string, email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash, emailVerified: true, onboardingDone: true, tosAccepted: true,
      acceptedTermsVersion: CURRENT_TERMS_VERSION, acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      healthDataConsentedAt: at, isSuspended: false,
    },
    create: {
      id, name: id === 'accept_free_user' ? 'Free Acceptance' : 'Premium Acceptance', email, passwordHash,
      role: 'USER', emailVerified: true, onboardingDone: true, tosAccepted: true, tosAcceptedAt: at,
      acceptedTermsVersion: CURRENT_TERMS_VERSION, acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      healthDataConsentedAt: at,
    },
  });
}

async function seedPlan(userId: string, planGroupId: string, swapsUsed: number) {
  await prisma.mealPlan.deleteMany({ where: { userId } });
  await prisma.planSwapTracker.deleteMany({ where: { userId } });
  await prisma.mealPlan.create({
    data: {
      id: `${planGroupId}_meal`, planGroupId, userId, status: 'APPROVED', mealType: 'BREAKFAST',
      mealName: 'Synthetic acceptance breakfast', calories: 420, proteinG: 24, carbsG: 48, fatG: 14,
      scheduledDate: scheduleStart, requiresSafetyRevalidation: false,
    },
  });
  return prisma.planSwapTracker.create({ data: { id: `${planGroupId}_tracker`, planGroupId, userId, swapsUsed } });
}

async function main() {
  passwordHash = await bcrypt.hash(password!, 12);
  try {
  const [freeUser, premiumUser] = await Promise.all([
    readyUser('accept_free_user', 'free-premium-acceptance@example.invalid'),
    readyUser('accept_premium_user', 'premium-access-acceptance@example.invalid'),
  ]);
  for (const user of [freeUser, premiumUser]) {
    await prisma.userProfile.upsert({
      where: { userId: user.id }, update: {}, create: { userId: user.id, shoppingDayOfWeek: 6 },
    });
    await prisma.nutritionReport.upsert({
      where: { userId: user.id },
      update: { acknowledgedAt: at },
      create: {
        userId: user.id, acknowledgedAt: at, foodsToAvoid: [], foodsToLimit: [], foodsRecommended: [],
        drinksGuidance: [], generalSummary: 'Synthetic local acceptance record.',
        basedOnConditions: [], basedOnAllergies: [],
      },
    });
  }

  const product = await prisma.billingProduct.upsert({
    where: { code: 'PREMIUM' },
    update: { displayName: 'Premium', status: 'ACTIVE', featureSetVersion: 'meal-swaps-v1' },
    create: {
      id: 'accept_premium_product', code: 'PREMIUM', displayName: 'Premium', status: 'ACTIVE',
      featureSetVersion: 'meal-swaps-v1', description: 'Synthetic local acceptance product.',
    },
  });
  const price = await prisma.billingPrice.upsert({
    where: { productId_environment_version: { productId: product.id, environment: 'TEST', version: 1 } },
    update: { amountMinor: 19_900, currency: 'PHP', isActive: true, activeUntil: null },
    create: {
      id: 'accept_premium_price', productId: product.id, provider: 'PAYMONGO', environment: 'TEST',
      currency: 'PHP', amountMinor: 19_900, interval: 'MONTH', intervalCount: 1, version: 1, isActive: true,
    },
  });

  const checkout = await prisma.billingCheckoutRequest.upsert({
    where: { id: 'accept_premium_checkout' },
    update: {},
    create: {
      id: 'accept_premium_checkout', userId: premiumUser.id, billingSubjectKey: 'accept-premium-subject',
      billingPriceId: price.id, provider: 'PAYMONGO', environment: 'TEST',
      requestIdempotencyKey: 'acceptance-request-key', requestHash: 'a'.repeat(64),
      providerIdempotencyKey: 'acceptance-provider-key', referenceNumber: 'acceptance-reference',
      status: 'SUCCEEDED', providerSessionId: 'cs_acceptance_synthetic',
      checkoutUrl: 'https://checkout.paymongo.com/acceptance-synthetic', completedAt: at,
    },
  });

  const subscription = await prisma.userSubscription.upsert({
    where: { provider_environment_creationIdempotencyKey: {
      provider: 'PAYMONGO', environment: 'TEST', creationIdempotencyKey: 'acceptance-subscription-key',
    } },
    update: {
      userId: premiumUser.id, billingSubjectKey: 'accept-premium-subject', status: 'NON_RENEWING',
      sourceCheckoutRequestId: checkout.id,
      currentPeriodStart: accessStartsAt, currentPeriodEnd: accessExpiresAt, renewsAutomatically: false,
    },
    create: {
      id: 'accept_premium_subscription', userId: premiumUser.id, billingSubjectKey: 'accept-premium-subject',
      billingPriceId: price.id, sourceCheckoutRequestId: checkout.id, provider: 'PAYMONGO', environment: 'TEST',
      creationIdempotencyKey: 'acceptance-subscription-key', collectionMode: 'ONE_TIME_ACCESS_PERIOD',
      renewsAutomatically: false, status: 'NON_RENEWING', currentPeriodStart: accessStartsAt,
      currentPeriodEnd: accessExpiresAt,
    },
  });
  const invoice = await prisma.billingInvoice.upsert({
    where: { id: 'accept_premium_invoice' },
    update: {
      status: 'PAID', amountPaidMinor: 19_900, servicePeriodStart: accessStartsAt,
      servicePeriodEnd: accessExpiresAt,
    },
    create: {
      id: 'accept_premium_invoice', subscriptionId: subscription.id, provider: 'PAYMONGO', environment: 'TEST',
      sourceCheckoutRequestId: checkout.id, collectionMode: 'ONE_TIME_ACCESS_PERIOD', status: 'PAID', currency: 'PHP',
      amountDueMinor: 19_900, amountPaidMinor: 19_900, servicePeriodStart: accessStartsAt,
      servicePeriodEnd: accessExpiresAt,
    },
  });
  await prisma.entitlementGrant.upsert({
    where: { sourceKey: 'acceptance-paid-premium-grant' },
    update: {
      userId: premiumUser.id, subscriptionId: subscription.id, invoiceId: invoice.id,
      effectiveFrom: accessStartsAt, effectiveUntil: accessExpiresAt, revokedAt: null,
    },
    create: {
      id: 'accept_premium_grant', userId: premiumUser.id, billingSubjectKey: 'accept-premium-subject',
      subscriptionId: subscription.id, invoiceId: invoice.id, entitlementKey: 'PREMIUM',
      source: 'PAID_INVOICE', sourceKey: 'acceptance-paid-premium-grant', effectiveFrom: accessStartsAt,
      effectiveUntil: accessExpiresAt,
    },
  });

  const freeTracker = await seedPlan(freeUser.id, 'accept_free_plan', 0);
  const premiumTracker = await seedPlan(premiumUser.id, 'accept_premium_plan', 0);
  const [freeReservations, premiumReservations] = await Promise.all([
    Promise.allSettled(Array.from({ length: 12 }, () => reserveWeeklySwap(prisma, {
      trackerId: freeTracker.id, userId: freeUser.id, cap: 3,
    }))),
    Promise.allSettled(Array.from({ length: 12 }, () => reserveWeeklySwap(prisma, {
      trackerId: premiumTracker.id, userId: premiumUser.id, cap: 6,
    }))),
  ]);
  assert.equal(freeReservations.filter((item) => item.status === 'fulfilled').length, 3);
  assert.equal(premiumReservations.filter((item) => item.status === 'fulfilled').length, 6);
  await Promise.all([
    prisma.planSwapTracker.update({ where: { id: freeTracker.id }, data: { swapsUsed: 2 } }),
    prisma.planSwapTracker.update({ where: { id: premiumTracker.id }, data: { swapsUsed: 4 } }),
  ]);

  const service = new UserBillingAccessService(new PrismaUserBillingAccessRepository(prisma), false, () => at);
  const [free, premium] = await Promise.all([
    service.getForUser(freeUser.id),
    service.getForUser(premiumUser.id),
  ]);
  assert.deepEqual([free.current.tier, free.current.swaps.cap, free.current.swaps.used], ['FREE', 3, 2]);
  assert.deepEqual([premium.current.tier, premium.current.swaps.cap, premium.current.swaps.used], ['PREMIUM', 6, 4]);
  assert.equal(premium.current.access?.expiresAt, accessExpiresAt.toISOString());
  assert.equal(free.catalogue[1].price?.amountMinor, 19_900);
  assert.equal(free.checkout.reason, 'DISABLED');

  console.log(JSON.stringify({
    database: 'disposable-loopback', providerCalls: 0, users: 2,
    free: { tier: free.current.tier, swaps: `${free.current.swaps.used}/${free.current.swaps.cap}` },
    premium: { tier: premium.current.tier, swaps: `${premium.current.swaps.used}/${premium.current.swaps.cap}` },
    concurrentReservations: { free: 3, premium: 6 },
  }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Premium acceptance failed.');
  process.exitCode = 1;
});
