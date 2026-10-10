# B1 billing decision record (draft)

Status: research in progress, updated October 9, 2026. Companion to
[Paid organization membership: design and spike](./organization-membership-billing.md).
This document itself is not an approval to charge, sign a provider contract, or
build production billing code. It converts every open item flagged by
[execution-plan.md § B1](./execution-plan.md#b1--cost-provider-and-lifecycle-decision-record)
into a concrete recommendation, evidence requirement, and sign-off checkpoint.

The already-approved D1–D9 policy from the [design register](./README.md#decision-register)
is preserved throughout: capacity bands (Free/Standard/Plus), self-service
enrollment with platform oversight, complimentary-access and grace-extension
exceptions, seven-day payment-failure grace, no paid-tier trials, no per-tier
feature differences, web-first management, and one-time 30-day transition for
existing larger organizations.

## How to read this record

Each open item is scored:

- **Direction** — the already-approved policy, quoted or paraphrased from the
  billing design; nothing here changes it.
- **Recommendation** — the concrete option this record proposes to adopt,
  chosen to preserve the approved policy with the smallest reasonable
  implementation surface.
- **Evidence needed** — primary-source artifacts the spike must produce before
  the recommendation is accepted. Where evidence would require a real provider
  or real hosting telemetry, this record calls it out explicitly.
- **Owner decision** — the concrete sign-off the product owner must record to
  close the item. Until every item has an owner decision, B1 is not "done" in
  the execution plan sense.

Nothing in the "Recommendation" column authorizes implementation on its own.

## Evidence captured during the spike

This is an initial evidence snapshot, not owner approval. Official provider
and store documentation was reviewed October 9, 2026; recheck it before
selection or implementation because terms and store rules can change.

| Area | Evidence and current conclusion |
|---|---|
| Hosting | No representative staging or production resource telemetry is available. The report-query integration measurements in [Report query API](./report-query-api.md) cover test-fixture query counts, payloads, and plans; they do not establish per-organization hosting cost. [Railway's current pricing](https://railway.com/pricing) meters CPU, memory, and volumes per second and bills egress/storage separately; the actual staging workspace invoice and usage remain uncollected. No cost-backed price recommendation is supportable yet. The separate staging environment is documented in [Scale & Ops § 5.2](../05-scale-ops.md#52-staging-environment). |
| Stripe | Official docs describe asynchronous subscription lifecycle events and [signed webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), a [hosted customer portal](https://docs.stripe.com/customer-management) for subscription/payment management and cancellation, [subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules), and [provider-calculated prorations](https://docs.stripe.com/billing/subscriptions/prorations). Its [U.S. pricing page](https://stripe.com/pricing) lists 2.9% + $0.30 for domestic online card payments; [Stripe Billing pricing](https://stripe.com/billing/pricing) lists 0.7% of recurring billing volume on pay-as-you-go ([plan/pricing notice](https://support.stripe.com/questions/changes-to-the-stripe-billing-starter-and-scale-plans?locale=en-GB)). At those published rates, one domestic card subscription payment is approximately 3.6% of the billed amount plus $0.30, before tax tooling, disputes, or other applicable fees. Confirm current eligibility, payment mix, and negotiated terms before modeling fees. [Stripe Tax](https://docs.stripe.com/tax) supports calculation and obligation monitoring, but does not by itself establish that HousePoints' registrations, filings, or remittances are handled. |
| Paddle | Official docs describe a [hosted customer portal](https://developer.paddle.com/concepts/sell/customer-portal), [subscription lifecycle webhooks](https://developer.paddle.com/webhooks), [transaction/checkout workflows](https://developer.paddle.com/build/transactions/create-transaction), a [separate sandbox](https://developer.paddle.com/sdks/sandbox/), and [webhook signature verification](https://developer.paddle.com/webhooks/about/signature-verification). Paddle describes itself as a [merchant of record](https://developer.paddle.com/get-started/how-paddle-works/) and its [public pricing page](https://www.paddle.com/pricing) describes an all-inclusive price, but the reviewed material did not establish a launch-specific fee schedule, contract terms, or HousePoints' eligibility. Obtain and review a written quote and terms before comparing total cost. |
| Mobile distribution | [Apple's App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) require in-app purchase to unlock app functionality under guideline 3.1.1, while external-purchase-link restrictions vary by storefront; the United States storefront is treated differently in the current guideline. [Google Play's payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en) requires Play Billing for digital goods/services sold in the app, permits consumption-only access to services purchased elsewhere and purchasing information without direct links, but restricts leading users to an alternate payment method unless a policy exception/program applies. The owner selected a U.S. iOS external link and non-clickable Google Play billing information; final policy/store review remains a release gate. |

The owner selected Stripe as the B2 sandbox candidate and decided the initial
mobile paths. Seller-specific provider terms/tax responsibilities, final
store review, monthly prices, and per-organization cost remain open. Do not
infer these from integration-test metrics, headline pricing, or a single
storefront's rules.

## Commercial matrix

### 1. Standard price and initial Plus capacity bands

Direction: capacity-band pricing with predictable monthly per-organization
price; Standard covers members 5–20; Plus starts at member 21; larger bands
added only when demand justifies them; no paid trials; no per-tier feature
differences.

Recommendation:

- Publish one Standard price and exactly one initial Plus band at launch;
  defer additional Plus bands until at least one paying organization crosses
  the boundary.
- Prices set in a single currency for launch; multi-currency deferred.
- Price the tiers to cover expected hosting per member at the top of each
  band with margin sufficient for support/reconciliation overhead, not to
  optimize for revenue growth. The spike must derive the actual number from
  hosting evidence (see § 3 below), not from competitor pricing.
- Until representative telemetry and provider fees are available, do not
  publish or approve a price sheet. The existing local report-query fixture
  measurements are not a substitute for production-like resource usage.

Evidence needed:

- Hosting cost projection across membership and activity mixes (§ 3).
- Provider fee schedule for the selected provider, launch country, currency,
  and payment method (§ 4).
- Currency and jurisdiction shortlist consistent with the intended launch
  region.

Owner decisions recorded in this review: initial paid launch market is the
United States, with U.S. storefronts in scope; the selling legal entity is
also based in the United States; launch billing currency is USD. Approve a
first Plus capacity band of 21–50 members. Standard and Plus monthly prices
remain open until representative hosting costs and provider fees are
available.

### 2. Plan-catalog change process

Direction: changing the plan catalog is distinct from changing an existing
subscriber's agreed price or capacity; version band definitions; explicitly
decide notice, effective dates, and grandfathering before applying changes to
existing subscriptions.

Recommendation:

- Represent the plan catalog as a versioned record with an active revision
  and a monotonically increasing version number. Each `OrganizationSubscription`
  references the plan revision it was activated under.
- Catalog edits produce a new revision. Existing subscriptions stay on their
  original revision until an explicit migration event moves them (owner-
  initiated renewal on a new tier, or a platform-approved grandfathering
  policy).
- Grandfathering is off by default: a catalog change never silently reprices
  an existing subscription. A migration must record actor, reason, before/
  after revision and price, and effective date.
- Reject "instant" retroactive price changes at the mutation layer.

Evidence needed:

- Data-model sketch showing revision reference on `OrganizationSubscription`
  and required audit shape for a migration.
- Provider contract wording that permits price/plan changes only with the
  notice period the platform commits to.

Owner decision recorded in this review: give existing subscribers at least
30 calendar days' notice before a catalog price change takes effect at
renewal. Preserve each subscriber's existing price through that notice
period; do not silently migrate or reprice an existing subscription.

### 3. Hosting cost estimate at realistic member/activity levels

Direction: member count is a proposed pricing proxy, not a measured hosting
cost; estimate costs across membership and activity levels before setting
prices or promising unlimited capacity.

Recommendation:

- Build the estimate from actual staging telemetry at 4, 12, 20, 30, and
  50 counted members, with low/typical/high activity mixes. Include profiles
  at the top of Standard (20) and the initial Plus band (50), not only
  mid-band samples.
- Cost components: web hosting, API compute, PostgreSQL storage + IOPS,
  push notification delivery, log/observability retention, backup storage,
  email delivery (§ 8), Playwright/CI overhead attributable to production.
- Report monthly cost per organization for low/typical/high activity
  profiles and the observed range; include a ±30% variance only if the
  telemetry supports it. Calculate marginal cost at the Standard and Plus
  upper bounds rather than extrapolating from mid-band profiles.
- Explicitly note fixed platform costs (Auth0 tenant, domain, monitoring
  seat costs) that do not scale with organization count and must be
  amortized against the total subscriber base.

Evidence needed:

- Railway (or equivalent) usage numbers from staging with representative
  fixtures, projected to production traffic. Current report-query
  integration results do not measure resource cost.
- Provider-specific fees estimated per successful charge and per refund/
  dispute (§ 4).

Measurement plan (not yet run):

1. Use the existing isolated Railway staging environment documented in
   [Scale & Ops § 5.2](../05-scale-ops.md#52-staging-environment); do not
   copy production personal data or change production resources. Record the
   workspace plan, included usage, service configuration, deployment
   revision, and actual invoice/usage period.
2. Seed synthetic organizations at 4, 12, 20, 30, and 50 counted members.
   Exercise scoring, notifications, season operations, dashboard/report
   reads, and retained-data growth. Derive low/typical/high activity rates
   from an approved pilot or observed staging usage; if neither exists,
   label controlled rates as sensitivity assumptions, not representative
   demand.
3. Capture at least seven consecutive days of staging service usage and
   costs, including API/web compute, database and volume growth, backups,
   logs/observability, and egress. Record service-level CPU, memory, storage,
   database size, and traffic before and after each controlled scenario.
4. Convert measured resource quantities using the [Railway rate card](https://railway.com/pricing)
   that applies to the account and billing period. Include the plan fee,
   included credits, and separately billed services; reconcile the estimate
   to the workspace invoice rather than extrapolating from a local Docker
   run.
5. Report separate fixed platform cost and variable organization cost.
   Show monthly cost at all five member points, marginal cost from 19→20
   and 49→50 members, and the effect of the selected activity range. Only
   recommend prices after comparing those costs with the selected provider
   fee schedule and an explicitly approved support/reconciliation margin.

Staging resource measurements are not themselves production usage. Keep
the price recommendation provisional until a paid-pilot cohort validates
the load assumptions; do not claim unlimited capacity from this exercise.

Owner decision: acceptance that the price sheet in § 1 exceeds the projected
marginal cost per member for the top of each band by at least the agreed
margin; explicit note if any band is priced below marginal cost as a
deliberate loss-leader.

## Provider comparison

### 4. Provider selection

Direction: use hosted payment collection and verified server-to-server
events; verify webhook signatures with the provider's required raw-body
mechanism; sandbox-testable lifecycle; recurring organization billing;
portal/support operations; reconciliation.

Recommendation:

- Score at least two candidate providers against a fixed capability matrix
  before selecting one:

  | Capability | Must-have |
  |---|---|
  | Hosted checkout for recurring organization subscriptions | Yes |
  | Signed webhook events with raw-body verification | Yes |
  | Sandbox with independent credentials and event endpoints | Yes |
  | Customer portal for owner self-service management | Yes |
  | Programmatic cancel / schedule-downgrade at next renewal | Yes |
  | Tax handling appropriate for the launch jurisdiction | Yes |
  | Refund/dispute API with idempotency | Yes |
  | Documented retry/replay tooling and event IDs; integration tolerates duplicate/out-of-order delivery | Yes |
  | Public status page + audited outage history | Yes |

Initial source comparison (documented capability is not yet a sandbox pass):

| Capability | Stripe | Paddle |
|---|---|---|
| Hosted recurring checkout | Documented [Checkout subscriptions](https://docs.stripe.com/payments/checkout/subscriptions) | Documented [transaction checkout flow](https://developer.paddle.com/build/transactions/create-transaction) |
| Signed webhook verification | Documented [signature verification](https://docs.stripe.com/webhooks/signature) | Documented [signature verification over the raw body](https://developer.paddle.com/webhooks/about/signature-verification) |
| Isolated sandbox | Documented [Stripe sandboxes](https://docs.stripe.com/sandboxes) | Documented [Paddle sandbox](https://developer.paddle.com/sdks/sandbox/) |
| Owner self-service portal | Documented [customer portal](https://docs.stripe.com/customer-management) | Documented [customer portal](https://developer.paddle.com/concepts/sell/customer-portal) |
| Schedule changes / proration | Documented [subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules) and [proration behavior](https://docs.stripe.com/billing/subscriptions/prorations); configured behavior still needs sandbox verification | Documented [upgrade/downgrade flows](https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade); confirm a downgrade can preserve access until renewal and verify charge timing in sandbox |
| Tax responsibility | [Stripe Tax](https://docs.stripe.com/tax) calculates tax and helps monitor obligations; HousePoints must confirm its registration, filing, and remittance responsibilities | Paddle identifies as [merchant of record](https://developer.paddle.com/get-started/how-paddle-works/); verify supported transaction/product terms for HousePoints |
| Refunds/disputes and idempotency | Refund/API support is available; document exact dispute, retry, and idempotency behavior for chosen flow before pass | [Adjustment/refund API](https://developer.paddle.com/build/transactions/create-transaction-adjustments) documented; dedicated idempotency behavior and dispute handling remain unverified |
| Delivery retries, replay, and ordering | Retry/replay tools documented; design for duplicate and out-of-order events | Retry/replay details and ordering guarantees still require source verification |
| Fees and seller terms | U.S. baseline listed above; verify applicable account terms and all add-ons | Obtain written U.S. quote and contract; public reviewed source does not give enough detail to calculate total cost |
| Status page / outage evidence | Not yet verified | Not yet verified |

- Evaluate providers only against current official documentation dated
  during the spike. Any capability that requires "asking sales" is scored as
  absent until confirmed in writing.
- Owner decision recorded in this review: carry Stripe forward as the B2
  sandbox candidate for the U.S.-only launch. Its documented subscription
  features and published U.S. fee baseline fit the initial cost model, but
  seller-specific terms and HousePoints' tax obligations still require
  verification before live billing. Paddle is the runner-up and is not
  selected for this phase because its U.S. fee schedule was not established
  from the reviewed public evidence; its MoR tax handling may justify
  reconsideration if the scope expands.
- Do not select a provider based on brand familiarity alone; document the
  rejected alternative(s) with a one-line reason each.

Evidence needed:

- Capability matrix filled from primary sources, with URLs and access date.
- Fee comparison including per-transaction, per-refund, sandbox limits,
  minimum monthly commitments, and any per-webhook cost.
- Written confirmation that the provider's terms permit reselling under
  the intended business model.
- Provider-specific written fee quote and tax responsibility for the
  selected launch country/currency. Stripe Tax calculation/monitoring must
  not be treated as proof that registration, filing, and remittance are
  included.

Owner decision recorded in this review: Stripe is the B2 sandbox candidate;
Paddle is not selected because a comparable U.S. fee schedule was not
available from the reviewed public evidence. Sandbox account creation is
deferred until B1 decisions and the required seller-specific terms/tax
review are complete; no production credentials or provider account have
been created.

### 5. Mobile purchase/recovery flow

Direction: billing management ships on web first; mobile consumes the same
entitlements and shows subscription-limit messages alongside backend
enforcement; native billing management is deferred; any mobile purchase/
recovery link requires distribution review.

Recommendation:

- Keep billing management web-first. For the U.S. iOS storefront, the owner
  approved a web-billing link from subscription-limit messaging, with no
  native IAP, subject to final App Review/policy confirmation.
- Do not add any in-app purchase (IAP) surface for the paid tiers before B3
  approves it explicitly; the store platforms have strict rules on
  subscriptions sold outside their IAP where their rails could apply.
- Google Play's consumption-only guidance permits access to an externally
  purchased service and purchasing information without a direct link, but it
  does not generally permit leading users to an alternate payment method. A
  billing portal link must be reviewed for whether it leads to payment or
  purchase actions; do not assume it qualifies as a neutral
  account-management link. For the initial Google Play app, keep any
  purchasing information non-clickable unless the final policy review
  confirms an applicable exception/program.
- Apple's rules differ by storefront: current guideline 3.1.1 requires IAP
  to unlock functionality, and its external-purchase-link restrictions
  contain a United States storefront exception. Do not extrapolate that
  exception to other storefronts or assume HousePoints qualifies for an
  enterprise-services exception.
- If a storefront's rules block the approved web-first flow, defer paid
  mobile enrollment there until the owner explicitly approves a compliant
  alternative.

Evidence needed:

- Official Apple and Google policy citations for the U.S. storefronts and a
  recorded rationale for the consumption-only Android path. These sources
  and the owner's selected flows are captured above.
- Screen recording of each implemented mobile route belongs in the later
  release rehearsal; final app review remains a release gate.

Owner decisions recorded in this review: U.S. iOS may link to web billing,
with no native IAP, subject to current App Review and release-time policy
confirmation. The U.S. Google Play app may show non-clickable information
about web billing only; HousePoints' mobile flow is consumption-only because
the app will not sell subscription access in-app. Do not ship a direct
purchasing link without confirming an applicable policy exception/program.

## Lifecycle mechanics

### 6. Upgrade timing / proration

Direction: joining cannot exceed the plan limit; owner-approved upgrade or a
freed slot required before the join succeeds; never upgrade or charge
automatically.

Recommendation:

- Upgrades take effect immediately on owner approval. New capacity is
  available for a blocked join only after the provider confirms that the
  owner-initiated upgrade and required payment succeeded. If confirmation is
  asynchronous, keep the join blocked until it arrives; the valid invitation
  may be retried and is not consumed by the failed capacity attempt.
- Prefer provider-native proration if the selected provider's sandbox trace
  proves the configured behavior matches the approved owner choice; do not
  compute proration locally.
- Charge for the balance of the current billing period at the new price
  minus a credit for unused time at the old price only if the provider's
  configuration and failed-payment behavior produce that result. Provider
  documentation shows that a proration credit is not necessarily an
  automatic refund and a debit is not necessarily charged immediately. If
  the selected provider cannot do this reliably, fall back to scheduling
  the new price at the next renewal. The join remains blocked until the
  scheduled upgrade is effective or a slot is freed; do not create a join
  queue or consume the invitation while capacity is unavailable.
- Downgrades take effect only at the next renewal (already approved).
- Never issue a refund on upgrade.

Evidence needed:

- Provider documentation confirming supported proration mode and how
  failed-payment during upgrade is reported.
- Sandbox trace of upgrade → immediate access → next-invoice content.

Owner decision recorded in this review: use immediate provider-native
proration for owner-approved upgrades; do not implement local proration
math. Capacity remains blocked until the provider confirms the upgrade and
required payment succeeded. If the selected provider cannot reliably meet
that behavior, use the documented next-renewal fallback and leave the join
blocked until then. Confirm the provider-specific details in B2 sandbox
testing.

### 7. Ownership transfer, archive, and deletion

Direction: ownership transfer preserves the organization subscription;
billing-contact/provider access reconciled separately; previous owner
loses local billing-management authorization immediately; organization
archive does not silently cancel payment; combined archive/cancellation
workflow required before billing launch; deletion and provider-record
retention policy required.

Recommendation:

- Ownership transfer: `BillingAccount.billingContactUserId` follows the new
  owner; the prior owner's platform billing-management capability is
  revoked at the same transaction that transfers ownership. The provider
  customer record is not renamed automatically; the new owner is prompted
  to update it via the portal on next visit.
- Archive: block archive on an organization with an active paid
  subscription until the owner has either cancelled or explicitly
  acknowledged an archive-with-active-subscription workflow that (a) shows
  the paid-through date, (b) schedules cancellation at that date, and
  (c) requires the owner to confirm both.
- Deletion: provider records are retained (not deleted) for the tax /
  chargeback window recommended by the selected provider (typically 7
  years in most jurisdictions). Local `BillingEvent` payloads are pruned
  after the retention window defined below.
- Data retention:
  - `BillingAccount`, `OrganizationSubscription`: retained for the life of
    the organization plus the provider-recommended dispute window.
  - `BillingEvent`: full payload retained for 90 days; metadata (event ID,
    type, processed_at, error summary) retained for the provider-
    recommended dispute window.
  - `EntitlementOverride`: retained for the life of the organization; audit
    trail is not pruned.

Evidence needed:

- Selected provider's recommended retention period for dispute/chargeback.
- Sketch of the combined archive/cancellation UI showing paid-through
  date, effective cancellation date, and confirmation gate.

Owner decision recorded in this review: do not silently archive an
organization with an active paid subscription. Require the owner to confirm
the archive workflow, show the paid-through date, and schedule cancellation
for that date. Retain the full `BillingEvent` payload for 90 days, then
prune it while retaining the event metadata/audit record for the applicable
provider dispute and legal retention period.

### 8. Exception expiry and revocation transitions

Direction: complimentary access grants are dated or indefinite; grace
extensions always have a deadline; grant expiry or revocation must not
silently create a new paid subscription or authorize an unexpected charge.

Recommendation:

- On complimentary-access grant with an expiry date: at expiry,
  entitlement re-evaluates against the underlying subscription. If a
  paid subscription is `Active`, no change. If none, organization enters
  Limited unless counted membership is ≤4 (Free) or a stacked exception
  applies.
- On complimentary-access revocation before expiry: same re-evaluation,
  same day.
- On indefinite complimentary access revocation: same rules; the actor
  must acknowledge the resulting mode in the confirmation dialog.
- On grace-extension expiry: identical to a fresh payment-failure timeout
  (Limited), unless the owner has completed payment recovery, in which
  case Active.
- No exception state ever calls the provider to start a paid subscription
  or add a charge. Provider mutation is always owner-initiated through
  the portal.
- Stacked exceptions: at most one active complimentary-access grant and at
  most one active grace extension per organization. New grants supersede
  and revoke the prior grant with recorded reason.

Evidence needed:

- State machine diagram showing entitlement mode transitions across grant/
  revoke/expire events.
- Test cases for each transition against the F1 scoring-write protocol so
  entitlement change never happens mid-award.

Owner decision recorded in this review: exception grants, expiries, and
revocations may recalculate access only; they must never create or modify a
paid subscription or charge. Any billing change remains owner-initiated.
Also approve at most one active complimentary-access grant and one active
grace extension per organization; a new grant supersedes an existing same-
type grant with the prior state and reason recorded. Complimentary-access
expiry or revocation immediately re-evaluates access against any active paid
subscription or the Free eligibility rule; otherwise the organization enters
Limited. Grace-extension expiry without successful recovery also moves the
organization to Limited immediately at the revised deadline.

### 9. Limited-mode endpoint capability matrix

Direction: Limited mode preserves reads and the recovery/remediation
operations needed to leave, secure, or correct an organization. Normal
growth/scoring writes are blocked. The API currently has no billing
entitlement decorators or billing endpoints; this is the target policy,
not a claim that billing enforcement is already implemented.

Recommendation: classify every current API route as follows. Existing
bearer-token authentication, organization membership/role checks, platform
operator authorization, and security suspension rules continue to apply in
every billing mode.

| Class | Exact current API routes | Limited-mode target |
|---|---|---|
| Public/system and onboarding | `GET /health`; `POST /system/releases/record`; `POST /system/releases/broadcast`; `POST /telemetry/client-error`; `POST /users/bootstrap`; `POST /orgs/create-availability`; `POST /orgs/create` | Not gated by an existing organization's billing entitlement. Public release routes retain their release-secret checks; new organization creation remains subject to the Free-tier creation policy. |
| Organization-scoped reads | `POST /admin/context`; `/admin/point-adjustments/stats`; `/admin/audit`; `/dashboard/summary`; `/houses/leaderboard`; `/reports/query`; `/members`; `/users/scores`; `/transactions/recent`; `/transactions/reactions`; `/notifications/list`; `/orgs/route-context`; `/orgs/join/preview`; `/recognition-categories/list`; `/seasons/context`; `/seasons/plan-context`; `/seasons/compare` | Allowed in Free, Active, Grace, and Limited, subject to existing role/membership and security checks. |
| Recovery, account, and safety mutations | `POST /users/profile`; `/users/account-deletion`; `/devices/register`; `/devices/unregister`; `/notifications/mark-read`; `/notifications/mark-all-read`; `/moderation/reports/submit`; `/admin/org/owner`; `/admin/org/archive`; `/admin/org/restore`; `/admin/users/remove`; `/points/delete` | Allowed in Limited with existing authentication/authorization. `/points/delete` remains an audited correction, not a new award/deduction. Account deletion keeps its existing owner-transfer requirement. |
| Invitations and membership | `POST /orgs/invite`; `/orgs/join` | Invitation creation remains allowed in Limited. Joining is denied until the organization is billing-eligible and has capacity; a blocked attempt does not consume the invite. |
| Scoring, season, category, and organization changes | `POST /points/adjust`; `/points/deduct`; `/transactions/react`; `/recognition-categories/create`; `/recognition-categories/archive`; `/seasons/plan`; `/seasons/plan/discard`; `/seasons/planned-end`; `/seasons/start`; `/seasons/kickoff`; `/seasons/rename`; `/admin/org/settings`; `/admin/org/slug`; `/admin/houses`; `/admin/users/assign-house`; `/admin/users/role`; `/admin/users/display-name` | Free remains permitted within Free limits; Active and Grace permitted; Limited denied. |
| Platform-operator functions | `POST /platform/overview`; `/platform/organizations/detail`; `/platform/organizations/status`; `/platform/organizations/revoke-invites`; `/platform/organizations/revoke-invite`; `/platform/settings`; `/platform/users/search`; `/platform/users/revoke-devices`; `/platform/account-deletions`; `/platform/account-deletions/complete`; `/platform/support-cases/list`; `/platform/support-cases/create`; `/platform/support-cases/detail`; `/platform/support-cases/update`; `/platform/support-cases/notes`; `/platform/moderation/reports`; `/platform/moderation/reports/resolve` | Billing mode does not gate operator actions; existing platform-owner authorization and audit behavior remain required. |
| Future billing recovery | No current API route; to be added by B2/P work | Owner portal/invoice status and payment recovery must be available in all billing modes, including Limited, with provider-confirmed state changes. |

Additional rules:

- A Limited-mode check belongs on every organization-scoped write route;
  routes not explicitly allowed above default to denied in Limited.
- Billing mode never gates authorized organization reads.
- Mobile uses the same server-side capability decision; client controls are
  presentation only.
- The full route list above was cross-referenced against the current API
  route declarations. Re-run that inventory when routes change and add
  positive/negative tests for each affected capability/mode.

Owner decisions recorded in this review: reactions are blocked in Limited
mode; invitation creation is allowed while joins remain blocked until the
organization is eligible and has capacity. The owner approved the complete
route classification above in this review.

### 10. Payment-failure email requirements (provider/content deferred to B3)

Direction: notify organization owners when payment fails and explain the
seven-day grace period; keep grace deadline stable across repeated retries;
deduplicate; retry delivery failures; surface missing/unusable addresses to
platform operators.

Recommendation:

- Use a dedicated transactional-email provider (not the billing
  provider's built-in notification) so notice content, deduplication, and
  retry logic remain owned by the platform.
- One "payment failure — action required" email per unresolved payment
  incident. A retry of the same incident does not send a fresh email; the
  in-app persistent notice is authoritative for the continued state.
- Reminder cadence: send one reminder at grace-deadline minus 24 hours
  if unresolved. Do not spam.
- After recovery, send one "payment restored" confirmation.
- Missing/bouncing owner email is a platform operator queue item; do not
  block Grace/Limited transitions on email deliverability.

Evidence needed before B3:

- Selected email provider capability review (bounce webhooks, template
  versioning, rate limits, DKIM/DMARC setup at the launch domain).
- Sample email content approved by the product owner.
- Test proving that repeated provider retries of the same failed payment
  do not produce duplicate emails or reset the grace deadline.

Owner decision for B1: preserve these delivery and deduplication
requirements. Provider selection and approval of final failure, reminder,
and recovery email content are deferred to B3, as scoped in the
[execution plan](./execution-plan.md#b3--specify-notifications-operations-and-launch-decision).

## Preserving approved policy — non-negotiables

The following are already approved and this decision record does not
propose changing any of them. They are listed here so implementation
tickets can cite them as constraints:

- No paid-tier trial.
- No per-tier feature differences beyond member capacity.
- Payment never grants organization access.
- Complimentary access does not automatically stop a recurring charge.
- Free is a durable plan state, not a trial.
- Web-first management; native billing management deferred.
- Rollout starts with explicitly enrolled pilot organizations; kill switch
  disables new enrollments without discarding existing subscription
  state.

## Acceptance checklist

B1 is complete when every item below has a documented owner decision:

- [x] Initial paid launch market: United States (§ 1)
- [x] Seller legal-entity jurisdiction: United States (§ 1)
- [x] Launch currency: USD (§ 1)
- [x] Initial Plus capacity boundary: 21–50 members (§ 1)
- [ ] Standard and Plus monthly prices (§ 1)
- [x] Plan-catalog change notice period: 30 days; preserve current price
      through notice (§ 2)
- [ ] Hosting cost estimate accepted; price sheet ≥ marginal cost per
      member at the top of each band (§ 3)
- [x] B2 sandbox candidate: Stripe; Paddle not selected for this phase
      (§ 4)
- [ ] Confirm Stripe seller-specific fees, contract terms, required
      capabilities, and HousePoints' tax responsibilities (§ 4)
- [x] U.S. iOS web-billing link; no native IAP, subject to final review
      (§ 5)
- [x] U.S. Google Play: non-clickable billing information only; no direct
      link (§ 5)
- [x] U.S. storefront policy sources and selected mobile-flow rationale
      recorded (§ 5); implemented-flow recording is deferred to release
      rehearsal
- [x] Immediate provider-native proration; no local math; payment
      confirmation gates capacity (§ 6)
- [x] Full `BillingEvent` payload retention window: 90 days (§ 7)
- [x] Archive-with-active-subscription confirmation gate and scheduled
      cancellation at paid-through date (§ 7)
- [x] No provider mutation from exception changes (§ 8)
- [x] Single-active-grant-per-type policy with supersession audit (§ 8)
- [x] Complimentary-access expiry/revocation immediately re-evaluates access
      (§ 8)
- [x] Grace-extension expiry enters Limited at its revised deadline absent
      payment recovery (§ 8)
- [x] Reactions blocked in Limited mode (§ 9)
- [x] Endpoint-level route inventory and full capability matrix owner
      sign-off (§ 9)
Until every checkbox is ticked, B1 remains "prepared, not decided"; B2
must not begin against a real provider account.

## What this record does not authorize

- Any production charge or customer contact.
- Provider account creation with production credentials.
- Any code merge that flips an entitlement enforcement flag on for
  organizations outside the enrolled pilot list.
- Removal of the "prepared but disabled" language from the execution
  plan.
