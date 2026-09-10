import assert from 'node:assert/strict';
import app from '../src/app';
const target = new URL(process.env.DATABASE_URL || '');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '55463');
assert.equal(target.pathname, '/nutrimind_audit');
assert.equal(process.env.NODE_ENV, 'test');
app.listen(5012, '127.0.0.1', () => console.log('Disposable browser API listening on loopback 5012.'));
