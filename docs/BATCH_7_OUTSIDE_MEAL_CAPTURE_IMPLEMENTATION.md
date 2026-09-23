# Batch 7 — Outside-meal capture and revision evidence

**Change ID:** CHG-20260923-04  
**Implemented:** September 23, 2026  
**Schema migration:** `20260923160000_outside_meal_capture_revisions`, applied to the authorized development database.

## Capture workflow

The existing `MealLog` and outside-item models remain authoritative. Search groups eligible certified recipes first, then other known catalog, raw-recipe, and FNRI names labeled with conflict or uncertainty. Free text remains possible because eating is retrospective. An eligible recipe selection carries its meal-library ID and original serving macros; changed values use `USER_ADJUSTED_LIBRARY` provenance. Measured FNRI foods scale composition per 100 g, while manual values remain user-reported. Unresolved items remain excluded from partial totals. AI estimation is limited to unresolved items and requires portion and preparation context; private notes never enter the estimator prompt.

The user chooses a consumed time and may attach a private image and note. A preview shows item-level macros, sources, ranges, and partial-total disclosure. Confirmation binds to the saved preview and request key, stores the log once, and returns the same log on replay. The service rechecks the current profile while committing and stores a safety follow-up *after* the consumption fact exists. The follow-up distinguishes a detected conflict from insufficient evidence; neither blocks truthful logging.

All effective values count in the tracker. Until an RND confirms or corrects an item, its calories remain in the visually distinct estimated segment, including library/FNRI and manual values. This is a statement about the recorded intake estimate, not a downgrade of the source recipe's certification. Items without usable values do not count as zero food.

## Corrections and privacy

User corrections append an item revision with the old record retained, set the effective value to user-reported, and recompute the aggregate and daily tracker in one serializable transaction. If an item had an RND decision, the edited revision returns to pending review. Voiding creates a revision for every item, clears active item macros under the database consistency constraint, changes the parent log to `VOIDED`, and removes it from active totals. The original values remain in revisions and the parent audit trail. A repeat void is idempotent. Images are restricted to the owner and stored in the database with the user-owned log, so account deletion cascades to them. Upload is optional and happens after the log commit; image-upload failure never rolls back the meal.

The current capstone environment queues all Gemini-estimated items for RND review. This is a demonstration policy; Batch 8 will implement the selective, bounded queue and clarification contract. A logged certified recipe does not become an RND-confirmed *consumption* record by itself.

## Verification and limits

- Prisma migration deployed to the authorized development database; generated client and backend/frontend type checks pass.
- Backend build, script typecheck, and lint pass. Unit suite: **476 passed, 0 failed, 1 existing TODO** across 477 tests.
- Frontend production build, lint, and unit suite pass: **201/201** tests across 53 files.
- `npm run test:acceptance:batch7-outside` exercises the development database with a disposable user, measured FNRI fixture, existing certified recipe, preview and commit replay, user-adjusted recipe values, partial totals, revisions, voiding, image storage, and post-save conflict warning. It deletes its fixtures in `finally`.
- The development-database acceptance passed. It exposed and drove fixes for the old five-second commit transaction timeout and the existing item constraint that requires voided active macros to be null.
- The current UI permits manual macros for one food at a time. Multiple foods can be combined using FNRI portions, AI estimation, or unresolved placeholders; a per-item manual editor during initial capture is deferred. Corrections are available after saving.
- Image size is capped at 2 MB. The private image is saved as bytes; for a larger deployment this should move to private object storage with equivalent access and deletion controls.
