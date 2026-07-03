# Point Adjustments Design

## Goal

Give admins a controlled way to deduct points when the product needs a correction, without making the app feel punitive or locked into a magic theme. The feature should be transparent, audited, season-scoped, and hard to abuse.

## Product Language

- Feature name: `Point adjustments`
- Primary action: `Deduct points`
- Transaction type: `DEDUCTION`
- Audit event: `POINTS_DEDUCTED`
- Activity badge: `Deducted`
- Avoid product names that sound magical, punitive, or theme-specific.

This keeps the app theme-neutral. A company can run House Points with office houses, departments, project squads, or any future house naming system without the deduction feature feeling out of place.

## MVP Rules

### Product Policy

The MVP is an admin correction tool, not a comeback mechanic. Deductions are available to admins and owners who need to correct or moderate point activity inside a season. The original last-place-only comeback idea remains a possible future game mode, but it should not shape the first production behavior.

Point adjustments are controlled by the environment-level `POINT_ADJUSTMENTS_ENABLED` rollout flag. Per-organization owner controls are deferred until org settings exist and until the feature has enough real usage to justify an in-product toggle.

Activity, Audit, and targeted in-app notifications are the MVP notification surfaces. A targeted member can see deductions in the shared Activity feed and receives a durable warning notification in the account menu. Elevated users can review deductions in Audit. Email notifications remain deferred.

### Eligibility

- Only admins and owners can deduct points.
- The actor must belong to an organization and have a house assignment.
- The target member must belong to the same organization.
- The target member must belong to a different house than the actor.
- The deduction is season-scoped and applies to the current active season.
- The action is unavailable when no active season exists.

### Guardrails

| Guard | Rule |
|---|---|
| Cooldown | A house can deduct points at most once per 24 hours. |
| Delta cap | MVP deduction amount is fixed at `-10`. |
| Same-target protection | A member cannot receive more than one deduction in a 24-hour window. |
| Visibility | Every deduction appears in Activity and Audit. |
| Season reset | Cooldowns and reporting are scoped by season. |
| Reason required | The actor must provide a short reason. |

The MVP does not enforce last-place-only eligibility. That rule would turn the feature into a comeback mechanic, which is intentionally deferred.

## UX

### Admin Entry Point

- Add a `Deduct points` action in Manage or the Award Points flow.
- Keep it visually distinct from awarding points.
- Require target member, reason, and confirmation.
- Show guardrail copy before submit:
  - "Deductions are visible in Activity and Audit."
  - "This house can deduct points once every 24 hours."

### Activity Feed

- Show deductions in the same feed as awards.
- Use negative point copy: `-10`.
- Use a clear `Deducted` badge.
- Include actor, target, target house, reason, season badge, and timestamp.
- Do not hide deductions from regular members.

### Audit

- Record a durable `POINTS_DEDUCTED` audit event.
- Include actor, target member, target house, season, delta, and reason.
- Audit copy: "`{actor}` deducted 10 points from `{target}`."

## Data Model

The current `PointTransaction` ledger should remain the source of truth. Add an explicit transaction type before allowing negative deltas:

- `PointTransaction.type`: `AWARD` | `DEDUCTION`
- `AWARD` transactions require positive `delta`.
- `DEDUCTION` transactions require negative `delta`.
- Both transaction types require `seasonId`.
- Deductions should preserve the same actor, target user, target house, reason, and trait shape where possible.

Trait handling is an open decision. The safest MVP is to make deductions reason-based and omit traits, because positive recognition traits do not naturally map to deductions.

## API Shape

Use a separate endpoint rather than overloading the award endpoint:

- `POST /points/deduct`

Input:

- `targetUserId`
- `reason`

Server-derived:

- actor user and organization from auth
- current active season
- actor house
- target house
- fixed delta `-10`

Expected failures should be typed:

