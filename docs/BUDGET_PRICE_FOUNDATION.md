# Budget and Ingredient-Price Foundation

Status: ADR-018/ADR-019/ADR-024 accepted; price migrations passed shared-development acceptance; bounded PSA/OpenSTAT ingestion and an empty conversion-evidence foundation are locally verified

Evidence date: September 6, 2026

Scope: price and conversion source research, additive schema/migrations, pure policies, licensed source snapshot, deterministic importer, exact 51-meal coverage, disposable acceptance, and prior shared-development price-migration acceptance

## 1. Decision

NutriMind will treat retail price data as dated evidence that is separate from FNRI nutrition composition. A price estimate must identify its official publication, source commodity wording and unit, observation period, geography, mapping decision, normalized basis when defensible, and supersession history. FNRI `FoodItem` rows do not receive a timeless price field.

The price database foundation was intentionally deployed empty. The later bounded ingestion phase commits one attributed, checksum-pinned PSA/OpenSTAT Cebu City snapshot plus a deterministic importer, but does not write it to shared development. Shared development's six price tables remain empty. The conversion phase adds an empty, normalized evidence schema and metadata-only review of authoritative yield sources; it loads no numerical conversion row. No endpoint, UI, scheduled fetch, generated price, or payment behavior is added.

## 2. Verified repository baseline

- `FoodItem` contains nutrient composition and a free-text `source`; it has no retail price, observation date, locality, or price provenance.
- `MealLibraryIngredient` and `MealIngredient` can point to `FoodItem` and can carry an optional positive quantity and free-text unit. Older or AI-derived rows may lack either field.
- `GroceryService` projects only approved/actionable meal ingredients. `grocery-quantity.policy.ts` aggregates equal normalized text units, preserves an unknown quantity when any contributing row lacks a valid quantity, and never converts between physical unit families.
- `GroceryItem` stores name, optional quantity/unit, source meal count, and pantry/check state. There is no price estimate or coverage contract in the API or frontend.
- Certified reusable library meals require FNRI-linked ingredients, but an FNRI nutrition link is not proof that an official price commodity describes the same retail product, preparation state, grade, package, or locality.

These are code/schema observations. Historical documents that imply complete grocery quantities or budget support are not current implementation evidence.

## 3. Official Philippine source findings

All sources below were first reviewed on **2026-09-06**. That initial review downloaded no bulk data; section 8 records the later owner-authorized bounded PSA snapshot and local-only import acceptance.

### 3.1 PSA Retail Price Survey and OpenSTAT

