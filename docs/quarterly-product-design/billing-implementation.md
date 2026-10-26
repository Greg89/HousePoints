# Billing implementation specification

Reviewed October 26, 2026. The owner deferred hosting-cost work and requested specification/implementation readiness instead. No further cost rehearsal is needed for this design pass. Prices, seller-account setup and live-launch approval remain separate; none is implied by this document. Stripe remains the selected sandbox candidate. This is an implementation blueprint, not completed billing code.

## Authority and resolved conflicts

Use the later recorded decisions in [B1](./b1-decision-record.md) when September design prose conflicts. Free capacity is 4, Standard 20, initial Plus 50; these are maximum capacities, not minimum subscription eligibility. A two-member organization may buy Standard. Features are identical across tiers. Membership removal never cancels or reduces a subscription automatically.

Limited mode allows invitation creation but blocks joins, scoring, reactions and normal configuration changes. Reads and the B1 recovery/safety allowlist remain available. Complimentary access changes access only, never payment obligations: display “charges continue” when applicable and offer a separate owner cancellation action. A grant must not claim future charges have stopped. Normal owner billing commands may use the application backend; they are not restricted to provider-portal mutations.

The following sections are engineering recommendations unless already approved in B1. Open product choices are explicitly listed at the end rather than silently treated as approved.

## Current repository and first implementation boundary

There are no billing/subscription/override models in `packages/db/prisma/schema.prisma` and no Stripe dependency in the API package. `apps/api/src/organization-capacity.ts` limits the number of organizations platform-wide; it does not enforce per-organization member capacity. Preserve it as a separate policy.

Start with a pure entitlement evaluator in the API billing domain and shared response contracts, followed by additive persistence and observation-only integration. Do not start by sprinkling Stripe statuses through existing routes. No Stripe account is needed for this first unit. Provider integration and launch enforcement remain separately gated.

## Local state and evaluation

Return `{ mode, accessSource, effectiveCapacity, joinCapacity, countedMembers, reason, effectiveUntil, billingRevision, capabilities }`. Keep raw provider status and invoice/contact data out of ordinary-member responses. Owner/platform views additionally expose current and pending plan, recurring price, paid-through date, payment incident, exceptions and synchronization status.

Evaluate at one server timestamp. Access/security authorization comes first; billing never bypasses suspension, archive or membership guards. Then resolve paid access and unexpired overrides, using the greatest valid capacity rather than letting a smaller complimentary grant reduce paid capacity. A pending downgrade restricts joins to the smaller of effective capacity and target capacity. Expiration uses `now >= deadline`; correctness must not depend on a scheduled job firing on time.

Recommended access table:

| Condition | Decision |
|---|---|
| No paid coverage or exception, at most 4 counted members | Free; capacity 4 |
| Verified paid coverage through a future date | Active; paid plan capacity |
| Unresolved eligible renewal failure before its fixed deadline | Grace; previous paid capacity |
| Valid complimentary grant | Active with complimentary source and explicit expiry or indefinite marker |
| Valid grace extension attached to the unresolved incident | Grace until revised deadline; no extra recurring charge or waived debt |
| No qualifying coverage and more than 4 members | Limited; preserve members/history |
| Paid-through cancellation expires | Free if eligible, otherwise Limited; no new failure grace |
| Pending/failed first purchase or failed upgrade | Preserve pre-purchase access/capacity; no new paid capacity |

Keep paid subscription state even when membership fits Free; access fallback never cancels debt, hides an invoice or stops renewal. A refund/dispute is not a membership mutation and must not delete ledger history.

Count memberships with `archivedAt == null`, including suspended and unassigned members; audit existing `isActive` writers before adopting this predicate, since access suspension must not release a slot. Deduplicate by the existing organization/user unique key. Creation, join, restoration and any operator membership path must use one count policy.

## Persistence and concurrency

