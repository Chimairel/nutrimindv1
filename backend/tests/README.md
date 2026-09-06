# Backend test baseline

The backend uses Node's built-in `node:test` runner through the existing `tsx` TypeScript executor. No test-framework dependency was added in Batch 2A or Batch 3.

Run from `backend`:

```powershell
npm test
```

The command first type-checks the isolated test project and then runs explicitly listed TypeScript test files.

## Current scope

- Active tests cover the current pure domain, validation, migration, billing, compensation, actionability, restriction, generation, and operational policies recorded in the engineering record.
- One TODO remains an executable specification for clinically approved calorie bounds; it is not a passing test.
- The current result is 458 registered tests: 457 pass, 0 fail, 0 skipped, and 1 TODO.
- Tests require no live database or network. The test-only mail-capture regression imports the email module but exits through an absolute local JSONL capture path before Nodemailer and proves that the seam rejects non-test use.

The 500 kcal implementation floor is deliberately not approved by an active test. `TEST-021` remains TODO until a clinically approved bound and behavior-change batch exist.

The Batch 4B1 restriction tests use synthetic evidence only. They do not import a production service, Express app/server, Prisma client, or external integration. Production use of the policy is limited to the separately approved Batch 4B2 meal-generation library adapter.

Batch 4B2 adds TEST-027 and TEST-028 through synthetic adapter inputs and injected fallback callbacks. Tests do not import the meal-generation service, Prisma, Gemini, or the network. Production imports of the adapter are limited to meal-generation library candidate filtering; other restriction workflows remain outside this test scope.

TEST-042 through TEST-044 exercise the pure mixed-cuisine prompt policy. They verify culture-as-influence semantics, support for accessible general/convenience foods, and the precedence of recorded clinical constraints without importing Prisma, Gemini, or the network.
