# NutriMind Billing Processing Operator Runbook

**Status:** Shared-development acceptance only

**Environment:** PayMongo TEST
**Last verified:** September 6, 2026

This runbook covers the asynchronous PayMongo TEST payment-projection worker and the aggregate admin status surface. It does not authorize checkout creation, webhook registration or replay, provider mutation, production deployment, LIVE mode, recurring collection, cancellation, refunds, or money movement.

## Current safe state

All four independent billing switches remain false by default:

- `PAYMONGO_INTEGRATION_ENABLED`
- `PAYMONGO_WEBHOOK_ENABLED`
- `PAYMONGO_RECONCILIATION_ENABLED`
- `BILLING_PROCESSING_WORKER_ENABLED`

With the worker switch false, startup creates no billing timer and performs no provider read. The worker also fails closed in production, outside TEST mode, or when webhook ingestion and reconciliation are not both validly configured.

The shared development database has all 23 repository migrations, including:

- `20260906193000_paymongo_sandbox_checkout`
- `20260906230000_paymongo_payment_projection`
- `20260906234500_ingredient_conversion_evidence`
- `20260906235900_compensation_admin_workflow`

These migrations are additive. The billing, finance, conversion, and compensation tables were verified empty at the September 6 shared-development schema gate. Financial ledger, conversion evidence, work credit, statement-credit, and payout-event rows are append-only and must never be deleted or edited as a recovery action.

## Activation gate for a later approved TEST deployment

Do not enable the worker until a separately approved deployment has all of these controls:

1. Checkout remains disabled unless new collection is specifically authorized.
2. The TEST webhook endpoint is durably reachable and retains signed events during worker downtime.
3. TEST reconciliation credentials are installed through the approved secret boundary and never written to source, tickets, logs, or command output.
4. `npx prisma migrate status` reports the database schema is current.
5. The admin aggregate endpoint is accessible only to an authenticated ADMIN.
6. The hosting process sends SIGTERM or SIGINT and waits for graceful worker shutdown before termination.
7. An operator owns alerts for backlog age, retry growth, dead letters, reconciliation issues, and process restarts.

Enablement requires a configuration change and process restart. Do not edit billing tables to simulate enablement.

## Routine observation

Use `GET /api/admin/billing-operations` through an authenticated ADMIN session. The response is intentionally aggregate-only:

- `queue.pending`: accepted events waiting for processing.
- `queue.processing`: currently leased work, including a temporarily stranded lease until it expires.
- `queue.retryable`: failed work with a scheduled next attempt.
- `queue.deadLetter`: terminal or exhausted work requiring investigation.
- `queue.oldestPendingAgeSeconds`: age of the oldest pending event.
- `recent.succeeded` and `recent.failed`: rolling 24-hour outcomes.
- `openReconciliationIssues`: unresolved deterministic or exhausted failures.
- `worker`: process-local enabled state, lifecycle, and last-run summary.

The process-local worker state resets on restart. PostgreSQL queue and issue counts are the durable source for continuity across restarts.

Never add record identifiers, webhook payloads, signatures, payment identifiers, user identifiers, billing-subject keys, health data, authorization values, or secrets to monitoring output.

## Expected recovery behavior

### Process restart or expired lease

The claim lease is one minute. A new process may reclaim a `PROCESSING` item only after `claimExpiresAt`. The claim transaction increments `attemptCount` and replaces the opaque claim-token hash. Exact projection replay must return the existing subscription, invoice, payment attempt, billing transaction, two balanced ledger postings, and entitlement grant without duplicating them.

If `processing` remains nonzero beyond the lease plus two normal polling intervals, treat it as a database or worker availability incident. Confirm process health and database reachability before considering any data repair.

### Retryable reconciliation failure

Retryable failures become `FAILED` with `nextAttemptAt`. Backoff begins at 30 seconds, doubles by attempt, and is capped at one hour. A recovered provider/database dependency lets the next worker instance reclaim and process the same item. Provider reads are bounded by the configured batch and call budget.

If `retryable` grows or the oldest retry does not advance, disable new checkout collection, keep durable webhook ingestion available for already accepted payments, and investigate connectivity and provider status. Do not create another checkout or payment to recover an existing session.

### Dead letter or reconciliation issue

A deterministic failure or the fifth unsuccessful attempt remains `FAILED` without `nextAttemptAt` and creates or refreshes an open reconciliation issue. Common categories include unknown checkout session, ownership or price binding mismatch, timestamp conflict, payment-period overlap, and provider-ID replay conflict.

Review the local checkout audit trail and the provider dashboard using least-privilege access. Record the incident and escalate for a separately reviewed corrective event or code fix. Do not update a terminal processing row, entitlement, invoice, payment, transaction, or ledger row by hand.

## Emergency stop

1. Set `BILLING_PROCESSING_WORKER_ENABLED=false` in the approved configuration boundary.
2. If collection safety is uncertain, also set `PAYMONGO_INTEGRATION_ENABLED=false` so no new checkout is created.
3. Keep accepted-event ingestion available when operationally possible so already accepted payments are not lost; disabling webhook ingestion requires an incident decision and a later provider resend/reconciliation plan.
4. Restart or terminate the application through the hosting platform's graceful signal path.
5. Confirm the process reports worker lifecycle `STOPPED` and that no new provider reads occur.
6. Record queue and reconciliation aggregate counts, the incident interval, configuration change, and recovery owner without copying sensitive payloads.

Stopping the worker does not revoke an already paid, time-bounded entitlement. It also does not cancel, refund, or alter provider state.

## Recovery completion checks

Before closing an incident or re-enabling a later accepted worker deployment, confirm:

- migration status is current;
- no processing lease remains older than the lease window;
- pending and retryable counts are falling;
- every dead letter has an owned reconciliation issue;
- recent successes resume;
- financial posting batches remain balanced;
- entitlement periods for one billing subject do not overlap;
- logs and aggregate responses contain no prohibited identifiers or payloads;
- graceful shutdown completes without leaving active scheduling;
- checkout, webhook, reconciliation, and worker switch states match the approved operating decision.

Production and LIVE mode remain blocked by the governance, provider, legal/tax, security, support, monitoring, and canary gates in `PAYMENT_SUBSCRIPTION_COMPENSATION_ARCHITECTURE.md`.
