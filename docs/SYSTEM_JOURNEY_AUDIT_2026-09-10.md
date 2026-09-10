# NutriMind system journey audit — September 10, 2026

## Conclusion and scope

NutriMind has working authentication, onboarding gates, role separation, nutritionist application and review workflows, governed reference-data publication, and substantial deterministic coverage. **It is not yet verified as a fully working or clinically reviewed end-to-end nutrition system.** The current source contains important consistency defects, and the complete live-AI generation/report path was not exercised in this audit.

This audit follows the user's three-actor journey and current executable code. Older completion claims are not carried forward as current evidence. Scope included the 149 backend source files and 179 frontend source files as an inventory, route/controller/service tracing of the main workflows, schema/migration review, existing unit/component suites, selected database integration suites, public browser tests, and new disposable-database reproduction probes. This is a broad journey audit, not a claim that every line or every possible input was exhaustively verified.

The preceding UI changes remain in the worktree. This audit did not change production business behavior. It added a repeatable audit probe, included it in script type checking, and updated one obsolete source-location assertion in the navigation test. No shared database, real account, provider credential, external email, payment, deployment, or clinical decision was modified.

## Current three-actor journey

| Stage | Current implementation | Match to the requested journey |
|---|---|---|
| Nutritionist application | Public application, reference/email status lookup, admin review, required scheduled call, approval, expiring invitation, password activation | Substantially matches. Approval is an internal administrative verification process; stored PRC details are not an automatic live PRC lookup. |
| Nutritionist access | Server checks role, administrative verification and license eligibility; shared claim-based meal review queue; independent second review for escalated cases | Implemented; claim contention and related review behavior passed the selected integration suites. |
| User entry | Registration, OTP, authenticated login, statistics/preferences, conditions/allergies, shopping day, current consent, onboarding completion, report acknowledgement | API walkthrough passed through the report gate. A real generated report was not tested. |
| Retrieval and generation | Backend retrieves certified recipes, FNRI food records and active aggregate consumption evidence; filters safety/diet/goal; applies calorie eligibility; gives remaining slots to Gemini | A hybrid retrieval pipeline exists. It is not a guarantee of local stock, and FNRI linkage is not clinical approval. |
| Geographic preference | NATIONAL; REGIONAL with national fallback; LOCAL at province/HUC with regional then national fallback | Broader than strict exclusive regions, coarser than ordinary city/municipality coverage. No store inventory or guaranteed ingredient accessibility. |
| Display/review evidence | Pending previews are separate from approved/actionable meals. Meals/library expose a clickable verifier with bounded professional information | Largely present; verifier identity has a consistency issue across generation versus swapping. |
| User meal library | Uses the same MealLibrary storage as the nutritionist workspace, but only approved, complete, compatible evidence is returned to users | Safety/diet/goal-tag filtering exists; calorie-distance ranking and the requested All-types ordering do not. |
| Swapping | Same-type certified replacement, ownership/unlogged checks, 3 Free / 6 Premium swaps per plan group, preview, meal/ingredient/log transaction | Same-day swaps remain allowed. Warning acknowledgement and grocery consistency are incomplete. The library browse tab itself has no choose-for-future-slot action. |
| Tracking/adaptation | Meal/outside-meal logs, water, weight, progress and weekly check-ins; trend states and review recommendation | Implemented in parts. Weight paths differ; profile changes do not consistently invalidate plans/reports. |
| Administrator | People/applications, suspension, analytics, operations, compensation, reference data, images | Main read endpoints passed against synthetic data. Data management supports governed consumption releases and aliases, not arbitrary nutrient editing. |

Key source paths: [application service](../backend/src/services/nutritionist-application.service.ts), [user prerequisites](../backend/src/middleware/userPrerequisites.ts), [generation](../backend/src/services/meal-generation.service.ts), [locality policy](../backend/src/domain/planning-location.policy.ts), [consumption retrieval](../backend/src/services/food-consumption-context.service.ts), [swap/library service](../backend/src/services/meal-swap.service.ts), and [admin data](../backend/src/services/admin-data.service.ts).

## Confirmed defects and gaps

P1 means fix before claiming a reliable health/personalization journey. P2 means a material functionality, expectation, or verification gap. Reproduction observations deliberately demonstrate current failures; a successful audit-probe process does not mean those product behaviors passed acceptance.

