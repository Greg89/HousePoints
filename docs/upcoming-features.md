# Upcoming Features - Brainstorm

High-level definitions and open design questions for the next wave of features.
These are not scheduled. Treat this as a living document to refine before work starts.

---

## 1. Org Management & Self-Serve Signup

### What it is
Allow any user to create their own organisation, configure houses within it, and invite team members, removing the dependency on a developer to bootstrap an org manually.

### Current state
The `Organization` model exists and every entity is scoped to it. Self-serve organization creation is implemented for authenticated users: a creator provides organization details plus a first house, becomes `OWNER`, and is assigned to that house atomically. Admin/owner invite links are implemented as single-use tokens, and invite consumption is atomic and concurrency-safe. The API derives actor identity from verified Auth0 credentials and supports multiple Auth0 provider subjects per internal user through `AuthIdentity`.

Still deferred: org deletion, ownership transfer, deeper admin removal rules, domain allow-list joining, slug changes, and true multi-org membership. The first org settings slice is implemented for owner-only organization display-name updates.

### How it should work

**Org creation**
- Implemented as a post-login onboarding flow.
- The user who creates the org becomes the first `OWNER`.
- They set org name, slug, first house name, and first house color.
- Owner-only organization display-name updates are implemented in Manage Settings. Additional org settings and ownership-management screens are deferred.

**Roles**
- `OWNER` exists.
- `OWNER` controls organization-level configuration, including houses and seasons.
- `OWNER` and `ADMIN` can assign members, create invites, and manage day-to-day points interactions.
- `OWNER` can promote members to `ADMIN` and demote admins back to `MEMBER` from Manage Team. Role changes are audited.
- `OWNER` can rename the organization display name from Manage Settings. Slug changes are deferred because they affect URLs, links, and future invite policies.
- Admins can see owner-only Manage sections, but Houses and Seasons are disabled unless the actor is an owner.
- Org deletion, ownership transfer, slug changes, and deeper admin-removal rules are not implemented yet.
- `MEMBER`s have no admin capability; they award points only.

**Joining an org**
- Option A - **Invite link**: Implemented. Owner/admin generates a shareable single-use token. Any Auth0-authenticated user who follows it is added to the org as a `MEMBER`.
- Option B - **Email domain allow-list**: Deferred. This remains attractive for corporate rollouts but needs explicit product and security design.

**Isolation**
- All existing endpoints already filter by `organizationId` derived from the actor's mapping; this is already enforced.
- Bootstrap creates an unmapped user only; org creation and invite joining are explicit flows.
- Same-email alternate Auth0 provider logins link to the existing user only from verified email token claims. Unverified/body-only email conflicts return `ACCOUNT_LINK_REQUIRED`.
- A user can only belong to **one org** in the current schema (single `organizationId` on `User`). Multi-org membership remains deferred.

**Open questions**
- Do we allow a user to leave an org and join another? What happens to their transaction history?
- Do we need multi-use standing invite links, or is single-use enough for the first production cohort?
- Do we need an "org discovery" page, or is the invite link the only entry point?
- What happens to an org if the owner leaves?

---

## 2. Seasons

### What it is
A mechanism to periodically reset the active leaderboard while preserving all historical data for reporting. Prevents a runaway leader from holding first place indefinitely.

### Current state
Seasons are implemented for the core product flow. `PointTransaction` remains the append-only ledger, and every transaction belongs to a season. The dashboard defaults to the active season, historical seasons can be selected for Overview reporting and the Leaderboard tab, Activity includes season badges, and owners can start or rename seasons from Manage. Season starts are auditable through durable `AuditEvent` rows.

### How it should work

**Season model**
- Implemented `Season` table: `id`, `organizationId`, `name`, `startsAt`, `endsAt`, `isActive`, and creator metadata.
- Each `PointTransaction` has a required `seasonId` foreign key. Transactions written during an active season are tagged automatically.
- Legacy records were backfilled into `Season 0`.

