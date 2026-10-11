// Unit fixtures use the disabled rollout baseline. Local .env must not turn
// these fixtures into live clarification/profile database reads.
// Enabled behavior has dedicated HTTP/SQL acceptance against disposable data.
process.env.CLINICAL_CLARIFICATIONS_ENABLED = 'false';
