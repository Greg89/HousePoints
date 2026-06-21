# Upcoming Features - Brainstorm

High-level definitions and open design questions for the next wave of features.
These are not scheduled. Treat this as a living document to refine before work starts.

---

## 1. Org Management & Self-Serve Signup

### What it is
Allow any user to create their own organisation, configure houses within it, and invite team members, removing the dependency on a developer to bootstrap an org manually.

### Current state
The `Organization` model exists and every entity is scoped to it. Self-serve organization creation is implemented for authenticated users: a creator provides organization details plus a first house, becomes `OWNER`, and is assigned to that house atomically. Admin/owner invite links are implemented as single-use tokens, and invite consumption is atomic and concurrency-safe. The API derives actor identity from verified Auth0 credentials and supports multiple Auth0 provider subjects per internal user through `AuthIdentity`.

Still deferred: org settings, org deletion, ownership transfer, admin removal rules, domain allow-list joining, and true multi-org membership.

### How it should work

**Org creation**
- Implemented as a post-login onboarding flow.
- The user who creates the org becomes the first `OWNER`.
- They set org name, slug, first house name, and first house color.
- Additional org settings and ownership-management screens are deferred.

**Roles**
- `OWNER` exists.
- `OWNER` and `ADMIN` can manage houses, assign members, create invites, and manage seasons.
- Org deletion, ownership transfer, and admin-removal rules are not implemented yet.
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
Seasons are implemented for the core product flow. `PointTransaction` remains the append-only ledger, and every transaction belongs to a season. The dashboard defaults to the active season, historical seasons can be selected for Overview reporting and the Leaderboard tab, Activity includes season badges, and owners/admins can start or rename seasons from Manage. Season starts are auditable through durable `AuditEvent` rows.

### How it should work

**Season model**
- Implemented `Season` table: `id`, `organizationId`, `name`, `startsAt`, `endsAt`, `isActive`, and creator metadata.
- Each `PointTransaction` has a required `seasonId` foreign key. Transactions written during an active season are tagged automatically.
- Legacy records were backfilled into `Season 0`.

**Starting a new season**
- Owner/admin action: "Start new season".
- Sets the current active season's `endsAt = now()` and `isActive = false`.
- Creates a new `Season` row with `isActive = true`.
- Records a durable `SEASON_STARTED` audit event.
- No points are deleted. The leaderboard simply recomputes from zero because new transactions reference the new season.

**Leaderboard and scoring**
- House standings default to the active season.
- Member scores and dashboard summary accept an optional `seasonId` and default to the current active season.
- The UI can pass a specific season ID to view historical Overview reports and Leaderboard standings.

**Reporting**
- Implemented season dropdown in Overview.
- Implemented active-season status card in Overview behind `SHOW_SEASON_OVERVIEW_CARD`.
- Implemented Manage season controls.
- Future reporting: winner summary, season detail view, stats per season, and season comparison across houses.

**Edge cases**
- Transactions made before seasons were introduced are backfilled to `Season 0`.
- Overlapping active seasons are prevented by a partial unique database index.
- If an admin forgets to close a season, the season stays active until an owner/admin manually starts the next one. Optional scheduled rollover remains future work.

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

**Admin-only: recent deletions** - implemented for point awards. Owners/admins can soft delete an award from the Activity tab, live scoring excludes the deleted transaction, and the Manage tab shows a recent deletion audit.

**Season countdown / summary** - implemented as a feature-flagged current-season status card. It shows days remaining when the active season has an end date, otherwise it explains that admins can close the season from Manage when ready. Winner summary remains future work.

