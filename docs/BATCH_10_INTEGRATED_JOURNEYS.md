# Batch 10 — Integrated journey verification

**Change ID:** CHG-20260923-07

**Verification date:** September 23, 2026

**Status:** In progress. The Batch 10 exit gate in the implementation sequence remains open.

## Connected evidence

- `test:acceptance:batch10-email-auth` exercised email registration, captured OTP delivery, verification, login, and self-deletion with a disposable account. Google login intent and deletion acceptance also passed through the existing provider-free test harness; a real Google identity-provider round trip was not run.
- `test:acceptance:batch10-integrated-roles` connected an admin Lead assignment and audit event, a patient's manual outside log, an RND's clarification and correction, explicit patient consent, RND admission of a reproducible observed recipe, raw-corpus lookup, and account deletion. The observed candidate stayed outside `MealLibrary`; no safety clearance was inferred from its real-food provenance. Deletion removed the private log, item revisions, and a historical profile review while retaining only the deidentified admitted candidate and its deletion audit event. Test fixtures were removed afterward.
- Existing database acceptance scripts passed for plan cycles, profile adaptation, catalog metadata, upcoming preparation, progressive groceries, contextual swaps, outside capture, outside review, observed candidates, account deletion, Google auth intent, and checkpoint-3 governance. The governance fixture now uses distinct cycle dates and cleans both cycles, matching the current cycle uniqueness constraint.
- A real local backend and frontend served the Batch 10 Playwright role fixture. Three authenticated tests passed: user dashboard/meals/grocery, nutritionist review/outside-meal/library, and admin user/nutritionist/operations workspaces, each at desktop and mobile widths. The browser run caught and drove a fix for an authentication race: login and registration now wait for the authoritative profile fetch before route redirection. The regular unauthenticated Playwright suite passed 2 tests and skipped 6 fixture-dependent tests when the fixtures were absent.
- The shared development database has 65 applied migrations. `prisma validate` passed and a database-to-datamodel diff returned **No difference detected** after mapping historical review evidence, index names, and defaults in the Prisma schema. This was a source-schema reconciliation; it required no new migration or database write.
- Root `npm run check` passed: architecture and format checks, backend lint, **483 passing backend tests / 0 failures / 1 existing TODO**, **201/201 frontend tests**, and both production builds. The acceptance-script TypeScript check passed. `npm run audit` found zero vulnerabilities in all three lockfiles. Formatting was applied across existing files to satisfy the repository-wide format gate; much of this change is format-only.

## Exit-gate work still open

- The migrations were not rehearsed from an empty disposable database in this turn because the configured Docker Linux engine was unavailable. The live development target reports current migration status and zero Prisma datamodel drift, but those checks do not replace a clean bootstrap rehearsal.
- Browser coverage verifies authenticated routing and responsive workspace loading, not every action in the user, RND, and admin journey lists. In particular, a complete browser-driven onboarding/report acknowledgment, preparation-to-promotion, profile-change groceries, swaps, and outside-log action sequence still needs execution.
- An observed candidate was admitted and retrieved but was not carried through a generated plan, FNRI resolution, deterministic validation, independent RND approval, and eventual certified-library reuse in one connected acceptance.
- A real Google provider login, bounded live Gemini acceptance, scheduled job execution at timezone boundaries, and deployment behavior were not verified. The profile-cycle acceptance briefly attempted a live Gemini fallback and received provider `503` responses on three models before the script passed; this must not be interpreted as successful provider acceptance.
- Clinical review of policy thresholds, ingredient interpretation, and condition clearance remains outside code verification. These tests establish engineering behavior, not clinical approval.

The Batch 10 checklist remains unchecked until the connected action journeys and clean database rehearsal close these gaps. All disposable records created by the new integrated and browser fixtures were removed; a leftover zero-plan governance fixture cycle from an earlier failed test run was identified and removed by exact ID before the passing rerun.
