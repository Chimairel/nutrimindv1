# UI integration audit — September 15, 2026

This pass integrates the Antigravity UI branch through `35250df` and preserves its layout, theme, imagery, and interactions. It checks the implementation behind those controls; it is not certification of every application workflow or live provider.

## Findings and repairs

| Area | Finding | Implemented repair |
| --- | --- | --- |
| Recovery forms | A cold page could accept native submission before React attached handlers. Password visibility also depended on hydration. | Shared `HydratedForm` disables controls until handlers are ready on login, registration, recovery and nutritionist invitation forms. Reset validation uses the shared password schema. |
| Recovery routing | An existing user session could subject public recovery routes to onboarding/report redirects. | Public routes stay outside the user onboarding gate. |
| Reset consumption | The reset token was checked before hashing but consumed without a second conditional check. | Atomic token/expiry check and update, with refresh-session revocation in the same transaction. Reused, replaced or expired links cannot change the password. |
| Database reconnect | The new reconnect handler retried mutations and disconnected the shared pool. | Bounded retries apply only to reads; writes are never automatically replayed and the shared pool stays connected. |
| Avatar settings | Custom images overwrote the legacy Google-photo field and could create fictitious Google account records. | Custom changes affect `User.image`; only validated Google photo URLs are returned as the Google default. Shared avatar editor retains drafts across tab changes and supports all three roles. |
| Meal history | Skipped meals contributed to consumed totals. | Shared intake summary counts only `DONE`; skipped cards, activity counts, badges and note editing remain available. Committed separately as `53321d5`. |
| Locality slider | Five displayed stops collapsed into three persisted modes. | Both approved blends persist as distinct enum values and combine the corresponding planning evidence. |
| Compilation and maintainability | Motion prop types and catch-up fixtures failed type checks; large page sections duplicated responsibilities. | Corrected types; extracted `MealLibraryPanel` and `AvatarSettings`; retained markup/classes. Repository formatting and unused-import cleanup applied. |

## Locality blend behavior

The five persisted preferences are `NATIONAL`, `NATIONAL_REGIONAL`, `REGIONAL`, `REGIONAL_LOCAL`, and `LOCAL`. Blends gather both adjacent evidence scopes and alternate their contributions within the bounded context. Each retained record keeps its actual scope and source label. Missing evidence uses the available side, with national fallback when neither regional nor local records exist. This combines planning context; it does not promise an exact percentage of generated meals from each area. Existing safety and calorie eligibility checks still precede locality ranking.

Migration `20260915020000_locality_blends` adds two enum values without renaming existing values or deleting data. It was applied to the disposable database and the existing local application database. Before the latter, a PostgreSQL custom-format backup was created and its archive listing verified at `C:/Users/chima/.codex/backups/nutrimind/before-locality-blends-1789407019333.dump` (591,130 bytes).

## Verification

- Backend full deterministic suite: **526 passed, zero failed, one pre-existing clinical TODO**.
- Frontend full suite: **140 passed across 36 files**, including independent password visibility controls, hydration guard, all-role avatar behavior, persisted blend stops, history totals and skipped-note behavior.
- Frontend production build, backend build, and backend script TypeScript checks passed.
- Both linters passed without warnings; architecture, Prettier and `git diff --check` passed.
- Disposable API acceptance exercised normalized email login, incorrect credentials, reset with a stale authorization header, token reuse/expiry rejection, session revocation, old/new password login, avatar restoration, both blend values, skipped-log notes, note length validation and cross-user ownership rejection. No real email was sent and no real account password was changed.
- Three-role API smoke checks returned HTTP 200 for user profile/current meals/history/grocery, nutritionist profile/queue/library, and admin analytics/users/nutritionists. Cross-role access returned 403.
- Browser recovery checks confirmed fields disabled before hydration, enabled afterward, independent eye toggles, and no horizontal overflow at 390 px (document width 390 px). These are DOM/interaction observations; the captured screenshot was blank and discarded rather than retained as visual evidence.

Raw test/build receipts are in [verification/ui-integration-2026-09-15](verification/ui-integration-2026-09-15). The guarded scripts `backend/scripts/ui-auth-acceptance.ts` and `backend/scripts/ui-browser-fixtures.ts` only accept the designated disposable loopback database.

## Remaining verification limits and follow-up

- The reported personal-account credential failure was not reproduced with that account. A Gmail address alone does not establish whether it has a local application password or was created through Google sign-in. Recovery works for the synthetic account; the user must retry a newly requested link to verify real email delivery and their account.
- Live Google OAuth, SMTP delivery, Gemini generation, payments and clinical correctness were not validated in this pass.
- Automatic approval rejected starting the separate production test preview on port 3003, including an explicit loopback-bound attempt, with no specific reason. Full authenticated browser acceptance across all three roles remains outstanding; API and component coverage is not a substitute for it.
- The current development app remains at `http://localhost:3000` with the existing local backend on port 5000. The disposable API on 5015 is separate from real account data.
- Calendar behavior outside the Manila timezone needs dedicated acceptance coverage. Account email-change reverification and replacing the legacy Google-photo storage field deserve separate review. Image licensing/provenance was not established by this functional audit.

No UI redesign was performed. Passing automated checks establishes the bounded behaviors above, not completion of a full security or clinical audit.
