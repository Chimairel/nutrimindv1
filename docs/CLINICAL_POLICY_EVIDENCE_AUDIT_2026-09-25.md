# Clinical policy evidence audit

Date: September 25, 2026

Status: Evidence audit completed; no clinical policy approved or activated

Scope: Calorie calculations, macro guidance, condition rules, allergen controls, pregnancy rules, and review-triage thresholds

## 1. Purpose

This audit separates five kinds of values that currently appear in KAINARA:

| Classification | Meaning | Required treatment |
| --- | --- | --- |
| `ACTIVE_RUNTIME` | Changes a user's target, eligibility, routing, or plan now | Must fail safely and receive clinical approval when it carries clinical meaning |
| `DRAFT_INACTIVE` | Stored or coded for future use but excluded from matching | May be reviewed and revised without affecting users |
| `INTERNAL_HEURISTIC` | Product scheduling, ranking, or queue policy | Document and version it; do not present it as a medical guideline |
| `TECHNICAL_VALIDATION` | Checks data shape, units, completeness, or contradictions | Test as software behavior; clinical approval is not normally needed |
| `AI_PROMPT_ONLY` | Influences generated educational wording but has no clearance authority | Keep non-authoritative, restrained, and traceable to the source policy |

The result is an evidence map and a dependency order. It does not approve a threshold, diagnose a user, or replace review by a qualified Registered Nutritionist-Dietitian (RND).

## 2. Executive finding

KAINARA already has a strong architectural boundary: Gemini cannot certify safety, condition rules begin as inactive drafts, unknown evidence fails closed, and enhanced conditions require human review. The main problem is not a lack of published numbers. It is applying a valid number at the wrong scope or without the evidence required to evaluate it.

The most important example is sodium. A guideline expressed as milligrams **per day** can evaluate a composed day or meal plan. It cannot automatically certify one reusable meal unless an RND approves a separate meal-allocation method. Dividing a daily limit into breakfast, lunch, and dinner shares would be a new policy judgment, not a fact contained in the guideline.

No source reviewed here supports KAINARA's active `500 kcal/day` minimum. Replacing it immediately with a commonly repeated `1,200/1,500 kcal` pair would still overstate the evidence: those values occur in specific weight-loss programs and practice contexts, not as a universal safe floor for every adult. The correct short-term behavior is to treat a very-low calculated target as requiring RND review before plan generation, while an RND approves a versioned Filipino-population policy.

## 3. Current rule inventory

