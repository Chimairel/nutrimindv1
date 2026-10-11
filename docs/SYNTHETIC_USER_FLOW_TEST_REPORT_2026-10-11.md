# Synthetic user-flow verification — October 11, 2026

## Purpose and evidence limits

Requested work: create synthetic accounts, exercise member/RND/admin workflows in an actual browser, investigate failures, and prepare frontend/backend study documentation. Baseline: `32f67b99` on the development checkout. This report records observed software behavior; it does not establish clinical validation or guarantee that every possible workflow is defect-free.

The [engineering record](NUTRIMIND_ENGINEERING_RECORD.md) remains the canonical evidence ledger. Study material is in the [backend guide](study/BACKEND_STUDY_GUIDE.md) and [frontend guide](study/FRONTEND_STUDY_GUIDE.md).

## Environments and data handling

- **Ordinary browser journeys:** Chromium, frontend `http://localhost:3000`, existing API `http://localhost:5000`, configured development database. Authentication uses the actual login form. No mocked API responses or injected sessions are used by the two new synthetic journey specifications.
- **Isolated acceptance:** task-owned PostgreSQL 16 at loopback port 55488, seven fresh databases with repository migrations. Tests use real Express handlers, Prisma and SQL. Gemini, email/payment/OAuth/storage providers are disabled in these test processes. Development feature flags are unchanged.
- **Isolated browser acceptance:** the actual frontend calls those dedicated APIs through request forwarding; real fixture tokens are installed for actors seeded by the acceptance scripts. This verifies the interface and backend workflow together, but does not verify password login for those fixtures. Ordinary password login is covered separately above.
- The shared development account set contains 13 clearly marked accounts in group `sleep-oct11`. Existing account passwords, unrelated reviews and shared schema were preserved. New test accounts intentionally skip registration/onboarding and use the standard downstream guards.
- Credential guides, account specifications, raw logs, screenshots and traces remain under ignored `backend/.local/sleep-oct11/` and `backend/.local/dev-test-accounts/`. Raw admin screenshots can contain unrelated account names; they are not published with this report. No plaintext credentials belong in committed documentation.

## Shared development account matrix

All addresses below use the reserved `@example.test` domain.

| Email name | Role | Relevant configuration |
| --- | --- | --- |
| sleep-admin | Admin | Ordinary admin login and oversight |
| sleep-healthy | Member | 26 years, 65 kg, Maintain, Sedentary |
| sleep-heart | Member | Female, 45 years, 72 → 65 kg, Lose weight, Active, heart condition |
| sleep-diabetes | Member | 55 years, 80 kg, Maintain, Lightly active, diabetes |
| sleep-kidney | Member | 42 years, 62 kg, kidney disease |
| sleep-allergy | Member | 55 → 60 kg, Build muscle, Active, nuts and shellfish |
| sleep-vegan | Member | Vegan, no rice |
| sleep-pregnant | Member | Female, 30 years, pregnancy |
| sleep-rnd-a | RND | Active general reviewer, four years experience |
| sleep-rnd-b | RND | Active reviewer with diabetes expertise, 12 years experience |
| sleep-rnd-expired | RND | Expired credential |
| sleep-rnd-unverified | RND | Unverified credential |
| sleep-rnd-suspended | RND | Suspended account |

These are fictional software fixtures. The active reviewers can see the shared queue; automated actions are restricted to the newly created synthetic heart member. No real member's case is claimed or decided.

The account set remains available for repeat testing. Both reviewers retain active fixture credentials; no test-owned profile claim remains at completion. Shared synthetic history is retained rather than deleting its audit records.

## Verified workflows

### Ordinary login and interface checks

`frontend/e2e/synthetic-journey-live.spec.ts`: **12 passed**, one worker, 4.2 minutes in the final complete run.

