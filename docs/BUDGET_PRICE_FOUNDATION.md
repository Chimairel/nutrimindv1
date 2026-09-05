# Budget and Ingredient-Price Foundation

Status: ADR-018 accepted for an additive, unapplied foundation

Evidence date: September 6, 2026

Scope: source research, schema/migration design, and pure policy only

## 1. Decision

NutriMind will treat retail price data as dated evidence that is separate from FNRI nutrition composition. A price estimate must identify its official publication, source commodity wording and unit, observation period, geography, mapping decision, normalized basis when defensible, and supersession history. FNRI `FoodItem` rows do not receive a timeless price field.

The first catalogue phase is intentionally empty. This branch adds no source, publication, commodity, mapping, observation, fixture, endpoint, UI, scheduled fetch, or generated price. The migration is generated locally and remains unapplied. Payment code remains inert and unchanged.

## 2. Verified repository baseline

- `FoodItem` contains nutrient composition and a free-text `source`; it has no retail price, observation date, locality, or price provenance.
- `MealLibraryIngredient` and `MealIngredient` can point to `FoodItem` and can carry an optional positive quantity and free-text unit. Older or AI-derived rows may lack either field.
- `GroceryService` projects only approved/actionable meal ingredients. `grocery-quantity.policy.ts` aggregates equal normalized text units, preserves an unknown quantity when any contributing row lacks a valid quantity, and never converts between physical unit families.
- `GroceryItem` stores name, optional quantity/unit, source meal count, and pantry/check state. There is no price estimate or coverage contract in the API or frontend.
- Certified reusable library meals require FNRI-linked ingredients, but an FNRI nutrition link is not proof that an official price commodity describes the same retail product, preparation state, grade, package, or locality.

These are code/schema observations. Historical documents that imply complete grocery quantities or budget support are not current implementation evidence.

## 3. Official Philippine source findings

All sources below were accessed on **2026-09-06**. No bulk data was downloaded or imported.

### 3.1 PSA Retail Price Survey and OpenSTAT

- The [PSA Retail Price Survey page](https://psa.gov.ph/retail-price-survey) says the survey collects retail prices at pre-selected major trading centers and links category time series for cereals, root crops, beans/legumes, condiments, fruit vegetables, leafy vegetables, fruits, commercial crops, livestock/meat, poultry, and fish.
- The current [2018-based, new-geographic-code OpenSTAT collection](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__2018NEW/?tablelist=true) exposes national, regional, provincial, and selected-city results. Its 11 current matrices are `0042M4ARN01.px` through `0042M4ARN11.px`, in the category order above. On access, the collection covered 2018-2026 and reported updates dated September 3, 2026.
- Individual matrix metadata identifies the indicator as average retail price, generally in pesos per kilogram, updated monthly. Commodity labels include retail specification and basis, while some categories use another indicated unit such as piece.
- The official [OpenSTAT API guide](https://openstat.psa.gov.ph/API-Documentation) documents anonymous metadata/data access, a JSON POST query contract, `px`, `csv`, `json`, `xlsx`, `json-stat`, and `json-stat2` responses, and a limit of 10 requests per 10 seconds. A metadata-only request to the current API path succeeded during this review. Automated bounded ingestion is technically supported, but has not been implemented.
- Matrix IDs and PSA geographic codes are usable external identifiers within a named series. Commodity dimension values are source/matrix identifiers rather than FNRI codes, so NutriMind must retain the matrix ID, dimension value, exact label, and series version together. A label match alone cannot establish an FNRI mapping.
- PSA pages state that site data/content is [CC BY 4.0 unless otherwise stated](https://psa.gov.ph/retail-price-survey). The reviewed matrix also reports `Copyright: No`. Attribution must name PSA, link the source/terms, state changes, and retain technical notes. Any future importer must re-check the exact matrix/publication terms because some PSA publications carry different notices.

Conclusion: PSA/OpenSTAT is the only reviewed source with a documented structured API, monthly time series, subnational geography, and explicit general reuse terms suitable for a later ingestion prototype.

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

The unapplied migration introduces six append-only models:

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

## 6. Smallest next gated phases

1. **Disposable migration rehearsal:** apply the exact migration only to a task-owned local PostgreSQL target, verify append-only/check/FK/supersession behavior and complete rollback/cleanup, then compare the resulting schema with migration-derived expectations. Shared Neon remains out of scope until a separate owner-authorized acceptance phase.
2. **Bounded source basket:** after migration acceptance and source-license review, ingest a small PSA/OpenSTAT basket chosen from exact ingredients used most often by the 51 managed meals. Start with current monthly kilogram-based staples/vegetables that have exact FNRI mappings and one explicit target geography. Measure meal-slot and grocery item-count coverage before expanding. Do not mix DA/DTI rows until their ingestion and reuse gates are resolved.
3. Add internal repository/query adapters only after the basket and migration are accepted. Public endpoints, frontend labels, plan ranking integration, scheduled ingestion, and any Premium promise remain later phases.

## 7. Explicitly unavailable in this phase

There is no current price catalogue, user-location preference, accepted default geography, retailer/store price, package-to-edible-weight mapping, source precedence product decision, importer, database repository, API response, UI, budget target, or paid benefit. Estimates cannot run against production data until those inputs exist.