### Implementation notes
- Most widgets can be computed server-side in parallel on page load using existing `POST` endpoints or new lightweight aggregation endpoints.
- Consider a `GET /dashboard/summary` endpoint that returns all widget data in one round-trip to avoid waterfall fetching.
- Widgets should degrade gracefully: if there are no transactions yet, show an empty state, not an error.
- The layout should be a responsive CSS grid; widgets can be different sizes (some spanning 2 columns) depending on their content density.
- Elevated Manage reporting should expand from the current member/house/unassigned/deletion cards into a compact operational view: recent admin actions, invite activity, season changes, unusual point volume, and data cleanup history.
- The Manage tab has been split into focused overview, deleted-points reporting, season-management, house-management, and team-management components so future reporting widgets or admin workflows can move into clearer sections without inflating one mixed CRUD/reporting component.
- The Manage tab now has internal Overview, Team, Houses, Seasons, and Audit sections. This keeps current CRUD workflows and the deletion audit available while creating obvious landing spots for future operational widgets.
- The Team section now uses compact assignment/invite cards and includes audit-backed invite activity reporting for recent token generation and use.
- The Audit section now includes a recent admin-actions timeline backed by persisted app data. The dedicated `AuditEvent` table now records the current admin timeline event types: house assignment, point deletion, invite creation/use, and season starts. Legacy fallback rows are still merged for older records that predate durable audit events.

**Open questions**
- Do members and admins see the same widgets, or should the layout be role-aware?
- Should widgets be configurable (org owner can pin/unpin them)?
- Is real-time update (polling / websocket) in scope for the activity strip?

---

## 4. The Hex

### What it is
A limited, high-stakes ability for the house currently in **last place** to hex members of rival houses, temporarily reducing their points. Adds strategic tension and a comeback mechanic.

### Design intent
- Last place should feel hard but not hopeless. The Hex is a pressure valve.
- It should be memorable and fun, not punishing or toxic. The guards are as important as the ability itself.

### How it should work

**Eligibility**
- Only the house ranked **last** on the current leaderboard (at the moment of casting) can initiate a Hex.
- Any `ADMIN` member of the last-place house can cast a Hex on behalf of their house.
- Regular `MEMBER`s cannot cast Hexes; admin gate prevents griefing.

**The Hex action**
- Admin selects a target member from a **different** house (not their own).
- Selects a Hex Trait from a dedicated Hex Trait list (see below).
- Optionally adds a note.
- The system creates a `PointTransaction` with a **negative delta** (e.g. -5 to -15) and a `type: HEX` discriminator.
- The target's house score decreases; their personal score decreases.

**Hex Trait list** (distinct from the positive Trait list)
The Hex Traits name the *failure mode* being hexed, keeping it professional rather than personal:

- Missed Deadline
- Scope Creep
- Overcommunication
- Analysis Paralysis
- Knowledge Hoarding
- Dropped the Ball
- Meeting Overrun
- Reinvented the Wheel
- Ignored the Process
- Radio Silence

These are light-hearted work antipatterns, not personal attacks. The list is intentionally short and fixed; no custom Hex reasons.

**Guards against overuse**

| Guard | Rule |
|---|---|
| Cooldown | A house can cast at most **1 Hex per 24 hours** |
| Ceiling | A house loses the Hex ability once they are no longer last place |
| Delta cap | Hex delta is fixed at -10 (not configurable) to prevent stacking abuse |
| Self-protection | A member cannot be hexed twice in the same 24-hour window |
| Audit trail | Every Hex is fully visible in the activity feed with a Hex badge; no hidden transactions |
| Season reset | Hex counts reset with each season |

**Schema changes**
- `PointTransaction` gets a `type` enum: `AWARD` (default, existing) | `HEX`.
- Hex transactions always have a negative `delta`. Award transactions always have a positive `delta`. Enforce at the DB and API validation layer.
- Hex cooldown tracked via a query: `COUNT(*) WHERE type = HEX AND actorHouseId = X AND createdAt > now() - 24h`.

**API changes**
- New endpoint `POST /hex/cast` (separate from `POST /points/adjust`) to make the distinction explicit and allow different validation logic.
- Returns `429` with a meaningful message if the cooldown or eligibility guard fires.

**UI changes**
- A "Cast Hex" button appears in the admin panel **only** when the admin's house is in last place.
- The button is hidden (not just disabled) when the house is not last; this keeps the surprise.
- Activity feed shows Hex transactions with a distinct visual treatment (red delta, Hex icon, Hex Trait pill in a different colour).

**Open questions**
- Should hexed members be notified in-app?
- Should the Hex ability be opt-in per org (org owner enables it in settings)?
- What happens on a tie for last place; do both houses get the Hex?
- Is a -10 fixed delta the right balance, or should it scale with the points gap?
- Should there be a "counter-hex" or defensive ability for houses in the lead?