**Starting a new season**
- Owner action: "Start new season".
- Sets the current active season's `endsAt = now()` and `isActive = false`.
- Creates a new `Season` row with `isActive = true`.
- Records a durable `SEASON_STARTED` audit event.
- No points are deleted. The leaderboard simply recomputes from zero because new transactions reference the new season.

**Leaderboard and scoring**
- House standings, member scores, and dashboard summary default to the active season.
- House standings, member scores, and dashboard summary accept an optional `seasonId`.
- The UI can pass a specific season ID to view historical Overview standings, reports, and Leaderboard standings.

**Reporting**
- Implemented season dropdown in Overview.
- Implemented active-season status card in Overview behind `SHOW_SEASON_OVERVIEW_CARD`.
- Implemented Manage season controls.
- Future reporting: winner summary, season detail view, stats per season, and season comparison across houses.

**Edge cases**
- Transactions made before seasons were introduced are backfilled to `Season 0`.
- Overlapping active seasons are prevented by a partial unique database index.
- If an owner forgets to close a season, the season stays active until an owner manually starts the next one. Optional scheduled rollover remains future work.

**Open questions**
- Should Activity gain a season filter in addition to badges?
- Should season starts create user-visible announcements beyond the admin audit timeline?
- Do we need a "season preview" period where the next season is configured before it goes live?
- Should future season boundaries support scheduled calendar cadence?

---

## 3. Dashboard Widgets

### What it is
Replace the current single-view dashboard with a richer landing page composed of focused widgets, giving both members and admins an at-a-glance picture of what's happening.

### Current state
The dashboard has three tabs: Overview, Activity, and Leaderboard. The Overview tab shows house standings plus report widgets for season standout, trait leaders, recent activity, points velocity, and house member rankings. A compact current-season status card also exists, but it is hidden by default and displays only when `SHOW_SEASON_OVERVIEW_CARD="true"` is set on the web service.

### Proposed widgets

**This month's standout** - the member with the most points awarded to them in the current calendar month. Shows name, house colour, and total. Refreshes daily.

**Trait leader per house** - for each house, which trait has been most recognised this month. Visualised as a small bar or icon cluster. Useful for spotting cultural patterns ("Phoenix is leading in Innovation, Ember is leading in Team Support").

**Recent activity strip** - a compact horizontal scroll of the last 5-10 transactions, showing actor -> recipient, delta, and trait pill. Clicking opens the full activity feed.

**Points velocity** - a simple sparkline per house showing points earned per day over the last 14 days. Highlights momentum shifts (a house surging or fading).

**Admin-only: unassigned members** - a warning card showing how many members have not been assigned to a house yet. Links directly to the admin panel.

**Admin-only: audit history** - implemented for point awards and other admin actions. Owners/admins can soft delete an award from the Activity tab, live scoring excludes the deleted transaction, and the Manage Audit tab shows the deletion in the shared audit history.

**Season countdown / summary** - implemented as a feature-flagged current-season status card. It shows days remaining when the active season has an end date, otherwise it explains that admins can close the season from Manage when ready. Historical season winner summaries are implemented on the Overview tab. See [Season Winner Summary](./season-winner-summary.md).

**Season comparison report** - implemented as an Overview reporting widget that compares two seasons inside the current organization. It shows house rank changes, point changes, point velocity, and top contributors without changing the selected dashboard reporting season. See [Season Comparison Report](./season-comparison-report.md).

