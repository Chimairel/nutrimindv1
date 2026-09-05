# NutriMind Payment, Subscription, and Nutritionist Compensation Architecture

**Status:** Accepted architecture. Phase 1 additive schema definitions, unapplied migration SQL, pure policies, and database-free tests are implemented on `feature/billing-foundation`; provider integration, migration application, UI, credentials, money movement, and deployment remain pending.

**Decision ID:** ADR-017

**Requirement ID:** REQ-021

**Risk ID:** RISK-022

**Uncertainty ID:** UNC-016

**Research access date:** September 5, 2026

## 1. Decision

NutriMind will use PayMongo as the first sandbox collection adapter for a narrowly scoped monthly Premium subscription. Moving to production remains conditional on PayMongo account verification and capability activation, written confirmation that NutriMind's business model is accepted, confirmed commercial terms, a tax-invoicing decision, and the production-readiness gates in this ADR.

The design separates three domains:

1. **Collection:** products, immutable prices, provider customers, subscriptions, invoices, payment attempts, refunds, and an append-only financial ledger.
2. **Entitlement:** durable, time-bounded grants derived from verified provider events or server reconciliation. Browser redirects and client state never grant access.
3. **Nutritionist compensation:** first-class work credits, versioned compensation policies, periods, statements, adjustments, and payout records. User subscription revenue never triggers a direct reviewer payment.

The capstone implementation will record nutritionist compensation and manual/off-platform payouts without moving money. PayMongo Disbursements may be evaluated after the capstone under a separate approved ADR. PayMongo calls merchant settlements **Payouts**; paying workers or contractors from a wallet is a **Disbursement** and has different capabilities and obligations.

## 2. Current repository boundary

The current repository has no payment, subscription, entitlement, invoice, refund, compensation, or payout models or routes. The existing `User` roles remain `USER`, `NUTRITIONIST`, and `ADMIN`. `NutritionistProfile.totalVerified` is a mutable aggregate and cannot serve as payroll evidence. Existing review flows use a pooled queue with exclusive 30-minute claims and independent second approval for high-risk plans. Compensation evidence must therefore be written in the same transaction as an eligible completed review action, rather than reconstructed from aggregate counters or current plan state.

The current Express app mounts `express.json()` before its ordinary routers. A future PayMongo webhook route must be mounted before that middleware and receive the exact raw bytes required for signature verification. This ADR does not make that source change.

The existing meal-swap allowance is three per weekly cycle. It is the only current behavior chosen for the first Premium entitlement experiment: Free retains three and Premium receives six. All compatibility, restriction, approval, and weekly boundary rules remain identical.

## 3. Official PayMongo findings

All provider claims below were checked against official PayMongo pages on September 5, 2026.

### 3.1 Subscriptions and payment methods

PayMongo's Subscription API models a subscription from a Plan and Customer. The first invoice is created immediately; if its first payment is not completed within 24 hours, the subscription becomes `incomplete_cancelled`. Provider subscription states include `incomplete`, `incomplete_cancelled`, `active`, `past_due`, `unpaid`, and `cancelled`. Failed recurring payments are retried once per day for up to three attempts. Immediate cancellation stops future renewals, while an already open invoice may remain collectible. Plan changes take effect on the next billing cycle. [PayMongo subscription guide](https://docs.paymongo.com/docs/payment-acceptance-subscriptions)