| ID | Priority / evidence | Finding and effect | Repair direction |
|---|---|---|---|
| AUD-01 | P1 — reproduced through HTTP and database | Updating an existing user to VEGAN returned 200 while an egg meal remained APPROVED with safety revalidation false. Profile update recalculates onboarding targets but does not run plan compatibility revalidation. | Use one profile revision/change workflow for diet, conditions, allergies, goals and relevant body changes; invalidate affected unconsumed plans before making the new profile active for normal actions. |
| AUD-02 | P1 — reproduced | A condition change cleared report acknowledgement, retained the old report text, and allowed that same report to be acknowledged again. The page loads an existing report without requiring its profile revision to match. | Bind report generation and acknowledgement to immutable profile/report revisions; expose stale state and require a current report. |
| AUD-03 | P1 — reproduced with injected projection failure | Swap committed successfully but retained the original grocery item after grocery regeneration failed. The catch only logs the failure. | Commit a grocery invalidation/version change with the swap, then rebuild with durable retry; never serve the old list as current. |
| AUD-04 | P1 — reproduced | A preview requiring a calorie warning was committed with both warning flags false. The server stores client-supplied flags instead of enforcing the current preview requirement. | Compute the preview server-side for the exact current plan/profile/replacement revision and require acknowledgement when needed. |
| AUD-05 | P2 — reproduced | WeightLogService changes weight only; ProgressService changes weight and calorie target. Identical 90 kg entries produced different targets. | Consolidate both HTTP paths and weekly check-in updates into one weight/target policy and revision transaction. |
| AUD-06 | P2 — reproduced and source traced | A synthetic certified 3,000-kcal breakfast appears in the compatible library for a 2,000-kcal/day profile. Goal tags alone do not establish portion/calorie fit. Library and swap results have no target-distance sort. | Reuse explicit slot/target compatibility and stable ranking. Keep clinical eligibility ahead of ranking. |
| AUD-07 | P2 — reproduced, product decision | Same-day swapping is allowed; only earlier days and eaten/skipped meals are excluded. | Default to changes for a future shopping cycle, with explicit scheduling and grocery changes. Decide whether an informed same-day exception is desirable. |
| AUD-08 | P1 — source confirmed, multi-cycle runtime test still needed | Safety recheck chooses the plan group with the latest scheduled date and processes that group only. Current and pre-generated future groups can coexist. The safety-profile save and per-meal invalidations are separate transactions. | Invalidate every affected unconsumed current/future row atomically with the safety revision, then revalidate by durable job. Test overlapping cycles and interrupted jobs. |
| AUD-09 | P2 — source confirmed | NutritionReport has a unique user relation and regeneration uses upsert, overwriting the previous report. HealthProfileRevision history is not report history. | Store versioned reports with generated date, profile snapshot/revision, provenance, review state and acknowledgement history. |
| AUD-10 | P2 — integration coverage failure | The 51-recipe catalogue populated and certified in the disposable fixture, but the existing 1,900-kcal diabetes/vegetarian combined-flow test had 21 unmatched slots and attempted Gemini. Breakfast servings span 234.4–434.6 kcal; its 570-kcal breakfast allocation has a 484-kcal lower bound. Lunch max is 525.9 kcal versus a 646-kcal lower bound. | Measure usable coverage by profile AND serving/slot target; provide appropriately reviewed serving variants. Do not weaken calorie eligibility merely to make the old acceptance pass. |
| AUD-11 | P2 — source confirmed | Generated meal totals are persisted from Gemini after shape/range validation. Resolving FNRI ingredient IDs does not recompute those totals from quantities/units and composition records. | Reconcile portion conversions and totals deterministically where evidence permits; expose uncertainty and require review otherwise. |
| AUD-12 | P2 — source confirmed | Plan generation attributes certified reuse to safetyReviewedByNutritionist; swap and compatible-library projections use verifiedByNutritionist. They can be different people. | Define and display the exact reviewer/recipe revision authorizing the current meal, separately from original creator/verifier. |
| AUD-13 | P2 — source confirmed | Financial budget inputs/optimization are not wired into plan generation or grocery totals. Price/conversion tables and ingestion policies are foundations, not a working weekly-peso-budget planner. | Build evidence coverage, geographic/date matching, serving conversion and uncertainty-aware costing before promising budget compliance. |
| AUD-14 | P2 — source confirmed | Premium comparison advertises 6 versus 3 swaps, but outside-meal AI estimation also requires Premium with quota enforcement. The comparison does not describe that benefit. | Align entitlement policy, comparison text and feature affordances; retain core safety and ordinary logging for Free. |
| AUD-15 | P2 — source confirmed | Some daily aggregation and swap recalculation still use server-local setHours/setDate, while plan cycles and water use Manila business dates. | Standardize persisted day boundaries and test UTC versus Asia/Manila plus midnight transitions. |
| AUD-16 | Release blocker — existing external decision | The clinical policy file remains a draft with a 500-kcal floor; its external qualified-approval test is TODO and clinical approval record is awaiting sign-off. | Obtain a qualified decision and encode the approved policy/version; do not treat passing software tests as clinical validation. |

