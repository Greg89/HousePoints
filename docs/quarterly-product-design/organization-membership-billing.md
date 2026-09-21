# Paid organization membership: design and spike

Status: discovery design. The requested scope is planning/spiking a monthly paid organization membership managed at the platform level. Owner self-service enrollment with platform billing visibility and exception management is approved September 20, 2026. No provider, price, detailed checkout implementation, or production charge is approved by this document.

## Product boundary

An organization subscription is a commercial relationship, separate from `OrganizationMembership` (a user's role/access), organization archive, and moderation suspension. Payment never grants a person organization access and never overrides a security suspension.

Approved September 20, 2026: organization owners subscribe and manage their subscriptions through a self-service flow. Platform operators have visibility into what each organization is being billed and can manage subscription exceptions. Platform-assisted enrollment is not the default model.

The platform owns plan definitions, subscription visibility, support controls, and audited exceptions. Detailed checkout/customer-management implementation follows the provider spike. A manually granted entitlement is a documented exception, not evidence that an invoice was paid.

An access exception and a billing adjustment are distinct: granting complimentary access does not automatically stop an existing recurring charge. The platform must show the effect on access and on future billing separately. Initial exception types are approved below; provider-side handling of future charges remains part of the spike. Discounts and custom pricing are deferred.

## Approved platform exceptions

Approved September 20, 2026: start with two platform-managed exception types.

- **Complimentary access:** grant a specified capacity band without charging, either through an explicit expiry date or indefinitely. Indefinite grants are explicit, visible exceptions, not hidden bypasses. Record the band and whether expiry is dated or indefinite.
- **Grace extension:** give an organization additional time to resolve a payment issue by setting an explicit revised grace deadline. This does not waive its unpaid balance or change the recurring price.

Both require a nonblank reason, authorized platform actor, durable audit history, and revocation support. Record previous/new state, timestamps, and scope. Owners and platform operators can see the effective access, reason, and expiry where applicable.

For an already-paying organization, complimentary access must explicitly resolve future recurring charges; an entitlement-only override is insufficient. Show the intended provider billing change separately, reconcile it, and expose failures rather than claiming charges have stopped prematurely. Exact provider operations and treatment of existing unpaid invoices remain to be designed. Grant expiry or revocation must not silently create a new paid subscription or authorize an unexpected charge. Recovery/expiry transitions and owner notices must be specified during the spike.

Discounts and custom negotiated pricing are outside the initial scope.

## Delivery scope

Approved September 20, 2026 (D9): billing management ships on web first. Mobile consumes the same entitlements and shows subscription-limit messages alongside backend enforcement changes. Native billing management is deferred; any mobile purchase/recovery links require the distribution review described below.

## Commercial decisions for the spike

Direction agreed September 20, 2026: subscription tiers should account for member count so adoption can fund hosting. This supersedes the initial single-flat-plan recommendation. The agreed starting tier boundaries and capacity-band direction are below; prices and detailed commercial terms remain open.

| Tier | Proposed membership range | Billing |
|---|---|---|
| Free | Up to 4 members | No subscription charge |
| Standard | 5–20 members | Monthly organization subscription; price undecided |
| Plus | Starts at 21 members; larger capacity bands as needed | Predictable monthly price per capacity band; exact limits/prices undecided |

Approved September 20, 2026: use capacity bands with predictable monthly organization prices, rather than a Plus base price with per-member charges. Standard includes the 20th member; Plus starts at the 21st. Larger bands can be introduced or adjusted as actual organization sizes warrant. A 21–50 band was illustrative, not an approved limit. Do not promise unlimited membership or build a detailed large-organization tariff before demand justifies it.

Changing the plan catalog is distinct from changing an existing subscriber's agreed price or capacity. Version band definitions and explicitly decide notice, effective dates, and grandfathering before applying changes to existing subscriptions. Approval to adjust bands is not authorization for silent billing changes.

The reason for the tiers is hosting sustainability. Member count is a proposed pricing proxy, not measured hosting cost. During the spike, estimate costs across membership and activity levels (transactions, reporting, notifications, retained data) before setting prices or promising unlimited capacity.

Decisions to resolve next:

- Exact Plus capacity boundaries and prices, and the process for adding larger bands.
- Counted-member definition — approved September 20, 2026: count all current organization memberships, including owners, admins, regular members, members awaiting house assignment, and temporarily suspended members. Exclude pending invitations and removed/archived memberships. Count a person once in each organization they belong to. Suspension does not release capacity; implementation must distinguish suspension from membership removal rather than blindly filtering by an active-access flag.
- Capacity enforcement — approved September 20, 2026: invitations may be created at capacity, but joining cannot exceed the plan limit. Require an owner-approved upgrade (or a freed membership slot) before the join succeeds; never upgrade or charge automatically. Show the invitee a clear capacity message and create a deduplicated action-required notification for owners. A blocked attempt does not consume the invitation; it may be retried while otherwise valid and unexpired. Existing members retain normal access. Enforce capacity atomically across concurrent joins and all other membership-creation/restoration paths. For repeat attempts by an existing member, preserve the existing idempotent membership behavior without counting another slot.
- Capacity notification lifecycle: keep the owner notice visible while the organization remains full; resolve/archive it when an upgrade or membership removal makes a slot available. Capacity notifications do not reserve slots or extend invitation expiry.
- Downgrades — approved September 20, 2026: owners explicitly request a lower tier; membership removals do not automatically change the subscription. A downgrade takes effect at the next renewal and may only be scheduled when current counted membership fits the target tier. Once scheduled, new joins and membership restoration respect the lower target capacity so the organization remains eligible. Retain current paid-plan access until the effective date, subject to the scheduled capacity restriction and ordinary access rules. Never remove members or erase history automatically. Example: a Standard organization with four members may schedule Free for its next renewal.
- Downgrade implementation: validate membership count and scheduling atomically against membership additions. Persist target tier and effective date explicitly, distinguish current plan from pending plan in owner/platform views, and reconcile the provider change before reporting scheduling as successful. Cancellation/rescheduling of a pending downgrade and provider failure recovery remain implementation details to settle during the spike.
- Free access must be a durable plan state, distinct from a time-limited trial, payment grace, or complimentary exception. It should not require payment details unless a later explicit decision changes that policy.

Also record:

- Feature availability — approved September 20, 2026: Free, Standard, and Plus include the same core features, including custom recognition categories, seasons, and reporting. Member capacity is the tier differentiator. Role permissions and payment-lapse restrictions still apply; Free is a supported plan, not a trial with reduced features.
- Prices/currency and intended customer details remain to be finalized during the spike.
- New-organization entry — approved September 20, 2026: no paid-tier trial. New organizations start on Free with all core features and up to four counted members; owners subscribe when they need more capacity. Larger pilots use explicit platform-granted complimentary access, not an automatic trial. The one-time 30-day transition for existing larger organizations is separate from new-organization onboarding.
- Existing-organization transition — approved September 20, 2026: organizations with four or fewer counted members enter Free at billing rollout. Larger organizations receive 30 days of complimentary transition access with owner notices explaining the applicable future tier and deadline. Owners must explicitly subscribe; no automatic charges. Platform operators may grant longer or indefinite complimentary access through the approved exception workflow. After the transition deadline, organizations without a subscription or applicable exception enter Limited unless their counted membership has been reduced to fit Free. Preserve members and history; never remove members automatically.
- Transition implementation: record each organization's rollout start and fixed deadline so migration reruns cannot restart the 30 days. The assigned transition capacity must cover existing counted membership; define treatment of growth during transition and any required larger bands in rollout planning. This is a complimentary launch transition, not a failed-payment grace period; do not silently append another seven days when it expires.
- Who can subscribe and whether the billing contact must remain an organization owner.
- Cancellation — approved September 20, 2026: owners may cancel renewal at any member count without first removing members. Paid access continues through the paid-through date. At expiry, organizations with up to four counted members move to Free; larger organizations enter Limited, preserving members and history. Owners can resubscribe or reduce membership to fit Free. Deliberate cancellation does not receive an additional seven-day payment-failure grace period. Applicable platform exceptions are evaluated separately.
- Remaining operational decisions: reactivation/payment confirmation details, refunds/disputes, taxes/invoices, and who operates those processes. The payment-failure grace duration is approved at seven days; exact provider-event mapping remains part of the spike.
- Whether mobile may expose purchase/account-management links for the intended distribution model and regions.

Provider behavior, store purchase rules, tax handling, and contractual obligations require current primary-source verification during the spike. This draft makes no claim that a particular provider or web purchase flow satisfies those requirements.

## Entitlement architecture

Use a typed backend entitlement decision such as `{ accessMode, capabilities, limits, reason, effectiveUntil }`. Clients consume it for clear enabled/disabled states; mutation routes enforce it alongside existing role/organization guards. Do not scatter raw provider status checks through feature handlers.

D8 payment-failure policy approved September 20, 2026: seven days of normal access with a persistent owner billing notice, followed by limited access if unresolved. Preserve members and history. Restore normal access after verified payment recovery or an applicable platform exception. The modes below express that direction; the detailed endpoint allowlist and provider mapping remain to be finalized.

| Mode | Proposed behavior |
|---|---|
| Free | Same core features as paid tiers, up to four counted members; distinct from a trial or payment failure |
| Active | Plan capabilities and limits, subject to normal role/access checks |
| Grace | Continue normal operations for seven days; owners see persistent action-required billing status and the deadline |
| Limited | Retain authorized history/report reads; block new awards and program expansion; expose clear recovery instructions |

Cancellation scheduled for the paid-through date remains Active until that date. Reinstatement restores entitlements without rewriting seasons or points. Unknown/unreconciled provider state must not automatically grant access: retain a bounded last-known decision where policy permits, alert operators, and reconcile. Final expiry policy must be explicit before launch.

In Limited mode, the recommended allowlist includes sign-in/out, billing recovery, account deletion requests, ownership transfer, member removal, archive, moderation, and audited correction of existing records. Reads remain subject to security suspension and membership. New invites, awards/deductions, categories, season kickoff, and other growth operations are blocked. Reactions and other nonessential writes are blocked initially to keep the policy explicit. Convert this recommendation into an endpoint-level capability matrix before implementation; test every write path, including mobile.

Owner/admin billing notices explain organization availability; detailed invoices/payment contact information remain owner/platform-only. Billing action-required notices stay visible until the underlying condition resolves. Ordinary members see a concise organization availability message without financial details.

## Owner email notices

Requested September 20, 2026: include email capability to notify organization owners when payment fails and explain the seven-day grace period. This supplements the persistent in-app billing notice. Delivery implementation and reminder cadence can be refined during the billing spike; no email is sent as part of this design work.

Initial content should identify the organization, state that payment failed, show the exact grace deadline with a timezone, explain the limited-access consequence, and link to authenticated billing recovery. Never include payment credentials or expose billing details to ordinary members.

Proposed implementation requirements: use verified owner contact addresses, recheck recipients after ownership changes, deduplicate failure notices, retry delivery failures, and surface missing/unusable addresses or delivery failures to platform operators. Decide whether provider-native notices or an application transactional-email service best covers this need; avoid duplicate notices from both. Reminder and recovery emails remain follow-up design choices.

Keep the grace deadline stable across repeated retries for the same unresolved payment failure; retries must not repeatedly grant a fresh seven days. Define the authoritative failure timestamp, delayed-event handling, and first-payment versus renewal behavior in the provider mapping before implementation. Email delivery failure must not alter ledger data or silently redefine subscription state.

## Proposed persistence

- `BillingAccount`: organization identity, provider customer reference, billing contact reference, timestamps. One organization's billing state does not follow an owner's personal account to another organization.
- `OrganizationSubscription`: organization, provider subscription reference, plan/version, raw provider status, normalized access state, paid-through and grace deadlines, cancellation metadata, reconciliation timestamps. Enforce one effective paid subscription per organization. Free organizations still have an explicit local plan/capacity decision without requiring a provider subscription.
- `BillingEvent`: unique provider event ID, processing status/attempts, minimal necessary event metadata, error summary, timestamps. Retain sensitive payloads only under an explicitly reviewed retention policy.
- `EntitlementOverride`: organization, exception type (complimentary access or grace extension), capacity band where applicable, required reason, actor/approver, start, explicit dated/indefinite duration for complimentary access, revised deadline for grace extensions, and revocation metadata. Overrides are visible and audited. An indefinite complimentary grant is intentional; grace extensions always have a deadline.
- Plan definitions/versioning: decide during the spike whether configuration or database ownership best supports the initial operating model. Do not begin with an unrestricted platform plan editor.

Do not store card details. Provider IDs are mapped to organizations server-side; client-supplied metadata is not sufficient authority to activate an organization.

## Platform workflows

Add a Billing section to the existing platform organization detail surface, plus a queue for failed reconciliation and expiring exceptions. Show the organization, plan, recurring amount/currency, billing interval, current period, next billing date, latest invoice/payment status, cancellation state, entitlement reason, latest synchronization, and exception history. Distinguish billed amounts from actual collected payments and identify provider-backed values versus local overrides. Invoice detail remains restricted to authorized owners/platform operators.

Actions: inspect, reconcile, grant/revoke complimentary access (dated or indefinite), extend/revoke a grace extension, and support the selected enrollment/cancellation process. Require explicit confirmation for commercial changes and record actor/reason/before-after state. Exact billing permissions must be added to the platform authorization model; ordinary org admins cannot operate them.

An ownership transfer preserves the organization subscription. Billing-contact/provider access is reconciled separately, and the previous owner loses local billing-management authorization immediately. Organization archive does not silently cancel payment or cause continued charges without explanation: define a combined archive/cancellation workflow before billing launch, showing the paid-through date and consequences. Deletion and provider-record retention also need a documented policy.

## Payment integration requirements

If a provider is selected, use hosted payment collection and verified server-to-server events. A checkout return URL is not proof of payment. Verify webhook signatures using the provider's required raw-body mechanism, persist/dedupe events, acknowledge after durable acceptance, and process with retry.

Handle duplicate/out-of-order events by reconciling canonical subscription state and serializing updates per organization/subscription. Make outbound checkout/change requests idempotent. Run periodic reconciliation to recover missed events. Alerts and a retry queue must expose failures without losing the event or duplicating subscriptions.

Use separate sandbox/production credentials and event endpoints. Provider calls need timeouts and bounded retries. Capability evaluation should use locally reconciled state, not a provider network call on every point award.

## Bounded spike and deliverables

1. Use the approved owner self-service/platform oversight model to draft the commercial/entitlement matrix and implementation of the approved complimentary-access/grace-extension exceptions with the product owner.
2. Compare suitable provider capabilities using current official documentation: recurring organization billing, hosted collection, lifecycle events, portal/support operations, sandbox testing, and reconciliation. Record costs/constraints only after verification.
3. In an isolated sandbox, prove activation, renewal, failed payment, cancellation at period end, recovery, duplicate/out-of-order delivery, missed-event reconciliation, and timed override expiry. No real charges or production credentials.
4. Verify the intended mobile distribution/purchase model and document any launch constraints.
5. Design owner payment-failure email delivery, recipient verification, dedupe/retry, and platform visibility; refine reminder cadence as needed.
6. Produce an architecture decision record, event/state mapping, endpoint capability matrix, data-retention proposal, operational runbook outline, environment/secret inventory, and implementation estimate with risks.

Spike completion means the recommendation is concrete enough to accept, defer, or change. It does not mean production billing is ready.

## Acceptance before implementation/launch

Before slicing implementation: approve remaining commercial decisions, exception expiry/revocation and provider handling, limited-mode allowlist, grandfathering, ownership/archive behavior, and provider/distribution approach.

Before production: test tenant isolation, role revocation, payment event replay/order, expiry boundaries, failed provider calls, manual exceptions, mobile parity, and recovery without ledger loss. Verify required secrets and environment configuration, support ownership, monitoring, and rollback.

Rollout starts with explicitly enrolled pilot organizations. A kill switch may disable new enrollments without discarding existing subscription state. Entitlement enforcement rollback must use a deliberate audited policy; stopping a webhook worker is not a safe way to cancel subscriptions or grant free access.