- `ADMIN_REQUIRED`
- `ACTIVE_SEASON_REQUIRED`
- `TARGET_USER_NOT_FOUND`
- `TARGET_USER_UNASSIGNED`
- `ACTOR_HOUSE_REQUIRED`
- `CROSS_ORGANIZATION_TARGET`
- `SAME_HOUSE_TARGET`
- `DEDUCTION_COOLDOWN_ACTIVE`
- `TARGET_DEDUCTION_LIMIT_ACTIVE`

## Implementation Phases

### Phase 0 - Spec

- Create this design doc.
- Rename roadmap references from the earlier concept to point adjustments.
- Decide whether MVP requires last-place eligibility or starts as admin correction/comeback tooling.

Status: implemented. The MVP product policy is correction-first: no last-place-only requirement, environment-level rollout control, and Activity/Audit visibility as the first notification surface.

### Phase 1 - Ledger Taxonomy

- Add `PointTransaction.type`.
- Backfill existing rows to `AWARD`.
- Add database checks for valid delta/type combinations.
- Update contracts and mappers.
- Keep all existing award behavior unchanged.

Status: implemented. Existing awards default to `AWARD`, activity/deleted-point read contracts expose the transaction type, and the database now enforces award-positive plus deduction-negative deltas.

### Phase 2 - API

- Add `POST /points/deduct`.
- Enforce org, role, house, active-season, and cooldown rules.
- Create a `DEDUCTION` point transaction.
- Write a `POINTS_DEDUCTED` audit event.
- Add focused API tests.

Status: implemented. The backend now exposes `POST /points/deduct`, validates the request contract, enforces admin/owner access, actor house assignment, active season, same-organization target, target house assignment, different-house targeting, house-level 24-hour cooldown, and target-member 24-hour protection, then atomically creates a fixed `DEDUCTION` transaction for `-10` points plus a durable `POINTS_DEDUCTED` audit event.

### Phase 3 - UI

- Add admin deduction action.
- Add confirmation and typed error handling.
- Display deductions in Activity, Leaderboard, Overview, and Audit.
- Add component tests.

Status: implemented. Admins and owners have a dashboard `Deduct Points` action that targets members from another house, requires a reason, shows an explicit confirmation step, calls `POST /points/deduct`, surfaces cooldown and target-protection failures as safe user-facing messages, and refreshes the dashboard after success. Activity rows label deductions with negative point values and a visible `Deducted` badge, while the existing leaderboard, overview, and audit views reflect deduction transactions through the shared ledger and audit stream.

### Phase 4 - Product Hardening

- Gate deductions behind the environment-level `POINT_ADJUSTMENTS_ENABLED` rollout flag.
- Defer last-place-only eligibility unless point adjustments later become a dedicated comeback mechanic.
- Add Manage Overview reporting for active-season deductions by house.
- Add Manage Overview historical reporting for deductions by season and house.
- Treat Activity, Audit, and targeted in-app notifications as the MVP notification surfaces.
- Notify the targeted member when a deduction is created.

Status: in progress. Point adjustments are now globally gated by `POINT_ADJUSTMENTS_ENABLED` on both the API and web services. When the flag is off, the web app hides the admin/owner `Deduct Points` action and the API returns the typed `POINT_ADJUSTMENTS_DISABLED` response from `POST /points/deduct`. Manage Overview now includes a reporting-season selector for deduction totals and by-house reporting; it defaults to the active season and can load historical seasons through `POST /admin/point-adjustments/stats`. The MVP is explicitly correction-first, without last-place-only eligibility. Deduction transactions now create targeted `POINT_DEDUCTION_RECEIVED` warning notifications for the deducted member. Comeback mechanics, per-organization owner controls, email notifications, and deeper season-comparison analytics remain future product decisions.

## Open Questions

- Should owners eventually be able to enable/disable point adjustments per organization?
- Should deductions require owner approval, or is admin capability enough?
- Should targets be limited to rival houses only, or can admins correct points inside their own house?
- Should deduction reasons use free text, a fixed list, or both?
