import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

test('local restore, migration and API switch refuse missing or hosted target confirmations before Docker/database access', () => {
  const helper = resolve(__dirname, '../../scripts/local-database.mjs');
  for (const action of ['restore', 'migrate', 'use']) {
    for (const confirmation of [[], ['--confirm-target=hosted-neon-database']]) {
      const result = spawnSync(process.execPath, [helper, action, ...confirmation], {
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: 'postgresql://must-never-connect:private@unreachable.invalid/hosted' },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Confirm this local target/);
      assert.doesNotMatch(result.stderr, /private|unreachable|docker.*failed/i);
    }
  }
});
