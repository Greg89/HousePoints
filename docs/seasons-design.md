# Seasons Architecture

Last updated: June 21, 2026

## Purpose

Seasons reset the competitive scoreboard while preserving every historical point transaction. A new season should feel like a fresh race, not a data deletion.

The current implementation treats `PointTransaction` as the append-only ledger. Season changes alter which ledger rows are included in current scoring; they do not delete or rewrite point history.

## Current State

The first seasons implementation is complete:

- Every organization has exactly one active season.
- Existing point transactions were backfilled into an initial `Season 0`.
- New point awards attach to the active season automatically.
- House standings and member scores default to the active season.
- Overview reporting widgets and the Leaderboard tab can be scoped to historical seasons.
- The Activity tab remains all-activity by default and includes season badges on each item.
- Owners can start a new season and rename seasons from Manage. Admins can see the Seasons Manage section, but it is disabled unless they are an owner.
- Season starts are written to the durable `AuditEvent` table as `SEASON_STARTED`.
- The Overview tab has a current-season status card with the active season name, start date, and either days remaining or a no-end-date management hint. The card is hidden by default and displays only when the web service sets `SHOW_SEASON_OVERVIEW_CARD="true"`.

## Product Decisions

### Season Cadence

The first version uses owner-managed freeform seasons.

Owners can name and start a season manually, for example `Q3 2026` or `Summer Sprint`. Calendar presets and scheduled seasons can come later once real usage shows the right cadence.

### Legacy Transactions

Legacy transactions were backfilled into `Season 0`.

This avoids confusing historical gaps and means the application does not need to support permanent unscoped point transactions.

### Active Season Behavior

Each organization must have exactly one active season.

If an organization somehow has no active season, active-season reads and point awards fail with a clear expected error instead of creating unscoped ledger data.

### Season Management

`OWNER` users can start and rename seasons.

Starting a season is immediate. It closes the previous active season, creates the new active season, and records the rollover in the admin audit timeline. Renaming a season changes display metadata only; it does not change transactions, membership, dates, or scores.

There is no standalone "end season" action in version one. That avoids confusing no-active-season states.

### Historical Viewing

Historical seasons are visible to all authenticated org members.

The dashboard defaults to the active season. The Overview season selector can switch reporting widgets and the Leaderboard tab to a historical season. House cards remain active-season standings so the top-level competitive state stays consistent. Activity remains all-activity and uses season badges for context.

## Data Model

The implemented `Season` model stores organization scope, display name, start/end timestamps, active status, and creator:

```prisma
model Season {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  startsAt       DateTime
  endsAt         DateTime?
  isActive       Boolean  @default(false)
  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

`PointTransaction.seasonId` is required and restricted on delete, preserving ledger integrity:

```prisma
model PointTransaction {
  seasonId String
  season   Season @relation(fields: [seasonId], references: [id], onDelete: Restrict)
}
```

The database enforces one active season per organization through a partial unique index:

```sql
CREATE UNIQUE INDEX "Season_one_active_per_org"
ON "Season" ("organizationId")
WHERE "isActive" = true;
```

## Contract Surface

Shared contracts live in `packages/contracts` and cover:

- `seasonSchema`
- `seasonContextSchema`
- `seasonScopedRequestSchema`
- `createSeasonSchema`
- `renameSeasonSchema`
- `seasonTransitionSchema`

Rules:

- Missing `seasonId` means the active season.
- Supplied `seasonId` must belong to the actor's organization.
- Point-award writes do not accept a caller-provided `seasonId`; they always use the active season.
- Season start input accepts only a name in version one.

## API Surface

Implemented season endpoints:

- `POST /seasons/context` returns active season plus the organization's season list.
- `POST /seasons/start` closes the current active season and creates the new active season in one transaction.
- `POST /seasons/rename` renames a season in the actor's organization.

Season-aware endpoints:

- `POST /points/adjust` writes the active `seasonId`.
- `POST /houses/leaderboard` reads active-season house standings.
- `POST /users/scores` accepts optional `{ seasonId }` and defaults to active.
- `POST /dashboard/summary` accepts optional `{ seasonId }` and defaults to active.
- `POST /transactions/recent` returns all activity by default and includes season badge metadata.

The API uses `resolveSeasonScope(actor, requestedSeasonId?)` to centralize active-season lookup, cross-org protection, and expected errors:

- `404 SEASON_NOT_FOUND` for unknown or cross-org season IDs.
- `409 ACTIVE_SEASON_REQUIRED` when an active season is required but missing.

## Web Surface

The dashboard implements the first season UX pass:

- Overview shows a season selector.
- The selected season scopes Overview reporting widgets and the Leaderboard tab.
- Historical selection shows a subtle historical-view label.
- Activity items show season badges.
- Manage includes season start and rename controls for owners. Admins still see the Seasons tab, but it is disabled and labelled owner-only.
- Overview includes a feature-flagged current-season status card showing days remaining when `endsAt` exists, or a management hint when no end date is set.

## Testing Coverage

Current coverage includes:

- Contract tests for season schemas and API contract mappings.
- `resolveSeasonScope` unit tests.
- Fastify route tests for season context, start, rename, season-scoped scores, dashboard summary, activity badges, and cross-org season rejection.
- Web action tests for season actions.
- Dashboard component tests for active selection, historical selection, leaderboard refresh, activity navigation, and hidden/enabled current-season status.
- Database-backed integration tests covering season foreign-key behavior and audit-event storage.

## Completed Implementation Slices

1. [done] Schema and contracts
2. [done] API season scope
3. [done] Reporting scope
4. [done] Web read path
5. [done] Owner-only season management
6. [done] Durable audit event for season starts
7. [done] Feature-flagged current-season status card on Overview

## Future Season UX

These are optional next slices, not blockers for the current production-ready season foundation:

1. Activity season filter: decide whether Activity should stay all-activity only or allow filtering by season.
2. Season winner summary: show winner and key stats for recently ended seasons.
3. Season comparison report: compare house ranking, point velocity, and top contributors across seasons.
4. Season detail page or modal: provide a focused historical report without overloading the dashboard.
5. Scheduled seasons: support planned starts or automatic rollovers if real usage needs calendar-based cadence.
6. Notifications: decide whether season starts should create user-visible announcements beyond the admin audit trail.

## Remaining Product Questions

1. Should season names remain unique forever inside an organization, or should closed seasons be allowed to share names after rename?
2. Should Activity eventually gain a season filter in addition to badges, or stay all-activity only?
3. Should season start create an announcement-style activity item, or is the management audit trail enough?
4. Do future scheduled seasons need owner-configurable cadence presets, or is manual rollover enough?
