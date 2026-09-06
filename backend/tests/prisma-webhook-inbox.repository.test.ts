import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '@prisma/client';
import { WebhookInboxRecord } from '../src/billing/contracts';
import { PrismaWebhookInboxRepository } from '../src/services/prisma-webhook-inbox.repository';

function record(payloadHash = 'a'.repeat(64)): WebhookInboxRecord {
  return {
    provider: 'PAYMONGO',
    environment: 'TEST',
    providerEventId: 'evt_synthetic_12345678',
    eventType: 'checkout_session.payment.paid',
    livemode: false,
    payloadHash,
    providerCreatedAt: new Date('2026-09-06T12:00:00.000Z'),
    receivedAt: new Date('2026-09-06T12:00:01.000Z'),
    signatureKeyVersion: 'sandbox-v1',
    resource: { id: 'cs_synthetic_12345678', type: 'checkout_session' },
    disposition: 'PENDING',
  };
}

function fakePrisma(initialHash?: string) {
  let storedHash = initialHash;
  let createData: Record<string, unknown> | undefined;
  let transactionOptions: unknown;
  const providerWebhookEvent = {
    async findUnique() {
      return storedHash ? { payloadHash: storedHash } : null;
    },
    async create(input: { data: Record<string, unknown> }) {
      createData = input.data;
      storedHash = String(input.data.payloadHash);
      return { id: 'inbox_1' };
    },
  };
  const prisma = {
    providerWebhookEvent,
    async $transaction<T>(
      callback: (transaction: { providerWebhookEvent: typeof providerWebhookEvent }) => Promise<T>,
      options: unknown
    ) {
      transactionOptions = options;
      return callback({ providerWebhookEvent });
    },
  } as unknown as PrismaClient;
  return {
    prisma,
    state: () => ({ storedHash, createData, transactionOptions }),
  };
}

test('[TEST-101] webhook inbox atomically creates one immutable event and pending processing row', async () => {
  const fake = fakePrisma();
  const result = await new PrismaWebhookInboxRepository(fake.prisma).ingest(record());
  assert.equal(result, 'INSERTED');
  const state = fake.state();
  assert.deepEqual(state.transactionOptions, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  assert.equal(state.createData?.providerEventId, 'evt_synthetic_12345678');
  assert.deepEqual(state.createData?.processing, {
    create: { handlerVersion: 'paymongo-inbox-v1', status: 'PENDING', completedAt: null },
  });
  const serialized = JSON.stringify(state.createData?.sanitizedPayload);
  assert.match(serialized, /cs_synthetic_12345678/);
  assert.doesNotMatch(serialized, /billing|email|card|line_items|payment_intent/);
});

test('[TEST-101] an exact provider event replay is acknowledged without a second insert', async () => {
  const fake = fakePrisma('a'.repeat(64));
  assert.equal(await new PrismaWebhookInboxRepository(fake.prisma).ingest(record()), 'DUPLICATE');
  assert.equal(fake.state().createData, undefined);
});

test('[TEST-101] a reused provider event ID with different bytes is a conflict', async () => {
  const fake = fakePrisma('b'.repeat(64));
  assert.equal(await new PrismaWebhookInboxRepository(fake.prisma).ingest(record()), 'CONFLICT');
  assert.equal(fake.state().createData, undefined);
});

test('[TEST-101] ignored signed events are durable but have no pending business work', async () => {
  const fake = fakePrisma();
  const ignored = { ...record(), eventType: 'merchant.activated', disposition: 'IGNORED_UNKNOWN' as const };
  assert.equal(await new PrismaWebhookInboxRepository(fake.prisma).ingest(ignored), 'INSERTED');
  assert.deepEqual((fake.state().createData?.processing as { create: unknown }).create, {
    handlerVersion: 'paymongo-inbox-v1',
    status: 'IGNORED',
    completedAt: ignored.receivedAt,
  });
});
