# Audit repair implementation — September 10, 2026

This delivery implements the engineering repairs from the current journey audit and the user's subsequent shopping decisions. It does not certify the product as clinically approved. The existing clinical policy remains a draft pending qualified sign-off.

## Delivered behavior

| Audit area | Implementation |
|---|---|
| AUD-01, 02, 05, 08 | A shared, locked profile revision transaction recalculates targets, invalidates current and future unconsumed meals, clears claims/reviewer state, marks groceries stale and invalidates the current report. Both weight routes use the same transaction. Concurrent check-ins, generation and reviews reject changed profile snapshots. |
| AUD-02, 09 | Reports retain dated immutable content/profile snapshots and acknowledgement history. A stale or replaced report cannot be acknowledged. The report page exposes history; current-report PDF rejects stale context; account export includes versions. |
| AUD-03, 04, 07 | Same-day swaps remain available as explicitly requested. Every swap has a server-derived preview bound to the plan, profile, certified recipe and purchases. Confirmation requires its token and an idempotency key; required calorie warnings are enforced server-side. Meal, ingredients, quota, swap log and grocery rebuilding commit together or roll back together. |
| Shopping refinement | Grocery quantities distinguish required and purchased amounts. A 300 g purchase against a new 450 g requirement shows 150 g to buy. Users can enter partial purchased totals. Purchases are shopping-cycle totals; consumed meals remain in the cycle requirement. Surplus purchases remain recorded. Kilograms/litres aggregate into grams/millilitres. PDF output shows remaining, purchased and required amounts. |
| Swap notices | Confirmation lists only additional shopping needs. Removed quantities are omitted. Existing purchases reduce the added amount. Unresolved ingredient quantities stay explicit rather than becoming guessed weights. |
| AUD-06, 12 | Library eligibility includes serving/target fit. Results rank against the selected day's slots where available; All types puts the best breakfast, lunch and dinner first, followed by the remaining type groups. Library cards can choose an uneaten plan slot. Public attribution uses the safety reviewer authorizing the certified recipe. |
| AUD-10 | Nutritionist coverage includes eight daily target bands and each slot's usable serving count. The tool identifies missing reviewed servings; it does not silently scale a certified meal or manufacture clinical approval. |
| AUD-11 | Generated meal macros are recomputed from FNRI composition for fully resolved gram/kilogram portions. Missing composition or unsupported household conversions preserve estimated status and review requirements. Composition revision changes during generation reject stale work. |
| AUD-13 | A grocery cost endpoint and expandable UI expose remaining-shopping estimates, coverage, missing prices, observation dates/locality and source links. Exact mappings, compatible units and location evidence are required. Missing costs never count as zero; ambiguous commodity mappings remain unresolved. There is no promise that a peso budget is met. |
| AUD-14 | Premium disclosure includes quota-limited outside-meal AI estimates and next-week planning. Premium can prepare/read one upcoming cycle and its separate grocery list. Current-plan reads no longer select the newer future group. Existing recipe review and swap caps still apply. |
| AUD-15 | Daily cron aggregation and swap day calculations use Manila boundaries. |
| Admin source corrections | Admin can save a composition draft with source URL/date/reason, inspect before/after values, publish it, and prepare rollback as a new draft. Publication increments composition revision and invalidates dependent recipe certifications and affected unconsumed meals. Logged meal nutrition is retained. |

Legacy grocery lists without a cycle key are adopted only when their timestamp identifies one matching cycle. Ambiguous legacy records are retained for reconciliation and never credited to a different week. Login inputs remain disabled until the client handlers are ready, preventing an early native form submission on a cold load.

Revalidation flags are durable. The daily cron retries a bounded batch of affected users; failed replacements remain non-actionable. This requires the existing cron endpoint to be scheduled in the deployment. Grocery reads rebuild stale projections instead of serving them as current. Full-plan replacement is rejected once overlapping meals have been logged or their cycle has purchases; individual swaps preserve those records.

## Verification

- Backend deterministic suite: 519 pass, 0 fail, 1 external clinical-policy TODO (520 registrations).
- Frontend deterministic suite: 73 tests across 20 files. The library request assertion now includes the selected Manila date.
- Disposable journey acceptance covers onboarding/OTP, application/activation, role isolation, seventeen authenticated API reads, PDF signature, oversized serving rejection, warning enforcement, grocery failure rollback, idempotent swap replay, partial purchases, profile invalidation across two cycles, matching weight paths, stale-report rejection, Premium future access and composition draft/publication.
- Browser acceptance: five Chromium tests pass. These include the real UI purchase-aware swap (300 g bought, 450 g required, then 400 g purchased), report history, public entry validation, and nutritionist/admin workspace rendering at desktop and 390 px mobile width.
- Production integration smoke passes against disposable data: review claims, refresh rotation, certification, profile invalidation, check-in idempotency, generation contention and outside-meal preview persistence.
- Admin reference-data, outside-meal, Premium, compensation and controlled payment-projection acceptance suites pass against separate disposable databases. Seven payment calls went to the controlled test gateway; no real payment or email was sent.
- All 33 migrations applied on fresh disposable PostgreSQL 16 databases. Four new migrations add profile/report/grocery revisions, composition history, grocery base-unit backfill and swap request identity.

The full source/build gates and exact final command outcomes are recorded in the engineering record. Tests use synthetic data on a task-owned loopback Docker container; shared data and the user's existing backend on port 5000 were not migrated.

## Required external completion

1. **Qualified clinical policy approval (AUD-16).** The draft calorie floor was not changed without an approved policy. Software tests cannot replace this decision.
2. **Reviewed serving coverage.** Real nutritionists must create/certify appropriately sized servings for the gaps shown by the new coverage panel. Synthetic test recipes are not production catalogue additions.
3. **Real Gemini/report output and external integrations.** The disposable environment has no Gemini key. Live AI output, real SMTP/OAuth/payment delivery and production deployment remain unverified.
4. **Price and conversion evidence.** Reference-price coverage may be partial or unavailable. Household measures, edible/as-purchased yields, store package sizes and a guaranteed weekly-budget optimizer require additional reviewed data/product policy. Current estimates explicitly disclose their limits.

Locality remains evidence-based NATIONAL → regional/province-HUC preference with broader fallback, as documented in the audit. It does not guarantee city-level store inventory or real-time ingredient availability.

## Re-running the disposable browser checks

The browser fixture/server scripts require NODE_ENV=test and the exact database 127.0.0.1:55463/nutrimind_audit. Use only a task-owned database.

1. Apply migrations and seed FNRI data in that disposable database.
2. Run backend/scripts/repair-browser-fixture.ts with synthetic JWT secrets.
3. Run backend/scripts/repair-browser-server.ts; it binds loopback port 5012.
4. Start the frontend with NEXT_PUBLIC_API_URL=http://127.0.0.1:5012/api and NUTRIMIND_REPAIR_E2E=true. Its separate .next-repair directory prevents dev/build cache conflicts.
5. Run the frontend Playwright suite with NUTRIMIND_REPAIR_E2E=true. Without that explicit flag, the three authenticated tests are skipped.

The fixture's example.invalid accounts and published password are synthetic test-only credentials. Never use the fixture or its data for production or clinical review.