The documented automatic recurring methods are cards and Maya. Card subscriptions depend on card vaulting and eligible account capabilities. GCash subscription support is described inconsistently across current official surfaces and may require provider support or separate approval; it is excluded from the MVP promise until PayMongo confirms it in writing for the actual account. [Subscription product page](https://www.paymongo.com/en-ph/products/accept-payments/subscriptions), [account capabilities](https://docs.paymongo.com/docs/account-settings-account-capabilities), [card vaulting](https://docs.paymongo.com/docs/payment-acceptance-card-vaulting)

Subscription capability is separately activated. Payment-method availability depends on account verification, business type, and partner approval. The production gate must confirm the actual account capability instead of assuming the documentation's general availability applies to NutriMind.

### 3.2 Payment security and test mode

The server creates provider resources using the secret key; the browser may use only the provider's public key and client-facing secret where the selected flow requires it. Raw card number, CVC, OTP, and authentication results must remain on provider-controlled surfaces and must never be sent to or logged by NutriMind. Payment success is established through signed webhooks or authoritative server reconciliation, not a return URL. [Payment concepts](https://docs.paymongo.com/docs/payment-acceptance-key-concepts), [card payments](https://docs.paymongo.com/docs/payment-acceptance-cards)

PayMongo test mode uses separate test keys and simulated transactions without moving real money. Sandbox fixtures and test payment methods must be used through the entire MVP acceptance sequence. [Testing guide](https://docs.paymongo.com/docs/payment-acceptance-testing)

### 3.3 Webhooks and recovery

PayMongo signs a webhook over `timestamp.rawBody` with HMAC-SHA256. The `Paymongo-Signature` header can contain test and live signatures, so verification must select the signature for the configured environment, compare it in constant time, and enforce a bounded replay tolerance. The raw request body must be preserved. [Webhook setup and signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)

Webhook events have unique event IDs and include a `livemode` value. Relevant events include subscription activation, past-due, unpaid, and update events; invoice created, finalized, paid, payment-failed, and update events; plus payment, refund, and payout events. [Webhook event catalogue](https://docs.paymongo.com/docs/developer-tools-webhooks-events)

The provider expects a 2xx response within 30 seconds and retries failed delivery up to 12 times with exponential backoff. Duplicate deliveries are expected. A webhook endpoint may become disabled after repeated failures, and exhausted events may require manual dashboard resend. NutriMind must durably ingest the event before acknowledging it, process it asynchronously, and run independent reconciliation. [Webhook retry behavior](https://docs.paymongo.com/docs/developer-tools-retry-logic), [webhook resource](https://docs.paymongo.com/reference/webhook-resource)

### 3.4 Refunds, pricing, and money movement

PayMongo documents full and partial refunds for paid payments; cumulative refunds cannot exceed the original payment. Refund processing can be delayed by insufficient available balance. Whether every required refund scenario is simulatable in test mode must be confirmed with PayMongo before the refund acceptance gate. [Refund guide](https://docs.paymongo.com/docs/payment-acceptance-refunds)

The public Philippine pricing page currently states that standard prices exclude VAT and lists no standard setup or monthly fee. It lists QR at 1.34%; domestic cards at 3.125% plus PHP 13.39; international cards at 4.02% plus PHP 13.39; GCash at 2.23%; Maya at 1.79%; GrabPay at 1.96%; ShopeePay at 1.70%; and direct bank methods at 0.71% or PHP 13.39. Its financial-tools table labels outbound transfers to suppliers, partners, or employees as `Payouts` at PHP 10, while the current dedicated guides distinguish no-fee merchant settlement Payouts from PHP 10 wallet-funded Disbursements. The implementation must follow the actual enabled API/capability and confirmed commercial terms rather than relying on the marketing label. Subscription-specific pricing is not stated clearly enough to encode as a product assumption. Prices may change and remain configuration/evidence, not source constants. [PayMongo pricing](https://www.paymongo.com/en-ph/pricing), [Payouts](https://docs.paymongo.com/docs/money-movement-payouts), [Disbursements](https://docs.paymongo.com/docs/money-movement-disbursements)

PayMongo **Payouts** settle a merchant's cleared funds to the merchant's nominated bank or wallet. PayMongo **Disbursements** can send money from a funded PayMongo Wallet to bank accounts, e-wallets, or PayMongo wallets and are described for payroll, contractors, vendors, and refunds. Disbursements require capability activation, correct recipient information, wallet funding, and reconciliation of `pending`, `succeeded`, and `failed` states. Test mode simulates them. The published standard disbursement fee is PHP 10, with one free transfer per week, and provider limits differ between InstaPay and PESONet. [Payouts](https://docs.paymongo.com/docs/money-movement-payouts), [Disbursements](https://docs.paymongo.com/docs/money-movement-disbursements)

Provider money movement does not determine whether a nutritionist is an employee or contractor, set lawful compensation, satisfy withholding and tax requirements, or authorize storing bank data. Those require owner, accounting, and legal decisions outside this engineering ADR.

### 3.5 Production account and policy prerequisites

Production activation requires account and business verification, supporting documents, a functioning public website, Philippine peso pricing, and published terms, privacy, refund, and contact information. [Account setup](https://docs.paymongo.com/docs/account-settings-account-setup), [verification requirements](https://docs.paymongo.com/docs/account-settings-verification-requirements), [website guidelines](https://docs.paymongo.com/docs/account-settings-website-guidelines)

PayMongo's official restricted-business list identifies subscription services and telemedicine, telehealth, and medical-benefit packages as elevated-risk categories that may require prior written approval. NutriMind's exact classification is unresolved. Production use requires written provider confirmation before live credentials or money are introduced. [Restricted businesses](https://www.paymongo.com/en/restricted-businesses)

PayMongo's provider invoice identifies a subscription billing cycle. This ADR does not assume that the provider invoice or an emailed payment receipt satisfies Philippine BIR invoicing requirements. The owner must obtain accounting/legal guidance and define the merchant's invoice/official-receipt process before production. [Invoice resource](https://docs.paymongo.com/reference/invoice)

## 4. Product and entitlement policy

### 4.1 Sandbox product

The sandbox contains one monthly `Premium` product with one immutable test price. PHP 199.00 (`19900` centavos) may be used as an explicit demo-only placeholder so amount handling is testable; it is not an approved commercial price. Price records are versioned and never edited in place after provider use. A price change creates a new price and deactivates the previous one for new purchases.

The collection methods are card and Maya only when the sandbox account exposes those capabilities. The UI must derive method availability from server configuration and must not promise GCash.

### 4.2 Conservative Free and Premium matrix

| Capability | Free | Premium sandbox MVP | Complexity and boundary |
| --- | --- | --- | --- |
| Safety intake, restrictions, contraindication handling, disclaimers, and verification status | Included | Included | Existing safety behavior; never gated |
| Weekly safe meal plan and library-first generation | Included | Included | Existing behavior; no review priority difference |
| Meal logging, water tracking, grocery list, and grocery PDF | Included | Included | Existing behavior |
| Compatible meal-library browsing | Included | Included | Same complete-profile compatibility evaluator |
| Meal swaps per weekly cycle | 3 | 6 | Moderate: central entitlement resolver and one server-owned quota policy |
| Account data export and privacy rights | Included | Included | Always free; never a retention or cancellation barrier |
| Longer comparisons, richer derived trends, or CSV convenience export | Existing raw history remains accessible | Candidate after MVP | Moderate; metric meaning and UI need separate acceptance |
| Favorites and saved compatible filters | Candidate | Candidate | Moderate; new persistence and UX |
| Household/multi-person planning, reliable ingredient-price budgets, unlimited AI generation, priority licensed review/SLA, or promised medical outcomes | Deferred | Deferred | High cost, safety, evidence, or product risk |

Both tiers remain library-first. Neither tier promises unlimited Gemini requests, provider model availability, nutritionist turnaround, or clinically superior review. Operational AI budgets are server-controlled and cannot weaken the common safety boundary.

### 4.3 Authoritative entitlement rules

- A verified paid invoice grants `PREMIUM` for one explicit service period. The grant is durable evidence distinct from the provider's mutable subscription snapshot.
- `active` subscriptions may create or extend a grant only after the corresponding invoice is verified paid.
- `past_due` may retain an already-paid grant and may receive at most a 72-hour grace period aligned with the documented three daily retries. It cannot create a new paid period.
- `incomplete`, `incomplete_cancelled`, and `unpaid` create no new Premium grant.
- Cancellation stops renewal. Access paid for the current period continues to the recorded period end unless a documented refund policy revokes it. The cancellation UI must state the effective date.
- A full refund may revoke the entitlement attributable to that invoice under the approved refund policy. A partial refund creates financial evidence but never silently changes entitlement; an admin must record the explicit outcome.
- Expired grants resolve to Free without rewriting financial history.
- Provider API reads may repair a stale subscription mirror. They do not erase webhook evidence or ledger entries.
- Client cookies, decoded JWT claims, checkout return parameters, and frontend state never establish entitlement.

## 5. Data model proposal

This is an additive Prisma proposal. No migration is part of this phase. Financial records use `Decimal` or integer centavos consistently; the selected implementation must prohibit floating-point money. All timestamps are stored as UTC instants. Business-period presentation uses `Asia/Manila` where a Philippine calendar boundary matters.

### 5.1 Collection and entitlement

| Model | Purpose and essential fields | Key constraints |
| --- | --- | --- |
| `BillingProduct` | Stable internal product code, display name, status, feature-set version | Unique code; deactivate rather than delete |
| `BillingPrice` | Product, provider/environment, provider plan ID, currency, amount in centavos, interval, interval count, version, active dates | Unique provider plan ID by environment; immutable after use; PHP and monthly only for MVP |
| `ProviderCustomer` | User-to-provider customer mapping and external customer ID | Unique `(provider, environment, externalCustomerId)` and one active mapping per user/provider/environment |
| `UserSubscription` | User, price, provider subscription ID, normalized status, provider raw status, current period, cancellation fields, provider update/version timestamps | Unique external subscription by environment; no cascade delete of finance evidence |
| `BillingInvoice` | Subscription cycle, provider invoice ID, amount due/paid/refunded, currency, normalized state, period, provider timestamps | Unique external invoice by environment; amounts internally consistent |
| `PaymentAttempt` | Invoice/payment-intent/payment IDs, amount, status, failure category/code, idempotency key, attempt timestamps | No raw payment method or secrets; provider IDs unique where applicable |
| `FinancialLedgerEntry` | Immutable `CHARGE`, `REFUND`, `DISPUTE`, or approved `ADJUSTMENT` evidence with signed amount, currency, source resource, event, actor/reason | Append only; idempotent source key; corrections use counter-entries |
| `BillingRefund` | Payment/invoice, requested and approved amounts, provider refund ID, reason, state, requester/approver, timestamps | Cumulative amount cannot exceed paid amount; request/approval separation |
| `EntitlementGrant` | User, entitlement key, source type/ID, effective range, grant version, optional revocation and reason | Overlap allowed only by explicit resolver policy; source unique; history retained |
| `ReconciliationIssue` | Provider/local mismatch type, affected resource, severity, first/last seen, resolution actor/note | No automatic destructive correction; auditable closure |

Suggested enums include `BillingProvider`, `BillingEnvironment`, `BillingProductStatus`, `BillingInterval`, `SubscriptionStatus`, `InvoiceStatus`, `PaymentAttemptStatus`, `FinancialEntryType`, `RefundStatus`, `EntitlementKey`, `EntitlementSource`, and `ReconciliationIssueStatus`.

User deletion must not cascade financial evidence. Subject to an approved retention policy, identity can be restricted, set null with a durable pseudonymous billing subject, or pseudonymized. The exact legal retention duration remains unresolved in UNC-016.

### 5.2 Immutable webhook inbox

`ProviderWebhookEvent` stores provider, environment, provider event ID, event type, provider creation time, receipt time, livemode, payload hash, a minimal sanitized payload or encrypted evidence reference, signature-key version, and ingestion trace ID. It has a unique `(provider, environment, providerEventId)` constraint.

Mutable processing state does not belong on the immutable envelope. `WebhookEventProcessing` or `WebhookProcessingAttempt` records status, attempt number, start/end time, handler version, normalized error category, next retry, and resulting local resource IDs. Unknown but valid events are acknowledged and recorded as ignored; invalid signatures are rejected and are not trusted event evidence.

The ingestion transaction inserts the immutable event and an outbox/work item before returning 2xx. A duplicate event returns 2xx only after confirming the stored identity and payload hash agree. A reused event ID with a different hash is a security/reconciliation incident.

### 5.3 Nutritionist work and compensation

| Model | Purpose and essential fields | Key constraints |
| --- | --- | --- |
| `NutritionistWorkCredit` | Nutritionist, source action, credit kind/units, action time, policy version, validity/reversal state | Unique source action; created transactionally with completed eligible work; immutable corrections |
| `CompensationPolicy` | Versioned effective dates, base-retainer rule, workload bands/caps, eligible work kinds, governance notes | Approved versions are immutable |
| `CompensationPeriod` | Philippine period boundaries, policy version, calculation status, closed timestamp | One period per policy/scope; no changes after close except explicit reopen audit |
| `CompensationStatement` | Nutritionist/period, base amount, workload band amount, approved adjustments, gross/net placeholders, state | Unique nutritionist/period; calculated, reviewed, approved, paid lifecycle |
| `CompensationAdjustment` | Statement, signed amount, reason code/note, creator and independent approver | Never overwrites credits; maker-checker required |
| `CompensationPayout` | Statement/batch, method, amount, currency, external/manual reference, submitter/approver, state, timestamps | Unique idempotency key/reference; cannot exceed approved payable amount |
| `CompensationPayoutEvent` | Append-only state transition, actor/provider event, reason, timestamp | Corrections and reversals remain visible |

Suggested work-credit kinds are completed ordinary review, completed independent high-risk second review, library evidence certification, and safety-flag resolution. A claim, abandoned claim, duplicate decision, self-correction, or invalidated action does not create a new credit automatically. Each compensation period locks one approved policy version before statements are calculated.

## 6. State machines

### 6.1 Subscription

```text
NONE -> INCOMPLETE -> ACTIVE -> PAST_DUE -> ACTIVE
                    |           |
                    |           -> UNPAID
                    -> CANCELLED

INCOMPLETE -> INCOMPLETE_CANCELLED
```

Provider events drive the mirror subject to transition validation. Terminal or newer provider evidence cannot be regressed by an older event. Cancellation is recorded separately from the paid entitlement period.

### 6.2 Invoice and payment attempt

```text
Invoice: DRAFT -> OPEN -> PAID
                 |  |-> VOID
                 |  -> UNCOLLECTIBLE (only if provider-supported and mapped)

Attempt: CREATED -> REQUIRES_ACTION -> PROCESSING -> SUCCEEDED
             |             |             -> FAILED
             |             -> FAILED
             -> CANCELLED
```

The exact provider payload is adapted to the smaller internal vocabulary. Unknown external states map to `UNKNOWN` and create a reconciliation issue; they are never treated as success.

### 6.3 Refund

```text
REQUESTED -> REVIEWED -> APPROVED -> SUBMITTED -> SUCCEEDED
     |          |           |            -> FAILED -> SUBMITTED
     -> REJECTED            -> CANCELLED
```

`SUCCEEDED` is based on provider evidence. A refund ledger entry is appended exactly once. Entitlement action is a separate explicit decision.

### 6.4 Compensation

```text
Period: OPEN -> CALCULATING -> REVIEW -> APPROVED -> CLOSED
Statement: DRAFT -> CALCULATED -> REVIEWED -> APPROVED -> PAYOUT_PENDING -> PAID
                                   |             |               -> PAYOUT_FAILED
                                   -> RETURNED   -> VOIDED
Payout: DRAFT -> APPROVED -> SUBMITTED/MANUAL_RECORDED -> SUCCEEDED
              |             |                         -> FAILED -> APPROVED
              -> VOIDED
```

The actor who calculates or adjusts a statement cannot be the actor who approves and records/submits its payout in production. The present `ADMIN` role can support this initially through actor-ID separation; a later finance role may be introduced if operations require it.

## 7. Nutritionist compensation policy

The compensation formula is deliberately not cash per approval:

```text
gross compensation
  = contracted base retainer
  + approved workload-band allowance
  + approved signed adjustments
```

Work credits support workload bands and auditability. Initial relative units may be configured as ordinary completed review `1.0`, independent high-risk second review `1.5`, library safety certification `1.25`, and safety-flag resolution `1.5`. These values are planning defaults, not employment terms. Each period applies a documented unit cap and fixed allowance bands. Outcomes such as approve, reject, or escalate receive the same ordinary-review credit when the work is valid and complete.

Quality, disagreement, turnaround, and compliance metrics may require coaching, audit, or statement review. They must not automatically multiply pay or reward an approval outcome. Policy versions, effective dates, exceptions, reversals, and manual adjustments remain reviewable. Current `totalVerified`, queue claims, and raw approval counts are never compensation sources.

The capstone records `MANUAL_OFF_PLATFORM` payout evidence only. It stores the payment date, amount, currency, approved statement, non-sensitive external reference, maker, approver, and reconciliation state. It stores no bank account or e-wallet credentials.

## 8. API and authorization proposal

### 8.1 User endpoints

- `GET /api/billing/catalog` returns active public products, immutable current prices, enabled test/live methods, and clear environment labels.
- `GET /api/billing/me` returns the authenticated user's subscription mirror, paid-through date, cancellation date, resolved entitlements, invoice summaries, and unresolved user-action state.
- `POST /api/billing/subscriptions` creates or resumes one provider checkout/subscription using a server-issued idempotency key and the selected active price.
- `POST /api/billing/subscriptions/:id/cancel` validates ownership and requests cancellation once.
- `GET /api/billing/invoices` returns only the authenticated user's sanitized invoice and refund summaries.
- `POST /api/billing/refund-requests` records a bounded request; it does not execute a provider refund.

All user routes require authenticated `USER`, owner-scoped queries, backend onboarding/readiness policy where appropriate, request schemas, and rate limits. Purchase availability may be gated by account readiness; cancellation, invoice access, refund request, and account export cannot be blocked by a lapsed entitlement.

### 8.2 Provider webhook

- `POST /api/webhooks/paymongo` has no NutriMind JWT requirement because PayMongo authenticates through its signature.
- It is mounted before `express.json()` with a route-scoped raw-body limit.
- It rejects missing/invalid signatures, wrong environment, stale timestamps, oversized bodies, and malformed envelopes.
- It persists valid events idempotently and returns promptly. Business processing is asynchronous.

### 8.3 Admin and nutritionist endpoints

- Admin billing endpoints list subscriptions, invoices, refunds, webhook processing, and reconciliation issues. They do not expose payment secrets or health data.
- Refund execution requires a reason, current provider read, an idempotency key, and approval separation above a configured threshold.
- Product/price administration can activate versioned configuration but cannot mutate a price already used.
- Compensation endpoints calculate periods, inspect source credits, review/approve statements, record manual payouts, and reconcile failures. Actor separation is enforced by stored IDs.
- Nutritionists may read only their own credits, statements, adjustments, and payout summaries. They cannot edit source credits, policy, or payout status.

## 9. UI proposal

The USER portal adds a Billing page containing plan comparison, the environment/test label, provider-hosted checkout action, current status, paid-through date, cancellation effect, invoices/refunds, and recovery guidance. Payment methods are shown only when enabled by server configuration. The UI never asks for raw card data in a NutriMind form.

Premium benefits appear at the relevant action. The meal-swap UI shows `used / cap` from the server response and explains that all options remain subject to the same safety filters. A failed or expired entitlement returns a stable server reason and refreshes billing state; it never silently consumes a swap.

The ADMIN portal adds billing operations and compensation views with filters, mismatch queues, immutable timelines, reasoned actions, and maker-checker identity. Destructive editing is absent; corrections append events or adjustments.

The NUTRITIONIST portal adds a private compensation view showing credited work, the policy version, period statement, adjustments, payout status, and a dispute/contact path. It does not expose other nutritionists' data or user billing.

## 10. Webhook, idempotency, and reconciliation design

1. Receive the bounded raw body and signature header on the environment-specific endpoint.
2. Parse signature parts without trusting the JSON body; verify timestamp and environment-specific HMAC using a versioned secret reference and constant-time comparison.
3. Parse a minimal envelope after signature verification. Reject an event whose `livemode` disagrees with endpoint configuration.
4. In one short transaction, insert the immutable event plus outbox item. On a duplicate ID, verify the payload hash. Return non-2xx if durable insertion fails so PayMongo retries.
5. Return 2xx before expensive provider reads or business processing.
6. A worker locks one event, maps it to an internal command, validates resource ownership and transition ordering, and writes subscription/invoice/payment/ledger/entitlement changes atomically.
7. Provider POST requests use a stable local operation ID/idempotency key. A retry first checks local and provider state.
8. Daily reconciliation compares nonterminal local subscriptions, open invoices, submitted refunds, and recent provider resources. It creates issues and safe corrective events; it does not delete history.
9. Operations monitors webhook age, duplicate rate, processing failures, disabled endpoints, reconciliation backlog, past-due age, refund failures, and environment mismatches.

Webhook delivery order is not assumed. Handlers use provider resource update time, local processed version, and terminal-state precedence. If evidence is ambiguous, processing pauses and fetches the provider resource rather than guessing. Unknown valid event types are stored, acknowledged, and surfaced for adapter review.

## 11. Security, privacy, and retention

- Keep secret keys and webhook secrets server-side in the established secret-management boundary; use distinct test/live credentials and webhook endpoints.
- Never store or log PAN, CVC, OTP, card authentication payloads, PayMongo client secrets, raw authorization headers, or provider secret keys.
- Optional payment display data is limited to provider payment-method ID, brand/type, and last four digits when supplied and needed.
- Do not send conditions, allergies, meal contents, health goals, weight, or clinical review data in provider metadata. Use opaque internal billing-subject and operation IDs.
- Sanitize provider errors into stable internal categories. Raw provider responses belong only in tightly controlled diagnostic evidence if retention is approved.
- Encrypt any future payout recipient token or account field at rest, restrict access, and display only last-four or provider recipient reference. The capstone stores neither.
- Keep immutable financial and compensation audit evidence separate from general `AuditEvent`; the generic audit stream may reference a domain record without becoming the accounting source.
- Define retention, deletion/pseudonymization, data-subject response, breach handling, and backup restoration with legal/accounting input before production. Account export remains available without Premium.
- Apply least privilege, explicit ownership filters, rate limits, CSRF/redirect review where cookies participate, content-security rules for provider surfaces, dependency scanning, and redacted structured logs.

## 12. Failure and rollback behavior

| Failure | Required behavior |
| --- | --- |
| Checkout create times out | Retry with the same idempotency key; query provider before creating another subscription |
| User closes/returns from checkout | Show processing state; wait for verified event or reconcile; do not grant Premium |
| Duplicate webhook | Confirm stored event ID/hash and acknowledge without duplicate state or ledger writes |
| Out-of-order webhook | Retain event, apply transition/version rules, and reconcile ambiguous resources |
| Webhook DB unavailable | Return non-2xx; provider retry plus operations alert |
| Handler fails after ingestion | Retry processing from durable inbox; event remains immutable |
| Endpoint disabled or retries exhausted | Alert, restore endpoint, use dashboard resend/provider reconciliation, document gap |
| Payment retry enters `past_due` | Preserve already-paid period, apply no more than 72-hour policy grace, explain recovery |
| Refund lacks provider balance | Keep submitted/pending state, do not claim completion, reconcile until terminal |
| Entitlement resolver unavailable | Fail closed for new Premium-only convenience actions; preserve safety and cancellation/account access |
| Compensation calculation discrepancy | Return statement for review; append adjustment/reversal with reason; never edit source credit |
| Manual payout fails | Record failed event, keep statement payable, require a new approved attempt/reference |

Each implementation phase has a feature/configuration switch. Rollback deactivates the new price/product or entitlement resolver and stops new collection while retaining webhook reception, cancellation, refund, and reconciliation. Financial events and ledger rows are never deleted during rollback. A database down migration is acceptable only before any financial data exists and after explicit approval.

## 13. Verification plan and acceptance gates

### 13.1 Deterministic tests

- State-transition tables cover every normalized subscription, invoice, attempt, refund, grant, statement, and payout state, including unknown states.
- Entitlement tests prove paid-period, cancellation, expiry, past-due grace, unpaid, full-refund, partial-refund review, overlapping grants, and timezone boundaries.
- Money tests prove integer/decimal arithmetic, currency agreement, cumulative refund limits, immutable prices, and balanced corrective ledger entries.
- Work-credit tests prove one credit per valid completed source action, equal ordinary credit across approval/rejection/escalation outcomes, high-risk second-review identity, policy-version locking, caps/bands, reversal, and maker-checker constraints.

### 13.2 Security and integration tests

- Raw-body HMAC fixtures cover test/live selection, valid/invalid signatures, old/future timestamps, timing-safe comparison, malformed and oversized bodies, and payload-hash conflict.
- Concurrent duplicate and out-of-order webhook tests prove one event envelope, one ledger effect, and deterministic final state.
- Cross-user and cross-nutritionist API tests prove ownership; direct API tests prove role and prerequisite enforcement.
- Provider POST tests prove stable idempotency keys through timeout/retry and process restart.
- Logging/privacy tests prove secrets, payment credentials, provider client secrets, and health metadata are absent.

### 13.3 Sandbox scenarios

The sandbox must demonstrate initial payment and activation, failed first payment leading to cancellation, recurring success, three documented retry days through past due/unpaid where simulatable, immediate cancellation with paid-through disclosure, duplicate/out-of-order webhooks, full and partial refund behavior where supported, webhook downtime/resend, and reconciliation of a deliberately missed event. Every scenario uses test keys and confirms no real money moved.

### 13.4 Production gates

Production remains blocked until all of the following are recorded:

1. PayMongo accepts NutriMind's exact business model in writing and activates required live subscription/payment capabilities.
2. Owner-controlled KYC/KYB, domain, policy pages, support channel, bank account, and account security are complete.
3. Commercial terms, VAT treatment, refund funding, chargeback handling, and PHP price are approved.
4. An accountant/legal adviser defines merchant invoice/official-receipt, refund, consumer, privacy, financial retention, and nutritionist compensation obligations.
5. Live/test secrets are separated, rotated, and stored through the approved deployment secret boundary; no secret appears in source or logs.
6. Sandbox acceptance, migration rehearsal, backup/restore, webhook load/replay, reconciliation, monitoring, alerts, runbooks, and access-control review pass.
7. An independent security review covers checkout, webhooks, authorization, data minimization, refund/admin actions, and incident recovery.
8. Live launch uses a bounded owner-approved canary with reconciliation and refund support available. No production compensation automation launches with the subscription canary.

## 14. Phased implementation and rollback gates

### Phase 0 — provider and governance gate

Confirm business eligibility, account capabilities, sandbox method/event/refund behavior, commercial terms, tax documents, retention, cancellation/refund policy, and demo price. Record unresolved answers without creating credentials in source. Rollback: remain architecture-only.

### Phase 1 — schema proposal and pure policies

Implemented in source on `feature/billing-foundation`: one additive Prisma migration file and schema definitions cover collection, entitlement, webhook inbox, reconciliation, and compensation evidence. Pure state, entitlement, money, idempotency, and compensation-credit policies have deterministic database-free tests. The migration remains unapplied; no PayMongo call, provider account, credential, UI, or money operation was added. Rollback before migration application is the isolated source commit.

### Phase 2 — migration rehearsal

Apply the exact reviewed migration first to a disposable PostgreSQL target, then only to the configured shared development database under fresh bounded owner authorization. Seed only explicit internal test product/price configuration; do not contact PayMongo. Prove preservation and down-migration limits. Rollback: down migration only while zero finance rows exist; otherwise disable features and retain data.

### Phase 3 — sandbox collection adapter

Add server-side PayMongo client boundaries, customer/plan/subscription creation, environment/idempotency controls, sanitized errors, and a minimal provider-hosted USER checkout. Use test mode only. Rollback: disable new checkout and deactivate the test price while preserving cancellation/status access.

### Phase 4 — webhook inbox and reconciliation

Mount raw-body webhook ingestion before JSON parsing, add signature/replay verification, durable inbox/outbox processing, state projections, ledger/grant writes, reconciliation, monitoring, and replay tools. Rollback: stop new checkout, keep webhook ingestion and reconciliation running until all test resources settle.

### Phase 5 — Premium entitlement surface

Add billing/admin UI and central entitlement resolution. Change only the weekly swap quota from three to six for active Premium grants. Run complete safety/actionability regression and sandbox E2E. Rollback: resolve all users to the Free quota while retaining paid-period evidence and support/refund duties.

### Phase 6 — compensation evidence

Add transactionally created work credits, versioned policies, periods/statements/adjustments, nutritionist read view, admin maker-checker workflow, and manual/off-platform payout records. Do not automate PayMongo Disbursements. Rollback: stop new period calculation, retain credits/statements, and settle manually.

### Phase 7 — separately approved production readiness

Complete every production gate and a separate go-live decision. A later ADR may evaluate PayMongo Disbursements after recipient verification, encrypted payout data, legal/tax review, provider approval, wallet controls, and independent reconciliation exist.

## 15. Next bounded coding phase

The next single phase should be **Phase 2 only: rehearse the exact checked-in migration on a disposable PostgreSQL database and prove schema/preservation behavior without PayMongo calls**. Applying it to the configured shared development database remains a later, separately authorized action.

Phase 2 acceptance requires a disposable local target, exact migration checksum, pre/post object inventory, Prisma status, zero pre-existing data loss, constraint probes inside rollback-safe fixtures, and complete cleanup. It must not use the configured Neon URL, provider credentials, provider APIs, seed data, or either application server.

## 16. Explicit unresolved decisions

- PayMongo's written acceptance and exact classification of NutriMind under its restricted-business policy.
- Actual sandbox/live account capabilities, including cards, Maya, GCash, refunds, and Subscription API activation.
- Subscription-specific commercial terms, VAT treatment, final PHP price, trial/discount policy, and who bears fees.
- Philippine tax invoice/official-receipt obligations, refund timing/wording, chargeback process, and financial-record retention.
- Final compensation contracts, base retainers, workload bands/caps, payroll/tax treatment, dispute process, and whether staff are employees or contractors.
- Whether PayMongo Disbursements is contractually and operationally appropriate after the capstone.
- Production grace period and full/partial-refund entitlement policy after legal and customer-support review.
- Exact pseudonymization and deletion behavior for financial records after account deletion.

These uncertainties block production, not the bounded Phase 1 schema-and-policy proposal.
