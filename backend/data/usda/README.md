# USDA FoodData Central composition snapshot

KAINARA uses FNRI first. When an ingredient has no FNRI match, an unambiguous exact USDA FoodData Central name or an admin verified USDA alias may provide **composition per 100 g**. This is nutrient evidence, not a statement that the ingredient is safe for a person's allergy or condition. Missing or ambiguous names remain unresolved. Reusable meal certification still requires FNRI linked ingredients and separate nutritionist review.

The application uses a checked in, derived catalogue. It does not request or ship a USDA API key. This avoids publishing a secret and avoids live API quota or availability dependencies during meal generation.

## Sources

- [FoodData Central download page](https://fdc.nal.usda.gov/download-datasets/)
- [FoodData Central data documentation](https://fdc.nal.usda.gov/data-documentation/)
- [FoodData Central API guide and key warning](https://fdc.nal.usda.gov/api-guide/)

The derived file `backend/prisma/data/usda-fdc-catalogue.json` contains nutrient complete Foundation Foods (April 2026), FNDDS 2021–2023 (October 2024), and historical SR Legacy (April 2018) records. It includes the FDC ID, original food name, dataset, publication date, official source search URL, and available nutrients. Foundation records are analytical references; FNDDS records may be compiled or estimated; SR Legacy is older reference data. None is a Philippine food composition replacement. Its use is labeled USDA in the app.

The source JSON files are excluded from Git under `backend/data/usda/source-delivery/`. Their official download URLs and SHA-256 values are pinned in the derived catalogue and `backend/scripts/derive-usda-fdc-catalogue.mjs`. To reproduce the projection, download and extract the three official JSON archives into that directory, then run `npm run usda:derive` from `backend`. The derivation refuses changed source hashes. Do not add source deliveries or API credentials to the repository.

## Database deployment

Apply Prisma migrations first. In development, run `npm run usda:import:dry-run` to validate the snapshot and count existing USDA rows, then `npm run usda:import:apply` to insert missing rows. In a built VPS/Docker backend, run `npm run usda:import:production:dry-run` and then `npm run usda:import:production:apply` after `prisma migrate deploy`. The backend Docker image includes the derived JSON under `prisma/data`. The importer is idempotent and creates an audit event. If USDA rows are absent, unmatched FNRI ingredients simply remain unresolved. Existing FNRI rows are untouched.

Admin verified aliases may link recipe terminology to one exact USDA record. A verified alias requires a food identity decision, not a nutrient or allergy inference. The raw recipe quantities still require defensible gram measurements before composition can be reconciled.

API processes cache the immutable USDA names for ten minutes to avoid rereading the full catalogue on every generation. Verified aliases are read fresh. Deploying a new dataset should restart API processes after import; a warm process will refresh its USDA snapshot when the cache expires.
