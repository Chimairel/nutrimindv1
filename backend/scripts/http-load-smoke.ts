import assert from 'node:assert/strict';

const baseUrl = (process.env.LOAD_TEST_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const requestCount = Math.max(10, Number(process.env.LOAD_TEST_REQUESTS || 100));
const concurrency = Math.max(1, Math.min(50, Number(process.env.LOAD_TEST_CONCURRENCY || 10)));
const p95LimitMs = Math.max(100, Number(process.env.LOAD_TEST_P95_LIMIT_MS || 1000));

async function main() {
  const durations: number[] = [];
  let nextIndex = 0;
  let failures = 0;

  async function worker() {
    while (nextIndex < requestCount) {
      const current = nextIndex++;
      const path = current % 5 === 0 ? '/ready' : '/health';
      const startedAt = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: { 'x-load-smoke': 'nutrimind-local-verification' },
        });
        if (!response.ok) failures += 1;
        await response.text();
      } catch {
        failures += 1;
      } finally {
        durations.push(performance.now() - startedAt);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  durations.sort((a, b) => a - b);
  const percentileIndex = Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1);
  const p95Ms = durations[percentileIndex];
  const averageMs = durations.reduce((sum, value) => sum + value, 0) / durations.length;

  console.log(JSON.stringify({
    baseUrl,
    requestCount,
    concurrency,
    failures,
    averageMs: Number(averageMs.toFixed(1)),
    p95Ms: Number(p95Ms.toFixed(1)),
    p95LimitMs,
  }));
  assert.equal(failures, 0, 'All health/readiness requests must succeed.');
  assert.ok(p95Ms <= p95LimitMs, `p95 ${p95Ms.toFixed(1)}ms exceeded ${p95LimitMs}ms.`);
}

main().catch((error) => {
  console.error('[Load smoke] Failed.', error);
  process.exitCode = 1;
});