1. Healthy member login and nine workspace routes at desktop width 1440 in light mode.
2. The same member routes at width 390 in dark mode.
3. Heart, diabetes, kidney, multiple-allergy, vegan and pregnancy members: ordinary login, account settings, health details, guidance and membership views.
4. Both active RND accounts: review queues, meal library, profile and personal audit pages.
5. Administrator: overview, people, nutritionist management, nutrition data, meals, all four audit tabs and test-account profile fields.
6. An API-only Playwright test verifies that expired and unverified reviewers receive 403 from the guarded review queue and suspended login is refused by the current login contract. This is not a browser UI login check for those three accounts.

Checks include arrival at the correct route, rendered content, absence of account-bootstrap/client exception messages, failed API responses and horizontal document overflow. They are navigation/layout smoke checks, not proof that every control on every route completes a mutation.

### Persistent clarification, profile changes and decisions

`frontend/e2e/synthetic-clarification-journey-live.spec.ts`: **one complete four-account browser workflow passed**, two minutes. Through ordinary UI login, the heart member saved health details; Reviewer A claimed the profile and published a named question page in the expanded canvas, then released it. The member submitted an answer; Reviewer B claimed the same profile, read and resolved that answer, and released the claim. The member saw the resolution; the administrator found the RND audit event and opened its saved case canvas without a case-load error. The empty-health illustration was absent while the clarification form was present. This test resolves clarification only: it does not clinically confirm the profile or approve a meal.

Fresh-database acceptance groups passed:

| Suite | Grouped checks | Verified behavior |
| --- | ---: | --- |
| Clinical clarification | 13 | Role/claim boundaries, immutable questions, unresolved blocking, member ownership, late answers, successor resolution, concurrency and audited access |
| Profile proposal | 19 | Member acknowledgment/correction requests, exactly-once application, release of 21 old meal claims and retained history |
| Meal context | 8 | Exact quantities/units, immutable decisions, stale approve/reject/swap refusal, twenty simultaneous claims invalidated after profile change and a transaction race |
| Review filters | 11 | Full catalog beyond 120 rows, unknown versus zero, rice/side composition, live verifier eligibility, swap pending state, no-replacement holds and saved admin search context |

Some groups overlap between suites; counts must not be presented as distinct individual assertions or distinct user journeys. Assertions cover HTTP response and persisted SQL state.

### Exact prior context and remaining-date recovery

- Reference acceptance passed **six groups** before entering its browser-ready mode: anonymous numeric references only; age/weight/goal differences excluded; original context retained after source member changes; portion/source nutrient changes excluded; quarantined/expired/challenged decisions excluded; legacy missing snapshots not reconstructed.
- Repair acceptance passed **11 groups** before its browser-ready mode: immutable source forms and paused claims; healthy declarations reopened for clarification; late answers and handoff; audited source records; actual edits retire outdated tasks; acknowledgment/ownership/admission gates; preserved consumed/skipped logs and purchases; concurrent membership receipt; one remaining-date recovery; read-only history; idempotent captures.
- Browser-ready mode intentionally stops before the scripts' final cleanup/deletion branches. Those branches are not counted as newly verified here.

`frontend/e2e/rnd-clarification-live.spec.ts`: **six browser tests passed** against these APIs. Four cover repaired history/purchases at 390/1440 pixels in light/dark themes. The other two cover exact-reference canvas behavior, Ctrl+wheel zoom, H/V tools, persistent questions and handoff, plus leaving an invalidated fullscreen canvas for the default queue panel without navigating the whole page.

### Registration and onboarding intake

Sixteen member scenarios exercised the actual registration and OTP API with a local captured-email transport, profile intake, structured declarations, required health details, current terms and meal schedules. Scenarios included none, shellfish, multiple allergies, diabetes, hypertension, kidney disease with shellfish, heart condition with nuts/MSG, pregnancy, gout, an unknown custom condition/allergy, pollen, myopia/dust mites, lactose intolerance/avoided pork, vegan, vegetarian and pescatarian/no-rice.

After correcting the test setup to save required meal times, **18 grouped checks passed**: two policy groups and all sixteen member scenarios. The initial phase successfully registered and verified these accounts, but onboarding completion failed because the old journey script omitted the new schedule requirement. The corrected continuation uses the same accounts and verifies completion and downstream gates. It must not be described as a second fresh registration run.