### Implementation notes
- Most widgets can be computed server-side in parallel on page load using existing `POST` endpoints or new lightweight aggregation endpoints.
- Consider a `GET /dashboard/summary` endpoint that returns all widget data in one round-trip to avoid waterfall fetching.
- Widgets should degrade gracefully: if there are no transactions yet, show an empty state, not an error.
- The layout should be a responsive CSS grid; widgets can be different sizes (some spanning 2 columns) depending on their content density.
- Elevated Manage reporting should expand from the current member/house/unassigned cards into a compact operational view: audit history, invite activity, season changes, unusual point volume, and data cleanup history.
- The Manage tab has been split into focused overview, audit-history, season-management, house-management, and team-management components so future reporting widgets or admin workflows can move into clearer sections without inflating one mixed CRUD/reporting component.
- The Manage tab now has internal Overview, Team, Houses, Seasons, and Audit sections. This keeps current CRUD workflows and the deletion audit available while creating obvious landing spots for future operational widgets. Houses and Seasons remain visible to admins, but are owner-only and disabled for non-owner admins.
- Manage Settings is implemented for owner-only organization display-name changes. Slug changes and broader organization lifecycle controls remain deferred.
- The Team section now uses compact assignment, invite, and owner-only role-management cards. It includes audit-backed invite activity reporting for recent token generation and use.
- The Audit section now uses the persisted `AuditEvent` table as the single source of truth for administrative history. It supports event-type filtering, cursor pagination, and includes point deletion, invite creation/use, season starts, house assignment, and role changes. Legacy fallback rows are still merged into the initial context for older records that predate durable audit events.

**Open questions**
- Do members and admins see the same widgets, or should the layout be role-aware?
- Should widgets be configurable (org owner can pin/unpin them)?
- Is real-time update (polling / websocket) in scope for the activity strip?

---

## 4. Point Adjustments

### What it is
A controlled admin action for deducting points when the product needs a correction. This replaces the earlier theme-specific concept with neutral language that works for any house theme.

### Current state
The product supports positive point awards, soft deletion of mistaken awards, first-class deduction transactions, backend deduction guardrails, an admin/owner dashboard action for deducting points, and Manage Overview reporting for active and historical season deductions by house. The MVP policy is correction-first: no last-place-only eligibility, no direct targeted-member notifications, and no per-organization owner toggle yet. The deduction flow is guarded by `POINT_ADJUSTMENTS_ENABLED`; set it to `"true"` on both the API and web services to expose the feature. The detailed design and phase status live in [Point Adjustments Design](./point-adjustments-design.md).

### Design intent
- Keep the action transparent and auditable.
- Avoid punitive or theme-specific language.
- Preserve the append-only point ledger.
- Add strong guardrails before negative deltas enter the system.

### Proposed MVP language
- Feature name: `Point adjustments`
- Admin action: `Deduct points`
- Transaction type: `DEDUCTION`
- Audit event: `POINTS_DEDUCTED`
- Activity badge: `Deducted`

### How it should work

**Eligibility**
- Only `ADMIN` and `OWNER` users can deduct points.
- The actor and target must belong to the same organization.
- The actor must have a house assignment.
- The target must have a house assignment.
- The target must be in a different house than the actor for the correction-first MVP.
- The deduction applies to the current active season.

**Guards**

| Guard | Rule |
|---|---|
| Cooldown | A house can deduct points at most once per 24 hours. |
| Delta cap | MVP deduction amount is fixed at `-10`. |
| Same-target protection | A member cannot receive more than one deduction in a 24-hour window. |
| Visibility | Every deduction appears in Activity and Audit. |
| Season reset | Cooldowns and reporting are scoped by season. |
| Reason required | The actor must provide a short reason. |

**Schema changes**
- `PointTransaction` gets a `type` enum: `AWARD` (default, existing) | `DEDUCTION`.
- Award transactions require positive `delta`.
- Deduction transactions require negative `delta`.
- Both transaction types require `seasonId`.

**API changes**
- New endpoint `POST /points/deduct`.
- Server derives actor, organization, actor house, target house, active season, and fixed deduction amount.
- Expected failures should return stable typed error codes.

**UI changes**
- Add a `Deduct points` admin action with explicit confirmation copy.
- Activity feed shows deduction rows with a negative delta and `Deducted` badge.
- Audit shows durable `POINTS_DEDUCTED` events.
- Direct user notifications are deferred; Activity and Audit are the MVP visibility surfaces.

**Open questions**
- What production usage threshold would justify direct user notifications for deductions?
- Should owners eventually enable/disable point adjustments per organization?
- Should targets be limited to rival houses only, or can admins correct points inside their own house?
- Should deduction reasons use free text, a fixed list, or both?
