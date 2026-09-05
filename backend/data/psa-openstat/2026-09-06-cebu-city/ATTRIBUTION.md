# PSA/OpenSTAT Cebu City retail-price snapshot

This directory contains an unchanged, bounded CSV response from six official
Philippine Statistics Authority OpenSTAT Retail Price Survey matrices. The API
requests select City of Cebu (`072217000`), eight reviewed commodities, and
January through August 2026.

- Source: Philippine Statistics Authority, Retail Price Survey via OpenSTAT
- Source page: https://psa.gov.ph/retail-price-survey
- API documentation: https://openstat.psa.gov.ph/API-Documentation
- Matrix collection: https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__2018NEW/?tablelist=true
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), unless
  otherwise stated by PSA
- Retrieved: 2026-09-05T18:59:18.157Z (2026-09-06 in Asia/Singapore)

The CSV values are unmodified official responses. Request bodies, SHA-256
checksums, source labels, mappings, and selection counts are recorded in
`manifest.json`. NutriMind's parser converts decimal pesos to integer centavos;
it does not alter or infer missing cells. PSA's `..` marker remains an explicit
unavailable observation.

NutriMind adds the manifest, mapping review, validation, and importer code.
Those adaptations do not imply PSA endorsement.