Supporting source: [profile controller](../backend/src/controllers/user.controller.ts), [safety save](../backend/src/services/safety-intake.service.ts), [safety recheck](../backend/src/services/user-safety-recheck.service.ts), [reports](../backend/src/services/nutrition-report.service.ts), [report page](../frontend/src/app/nutrition-report/page.tsx), [weight path](../backend/src/services/weight-log.service.ts), [progress path](../backend/src/services/progress.service.ts), [grocery](../backend/src/services/grocery.service.ts), [meal workspace](../frontend/src/features/meals/useMealsWorkspace.ts), [billing comparison](../backend/src/services/user-billing-access.service.ts), [outside-meal service](../backend/src/services/meal-log.service.ts), [cron](../backend/src/services/cron.service.ts), [clinical policy](../backend/src/domain/clinical-nutrition.policy.ts).

## Product decisions suggested by the audit

### Shopping and meal changes

A future-date-only rule is better preparation guidance than unrestricted same-day changes, but it does not completely solve the shopping problem: someone may already have bought the whole week's ingredients. Prefer editing the **next shopping cycle** before its grocery list is finalized. An optional current-cycle change should show added/removed ingredients, pantry availability and a clear acknowledgement. Safety-triggered removal must remain immediate and must not consume a paid/free swap quota.

For the requested library ordering, first apply current safety and diet eligibility, then rank each meal type against the selected future slot/day. All types should show the best breakfast, best lunch and best dinner, followed by each remaining type group in stable score order. This is currently a requirement gap, not existing behavior.

### Premium and budget

Current Premium is a TEST-only, nonrenewing 30-day entitlement with six swaps rather than three, plus bounded outside-meal AI estimates. The payment projection is considerably more developed than a simple upgrade flag: it includes verified grant evidence, replay handling, expiry, concurrency limits and reconciliation. The local payment test uses a controlled gateway; it does not establish a real PayMongo payment.

As a product judgment, extra swaps alone are a narrow benefit and conflict with the desire to keep shopping stable. Useful future benefits could include planning the next cycle, pantry-aware substitutions, meal-preparation organization and better history views. They should be advertised only after their backend behavior exists. Basic review transparency, allergy controls and honest nutrition uncertainty should remain part of the baseline product.

The money-budget feature is **partially built infrastructure**, not an operational budget optimizer. Affordability language in an AI prompt is not proof of a peso budget. Price evidence must retain location, observation dates, package/edible weights, conversion confidence and missing coverage; missing prices must never count as zero cost.

### Reports and changing health profiles

Report history would improve traceability, but a user being able to read a report is not itself a clinical safety guarantee. Keep versioned, dated, clearly attributed guidance and explicitly stale older reports. Do not mix a current profile summary with an old recommendation body without disclosure.

Weekly adaptation currently distinguishes insufficient data, low adherence, on-track progress and review recommended; its trend-driven calorie adjustment is explicitly zero. That is different from the user's proposed automatic calorie reduction. Body/goal/activity inputs can recalculate the formula, but unexpected weight changes should not silently trigger a punitive target change. Condition removal should be an explicit recorded profile update rather than the system inferring that someone is healed.

### Admin source updates

Admin can manage source metadata, draft/staged/active aggregate consumption releases, mappings, verified aliases, publication and rollback. Those actions were integration-tested. FNRI nutrient values are read-only in the workspace; there is no general reviewed composition-version editor. Freshness metadata does not automatically fetch new official data. Source publication also does not grant recipe approval. See the [reference-data runbook](ADMIN_REFERENCE_DATA_RUNBOOK.md).

