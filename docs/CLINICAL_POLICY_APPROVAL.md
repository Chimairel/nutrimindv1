# Clinical nutrition policy approval

Status: **Awaiting qualified clinical approval**

Policy version: `NUTRIMIND_CLINICAL_DRAFT_V1`

This gate covers the Mifflin–St Jeor calculation, activity multipliers, goal adjustments, minimum daily-calorie bound, condition-specific screening thresholds, pregnancy/lactation handling, weekly adaptation rules, and wording presented to patients and RND reviewers.

## Approval record

- Reviewer name:
- Professional title:
- PRC license number:
- License expiry verified on:
- Organization or faculty:
- Review date:
- Approved policy version:
- Required changes or limitations:
- Signature/reference:

After approval, update any required values in code, assign a new policy version if values changed, rerun the full test and integration suites, and set `CLINICAL_POLICY_APPROVED_VERSION` to the exact approved version in the production environment. NutriMind deliberately refuses production startup when this value is missing or does not match.

Software tests can prove deterministic calculations and workflow enforcement; they cannot substitute for this clinical decision.
