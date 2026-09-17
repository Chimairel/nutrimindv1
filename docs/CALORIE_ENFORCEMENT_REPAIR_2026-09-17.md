# Calorie enforcement and model ordering — September 17, 2026

## Finding

Read-only inspection of the three meals shown in the screenshot confirms a 2,779 kcal target at generation, with 858.9 breakfast, 1,140.8 lunch and 1,110.9 dinner: 3,110.6 kcal total (11.93% above target). Existing policy allocates 30/40/30 percent and permits ±15% around each meal target. Dinner's recorded allowed range was 708–960 kcal; its saved value exceeded that range. Being within a daily percentage alone does not establish slot compliance or medical appropriateness.

Generation validated the AI's declared total before FNRI reconciliation, then overwrote calories/macros with ingredient-derived totals without revalidating. Approval and replacement approval also lacked the slot constraint. These are confirmed enforcement gaps; no original provider response was retained to prove the precise sequence that produced this historical dinner.

## Changes

- Response validation now checks retrieved FNRI IDs and gram-based ingredient calorie totals before accepting a provider response. Rejection uses the existing model fallback mechanism.
- Recheck the final resolved totals before any transaction cancels or replaces an existing plan. Complete daily totals include certified-library meals and generated meals, and must also remain within ±15%. Unresolved ingredient lookups can still cause the final guard to reject generation rather than save an invalid plan.
- Approval and replace-and-approve enforce the current profile's slot range. Replacement generation uses the same range inside provider response validation.
- Prompt aims close to the target (prefer within 5%, while retaining the existing hard 15% band), includes already selected meals, requires per-100-g portion arithmetic, counts oils/sauces, distinguishes raw/cooked composition, and forbids rewriting calories without changing portions. Patient/reference text is treated as data. Partial composition coverage remains an estimate requiring review; no guessed mass conversions are added.
- FNRI reference sampling excludes estimated food records.
- Stable model order: gemini-3.8-flash → gemini-3.7-flash → gemini-3.6-flash → gemini-3.5-flash-lite. This is quality-first ordering of the existing stable Flash candidates, not a measured universal ranking for nutrition.

## Verification

- 535 backend tests pass, with one existing TODO, including the exact claimed-834 / ingredient-1,110.9 regression, corrected portions, invalid identities, duplicate slots, partial grounding and daily rounding boundaries.
- Backend build, lint, script checking, formatting and source architecture checks pass.
- Disposable acceptance rejects excessive-calorie ordinary approvals and replacements without changing the pending records, and still accepts an in-range replacement with the independent-review requirement intact.
- Google's model catalogue was queried using the configured key without a generation request; all four IDs list generateContent support. This does not prove available quota, successful live generation or nutritional correctness.
- Historical approved meals and consumption logs were not rewritten. No real-account plan was regenerated and no live Gemini generation was performed.

Sources checked September 17, 2026: [Google model catalogue](https://ai.google.dev/gemini-api/docs/models) describes 3.8 Flash as its most intelligent Flash model, with 3.7 and 3.6 as previous generations and 3.5 Flash-Lite focused on throughput/cost. [Models API](https://ai.google.dev/api/models) documents model discovery. Prompt wording cannot make an LLM foolproof; deterministic validation and qualified review remain necessary.
