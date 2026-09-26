# Quarterly product design

Created September 20, 2026. Target planning horizon: Q4 2026.

Status: main product decisions reviewed and work sliced. Decisions explicitly marked approved are settled; remaining implementation/commercial details are identified in the individual designs. See the [execution plan](./execution-plan.md) for ordered slices, dependencies, verification, and release gates. No implementation has started.

## Product direction

Help an organization define meaningful recognition, explain its standings, run successive seasons, and participate in a platform-managed monthly subscription program.

1. [Custom recognition categories](./recognition-categories.md)
2. [Leaderboard drill-through reporting](./leaderboard-reporting.md)
3. [Season kickoff and reporting](./season-lifecycle.md)
4. [Paid organization membership: design and spike](./organization-membership-billing.md)

These designs extend the implemented product described in [the roadmap](../roadmap.md). Earlier season and reporting documents remain records of current behavior. Where this draft proposes a change, it is explicitly future behavior. The [independent repository review](../refactor-pass-3/04-independent-review.md) supplies supporting engineering observations, not the feature priorities.

## Outcomes

- Owners can align recognition with their organization's values without engineering changes.
- Members can explain a displayed total through its contributing ledger entries.
- Owners can prepare a new season, deliberately kick it off, and communicate its results.
- Platform operators can understand subscription eligibility and exceptions before payment integration is built.

Track category adoption and award completion, drill-through usage and reconciliation defects, repeat-season kickoff, and support effort. Establish baselines before setting numerical targets. No production analytics values were available when drafting this design.

## Shared rules

- Organization scope is resolved from authorized context; supplied category, season, house, member, and subscription identifiers are revalidated in that scope.
- Owners manage categories, seasons, and organization configuration. Admins manage day-to-day member and point operations. Members can award and read permitted reports. Platform operators manage subscription policy and exceptions through separately authorized platform routes.
- Show disabled owner-only controls where they explain access. The API enforces authorization independently of UI and entitlements.
- Point transactions remain the scoring authority. Category changes, house moves, subscription changes, and season transitions never rewrite historical deltas.
- Live and closed-season totals use non-deleted transactions. Approved: closed-season corrections require a reason and audit trail, update historical standings and winners, and are disclosed in reports. Frozen winner certificates or immutable publication snapshots are deferred.
- Reporting retains transaction-time house attribution. Membership removal does not remove historical contributions. Account deletion continues to follow existing anonymization rules.
- New writes are idempotent where retries can duplicate business actions. Season transitions and point writes must coordinate so awards cannot land in a season that closed during the request.
- In-app notifications are durable. External push delivery cannot decide whether the business operation succeeded.
- Mobile compatibility is an explicit release gate, especially when replacing the fixed trait enum. A server rollout alone is insufficient.

## Recommended first-release boundaries

| Area | Included | Deferred |
|---|---|---|
| Categories | Organization-owned defaults, add/archive only, fixed names, historical reporting | Rename/edit/restore/reorder, weights, point presets, multiple categories on one award, per-season category sets |
| Reporting | House/member/category drill-through, reconciled totals, cursor pagination, shareable authenticated filters | Public links, full CSV exports, custom report builder, inferred historical participation rates |
| Seasons | One editable next-season plan, manual atomic kickoff, planned end date, historical recap and comparison | Automatic scheduler, standalone close without successor, reopen/backdate, frozen results |
| Billing | Product decision record, entitlement model, platform workflows, sandbox spike plan | Production charging, selected provider, prices, provider-specific billing mechanics |

## Decision register

Entries are proposed/open unless explicitly marked approved. Approval here settles design direction, not implementation or deployment.