- The [PSA Retail Price Survey page](https://psa.gov.ph/retail-price-survey) says the survey collects retail prices at pre-selected major trading centers and links category time series for cereals, root crops, beans/legumes, condiments, fruit vegetables, leafy vegetables, fruits, commercial crops, livestock/meat, poultry, and fish.
- The current [2018-based, new-geographic-code OpenSTAT collection](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__2018NEW/?tablelist=true) exposes national, regional, provincial, and selected-city results. Its 11 current matrices are `0042M4ARN01.px` through `0042M4ARN11.px`, in the category order above. On access, the collection covered 2018-2026 and reported updates dated September 3, 2026.
- Individual matrix metadata identifies the indicator as average retail price, generally in pesos per kilogram, updated monthly. Commodity labels include retail specification and basis, while some categories use another indicated unit such as piece.
- The official [OpenSTAT API guide](https://openstat.psa.gov.ph/API-Documentation) documents anonymous metadata/data access, a JSON POST query contract, `px`, `csv`, `json`, `xlsx`, `json-stat`, and `json-stat2` responses, and a limit of 10 requests per 10 seconds. A metadata-only request succeeded during the initial review; section 8 records the later deterministic bounded implementation.
- Matrix IDs and PSA geographic codes are usable external identifiers within a named series. Commodity dimension values are source/matrix identifiers rather than FNRI codes, so NutriMind must retain the matrix ID, dimension value, exact label, and series version together. A label match alone cannot establish an FNRI mapping.
- PSA pages state that site data/content is [CC BY 4.0 unless otherwise stated](https://psa.gov.ph/retail-price-survey). The reviewed matrix also reports `Copyright: No`. Attribution must name PSA, link the source/terms, state changes, and retain technical notes. Any future importer must re-check the exact matrix/publication terms because some PSA publications carry different notices.

Conclusion: PSA/OpenSTAT is the only accepted source for the bounded ingestion phase. The official series contains City of Cebu as its own selected-city geography with code `072217000`, so no Region VII or national substitution is used.

### 3.2 Department of Agriculture Bantay Presyo

- The [DA Price Monitoring page](https://www.da.gov.ph/price-monitoring/) publishes weekly average retail-price PDFs. At access it listed 2026 reports through August 24-30, 2026.
- The reviewed [August 24-30, 2026 bulletin](https://www.da.gov.ph/wp-content/uploads/2026/09/Weekly-Average-Prices-August-24-30-2026.pdf) reports weekly average prices for selected agri-fishery commodities in named NCR markets. Rows preserve commodity, specification, unit, and price; `-` means not sold. The bulletin names DA-AMAS as source and enumerates covered markets.
- The geographic scope is an NCR market group, not a household-specific store or a national observation. Most rows use kilograms, eggs use pieces with size specifications, and cooking-oil rows demonstrate why package wording and stated volume must be kept together.
- The publication index and PDFs expose no documented structured API or stable commodity IDs. A later importer would need an approved, versioned PDF parser and human review; automated ingestion is therefore **unverified**, not promised.
- No explicit price-dataset reuse license or terms link was found on the reviewed price page or bulletin. Reuse beyond source-linking and internal evaluation remains gated on a terms/licensing check with DA.

### 3.3 DTI basic-necessities and prime-commodities SRP bulletins

- DTI describes its BNPC bulletin as a consumer/retailer guide. The reviewed [February 1, 2025 bulletin](https://www.dti.gov.ph/wp-content/uploads/2025/08/BNPCSRPBULLETIN01FEBRUARY2025.002.pdf) contains suggested retail prices for branded/package-specific products and says SRPs apply nationwide unless a row says otherwise.
- These are policy guide prices, not observed market averages. Product name, market qualifier, package size, and effective date must remain intact; a 155 g can cannot be silently converted into the price of a generic FNRI food without an explicit reviewed match and edible-quantity basis.
- The bulletin is a PDF and exposes no documented API or stable SKU identifier. The Fair Trade FAQ's former “latest SRP” URL returned 404 during this review, which makes unattended discovery brittle. Update cadence is issuance-based rather than a documented fixed schedule. Automated ingestion is not supported by current evidence.
- The DTI site footer says content is in the public domain unless otherwise stated. The exact bulletin has no more specific machine-readable license metadata, so a later import must preserve DTI attribution and re-check current terms.

Conclusion: DTI SRP may later provide a small package-specific comparison catalogue. It must remain distinct from actual observed price sources and cannot seed generic ingredient prices automatically.

## 4. Additive persistence design

The foundation migration introduces six append-only models:

| Model | Purpose |
| --- | --- |
| `IngredientPriceSource` | Agency, dataset, source kind, URLs, license/attribution, cadence, access method, and honest automation status |
| `IngredientPricePublication` | One retrieved publication/matrix snapshot with external ID, source URL, publication/observation period, retrieval time, optional SHA-256, and metadata |
| `IngredientPriceGeography` | Versioned source geography using a scheme and external code at national, region, province, city, or market-group level |
| `IngredientPriceCommodity` | Source-specific identity with exact original description/specification/unit and optional defensible normalized basis |
| `IngredientPriceCommodityMapping` | Append-only exact, unmapped, ambiguous, or rejected FNRI mapping decision with evidence and supersession |
| `IngredientPriceObservation` | Immutable PHP centavo range, observation/validity dates, geography, original row wording/unit, optional normalized basis, and supersession |

SQL checks enforce HTTPS provenance URLs, API-support claims, date ordering, lowercase SHA-256 shape, all-or-none positive normalization, exact-mapping evidence, PHP-only positive ranges, and non-self supersession. Restrictive foreign keys preserve evidence. Update/delete triggers make all six price tables append-only; corrections require a new source version, snapshot, mapping, or superseding observation.

No existing model or column is dropped, renamed, reinterpreted, or altered. The only existing-schema addition is the Prisma back-relation from `FoodItem` to explicit mapping records; the SQL migration does not alter `FoodItem`.

## 5. Pure estimation policy

`ingredient-price.policy.ts` has no Prisma, network, Gemini, route, or UI dependency.

- Money is a safe integer number of PHP centavos. Source observations must be positive ranges; calculated ingredient shares may round down to zero centavos only when the proportional amount is below one centavo.
- Canonical conversion is limited to mass (`mg`, `g`, `kg`), volume (`mL`, `L`), and count (`piece`). Mass, volume, and count never cross-convert. Package/can/bottle/pouch/sachet labels are ambiguous unless ingestion supplies an explicit underlying normalized mass or volume.
- Only `EXACT` mappings with a concrete FNRI ID and evidence reference are eligible. Unmapped, ambiguous, rejected, or evidence-free rows remain unavailable.
- Future/invalid observations are rejected. Stale observations may produce a low-confidence labeled range. Unknown or mismatched locality produces no estimate; parent/national observations reduce confidence.
- Superseded rows are excluded. Identical duplicates are deterministically collapsed; conflicting duplicates are quarantined. Selection orders locality, freshness, caller-supplied source precedence, observation date, and stable ID. It preserves the selected source's range and reports competing observations instead of averaging them into false certainty.
- Ingredient estimates scale only across safe unit conversions and round ranges outward. Missing quantity, unit, mapping, normalization, geography, or usable observation produces an explicit unavailable reason.
- Meal, plan, and grocery aggregation sums known ranges, lists missing items, and reports item-count coverage. Partial coverage always lowers overall confidence. An empty/unknown collection has `null` cost rather than a deceptive zero.
- Budget ranking first removes `BLOCK` and `REVIEW` candidates. Only clinically `ALLOW` meals can be ranked, with complete coverage ahead of partial/unknown cost evidence.

## 6. Disposable migration-rehearsal result

The September 6 local PostgreSQL 16.4 rehearsal reconstructed all 17 parent migrations, proved that only `20260906120000_ingredient_price_foundation` was initially pending, and applied it through `prisma migrate deploy`. The exact foundation SHA-256 remained `54ee88a482cb6bfaa001126cff31c29092efeab1e5ac80c0505176aab210ff7d`.

One probe found a SQL three-valued-logic gap: each original normalization check rejected quantity-without-unit, but unit-without-quantity evaluated to `NULL` and passed. The foundation file was not edited. Additive migration `20260906150000_harden_ingredient_price_normalization` adds strict pair constraints to both commodity and observation tables; its SHA-256 is `f3b92e5cc7fb4291c344096275e100083a298ec444af663254a616d5aefd4f11`.

With both migrations applied, the disposable database had 6 price tables, 8 enums with 34 values, 15 declared indexes plus 6 primary-key indexes, 10 foreign keys, 14 checks, and 6 append-only triggers. Thirty-six invalid-operation probes covered provenance, identifiers, money/ranges, periods/validity, both normalization half-states, mapping evidence, geography hierarchy, FKs, uniqueness, supersession, and immutability. All passed; the transaction rolled back to zero price rows. All 56 pre-price table count/content hashes remained unchanged. A second deploy was empty, migration status was current, and migration-derived parity reported no difference. Exact Docker and test/cleanup evidence is recorded in engineering-record section 44.

## 7. Shared-development migration acceptance

The September 6 acceptance targeted the previously approved TLS-required pooled Neon development database `neondb`, schema `public`, with sanitized hostname fingerprint `6f48da70b1ce`. Read-only preflight found exactly 17 successful parent migrations through `20260905180000_billing_foundation`, canonical SQL content for every stored checksum, exactly the two price migrations pending, 56 pre-price tables, and no price table. The required migration file hashes matched the disposable rehearsal.

A datamodel comparison exposed two pre-existing `MealPlan` indexes created by `20260831090000_production_workflow_hardening` and present on shared development but omitted from Prisma schema metadata. An exact local database rebuilt from the 17 canonical migrations matched shared development with no difference, clearing migration-history drift for the bounded price deployment. DEF-031 later restored both exact mapped declarations without a database migration. The normal price deploy applied exactly the foundation and hardening migrations.

Postflight found exactly 19 successful migrations with the required new stored checksums, the same six tables, 8 enums/34 values, 15 declared plus 6 primary-key indexes, 10 restrictive foreign keys, 14 checks, and 6 append-only triggers. Every price table had zero rows. All 56 pre-price table count/content hashes matched, migration-derived parity reported no difference, and a second deploy/status was a no-op with identical migration, snapshot, and schema-inventory evidence. No shared fixture, seed, destructive probe, source data, or price value was written.

## 8. Bounded PSA/OpenSTAT ingestion result

The repository now contains an unchanged six-matrix CSV snapshot for City of Cebu, January-August 2026, its exact OpenSTAT POST requests, SHA-256 checksums, and CC BY 4.0 attribution. Eight source commodities were selected from frequent managed-catalogue ingredients: well-milled rice, carrot, potato, green munggo, cucumber, tomato, chicken breast, and tilapia.

Those targets account for 93 of 195 ingredient occurrences (47.69%) across 44 of 51 managed meals (86.27%). Exact raw FNRI mappings were accepted for seven commodities; green munggo remains `AMBIGUOUS` because the source label does not establish fresh versus dried preparation. Cooked catalogue foods remain distinct from raw retail identities. Exact same-identity catalogue coverage is therefore 49 of 195 rows (25.13%) across 37 meals, and actual available-cell coverage is 43 rows (22.05%) across 35 meals. Munggo, chicken breast, and tilapia have explicit `..` missing cells for every selected month; no observation is fabricated.

`prices:psa:dry-run` verifies the manifest, source/request checksums, CSV structure, geography, reviewed labels, decimal-to-centavo conversion, missing markers, and coverage without database access. `prices:psa:apply-local` is deliberately restricted to loopback PostgreSQL. It inserts or verifies immutable evidence by stable IDs, resolves FNRI names exactly once, preserves ambiguous candidates, and uses append-only supersession for later snapshots. A disposable PostgreSQL acceptance created 1 source, 1 geography, 6 publications, 8 commodities, 8 mappings, and 40 observations. Exact replay created zero rows. A local-only synthetic correction probe created 40 successors and its replay created zero rows.

The available observations span January 31 through August 31, 2026. The importer reports those dates and applies no implicit freshness threshold; the existing caller-supplied freshness policy remains authoritative. The official price basis is purchased commodity kilograms. Most meal quantities are edible or cooked grams. No yield, cooking conversion, or package conversion is inferred, and no runtime cost calculation is connected to this catalogue.

## 9. Smallest next gated phases

1. Review the bounded snapshot, seven exact mapping decisions, one ambiguous decision, and measured coverage before authorizing any shared-development import. A shared gate should re-check table emptiness, immutable source metadata, checksums, exact FNRI resolution, row counts, and rollback/cleanup behavior before using this importer outside disposable PostgreSQL.
2. Obtain a row-level Philippine conversion artifact and written use terms, then review exact food form, cut, edible basis, and preparation matches before inserting an append-only conversion-evidence revision. Public endpoints, frontend labels, plan ranking integration, scheduled retrieval, and any Premium promise remain later phases.
3. Do not mix DA/DTI data into this source catalogue. Keep DEF-031's resolved mapped declarations intact.

## 10. Explicitly unavailable in this phase

There is no shared/runtime price catalogue, user-location preference, retailer/store price, usable purchased-to-edible or raw-to-cooked factor row, package mapping, source precedence product decision, database query adapter, API response, UI, budget target, or paid benefit. The importer cannot target a non-loopback database. Estimates cannot run against production data until those inputs and later gates exist.

## 11. Conversion-evidence foundation and exact catalogue coverage

The additive migration `20260906234500_ingredient_conversion_evidence` defines two new append-only models. `IngredientConversionSource` preserves agency, publication, source and terms URLs, version and access dates, geography, methodology, license/use status, attribution, and optional artifact SHA-256. `IngredientConversionEvidence` preserves an exact source row/version, `PURCHASED_AS_SOLD`, `RAW_EDIBLE`, or `COOKED_EDIBLE` endpoints, direction, exact source and FNRI identities, preparation codes, units, bounded rational factors, uncertainty, observation/effective dates, review evidence, and one-to-one supersession. It relates explicitly to `FoodItem` and purchased `IngredientPriceCommodity` records; no shortcut conversion or price field was added to either model.

SQL checks require positive ordered rational ranges, compatible basis/kind/unit shapes, exact identity references, ordered dates, complete review metadata, and non-self supersession. A source marked `METADATA_ONLY` or `LICENSE_REVIEW_REQUIRED` cannot carry a factor row. A usable source requires explicit use rights and an artifact checksum. Restrictive foreign keys and update/delete triggers preserve both provenance tables. The migration inserts no source or factor data.

The pure `ingredient-conversion-evidence.policy.ts` evaluator uses integer rational arithmetic. It evaluates clinical compatibility before conversion evidence; accepts only reviewed, effective, non-superseded exact identity/preparation edges; normalizes only compatible mass or volume units; blocks unauthorized reverse traversal; and rejects duplicate conflicts, cycles, repeated edge use, incompatible bases, malformed or implausible factors, and multiple possible chains. Factor bounds multiply through a chain. Converted costs use safe integer centavos and round the lower bound down and upper bound up.

The source review at `backend/data/ingredient-conversion-evidence/source-review-2026-09-06.json` records five authoritative sources and no pilot factors:

- The [DOST-FNRI 47th Seminar Series abstract](https://www.fnri.dost.gov.ph/images/sources/SeminarSeries/47th/47thFSS.pdf) reports 173 Philippine yield factors from weighed foods prepared by named cooking methods, but the public artifact does not expose item-level factors, protocols, uncertainty, or reuse terms.
- The [USDA Food Buying Guide](https://foodbuyingguide.fns.usda.gov/appendix/downloadfbg) defines purchased-to-edible yields and exact trim/peel/cut/drain preparations. Its US institutional rows do not exactly match the current Philippine PSA/FNRI pairs.
- The [USDA ARS Meat and Poultry Cooking Yields, Release 2](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.pdf) defines cooked-hot-weight/raw-weight yields for exact cuts and cooking methods, but no current basket pair has the required matching preparation.
- The [FAO/INFOODS unit-conversion guideline](https://www.fao.org/3/i3089e/i3089e.pdf) and [food-matching guideline](https://www.fao.org/fileadmin/templates/food_composition/documents/Nutrition_assessment/INFOODSGuidelinesforFoodMatching_version_1_2.pdf) support explicit unit, denominator, density, identity, edible-portion, and preparation rules. They are methodology, not numerical evidence for NutriMind foods; [FAO terms](https://www.fao.org/contact-us/terms/en/) also require a use review before redistributing publication content.

The committed coverage report `backend/data/ingredient-conversion-evidence/coverage-2026-09-06.json` evaluates exactly 51 managed meals and 195 ingredient rows as of September 6, 2026. The source basket covers 93 rows/44 meals; 86 rows/43 meals have an exact raw FNRI mapping; and 80 rows/43 meals have a current exact-mapped price and valid quantity/unit. Forty-three rows/35 meals share the same food identity at the price and catalogue boundaries, but they remain `PURCHASED_AS_SOLD` versus `RAW_EDIBLE` and are not usable without an evidence bridge. The other 37 currently priced rows need a purchased-to-cooked chain. No reviewed conversion factor exists, so conversion usability is 0 rows/0 meals and whole-meal coverage is 0 complete, 0 partial, and 51 unpriced. Every missing row is listed: 102 lack a source-basket commodity, 7 lack an exact FNRI mapping, 6 lack a current price observation, 43 lack purchased-to-raw evidence, and 37 lack a purchased-to-cooked chain.

The next evidence request is specific: obtain DOST-FNRI's row-level 173-factor table, preparation protocols, uncertainty fields, and written reuse terms; preserve an unchanged artifact checksum; and accept only exact current price-commodity to catalogue-food matches. A nearby USDA row cannot substitute for a Philippine food/preparation pair.
