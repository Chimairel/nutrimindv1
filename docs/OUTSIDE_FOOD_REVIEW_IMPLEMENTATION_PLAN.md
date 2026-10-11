# Outside-food estimate review: implementation plan

Date: October 11, 2026. Owner authorized planning followed by implementation. Status: implemented; verification recorded in CHG-20261011-12.

## Accepted scope

- Health Plan access (including the existing Health trial) includes the existing configurable default of one outside-food review per fixed Monday-to-Monday week in Asia/Manila. A logged meal and all its saved food items form one request; plan IDs, repairs and starter/full transitions never reset this allowance.
- After an AI estimate, **Use estimate** saves only; **Ask RND to review** saves and admits the whole meal atomically. A failed admission keeps the preview available to save without review. AI estimation and RND review use separate allowances.
- Members choose when to request review. Logging, automatic compatibility warnings and uncertainty remain available without RND review. Automatic conflict, uncertainty, implausibility and development AI flags do not create unmetered RND queue work.
- An accepted open request survives membership expiry. Questions, member answers, corrections and RND handoffs within that request consume no further allowance. An episode stays open until all its food items are resolved. Each decision stays attached to its recorded item revision; changing the meal after the episode completes requires another admitted request. Repeated requests for unchanged completed estimates do not reopen work.
- Results are reviewed estimates, not measured exact macros or permission to eat a meal already logged. Existing immutable revisions, unknown values, calorie uncertainty, compatibility warnings and separate recipe/clinical approval gates remain.
- RNDs receive searchable read-only FNRI/USDA references using the existing catalogue presentation and bounded database queries. No admin composition, alias, import or publishing permission is granted.

## Batches

1. Backend admission: remove automatic queue creation, admit all items of a saved meal together under the existing user transaction lock and membership usage receipt, retain free open-request follow-up, stop post-completion edits from silently reopening work, and hide/deny historical unrequested automatic tasks. Keep history without deleting records. Reuse current schema; no shared migration or record rewrite.
2. Member/RND UX: one whole-meal request control, server-derived remaining/reset details, clear Health-only/allowance/error states, stale reviewed-revision wording and estimate labels. Use Impeccable and incumbent components/tokens; preserve logging and RND action permissions.
3. Reference support and verification: an eligible-RND GET-only catalogue endpoint, reused presentation without editing controls, focused policy/HTTP/component tests, guarded disposable PostgreSQL acceptance for concurrency/expiry/multiple items, and one bounded browser inspection with at most one correction/confirmation round.

## Edge cases and limits

- Reserve and complete usage only in the same transaction as review creation. Failed admission rolls back without charging; duplicate/concurrent requests serialize and replay open work.
- Automatic tasks without an explicit request never bypass allowance by being requested later; admission must charge them before they become claimable. Already explicitly requested historical open tasks retain continuity.
- Failed membership reads disable new requests and offer retry. Existing clarification replies remain available. UI is advisory; backend enforces quota and ownership.
- Existing membership rollout flag keeps its established disabled-mode behavior. The configured local application already has membership enabled; this work does not change rollout flags or external billing.
- Catalogue searches perform no AI lookup or mutation. Values retain their per-100-g basis and provenance; unknown nutrient values remain unknown.
- No provider calls, shared database deletions, new accounts or demo promotion are needed for implementation. Dedicated synthetic fixtures belong only to the disposable test database.

## Evidence

- Eight guarded HTTP/SQL acceptance groups passed on fresh loopback PostgreSQL with all 103 migrations. External provider keys were disabled; AI confirmation used stored synthetic previews.
- Final default backend `npm test`: 928 passed, one existing TODO, no failures. The fixture baseline sets `CLINICAL_CLARIFICATIONS_ENABLED=false` only in test processes. The first run inherited the local enabled rollout; five historical disabled-rollout fixtures failed. A sixth fixture lacked the current retained-history read and was updated; the controlled run passed. Normal local rollout configuration was preserved; the unit command now explicitly preloads its disabled-rollout fixture baseline.
- Five focused frontend files: 37 tests passed. Tests cover separate preview choices, quota/membership failures with saving retained, multi-item history requests, legacy tasks, stale reviews and read-only catalogue values/actions.
- Actual Chromium: ordinary marked member/RND logins; 390-pixel member light preview and 1440-pixel member/RND dark/light states, then one confirmation round. Preview and claim responses were synthetic; FNRI/USDA reads used the normal API. No saved meal or RND decision was sent to the shared database. No browser JavaScript errors or admin mutation requests occurred.
- Final build, lint, architecture and browser-smoke details are in the engineering record. No shared schema, records, provider configuration or deployment was changed.