| Record | Required invariants |
|---|---|
| PlanRevision | Immutable key/version, maximum members, USD monthly amount, environment-specific Stripe price ID; initial prices remain unset until approved; no mutable public plan editor |
| BillingAccount | Unique organization; provider customer identity unique within provider account/environment; current owner contact reference |
| OrganizationSubscription | Current commercial state, plan revision, provider identity, paid-through boundary, pending change, last reconciliation, monotonic revision; keep historical subscriptions, allow only one current reservation/subscription |
| BillingOperation | Unique organization/idempotency key, request fingerprint, actor, intended transition, expected revision, provider request key, pending/succeeded/failed/uncertain state |
| PaymentIncident | Subscription and renewal invoice association, first authoritative failure timestamp, fixed seven-day deadline, resolution; no new incident while an earlier failure remains unresolved |
| BillingEvent | Unique provider/account/environment/event ID; signature-verified durable receipt, payload retention, attempts/lease, processed/error status |
| EntitlementOverride | Type, capacity/deadline, reason, actor, revocation/supersession audit; at most one current grant of each type |
| BillingOutbox | Unique incident/notice-kind/recipient identity, retry state and delivery status; recheck current owner before sending |
| BillingRollout | Unique organization/cohort, fixed start/deadline and transition capacity; reruns never restart the 30 days |

Reuse the organization scoring-write lock protocol for entitlement-changing writes and protected scoring mutations. Re-read capabilities inside the scoring transaction. Membership additions and downgrade reservations must serialize on the same organization lock. Establish one lock order across billing, membership and scoring before implementation; test deadlocks and races in PostgreSQL.

Never hold a database transaction open across a provider call. Under lock, reserve an operation and its requested lower join cap; commit. Call Stripe with a stable idempotency key; then reconcile and finalize under lock. An uncertain response retains the reservation and queues reconciliation. Do not release the lower cap until provider failure/cancellation is confirmed. Concurrent checkout commands reuse a current operation rather than creating duplicate subscriptions. Revalidate owner authority before dispatch; ownership changes cannot retract a provider request already sent.

## Stripe integration boundary

Use hosted Checkout for first purchase, quantity one and a server-allowlisted price; no trials, coupons or arbitrary client amounts. Map customer/subscription to organization server-side. A redirect never activates access. Verify the invoice/payment and canonical subscription/price/environment before advancing paid coverage. Persist zero-amount paid invoices as settlement evidence rather than inventing a cash payment.

For upgrades, sandbox-test `payment_behavior=pending_if_incomplete` with `proration_behavior=always_invoice`; grant increased capacity only after the required invoice is settled and the intended update is applied. Keep existing capacity on payment failure or pending-update expiry. Stripe's default update behavior can apply changes before payment, so it is unsuitable without this explicit handling. [Stripe pending updates](https://docs.stripe.com/billing/subscriptions/pending-updates).

