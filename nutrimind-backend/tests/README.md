# Backend test baseline

The backend uses Node's built-in `node:test` runner through the existing `tsx` TypeScript executor. No test-framework dependency was added in Batch 2A or Batch 3.

Run from `nutrimind-backend`:

```powershell
npm test
```

The command first type-checks the isolated test project and then runs explicitly listed TypeScript test files.

## Current scope

- Active tests cover deterministic calorie calculations, synthetic-fixture integrity, the centralized approved-meal actionability policy/query boundaries, the deterministic restriction policy, and the meal-generation library compatibility adapter/fallback seam.
- TODO tests are executable specifications for known defects; they are not passing tests.
- TEST-013 through TEST-016 are active. TEST-017 through TEST-021 remain TODO.
- The current result is 91 registered tests: 86 pass, 0 fail, 0 skipped, and 5 TODO.
- Tests import only Node assertions/test APIs, Prisma enum values, pure calculation/actionability/restriction-policy modules, and synthetic fixtures.
- Tests must not import the Express app/server, Prisma singleton, Gemini, email, OAuth, PDF, cron, or other external-service paths.
- Tests require no `.env` file and must not access a database or network.

The 500 kcal implementation floor is deliberately not approved by an active test. `TEST-021` remains TODO until a clinically approved bound and behavior-change batch exist.

The Batch 4B1 restriction tests use synthetic evidence only. They do not import a production service, Express app/server, Prisma client, or external integration. Production use of the policy is limited to the separately approved Batch 4B2 meal-generation library adapter.

Batch 4B2 adds TEST-027 and TEST-028 through synthetic adapter inputs and injected fallback callbacks. Tests do not import the meal-generation service, Prisma, Gemini, or the network. Production imports of the adapter are limited to meal-generation library candidate filtering; other restriction workflows remain outside this test scope.