| Current behavior | Location | Status | Evidence assessment | Required decision |
| --- | --- | --- | --- | --- |
| Mifflin-St Jeor resting-energy equation | `backend/src/lib/calculations.ts` | `ACTIVE_RUNTIME` | Published equation, originally evaluated in healthy people aged 19–78; the onboarding range is 18–100 | Retain as an estimator, disclose scope, and route out-of-scope or clinically complex cases to review |
| Activity factors `1.2`, `1.375`, `1.55`, `1.725` | `backend/src/lib/calculations.ts` | `ACTIVE_RUNTIME` | No exact approved source is stored | RND must approve values, descriptions, and exclusions |
| Goal changes `-500`, `+500`, `0`, `+300 kcal/day` | `backend/src/domain/clinical-nutrition.policy.ts` | `ACTIVE_RUNTIME` | A 500–750 kcal deficit appears in structured obesity interventions; the four-value mapping is still an application policy | Review each goal separately; do not imply universal clinical suitability |
| Minimum `500 kcal/day` | `backend/src/domain/clinical-nutrition.policy.ts` | `ACTIVE_RUNTIME` | Unsupported and too low for unsupervised general meal planning | Replace only after approval; until then, stop automated planning and request RND review below an approved supervision boundary |
| Missing sex defaults to the female equation | `backend/src/lib/calculations.ts` | `ACTIVE_RUNTIME` fallback | A data fallback, not clinical guidance | Remove silent fallback from user-facing calculation; require the recorded input or explicit manual handling |
| Breakfast/lunch/dinner split `30/40/30` | `backend/src/domain/meal-calorie-allocation.policy.ts` | `INTERNAL_HEURISTIC` | A planning choice | Keep versioned as a product policy; do not call it medically optimal |
| Per-slot and per-day tolerance `±15%` | meal allocation and generated-plan calorie policies | `INTERNAL_HEURISTIC` | A search and plan-fit choice | Keep as an explainable ranking tolerance; test impact on plan availability |
| Weekly adaptation: 7 days, 4 logs, 70% adherence, weight-direction cutoffs | `backend/src/domain/weekly-adaptation.policy.ts` | `INTERNAL_HEURISTIC` with clinical presentation | No automatic target change occurs, which limits risk; exact cutoffs lack stored evidence | Present as review-priority logic and obtain RND approval for user-facing interpretations |
| Condition nutrient and ingredient rules | `backend/prisma/seed-condition-rules.ts` | `DRAFT_INACTIVE` | Most values have recognizable guideline origins; several have scope or measurement gaps | Keep inactive until sources, basis, and evaluation scope are approved |
| Ingredient/allergen classifier | `backend/src/domain/meal-ingredient-classification.policy.ts` | `ACTIVE_RUNTIME` safety control | Deterministic matching is appropriate, but supported taxonomy is incomplete and conflates distinct concepts | Expand taxonomy before claiming comprehensive allergen coverage |
| Condition and food advice in the nutrition-report prompt | `backend/src/services/nutrition-report.service.ts` | `AI_PROMPT_ONLY` | Some advice is directionally aligned with guidance but has no exact source record in the report | Generate from approved policy facts and show provenance; never let prompt text create clearance |

## 4. Evidence matrix and proposed disposition

These are proposed evidence links for RND review. They remain unapproved.

