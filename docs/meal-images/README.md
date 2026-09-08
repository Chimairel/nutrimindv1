# Meal image acquisition

This directory records candidate image research before any asset is uploaded to
Cloudinary or connected to production data.

## Guardrails

- The canonical catalogue in `backend/src/data/common-meal-catalogue.ts` is the
  source of meal names. Image filenames are not identifiers.
- An image may be selected only after visual review confirms that it is an
  accurate or clearly labelled representative depiction.
- Every selected third-party asset must retain its creator, source page,
  license, and license URL.
- Only Public Domain, CC0, CC BY, and CC BY-SA candidates are accepted by the
  current Wikimedia research script.
- Search results are candidates, not approvals. `NEEDS_VISUAL_REVIEW` must be
  changed deliberately after inspection.
- Generic fallbacks must be labelled `Representative image` in the UI.
- No remote image is downloaded or uploaded by the research script.

## Current scope

NutriMind currently contains 51 canonical common meals. Those are phase one.
The requested 100-meal visual catalogue therefore requires 49 additional meal
definitions to be designed, nutritionally linked to FNRI, and reviewed before
their images become useful application assets.

## Rebuild the Commons candidate manifest

From the repository root:

```powershell
python tools/meal-images/build_commons_candidates.py `
  --catalogue backend/src/data/common-meal-catalogue.ts `
  --output-dir docs/meal-images/generated
```

Use `--inventory-only` when only the deterministic 51-meal assignment sheet is
needed and no external search should run.

Review `generated/wikimedia-candidate-review.html`, then record decisions in a
separate approved-asset manifest. Do not treat the first search result as an
approved image.

To build a broader 100-image research pool from the Philippine edition of Wiki
Loves Food 2024:

```powershell
python tools/meal-images/build_philippine_food_pool.py `
  --output-dir docs/meal-images/generated `
  --target 100
```

This second manifest is input for designing the missing 49 canonical meals. A
photograph's availability is not evidence that a dish belongs in the clinical
catalogue; FNRI linkage and nutritionist review remain separate requirements.

## Consumption-first priority backlog

The primary backlog is now based on what Filipino adults commonly consume, not
whether a dish originated in the Philippines. Generate it with:

```powershell
python tools/meal-images/build_consumption_first_subjects.py `
  --output docs/meal-images/generated/consumption-first-photo-subjects.csv
```

See `CONSUMPTION_FIRST_SCOPE.md` for the DOST-FNRI evidence and the boundary
between reported food consumption and inferred meal-photo subjects.