Use application-controlled plan changes to enforce member counts. Keep portal plan switching, quantity changes and promotion codes disabled. Portal use is for payment methods/invoices/contact details and reviewed cancellation behavior. A portal session issued before ownership transfer may outlive local authorization; minimize session exposure and explicitly test that limitation before launch. [Stripe portal configuration](https://docs.stripe.com/customer-management/configure-portal).

Webhook handler verifies signatures against raw bytes, rejects wrong environment/account, durably stores accepted events and acknowledges only after commit. A leased worker reconciles canonical provider state; event arrival order is not state order. Serialize reconciliation per subscription, including the fetch/apply window through a worker lease or generation check, so an older fetch cannot overwrite newer state. Duplicate events do not duplicate notices, coverage or operations. Periodic reconciliation uses the same application path. Pin the SDK/API/event version in the integration slice. [Stripe webhook delivery](https://docs.stripe.com/webhooks).

Events to exercise: Checkout completion/async outcome, invoice paid/payment failed/action required/finalization failure, subscription updated/deleted, pending-update outcome, schedule outcome and refund/dispute signals. Treat them as triggers to reconcile, not direct permission commands. Do not grant access for arbitrary `active` status, an unrelated paid invoice, metadata alone or a test event received by live infrastructure.

## Payment incidents, time and failures

Recommended renewal incident start is the earliest provider failure timestamp for the relevant unpaid renewal invoice, not receipt time. A late event cannot give seven additional days. If the historical failure cannot be established, expose reconciliation-needed status; never invent a fresh deadline on each retry. First-payment failure has no paid-tier grace. Upgrade-payment failure preserves the already purchased tier and does not itself start renewal grace.

Recovery closes the incident only after canonical evidence settles the obligation and current paid coverage is established. An old invoice payment must not resolve a later unpaid renewal. Ownership transfer changes notice recipients without changing deadlines. Deadline jobs update notices, but request-time evaluation enforces expiry independently.

During a provider outage, retain already verified coverage only through its known paid-through boundary or existing grace/override deadline. Never extend coverage indefinitely because sync failed. Alert operators and allow a separately audited exception if needed. This strict boundary is a proposed launch policy requiring review below.

Cancellation is allowed at any count, effective at paid-through. A downgrade to Free uses period-end cancellation with the lower join cap, while ordinary cancellation does not impose the four-member cap early. Canceling a pending downgrade restores join capacity only after provider reconciliation. An archive workflow confirms cancellation scheduling before claiming successful archive; on provider failure keep the operation pending and explain the result. Restore never resumes billing automatically.

## Delivery slices and acceptance

| Slice | Concrete deliverable | Required evidence |
|---|---|---|
| 1: evaluator/contracts | Pure deterministic decisions; explicit reasons/capabilities; no enforcement | Table-driven boundaries, stacking, Free fallback, cancellation, first-payment/upgrade failures |
| 2: persistence/observation | Additive models, backfill and local capability projection with enforcement off | Migration rerun safety, counted-member audit, PostgreSQL concurrency, no changed user access |
| 3: provider sandbox | Idempotent checkout/changes, signed inbox, worker, reconciliation | Real sandbox payment/authentication failures, duplicates, reversed delivery, missed events, lost provider responses |
| 4: owner/platform workflows | Billing views, limited portal, changes, exceptions and audit | Owner revocation, tenant isolation, downgrade/join race, cancellation at any count, archive failure |
| 5: notices/enforcement | Transactional outbox, stable incident deadlines, API capability guards, essential mobile states | Route inventory coverage, failed email recovery, clock boundaries, retry award against expiry |
| 6: pilot | Fixed rollout grants, explicit cohort enrollment, independent enrollment/enforcement switches | Rerun preserves deadline, >50-member handling, recovery drills, approved live prices/terms and launch decision |

Each slice includes docs, relevant tests, typecheck and lint; runtime slices require full workspace tests/build and database changes require integration tests. Provider mocks prove local handling, not Stripe acceptance. Sandbox credentials remain isolated. Proposed secret/config inventory: Stripe secret key, webhook signing secret, pinned API version, approved price mapping and portal configuration, billing environment, enrollment/enforcement flags, email credentials. None is a public client variable.

## Decisions still requiring owner review

1. Approve the strict known-coverage cutoff during provider outages, or define a bounded technical-outage allowance distinct from payment-failure grace.
2. Approve initial payment-method scope (recommend automatic card collection for the first sandbox) and refund/dispute access handling (recommend operator review without automatic ledger changes).
3. Approve transition capacity for existing organizations above 50 (recommend explicit temporary capacity covering their current membership, no growth until a supported band/exception is approved).
4. Select email provider and approve messages/reminders before notification release. Confirm legal retention separately; a universal seven-year requirement is not established by this spec.
5. Set live prices and complete seller-account, tax, provider and store review before real charges. Cost measurements are deferred, not accepted or fabricated. Commercial unknowns must not block slices 1–2 or specification work; real-provider sandbox work still requires an account and a separately reviewed sandbox scope.

Next implementable unit: **slice 1, pure evaluator and contracts**. This makes billing behavior testable without prices, credentials, telemetry collection or changes to existing user access.
