# Gemini Premium and asset follow-up — September 17, 2026

Audited the 31 modified/new files in the Desktop checkout since `05e50d4`. Preserved the new illustrations, Premium styling, avatar changes, toast system and meal-modal refinements.

## Repairs

- The self-service test Premium API now requires per-account administrator permission. Admin → Users exposes Allow/Disable Premium testing in desktop and mobile views. Permission and grant changes are recorded in AuditEvent. User-row locking serializes permission withdrawal and activation.
- Revocation targets only the sandbox demo grant; independent administrator or paid grants remain unchanged. Repeated activation reuses one demo grant. Input actions are validated. The CLI helper uses the same permission boundary. The synthetic billing-price seeder is restricted to local test databases.
- Profile Premium badges now use the canonical entitlement resolver, including verified invoice evidence, instead of treating every unexpired grant as valid.
- Grocery cost UI distinguishes explicit PREMIUM_REQUIRED from unrelated 403 failures. Missing price data has a specific configuration message and never renders as zero cost. Marketing copy now describes published reference prices, bounded AI allowances and compatibility checks rather than real-time prices or guaranteed macro outcomes.
- Added a default-false testPremiumAllowed database column. Migration passed on the disposable database and was applied to the configured shared development database. No existing account was automatically authorized, no entitlement was granted to a real account, and no payment was made during this audit.

## Why grocery costs remain unavailable

Read-only checks of the configured database found zero IngredientPriceSource, IngredientPricePublication, IngredientPriceObservation and IngredientPriceCommodityMapping rows. Premium access does not create this evidence. Published price observations, exact ingredient mappings, appropriate location coverage and compatible purchase units are still needed before real totals can be calculated. No prices or conversion factors were invented or imported. The existing price-import tooling is not an admin price-management UI; a source-backed import and its coverage review remain outstanding work.

## SVG assets

The new cooking, not-found and verifying SVGs are valid XML (approximately 25–66 KB each). No script, foreignObject, event-handler attributes or external href references were detected. Keep these static application illustrations in frontend/public; Cloudinary is unnecessary for serving them. This code inspection does not establish artwork ownership or licensing.

## Verification and limits

- Frontend: 194 passing tests across 49 files.
- Backend: 528 passing tests; one existing TODO.
- Backend/frontend lint and production builds, script typechecking, formatting and architecture checks passed.
- Disposable API acceptance: unauthorized activation and self-authorization rejected, admin permission accepted, invalid actions rejected, repeated activation idempotent, scoped revocation preserves an independent grant, withdrawal blocks further activation, audit history recorded.
- No full authenticated browser journey, real payment/provider request, price-data import or clinical assessment was performed. Existing demo grants were not retroactively removed.