| ID | Decision | Recommended default / question |
|---|---|---|
| D1a | Category lifecycle — approved September 20 | Seed the current default set for each new organization. Owners add/archive categories. Archived categories leave the award picker but remain on existing awards and in historical reporting. At least one category must remain active; owners must add another before archiving the last one. |
| D1b | Category changes — approved September 20 | Add/archive only. No rename or other editing/restoration. To change a category, archive it and create a new one; old awards remain under the original identity and fixed name. Archived names may be reused for a new, separate category; reports distinguish the identities and never merge their history. |
| D2 | Historical results — approved September 20 | Allow corrections after season closure, require a reason and audit trail, and update historical standings (including winners). Clearly disclose corrections; final results are not frozen. |
| D3 | House attribution — approved September 20 | Points remain with the house recorded on each transaction after a member moves or leaves. Personal season totals span those houses; historical contributions remain reportable. |
| D4 | Ties — approved September 20 | For this release, equal scores share competition rank (1, 1, 3) for houses and members; display all tied winners. Name/ID orders tied rows without breaking the tie. Creative/competitive tiebreakers are deferred. This changes current ordinal ranking. |
| D4b | Report access — approved September 20 | All current organization members may drill through standings to contributing awards, recipients, givers, categories, and reasons, consistent with Activity access. Deleted-record evidence and admin audit remain admin/owner-only. Former members lose access but retain historical contributions. |
| D5 | Season transition — approved September 20 | Owners prepare and manually start the next season, closing the previous season atomically. Planned dates are informational; the current season continues accepting points until manual rollover. No background season-closing or kickoff service. |
| D6 | Billing operating model — approved September 20 | Owners subscribe and manage subscriptions through self-service. Platform operators see what organizations are billed, payment/subscription status, and manage audited exceptions. Initial exceptions: complimentary capacity-band access (dated or indefinite) and grace extensions, both with required reasons, audit history, and revocation. Discounts/custom pricing are deferred; provider mechanics and expiry/revocation transitions remain to be designed. |
| D7 | Member-count tiers and capacity bands — direction approved September 20; details open | Free up to 4, Standard 5–20, Plus starting at 21 members. All tiers include the same core features; member capacity is the differentiator. New organizations start on Free with no paid-tier trial; larger pilots use explicit complimentary access. Use capacity bands with predictable monthly organization prices, adding or adjusting larger bands as needed. Count all current memberships, including owners/admins, unassigned and temporarily suspended members; exclude pending invites and removed/archived memberships. Count once per organization. At capacity, block new joins without consuming invitations, notify owners, and require an owner-approved upgrade or freed slot; no automatic charges. Existing members keep normal access. Owner-requested downgrades take effect at renewal only after membership fits; scheduled downgrades immediately cap joins at the lower limit. No automatic downgrade or member/history removal. At initial billing rollout, existing organizations with up to 4 members enter Free; larger ones receive a 30-day complimentary transition with owner notices and explicit opt-in subscription. Afterward, enter Limited unless subscribed, excepted, or reduced to fit Free; preserve members/history. Exact Plus limits, prices, upgrade billing mechanics, and treatment of later catalog changes for existing subscribers remain open. |
| D8 | Payment lapse — approved September 20 | Seven days of normal access with a persistent owner notice, then limited access preserving members/history and report reads while blocking new awards, invitations, categories, and season starts. Keep billing recovery and essential account/admin actions available; restore access after payment recovery or an applicable platform exception. Add owner payment-failure email explaining the grace period; delivery/cadence details follow in the spike. Owners may cancel renewal at any member count; paid access lasts to the paid-through date, then Free if up to 4 members or Limited otherwise. Preserve history/members, allow resubscription or reduction to Free, and do not add failed-payment grace to deliberate cancellation. |
| D9 | Delivery scope — approved September 20 | Web first for category management, detailed drill-through reports, season planning, and billing management. Mobile custom-category selection, historical labels, season information, and subscription-limit messages ship alongside backend changes. Rich native reporting and management follow later. |

## Dependencies and readiness for slicing

D1-D6, the D7 capacity-band/counting/join/downgrade direction, D8, and D9 are approved as recorded above. Remaining commercial and validation decisions are listed in the individual designs; implementation mechanics remain proposals until slicing. Category identity and historical attribution feed reporting; the same reporting feeds season recaps. Billing discovery can proceed independently, but production entitlement enforcement depends on remaining D7 commercial details, D8 provider/notification mapping, exception details, and a verified checkout/mobile distribution approach.

Targeted reliability prerequisites are request idempotency, atomic deduction cooldown enforcement, season/write coordination, bounded push delivery, and correct notification organization targeting. Attach each to the affected feature rather than requiring the entire pass-3 refactor backlog.

The [execution plan](./execution-plan.md) now defines deliverable slices with user-visible behavior, migration/compatibility steps, tests, and rollout/rollback criteria. Begin with F1; billing discovery can proceed independently. Production billing remains conditional on the spike decision. No calendar estimates or commitment to every provisional slice are implied.
