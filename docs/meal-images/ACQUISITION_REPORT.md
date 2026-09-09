# NutriMind meal-image acquisition report

## Outcome

- Canonical application meals inventoried: **51**
- Consumption-first photo subjects prioritized: **100**
- Licensed Philippine food candidates retained: **117**
- Minimum requested candidate target: **100** (met with a 17-image rejection buffer)
- Planned local fallback categories: **7**
- Remote images downloaded: **0**
- Cloudinary uploads performed: **0**
- Application or database records changed: **0**

The consumption-first Commons matcher was smoke-tested against three subjects
and returned licensed candidates for all three, but at least one was not a good
semantic match. The complete 100-subject run is therefore intentionally not
treated as an approval process; candidate selection must remain reviewable.

## Source and rights record

The candidate pool comes from Wikimedia Commons category
`Images from Wiki Loves Food 2024 in the Philippines`. Every retained row reports
the creator, canonical Commons source page, original file URL, dimensions,
license name, and license URL returned by the Commons API.

All 117 retained candidates currently report `CC BY-SA 4.0`. That license
requires attribution, a license link, and identification of changes. Share-alike
requirements must be assessed before edited derivatives are published. This
repository records source facts for engineering review; it is not legal advice.

## Important separation

The 117-source pool is not the Meal Library, and it is no longer the primary
definition of image coverage. The primary 100-subject backlog is consumption
first: it represents foods and familiar meal combinations eaten by Filipinos,
including globally common items such as eggs, rice, noodles, sandwiches, and
oatmeal. The Philippine-dish source pool is supplemental.

NutriMind currently has only 51 canonical meal definitions. An available
photograph does not establish nutrition values, FNRI linkage, clinical
compatibility, or nutritionist approval.

No candidate has been silently attached to a meal. The canonical assignment
sheet starts every row as `UNASSIGNED`; the source pool starts every image as
`NEEDS_VISUAL_AND_CATALOGUE_REVIEW`.

## Artifacts

- `generated/canonical-meal-image-inventory.csv`: stable application asset keys
  and fallback categories for all 51 current meals.
- `generated/philippine-food-source-pool.csv`: the 117 candidate photographs and
  their complete source/license metadata.
- `generated/consumption-first-photo-subjects.csv`: the evidence-led primary
  backlog of 100 everyday meal-photo subjects.
- `generated/CANDIDATE_ATTRIBUTIONS.md`: readable candidate credit index.
- `generated/philippine-food-source-pool-review.html`: remote-thumbnail contact
  sheet; clicking a photo opens the canonical Commons file page.
- `generated/placeholder-asset-plan.csv`: planned local fallback assets.
- `tools/meal-images/*.py`: reproducible standard-library-only builders.

## Approval gate before Cloudinary

1. Visually approve or reject candidates for dish accuracy, framing, and card
   crop suitability.
2. Select exact images for canonical meals; use a labelled representative image
   only where there is no accurate match.
3. Design and approve the seven local fallback assets.
4. If expanding to 100 actual Meal Library recipes, design and FNRI-link the 49
   new meal definitions and send them through nutritionist review separately.
5. Only then configure Cloudinary, upload approved assets, and persist provider
   IDs plus attribution metadata in NutriMind.