## Verification performed in this audit

| Check | Result and limit |
|---|---|
| Initial full deterministic suite | 516 backend registrations: 514 pass, 1 fail, 1 clinical TODO. Failure was a stale assertion expecting billing href literals in Sidebar/BottomNav after navigation moved to the shared configuration. Root test chaining stopped before frontend. |
| Navigation assertion repair | Checks shared configuration, Sidebar consumption and Navbar/All tools reachability instead. Existing frontend component tests verify all three role tool inventories. No product entitlement rule changed. |
| Final deterministic suites | **Backend: 515 pass, 0 fail, 1 clinical TODO. Frontend: 73 pass across 20 files.** |
| Source/build gates | Backend and frontend production builds pass; both linters, source architecture, formatting, script type check and Prisma schema validation pass. |
| Dependency audit | Root, backend and frontend npm audit each reported zero known vulnerabilities. This is a package-advisory result, not a full security certification. |
| Migrations | All **29** applied to new disposable PostgreSQL 16 Alpine databases on loopback 55463. FNRI seed loaded 1,537 records with four updates from the checked-in CSV. |
| Production integration smoke | Exact outside-preview persistence, write idempotency, atomic claims, refresh rotation, certification/invalidation, check-in idempotency and generation contention passed. Despite the script name, it ran only against disposable local data. |
| Admin reference-data acceptance | Two releases, three activations, eleven audits; immutability and active context passed. |
| Outside-meal acceptance | FNRI/user-reported/unresolved handling; unresolved excluded; preview replay protection; review contention; 410 provisional kcal corrected to 330; notification written. Zero Gemini calls. |
| Compensation acceptance | Four work awards, two statements, manual payout evidence passed. Zero provider calls. |
| Premium acceptance | Free/Premium projections and concurrent reservations stop at 3/6 respectively. Zero provider calls. |
| Payment projection acceptance | Replay, expired-claim recovery, rollback, durable retry, overlap rejection and accounting constraints passed. Seven calls to its controlled gateway implementation, not the external payment provider. Initially collided with a reused fixture product; rerun in a separate clean database passed. |
| New journey probes | Application stages and captured invitation activation; registration/OTP/onboarding/report gate; role isolation; 17 authenticated read routes returned 200; grocery endpoint returned a PDF signature. Seven defect/gap observations reproduced. |
| Public browser suite | **2/2 Chromium tests passed**: landing and adversarial registration validation. Authenticated browser journeys were not rerun; authenticated API coverage is not browser coverage. |
| Combined library generation | Failed to stay library-only: all 21 slots unmatched in first 1,900-kcal fixture, then missing Gemini key. Recorded as a coverage failure and live-provider limitation, not a successful generated plan. |

New reproducible probes: [current-journey-audit.ts](../backend/scripts/current-journey-audit.ts). They assert observed defects deliberately and must be revised into acceptance assertions as fixes land. The script requires NODE_ENV=test and the exact disposable target `127.0.0.1:55463/nutrimind_audit`, captures mail locally, and starts Express on an ephemeral loopback port. It is not wired into the normal unit suite and must never run against shared or production data.

Not verified here: real Gemini output quality/availability, live SMTP or Google OAuth, real payment checkout/webhooks, shared-data freshness/coverage, fully authenticated desktop/mobile browser flows, clinical suitability, load under realistic concurrent users, and production deployment. Earlier engineering-record claims do not replace these missing current checks.

## Repair sequence before further UI work

1. Profile revisions, atomic plan invalidation, both active/future cycles, and report freshness/history.
2. One weight/target update path, reviewed calculation policy, and explicit next-cycle adaptation behavior.
3. Server-authoritative swap previews, shopping-cycle rules, and durable grocery consistency.
4. Target-aware library filtering/ranking, certified serving coverage, and accurate verifier identity.
5. Real-AI output tests with portion/FNRI reconciliation and generation failure/recovery cases.
6. Align Premium messaging with implemented entitlements; define budget requirements separately from price-data storage.
7. Run complete authenticated browser journeys for all three actors on the repaired API, including mobile, empty/error states, report refresh and shopping changes.

The audit artifacts and test repair are ready for review. The product defects listed above remain open; no blanket “everything works” conclusion is justified.
