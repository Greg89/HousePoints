# Point Adjustments Design

## Goal

Give admins a controlled way to deduct points when the product needs a correction or comeback mechanic, without making the app feel punitive or locked into a magic theme. The feature should be transparent, audited, season-scoped, and hard to abuse.

## Product Language

- Feature name: `Point adjustments`
- Primary action: `Deduct points`
- Transaction type: `DEDUCTION`
- Audit event: `POINTS_DEDUCTED`
- Activity badge: `Deducted`
- Avoid product names that sound magical, punitive, or theme-specific.

This keeps the app theme-neutral. A company can run House Points with office houses, departments, project squads, or any future house naming system without the deduction feature feeling out of place.

## MVP Rules

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

The original comeback-only concept limited the action to the last-place house. That is still attractive, but it should remain an explicit product decision before implementation. A stricter first version can include last-place eligibility; an operational correction version should not.

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

### Phase 4 - Product Hardening

- Decide whether deductions are org-owner feature-flagged.
- Decide whether last-place-only eligibility is part of production behavior.
- Add reporting for deductions by season and house.
- Consider notification copy for targeted members.

## Open Questions

- Is the MVP an admin correction tool, a last-place comeback mechanic, or both?
- Should owners be able to enable/disable deductions per organization?
- Should deductions require owner approval, or is admin capability enough?
- Should targets be limited to rival houses only, or can admins correct points inside their own house?
- Should deduction reasons use free text, a fixed list, or both?
