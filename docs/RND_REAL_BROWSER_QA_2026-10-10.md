# RND real-browser verification — October 10, 2026

> Policy update (October 11, 2026): the legacy dispute tab and public adjudication endpoints are retired. Quarantine release now requires only an active admin, current recipe evidence/version and a recorded rationale. Historical results below describe the policy tested on October 10; see engineering record CHG-20261011-11 for current verification.

## Environment and method

This follow-up uses actual password sign-in and the connected Codex in-app browser, with the normal frontend and Express routes. Browser interactions did not inject authentication cookies, intercept API responses, or issue hidden API requests. Synthetic fixture setup used guarded local scripts. All data belongs to the task-owned loopback PostgreSQL database `kainara_browser_full_20261010_v3` on port 55488, with all 103 migrations. No shared Neon database writes occurred.

The test frontend runs on port 3002 and its same-origin API proxy targets the test API on port 5002. `localhost` and `127.0.0.1` keep the member/admin and RND browser logins separate, including refresh cookies. The owner authorized parallel agents: one performed library governance UI tests while the primary agent checked admin/member flows; two handled independent fixes and regression tests. Gemini, email and payment providers were disabled. Normal localhost:3000 and its API were preserved.

The final fixture has ten synthetic accounts: three members, six eligible RNDs and one admin. Two future auto-selected meal rows with no review decisions were initialized as pending to exercise rejection and concurrent profile invalidation. An initial fixture selection also selected a held recipe; it remained quarantined and was excluded from the actual replacement/invalidation decisions. Setup-only query mistakes and a download locator timeout were corrected; they are not reported as application failures.

## Observed browser journeys

| Journey | Observed result |
| --- | --- |
| Password login and logout | Real member, RND and admin sessions succeeded. A narrow RND viewport showed the desktop-only guard. |
| Meal canvas | Claim, fullscreen, H/V tools, button zoom and fit controls worked; ingredients were read-only table cells. Prior review references remained anonymous and required a separate decision. |
| Meal clarification | Publishing questions withdrew the member's cases and closed the canvas to the default panel. The member answered in Health details without changing their profile. Another RND saw and resolved the saved form. |
| Profile proposal and disagreement | The member requested a correction; the profile stayed unchanged. The RND revised the proposal, retaining the previous proposal and member response. Acknowledgment applied revision 2 and required fresh guidance/profile review. This fixture normalized a no-condition declaration; it did not test a new Type 2 diabetes diagnosis. |
| Profile confirmation | After report acknowledgment, an RND claimed and confirmed the current profile with recorded notes. |
| Explicit swap filters | A 36 g sugar maximum retained the low-sugar plate, excluded the high-sugar plate, and reported missing sugar evidence separately. Swapping saved a pending replacement; a separate approval modal and decision were required. |
| First flag | Structured concern notes immediately withheld the recipe. An uninvolved RND saw the notes/history and re-verified the recorded version. |
| Second flag and release | The next published-meal flag quarantined the recipe. Two distinct eligible, uninvolved RNDs confirmed the same current version. It stayed quarantined until admin supplied a rationale and released it. |
| Subsequent flag | A third incident quarantined immediately with zero fresh confirmations. The timeline retained all 11 changes across three incidents, including earlier findings and immutable nutrition evidence. |
| Admin oversight | Approval, clarification evidence and accepted/replaced proposal history were readable through related-case details. Opening sensitive details created an admin access audit entry. Recipe timelines retained flags, findings, actors, versions and release. |
| JSON batch | Template and selected-recipe downloads worked. Export omitted reviewer identities, flags and member data. Valid preview/import created one unverified draft; import was disabled after success. Invalid ingredient mapping produced an explicit error and blocked import. Input was pasted JSON, not a file upload. |
| No suitable replacement | A deliberately impossible 1 kcal maximum returned zero complete-plate matches. The no-match control opened the rejection modal; mandatory rationale committed a rejected, unavailable slot without replacement. Admin details retained the search scope, filters, counts, time, context and rationale. The member saw an unavailable-slot notice. `Needs resolution` is the existing disputed-decision view, not a list of these final rejections. |
| Concurrent profile change | While an RND held a fullscreen low-sugar case on 127.0.0.1, the member changed weight through the localhost UI. The canvas closed, the pending cases disappeared, the default panel and stale-context notice appeared, and the RND URL stayed unchanged. No manual reload was performed. |

## Bugs reproduced and fixed

1. **Member clarification notification did not navigate.** Add only the exact member review-request route to Health details; unrelated or unsafe targets stay excluded. Browser retest reached the page.
2. **Latest unacknowledged guidance appeared archived.** Only reports older than the active planning version are archived. A real weight update created version 3; it correctly read “Not yet selected for planning” before acknowledgment.
3. **Recipe certification was described as personal meal approval.** Public attribution now requires a matching immutable approval decision for member scope. Automatic certified-library selection uses recipe scope; ambiguous or reused historical attribution uses neutral recorded scope. All four member serializer queries include bounded decision proof, which is stripped from public output. The real credential modal correctly described recipe review, without invented credentials.
4. **Audit list time was eight hours behind its decision details.** PostgreSQL JSON omitted the timezone on UTC timestamp columns. Normalize timezone-less values as UTC, preserving explicit zones. Browser list and detail now show the same Philippine time.
5. **Recipe forms duplicated after flagging transitions.** Derivation and review siblings had the same React key. Distinct keys keep exactly one review panel and the appropriate held correction form after mutations.
6. **Quarantined detail header said pending re-review.** Detail reads now include the current lineage, and header status follows it. Grid, shared pool and detail all show Quarantined after the third flag.

## Regression evidence and limits

- Backend: **883 passed, zero failed, one existing TODO (884 total)**.
- Frontend: **843 component tests passed in 181 files**, plus **eight Node checks**.
- Backend/frontend production builds and lint passed. Application/test TypeScript checks and the global architecture guard passed, including all 21 entry-point budgets.
- Focused regressions cover notification role/path checks, guidance version ordering, legacy/recipe/member attribution and stale swapped decisions, private snapshot omission, timezone preservation, current lineage detail reads and same-open-detail flag/reverify/quarantine rendering.
- This run does not establish clinical validity, hosted behavior, external provider delivery, real OAuth/OTP/payment, production-scale load, every document upload path, or all health diagnoses. Ctrl-wheel was covered by the preceding authenticated Chromium suite; this connected-browser run exercised button zoom, not Ctrl-wheel.
- The tiny synthetic catalogue has only lunch recipes, so its empty breakfast/dinner slots are expected; this run does not prove provider-backed completion of all 21 slots. Earlier SQL/HTTP repair tests remain the evidence for full repair scenarios.
- Shared clarification enablement and its five pending migrations remain a separate rollout. No demo promotion occurred.

## Screenshots

- [Quarantine after third flag](verification/browser-qa-2026-10-10/quarantine.jpg)
- [Live canvas exit after member profile change](verification/browser-qa-2026-10-10/live-canvas-exit.jpg)
- [Recipe review attribution](verification/browser-qa-2026-10-10/recipe-attribution.jpg)
- [New unacknowledged guidance](verification/browser-qa-2026-10-10/new-guidance.jpg)
