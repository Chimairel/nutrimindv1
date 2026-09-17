# Antigravity follow-up: application signatures and review integrity

This bounded audit starts from `3565eb1`, preserving the latest Antigravity UI. It does not establish complete three-role, clinical, or live-provider acceptance.

## Repairs

- Signature confirmation now exports the canvas directly. The installed signature wrapper's `getTrimmedCanvas()` calls a dependency whose default import is an object rather than a function in the tested module environment. Export failure previously prevented the form value from being saved. Drawing no longer implicitly confirms after the first stroke; explicit confirmation stores the image, with retry feedback if capture fails.
- A fixed backing bitmap and disabled resize clearing preserve the drawing during mobile viewport changes. Mouse/touch coordinates are mapped to that bitmap before drawing. Clearing a confirmed signature clears the form value.
- Frontend and backend require bounded PNG signature data and PNG/JPEG headshot data. This validates data-URL syntax and size, not image authenticity or liveness. Only the application route receives a 2 MB JSON limit, accommodating the accepted combined media sizes; the general API limit stays 256 KB.
- Added the missing additive migration for eight application/profile identity and payout columns. All eight were already present in the configured database; applying the migration recorded their deployment without replacing account data. The migration also passed against the disposable PostgreSQL database.
- A replacement recipe starts its own review chain. High-risk replacements remain pending with one approval and retain their high-risk flag and plan type, even if the rejected meal already had an approval. Ingredients cannot claim FNRI provenance without a resolved FNRI record. Missing generated nutrient values are rejected rather than replaced with invented defaults.
- Extracted replacement logic, the progress graph, profile options, and meal-history filter options into focused modules. Existing layout/classes were preserved. Formatted the recent Antigravity changes and made one source-contract test tolerant of line wrapping.

## Verification

- Frontend: 190 tests passed across 48 files, including explicit signature confirmation, export retry, clearing, and mouse/touch coordinate scaling.
- Backend: 527 tests passed, with one existing TODO. Both linters and production builds passed. Source architecture check passes at the 900-line module limit.
- `backend/scripts/application-signature-acceptance.ts` passed against the guarded disposable database at loopback port 55465. It tests rejection of missing/invalid signatures, submission and persistence above the old 256 KB limit, and a fresh high-risk replacement review chain. Email was captured locally; no real applicant was submitted and no Gemini request was made.
- Browser: a synthetic drawing remained confirmable after changing to a 390 px viewport; confirmation displayed the locked image and survived navigating back and forward between application steps. Continue no longer raised the signature error. The browser date control did not retain the synthetic expiry during automation, so this is not evidence of completing every wizard step. The final coordinate-scaling adjustment additionally has a regression test.

## Remaining limits

Real camera capture, live application emails, invitation acceptance, and the complete admin approval journey were not exercised in this pass. Replacement generation still lacks quantified ingredient inputs in its current candidate contract, so exact replacement grocery quantities and nutritional accuracy are not established by these tests. The signature capture is a stored drawing, not cryptographic certification or proof of professional identity.
