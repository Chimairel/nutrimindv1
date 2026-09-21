# 2018, 2019, and 2021 ENNS individual dietary data

The `source-delivery/` directory contains the untouched CSV delivery received from DOST-FNRI. Git ignores that directory because it contains respondent-level public-use records. Application code does not read those records at runtime.

The derivation script produces aggregate food-group evidence for national, regional, and historical province/HUC scopes. It uses the supplied national sampling weight for national and regional summaries and the supplied provincial sampling weight for province/HUC summaries. Each aggregate reports weighted mean edible intake, weighted percent consuming, unweighted respondent count, survey year coverage, and a relative-to-national familiarity index.

Source files expected in `source-delivery/`:

- `2018-2019-2021 ENNS_data-set_dietary_indiv.csv`
  - SHA-256: `68bfb57cc5254fa773b7b864b00b07f86408a2f15ebfb4c87152ed99a9101e6e`
- `2018-2019-2021 ENNS_data-dictionary_dietary_indiv.csv`
  - SHA-256: `f9ad8da623100b1c5deb88181760b7f5552fa2f7b3220e0d8e0e0ff2937ffd4d`

Official context:

- Public-use dietary component: https://enutrition.fnri.dost.gov.ph/puf-preview.php?xx=2018748
- 2018–2019 Food Consumption Survey methodology: https://enutrition.fnri.dost.gov.ph/uploads/2018-2019%20Facts%20and%20Figures%20-%20Food%20Consumption%20Survey.pdf
- 2021 individual-level Food Consumption Survey: https://enutrition.fnri.dost.gov.ph/uploads/2021%20ENNS%20FandF%20Food%20Consumption%20Survey.pdf

These aggregates are familiarity evidence for ranking already eligible meals. They do not provide meal safety, nutrient composition, availability, or clinical clearance.
