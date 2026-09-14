import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDatabaseRead } from '../src/lib/retry-database-read';

test('connection retry recovers reads without replaying writes', async () => {
  let calls = 0;
  const query = async () => {
    if (++calls === 1) throw { code: 'P1017' };
    return 'result';
  };
  assert.equal(await retryDatabaseRead('findMany', query, async () => {}), 'result');
  assert.equal(calls, 2);
  for (const operation of ['create', 'update', 'updateMany', 'upsert', 'deleteMany']) {
    calls = 0;
    await assert.rejects(retryDatabaseRead(operation, query, async () => {}));
    assert.equal(calls, 1);
  }
});

test('read retries stop after three retries and do not retry validation failures', async () => {
  let calls = 0;
  await assert.rejects(
    retryDatabaseRead(
      'findFirst',
      async () => {
        calls++;
        throw { code: 'P1017' };
      },
      async () => {}
    )
  );
  assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(
    retryDatabaseRead(
      'findFirst',
      async () => {
        calls++;
        throw new Error('Invalid query');
      },
      async () => {}
    )
  );
  assert.equal(calls, 1);
});