Generation before guidance acknowledgment returned 409 and created zero jobs. Member access to admin and RND routes returned 403. Intake does not demonstrate provider-backed full-week generation.

## Failures investigated

| Observation | Cause and disposition |
| --- | --- |
| Kidney browser check lost its trace file | Two concurrent Playwright commands shared the default output directory. Separate output directories fixed the test collision; the final kidney check passed. |
| Audit tab state assertion failed | The shared tab component uses `aria-pressed`; the test incorrectly expected `aria-selected`. Corrected the assertion; all audit tabs passed. |
| Suspended-login status assertion failed | Login currently returns a generic 400 refusal, whereas the first test expected 403. Authentication was denied correctly; the test now verifies the actual contract and message. |
| Onboarding completion returned `ONBOARDING_INCOMPLETE` | The old test setup lacked required meal schedules. Updated the tracked journey script and verified the equivalent setup in the isolated continuation. |
| Prefilled health textarea could not be found reliably | An exact implicit-label locator stalled. The new browser workflow uses the accessible textbox name and bounded action timeouts. |
| Retried profile journey searched for Claim after already claiming | A preceding request had completed and the fixture retained its claim. The test now recognizes a claim already owned by that reviewer rather than attempting it again. |

No runtime authorization, clinical policy or transaction guard is loosened to make these tests pass. Initial failures remain in the private evidence directory.

## Regression checks

- Backend test typecheck and complete unit suite: **924 passed, zero failed, one TODO** (925 total).
- Frontend: **905 Vitest tests passed across 187 files**, plus **eight Node security/service-worker tests passed**.
- Backend build and full ESLint passed.
- Frontend full ESLint and production build passed; the build uses a separate output directory from the running development server.
- All 25 source composition budgets passed; handwritten source modules remain within the 900-line limit.

## Completion and changes

The corrected complete runs passed **18 actual-browser tests**: 11 ordinary-login smoke checks, one ordinary-login cross-role clarification workflow and six isolated API canvas/history checks. One additional Playwright API-only test verifies negative credential gates. These counts describe test cases, not distinct assertions or exhaustive feature coverage.

The cross-role workflow was then repeated successfully with the previous resolved form retained (2.1 minutes). New questions use distinct labels and status assertions target the current form, so an older resolved form cannot accidentally satisfy the new resolution check.

The retained code changes are two opt-in browser specifications and the missing required meal-schedule setup in `backend/scripts/system-journey-members.ts`. No new application defect was confirmed within the tested paths, and no application authorization or clinical policy change was needed. Documentation includes both study guides, this report and a dated engineering-record entry. Task-owned isolated API processes and PostgreSQL container are stopped after verification; normal localhost services remain running.

## Repeating these checks

1. Use the [development test-account guide](DEV_TEST_ACCOUNTS.md) to provision the marked account matrix on the confirmed development target. Save credentials privately. These specifications expect the reserved names in the table and decline non-loopback browser destinations.
2. Set `SYNTHETIC_JOURNEY_GUIDE` to the complete CLI credential-guide JSON and `NUTRIMIND_REPAIR_E2E=true` to use an already-running local frontend.
3. From `frontend`, run `npx playwright test e2e/synthetic-journey-live.spec.ts --workers=1 --output=<unique-private-directory>`.
4. Run `e2e/synthetic-clarification-journey-live.spec.ts` separately with its own output directory. This test saves synthetic health details and creates persistent clarification history; use a deliberate fixture group and retain the audit trail. Never run it against real members.
5. For isolated acceptance, inspect each script's exact loopback/fresh-database guard before provisioning its disposable target. Do not replace that guard with an unrestricted shared-database URL. Browser-ready scripts remain serving until stopped.

## Remaining limits

This run does not verify live SMTP delivery, real Google OAuth, payment-provider settlement/webhooks, live Gemini output quality, hosted production reliability or qualified clinical review. It also does not claim an exhaustive visual audit of every route or every possible condition combination. Provider-free SQL tests and existing unit tests supply important generation/replacement evidence; a fresh provider-backed 21-meal journey is a separate rehearsal.
