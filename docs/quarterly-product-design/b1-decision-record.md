# B1 billing decision record (draft)

Status: draft, September 29, 2026. Companion to
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

Evidence needed:

- Hosting cost projection across membership and activity mixes (§ 3).
- Provider fee schedule for the selected provider and payment method (§ 4).
- Currency and jurisdiction shortlist consistent with the intended launch
  region.

Owner decision: signed price sheet naming (a) Standard monthly price, (b)
Plus starting band and monthly price, (c) launch currency, (d) whether the
first Plus band is 21–50 or a different upper bound.

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

Owner decision: minimum notice period (calendar days) before a price change
takes effect on renewal for an existing subscriber; default grandfathering
posture (recommendation: preserve prior price through the notice period).

### 3. Hosting cost estimate at realistic member/activity levels

Direction: member count is a proposed pricing proxy, not a measured hosting
cost; estimate costs across membership and activity levels before setting
prices or promising unlimited capacity.

Recommendation:

- Build the estimate from actual staging telemetry, projected across three
  organization archetypes: Free-band (≤4 members, low activity), Standard
  mid-band (~12 members, typical activity), Plus lower-band (~30 members,
  high activity).
- Cost components: web hosting, API compute, PostgreSQL storage + IOPS,
  push notification delivery, log/observability retention, backup storage,
  email delivery (§ 8), Playwright/CI overhead attributable to production.
- Report each archetype as monthly cost per organization with a ±30%
  variance band, plus a marginal cost per additional counted member within
  the archetype's tier.
- Explicitly note fixed platform costs (Auth0 tenant, domain, monitoring
  seat costs) that do not scale with organization count and must be
  amortized against the total subscriber base.

Evidence needed:

- Railway (or equivalent) usage numbers from staging with representative
  fixtures, projected to production traffic.
- Provider-specific fees estimated per successful charge and per refund/
  dispute (§ 4).

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
  | Documented event ordering guarantees / replay tooling | Yes |
  | Public status page + audited outage history | Yes |

- Evaluate providers only against current official documentation dated
  during the spike. Any capability that requires "asking sales" is scored as
  absent until confirmed in writing.
- Do not select a provider based on brand familiarity alone; document the
  rejected alternative(s) with a one-line reason each.

Evidence needed:

- Capability matrix filled from primary sources, with URLs and access date.
- Fee comparison including per-transaction, per-refund, sandbox limits,
  minimum monthly commitments, and any per-webhook cost.
- Written confirmation that the provider's terms permit reselling under
  the intended business model.

Owner decision: selected provider name + intended sandbox account creation
date; documented rejection reason for the runner-up.

### 5. Mobile purchase/recovery flow

Direction: billing management ships on web first; mobile consumes the same
entitlements and shows subscription-limit messages alongside backend
enforcement; native billing management is deferred; any mobile purchase/
recovery link requires distribution review.

Recommendation:

- Mobile at launch shows subscription-limit / limited-mode messaging and
  routes owners to the web billing portal via a signed authenticated deep
  link. It does not embed a purchase surface.
- Do not add any in-app purchase (IAP) surface for the paid tiers before B3
  approves it explicitly; the store platforms have strict rules on
  subscriptions sold outside their IAP where their rails could apply.
- Verify the deep-link/authenticated web checkout flow against the Google
  Play policies already documented in
  [google-play-console-declarations.md](../google-play-console-declarations.md)
  and the App Store equivalent before B3.
- If the store platforms would classify web-checkout as noncompliant for
  the intended offering, defer paid launch on that store rather than build
  native IAP mid-spike.

Evidence needed:

- Current Google Play policy citation and App Store policy citation on
  digital goods / external checkout, dated during the spike.
- Screen recording of the deep-link flow from mobile Limited state → web
  billing portal → back to mobile.

Owner decision: acceptance that mobile launch ships with the deep-link
flow only; explicit deferral of native IAP; per-store go/no-go decision
if a store's policy blocks the deep-link approach for our category.

## Lifecycle mechanics

### 6. Upgrade timing / proration

Direction: joining cannot exceed the plan limit; owner-approved upgrade or a
freed slot required before the join succeeds; never upgrade or charge
automatically.

Recommendation:

- Upgrades take effect immediately on owner approval. New capacity is
  available for the join attempt that triggered the upgrade prompt.
- Delegate proration to the provider using its standard "prorate on
  upgrade" behavior; do not compute proration locally.
- Charge for the balance of the current billing period at the new price
  minus a credit for unused time at the old price (provider default). If
  the selected provider cannot do this reliably, fall back to charging the
  new price at the next renewal and holding the join queued behind the
  effective date — no automatic mid-cycle charge in that mode.
- Downgrades take effect only at the next renewal (already approved).
- Never issue a refund on upgrade.

Evidence needed:

- Provider documentation confirming supported proration mode and how
  failed-payment during upgrade is reported.
