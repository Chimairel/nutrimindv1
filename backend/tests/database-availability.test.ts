import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseAvailabilityFailure } from '../src/lib/database-availability';

test('quota failures expose a stable safe code rather than vendor credentials or advice', () => {
  const failure = databaseAvailabilityFailure({
    name: 'PrismaClientInitializationError',
    message:
      'Error querying the database: ERROR: Your account or project has exceeded the quota. Upgrade your plan to increase limits. postgres://private',
  });
  assert.equal(failure?.errorCode, 'DATABASE_QUOTA_EXCEEDED');
  assert.doesNotMatch(JSON.stringify(failure), /postgres|private|Upgrade/);
});
test('known connection and initialization failures remain distinct from domain and validation errors', () => {
  assert.equal(
    databaseAvailabilityFailure({ name: 'PrismaClientInitializationError' })?.errorCode,
    'DATABASE_UNAVAILABLE'
  );
  assert.equal(
    databaseAvailabilityFailure({ name: 'PrismaClientKnownRequestError', code: 'P2024' })?.errorCode,
    'DATABASE_UNAVAILABLE'
  );
  assert.equal(databaseAvailabilityFailure({ name: 'PrismaClientKnownRequestError', code: 'P2002' }), null);
  assert.equal(databaseAvailabilityFailure(new Error('Invalid email or password.')), null);
  assert.equal(databaseAvailabilityFailure(new Error('Your account or project has exceeded the quota.')), null);
  assert.equal(databaseAvailabilityFailure(null), null);
});