| Domain | Candidate value or rule | Source and population | Correct system use | Limitation |
| --- | --- | --- | --- | --- |
| Filipino adult energy and macros | Adult AMDR: protein 10–15%, fat 15–30%, carbohydrate 55–75% of energy | [DOST-FNRI Philippine Dietary Reference Intakes 2015, revised 2018](https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf), general Filipino population age 19+ | General evidence panel and RND review support | A population reference range is not an individualized prescription or a condition clearance |
| Resting energy | Mifflin-St Jeor equation | [Mifflin et al., 1990](https://pubmed.ncbi.nlm.nih.gov/2305711/), 498 healthy people aged 19–78 | Estimation input to a reviewed energy-target policy | The application's age range and complex clinical profiles extend beyond the original study population |
| Weight-loss energy deficit | Common starting deficit of 500–750 kcal/day in structured intervention | [ADA Standards of Care, obesity and weight management](https://diabetesjournals.org/care/article/49/Supplement_1/S166/163915/8-Obesity-and-Weight-Management-for-the-Prevention) | RND-reviewed starting policy or review assistance | Not a universal prescription; lower-energy plans require selected participants and trained-practitioner monitoring |
| Hypertension sodium | 2,300 mg/day DASH target; 1,500 mg/day can lower blood pressure further | [NHLBI DASH eating plan](https://www.nhlbi.nih.gov/health/dash-eating-plan) | Full-day plan validation and RND review assistance | Daily total does not directly certify a single meal; user context still matters |
| Diabetes fiber | At least 14 g per 1,000 kcal | [ADA Standards of Care, nutrition](https://diabetesjournals.org/care/article/48/Supplement_1/S86/157563/5-Facilitating-Positive-Health-Behaviors-and-Well) | Plan-level adequacy flag and RND review assistance | Passing fiber alone does not establish diabetes suitability; carbohydrate distribution, medication, timing, and response are individualized |
| Diabetes macros | No universal ideal carbohydrate/protein/fat percentage for all people with diabetes | [ADA nutrition therapy consensus report](https://diabetesjournals.org/care/article/42/5/731/40480/Nutrition-Therapy-for-Adults-With-Diabetes-or) | Reason to preserve manual `STANDARD` review | A simple sugar or carbohydrate ceiling cannot safely become the whole diabetes policy |
| CKD sodium and protein | Salt under 5 g/day (2 g sodium); protein at or below 0.8 g/kg/day in the cited key takeaways | [KDIGO 2024 CKD guideline key takeaways](https://kdigo.org/wp-content/uploads/2025/01/Key-Takeaways_KDIGO-2024-CKD-Guideline_People-Living-with-CKD.pdf) | Plan-level flags for an RND | Stage, labs, dialysis, nutritional status, potassium, and treatment alter needs; retain `ENHANCED` manual review |
| Cardiovascular saturated fat | Less than 6% of calories when lowering LDL cholesterol is needed | [American Heart Association saturated fat guidance](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats) | Plan-level risk flag for RND review | It is a daily energy percentage, not standalone proof that a meal is cleared for every heart condition |
| Pregnancy food safety | Avoid or appropriately cook specified high-risk foods, including undercooked meats/eggs/seafood and unpasteurized products | [CDC safer food choices for pregnant women](https://www.cdc.gov/food-safety/foods/pregnant-women.html) | Deterministic ingredient/preparation flag followed by `ENHANCED` review | Ingredient names alone may not establish pasteurization, cooking temperature, or handling |
| Pregnancy caffeine | Less than 200 mg/day | [ACOG pregnancy FAQ](https://www.acog.org/womens-health/faqs/having-a-baby) | Daily quantified-intake flag | A word match for coffee or tea cannot measure caffeine; missing quantity must be unevaluable |
| Pregnancy/lactation energy | Pregnancy +300 kcal in second and third trimesters; lactation +500 kcal in the PDRI summary | [DOST-FNRI PDRI](https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf) | Future stage-specific policy after intake captures stage | Current profile combines pregnancy and lactation and does not capture trimester; do not automate yet |
| Food allergens | U.S. labeling recognizes milk, egg, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans, and sesame | [FDA food allergies](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies) | Taxonomy reference and ingredient exclusion | Local requirements must also be checked; a labeling list is not a universal exposure threshold or cross-contact guarantee |

The U.S. sources above are supporting clinical references, not substitutes for Philippine regulation or RND judgment. Filipino general-nutrition policy should prefer DOST-FNRI/PDRI where the required value exists. Condition-specific sources should store their population and exclusions rather than being presented as universal Filipino thresholds.

## 5. Blocking findings

### 5.1 Unsupported active calorie floor

`minimumDailyCalories: 500` changes plans today. The repository already marks its policy version as a draft and blocks production startup unless the exact policy version is externally approved, but development and demonstration environments still execute it. This is the highest-priority active policy issue.

Recommended behavior before clinical approval:

1. calculate and display a provisional estimate;
2. if it falls below the approved automated-planning boundary, do not generate a self-service plan;
3. create an RND review item with the inputs and formula provenance;
4. avoid substituting a different hardcoded floor until the RND has approved the exact value, population, and exclusions.

### 5.2 Daily rules cannot certify an individual meal

The current hypertension drafts use `DAILY_TOTAL`. Reusable condition clearance is scoped to a meal and condition. Automatic hypertension clearance currently evaluates the meal record without a composed day's totals, so these rules are unevaluable. Even if the code supplied one meal's sodium, comparing it directly with a daily ceiling would answer the wrong question.

Choose one of these reviewed designs:

- evaluate daily rules against a complete proposed day and persist a plan/day validation result; or
- create an RND-approved meal-allocation policy with its own version, evidence, and impact report, then use that derived per-meal ceiling for reusable meal clearance.

The first option is recommended for the capstone because it preserves the published unit and avoids inventing meal shares.

### 5.3 Generated candidates lack the evidence required by most rules

The RND review path supplies calories, protein, and carbohydrates to the generic rule evaluator. It does not supply the extended nutrients needed by the draft rules, and it does not supply composed daily totals. Sodium, fiber, potassium, phosphorus, and saturated-fat rules therefore remain unevaluable for generated candidates even when those fields exist on reusable library entries.

The deterministic output must distinguish:

- `PASS`: the required value, unit, basis, and scope were available and the rule passed;
- `CONFLICT`: the evidence was available and the rule failed;
- `UNEVALUABLE`: a value, unit, preparation fact, body weight, or daily composition was missing.

`UNEVALUABLE` must continue to require review and must never be converted to safe.

### 5.4 Policy-version state is not enforced at the common query boundary

The common evaluator loads rules with `reviewStatus = APPROVED`, `active = true`, and a non-null approver. It does not also require the parent `ConditionRulePolicyVersion` to be `ACTIVE`. Activation and suspension services usually synchronize child flags, but the safety query should enforce both facts so drift or a manual data edit cannot make a rule usable outside an active policy version.

### 5.5 Allergen taxonomy is incomplete

The deterministic classifier supports `SHELLFISH`, `NUTS`, `DAIRY`, `GLUTEN`, and `EGGS`. Intake recognizes soy, fish, sesame, and lactose but routes them as unsupported/manual review.

Before claiming broad deterministic allergen coverage, the schema and classifier should distinguish at least:

- peanuts from tree nuts;
- fish from crustacean shellfish and, if supported, molluscs;
- milk-protein allergy from lactose intolerance;
- wheat allergy from gluten-related restrictions;
- soy and sesame as their own allergens.

Known ingredient conflicts may be hard-blocked deterministically. Unknown ingredients, ambiguous derivatives, missing preparation details, and cross-contact remain review cases. No reviewed source established a universal dose threshold for KAINARA to encode.

### 5.6 Pregnancy and lactation are conflated

The intake code maps pregnancy, lactation, and breastfeeding to one `PREGNANT` value, while the draft ingredient blocklist is pregnancy-specific. PDRI also assigns different energy additions, with the pregnancy value limited to the second and third trimesters. The model must separate pregnancy and lactation, and pregnancy must capture enough stage information, before energy rules can be automated.

## 6. Non-blocking but required governance improvements

### 6.1 Store source evidence as data

The rule tables currently store a title and citation string. Add a normalized, immutable source record when implementation resumes:

| Field | Purpose |
| --- | --- |
| `issuingOrganization` | DOST-FNRI, ADA, KDIGO, CDC, and so on |
| `title` and `sourceUrl` | Human-readable identity and canonical location |
| `publicationDate` and `sourceVersion` | Reproducibility |
| `section`, `table`, and `page` | Exact support for the value |
| `population` and `jurisdiction` | Who the guidance describes |
| `exclusionsAndCaveats` | Cases where it should not be applied |
| `retrievedAt` | Audit trail for web material |
| `artifactChecksum` or archived reference | Evidence that the reviewed text has not silently changed |

Rules and calculation-policy versions should reference this record. Approval must bind the exact policy version to exact source revisions.

### 6.2 Separate outcome authority

Every deterministic result should carry one of these authority outcomes:

- `INFORMATIONAL`
- `REVIEW_REQUIRED`
- `HARD_BLOCK`
- `CLEARANCE_ELIGIBLE`

A rule should become `CLEARANCE_ELIGIBLE` only when its policy version explicitly allows automation at the same scope and basis being evaluated. Passing a review-assistance flag must not produce condition clearance.

### 6.3 Keep planning heuristics honest

Meal shares, calorie tolerances, shopping lead time, ranking weights, exposure priority, and weekly data-sufficiency cutoffs are valid product policies. Store or document them with a version and impact tests. User-facing wording should call them planning rules or review-priority rules unless an approved clinical source supports a stronger claim.

## 7. Dependency order for implementation

1. **Stop unsupported active authority:** replace the 500 kcal behavior with fail-closed RND routing under an approved interim policy; remove the missing-sex fallback.
2. **Fix semantic scope:** split pregnancy/lactation; decide plan/day validation versus an approved derived per-meal policy.
3. **Make evidence computable:** persist extended nutrients and units for generated candidates and provide daily composition when evaluating daily rules.
4. **Complete safety taxonomy:** migrate allergen and intolerance concepts without treating blanks as safe.
5. **Harden rule governance:** require an active parent policy at every use boundary and store exact source metadata.
6. **Review draft policies:** produce impact reports, obtain two independent approvals where required, and activate only the exact approved versions.
7. **Update report wording:** generate advice from approved policy facts and show meaningful provenance without implying diagnosis or independent clinical review.
8. **Run connected tests:** verify low-target routing, unevaluable evidence, allergen conflicts, policy suspension, pregnancy/lactation separation, and whole-day condition validation.

## 8. Proposed RND approval packet

The first approval packet should contain:

1. the Mifflin-St Jeor formula, supported age range, and exclusions;
2. activity multipliers and descriptions;
3. goal-specific adjustments;
4. automated-planning lower bound and the exact review-routing behavior;
5. Filipino AMDR display policy;
6. full-day hypertension validation using 2,300 mg/day and the status of the 1,500 mg/day target;
7. diabetes fiber as review assistance, with no automated diabetes clearance;
8. CKD, heart, and pregnancy rules as `ENHANCED` review assistance only;
9. the expanded allergen/intolerance taxonomy;
10. the pregnancy/lactation split and required profile fields.

The approval record must identify what was accepted, modified, or rejected. A signature over a generic list of website links is insufficient because the software behavior depends on units, population, scope, and failure handling.

## 9. Verification performed

- Read the active calculation, meal-allocation, weekly-adaptation, intake-safety, ingredient-classification, condition-rule evaluation, clearance, and nutritionist-review paths.
- Compared Prisma rule governance and draft seed values with their runtime query boundaries.
- Read the current clinical approval gate and existing engineering risks.
- Checked the cited primary or issuing-organization material available on September 25, 2026.
- Made no schema, seed-data, runtime, or environment change.

## 10. Follow-up implementation after the calculation-method clarification

The owner clarified that recognized sources should govern **how a value is calculated from current user data**, rather than being copied into the application as unexplained universal constants. The following bounded implementation was then added without activating any draft condition policy:

- The generic condition evaluator now treats `PER_1000_KCAL`, `PERCENT_OF_DAILY_CALORIES`, and `PER_KG_BODY_WEIGHT_DAILY` thresholds as source coefficients. It resolves them at evaluation time from the current daily energy target or body weight and records the method, coefficient, inputs, and calculated result.
- `PER_SERVING` and `DAILY_TOTAL` remain fixed-basis comparisons because their cited guidance is already expressed in those units. A daily-total rule still requires a composed day's evidence; it is not converted into a per-meal certification rule.
- A versioned nutrition-reference calculator now derives Filipino adult PDRI macronutrient ranges from the user's current daily energy target, diabetes-review fiber from `14 g/1,000 kcal`, cardiovascular-review saturated fat from `6%` of energy, and CKD-review protein from `0.8 g/kg/day` when weight is available.
- Condition-specific calculated values remain `REVIEW_ASSISTANCE_ONLY`. They cannot create reusable condition clearance, and the underlying rule-policy versions remain inactive drafts until the configured RND governance is completed.
- The common rule query now requires both an approved active child rule and an `ACTIVE` parent policy version. This closes the query-boundary drift described in finding 5.4.
- The nutrition-report snapshot stores the exact calculation version and derived reference facts used for that report. This preserves reproducibility when the user's inputs or policy version later change.
- A public evidence register now distinguishes integrated data/methods, inactive clinical-policy drafts, and recipe provenance. Listing an issuer or publisher explicitly does not claim cooperation, endorsement, sponsorship, or clinical approval.

Examples of resolved coefficients:

| Input and source coefficient | Calculated reference |
| --- | --- |
| 1,800 kcal/day × 14 g fiber per 1,000 kcal | 25.2 g fiber/day |
| 2,000 kcal/day × 6% energy ÷ 9 kcal/g | 13.3 g saturated fat/day |
| 70 kg × 0.8 g protein/kg/day | 56 g protein/day |

These calculations improve traceability; they do not resolve the separate scope, evidence-completeness, allergen-taxonomy, pregnancy/lactation, or calorie-floor findings above.