- Sandbox trace of upgrade → immediate access → next-invoice content.

Owner decision: proration model to adopt (provider-native default vs.
next-renewal-only); confirmation that no local proration math is on the
table.

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

Owner decision: retention window (calendar days) for full `BillingEvent`
payloads; sign-off that archive-with-active-subscription requires explicit
owner confirmation.

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

Owner decision: sign-off on the "no provider mutation from exception state"
rule; sign-off on single-active-grant-per-type policy.

### 9. Limited-mode endpoint capability matrix

Direction: recommended allowlist covers sign-in/out, billing recovery,
account deletion requests, ownership transfer, member removal, archive,
moderation, and audited correction of existing records. Convert the
recommendation into an endpoint-level capability matrix before
implementation; test every write path including mobile.

Recommendation: draft matrix (spike must fill from current route
inventory):

| Category | Endpoints | Free | Standard/Plus Active | Grace | Limited |
|---|---|---|---|---|---|
| Auth | `/auth/*`, session read | ✓ | ✓ | ✓ | ✓ |
| Billing recovery | Provider portal redirect, invoice status read | ✓ | ✓ | ✓ | ✓ |
| Account deletion | User self-deletion request | ✓ | ✓ | ✓ | ✓ |
| Ownership transfer | Owner transfer mutation | ✓ | ✓ | ✓ | ✓ |
| Member removal | Admin/owner remove-member | ✓ | ✓ | ✓ | ✓ |
| Archive/restore | Owner archive, owner restore | ✓ | ✓ | ✓ | ✓ |
| Moderation | Suspend/reinstate, audited correction | ✓ | ✓ | ✓ | ✓ |
| History reads | Dashboard, activity, leaderboard, reports (R2–R4) | ✓ | ✓ | ✓ | ✓ |
| Point awards / deductions | `/points/*` mutations | ✓ (≤4 cap) | ✓ | ✓ | ✗ |
| Season kickoff / rollover | Season mutations | ✓ (≤4 cap) | ✓ | ✓ | ✗ |
| Category management (C-slices) | Recognition mutations | ✓ | ✓ | ✓ | ✗ |
| Invite creation / accept | Invitation mutations | ✓ (≤4 cap) | ✓ (cap enforced) | ✓ (cap enforced) | ✗ |
| Reactions | Reaction mutations | ✓ | ✓ | ✓ | ✗ |
| Notification writes triggered by growth actions | Push/notification writes | via allowed actions | via allowed actions | via allowed actions | ✗ |

Rules:

- Every write route decorates its handler with a capability check driven
  by the typed entitlement decision (`{accessMode, capabilities}`); a
  route without a decorator defaults to `Active`-only.
- Read routes are subject to organization membership and security
  suspension only; billing state does not gate reads.
- Mobile enforces the same matrix via the entitlement decision returned
  to the client; there is no mobile-only escape hatch.

Evidence needed:

- Route inventory generated from the current API workspace, cross-
  referenced against the matrix above so no route is unclassified.
- Test-case list showing at least one positive and one negative case per
  category per mode.

Owner decision: confirmation of the "reactions blocked in Limited" call
(the design says "initially blocked to keep the policy explicit"); explicit
sign-off on the full matrix.

### 10. Payment-failure email delivery

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

Evidence needed:

- Selected email provider capability review (bounce webhooks, template
  versioning, rate limits, DKIM/DMARC setup at the launch domain).
- Sample email content approved by the product owner.
- Test proving that repeated provider retries of the same failed payment
  do not produce duplicate emails or reset the grace deadline.

Owner decision: transactional-email provider selection; approved final
email content for the three notices (failure, reminder, restored).

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

- [ ] Standard price, initial Plus band + price, launch currency (§ 1)
- [ ] Plan-catalog change notice period and grandfathering posture (§ 2)
- [ ] Hosting cost estimate accepted; price sheet ≥ marginal cost per
      member at the top of each band (§ 3)
- [ ] Selected provider + documented runner-up rejection (§ 4)
- [ ] Mobile launch ships deep-link flow only; per-store go/no-go (§ 5)
- [ ] Proration model (provider-native vs. next-renewal-only) (§ 6)
- [ ] `BillingEvent` retention window; archive-with-active-subscription
      confirmation gate (§ 7)
- [ ] Exception state machine sign-off (§ 8)
- [ ] Limited-mode capability matrix approved with full route inventory
      classified (§ 9)
- [ ] Transactional-email provider + approved email content (§ 10)

Until every checkbox is ticked, B1 remains "prepared, not decided"; B2
must not begin against a real provider account.

## What this record does not authorize

- Any production charge or customer contact.
- Provider account creation with production credentials.
- Any code merge that flips an entitlement enforcement flag on for
  organizations outside the enrolled pilot list.
- Removal of the "prepared but disabled" language from the execution
  plan.
