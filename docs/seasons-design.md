# Seasons Design Plan

## Purpose

Seasons reset the competitive scoreboard on a planned cadence while preserving every historical point transaction. A new season should feel like a fresh race, not a data deletion.

This design is written against the current codebase, where:

- `PointTransaction` is the append-only ledger.
- House scores, member scores, dashboard widgets, and activity feed all read directly from that ledger.
- There is no transaction taxonomy yet. Hex will need that too, so Seasons should establish the pattern carefully.

## Product Goals

- Keep current scoring simple for daily users: the default dashboard shows the active season.
- Preserve history for reporting: admins can inspect past seasons without changing old records.
- Make season rollover explicit and auditable.
- Avoid surprise point loss. A reset changes the scoreboard scope, not the underlying transactions.
- Build the data model in a way that supports Hex and future reporting.

## Recommended Product Decisions

### Season cadence

Use owner-managed freeform seasons for the first version.

Owners can name a season and start it manually, for example "Q3 2026" or "Summer Sprint". Calendar presets can come later once real usage shows the right cadence.

### Legacy transactions

Backfill existing transactions into an initial season named `Legacy Season` or `Season 0`.

Reason: excluding old transactions from all season views creates confusing gaps in historical reports. Backfilling gives every transaction a season immediately and makes `seasonId` required after migration.

### Active season behavior

Each organization must have exactly one active season.

All new point transactions attach to that active season. If an org somehow has no active season, point awards should fail with a clear server error rather than create unscoped ledger data.

### Who can manage seasons

Only `OWNER` can start a new season in version one.

Admins can award points and manage houses, but season rollover changes the competitive frame for the whole organization. That is owner-level authority.

### Starting the next season

Starting a season should close the current active season and create the new active season in one database transaction.

No manual "end season" action for the first version. It adds states that are easy to misunderstand, such as no active season or an ended season with no replacement.

### Viewing seasons

The dashboard defaults to the active season. A season selector can switch the leaderboard, activity, member scores, and overview widgets to a historical season.

Historical seasons are read-only.

## Data Model

Add a `Season` model:

```prisma
model Season {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  startsAt       DateTime
  endsAt         DateTime?
  isActive       Boolean  @default(false)
  createdById    String?
  createdBy      User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  transactions   PointTransaction[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId, isActive])
  @@index([organizationId, startsAt])
}
```

Add `seasonId` to `PointTransaction`:

```prisma
model PointTransaction {
  seasonId String
  season   Season @relation(fields: [seasonId], references: [id], onDelete: Restrict)

  @@index([organizationId, seasonId, createdAt])
  @@index([targetHouseId, seasonId, createdAt])
  @@index([targetUserId, seasonId, createdAt])
}
```

### Active season uniqueness

Prisma cannot express a partial unique index for "one active season per organization" directly in the schema. Add it in SQL migration:

```sql
CREATE UNIQUE INDEX "Season_one_active_per_org"
ON "Season" ("organizationId")
WHERE "isActive" = true;
```

## Migration Plan

1. Create `Season` table with nullable `PointTransaction.seasonId`.
2. For each organization, create one active legacy season:
   - `name`: `Legacy Season`
   - `startsAt`: earliest transaction `createdAt`, or organization `createdAt` if no transactions exist
   - `endsAt`: null
   - `isActive`: true
3. Backfill every existing `PointTransaction.seasonId` to its organization's legacy season.
4. Alter `PointTransaction.seasonId` to required.
5. Add indexes and active-season partial unique index.

This is safer than creating a nullable permanent field because the application never has to support unscoped transactions after the migration completes.

## Contract Shape

Add shared schemas:

```ts
seasonSchema = {
  id: string,
  name: string,
  startsAt: datetime,
  endsAt: datetime | null,
  isActive: boolean,
}

seasonContextSchema = {
  activeSeason: seasonSchema,
  seasons: seasonSchema[],
}

seasonScopedRequestSchema = {
  seasonId?: string,
}

createSeasonSchema = {
  name: string,
  startsAt?: datetime,
}
```

Rules:

- Missing `seasonId` means active season.
- Supplied `seasonId` must belong to the actor's organization.
- Write endpoints do not accept `seasonId`; they always use the active season.

## API Plan

### New endpoints

`POST /seasons/context`

Returns active season plus historical season list for the actor's organization.

`POST /seasons/start`

Owner-only. Closes the current active season and creates the next active season in one transaction.

Suggested response:

```json
{
  "previousSeason": { "id": "season-1", "name": "Legacy Season", "endsAt": "2026-06-17T12:00:00.000Z" },
  "activeSeason": { "id": "season-2", "name": "Q3 2026", "startsAt": "2026-06-17T12:00:00.000Z" }
}
```

### Updated endpoints

These accept optional `{ seasonId }` and default to active:

- `POST /houses/leaderboard`
- `POST /users/scores`
- `POST /transactions/recent`
- `POST /dashboard/summary`

This endpoint must attach active season automatically:

- `POST /points/adjust`

## Query Rules

Create one shared helper in the API before updating endpoints:

```ts
resolveSeasonScope(actor, requestedSeasonId?)
```

It should:

- Load active season when no `seasonId` is provided.
- Verify requested season belongs to `actor.organizationId`.
- Return `404 SEASON_NOT_FOUND` for unknown or cross-org seasons.
- Return `409 ACTIVE_SEASON_REQUIRED` if no active season exists for default reads or point awards.

All score queries should filter by both `organizationId` and `seasonId`.

## UI Plan

### First UI pass

Add a compact season selector near the overview tab heading:

- Current active season is selected by default.
- Historical seasons appear in the dropdown.
- Selected season scopes overview widgets, house cards, activity, and leaderboard.
- Historical season selection should show a subtle "Historical view" label.

### Management UI

Add an owner-only "Seasons" card under Manage:

- Shows current active season.
- Provides "Start new season".
- Requires season name.
- Uses a confirmation step that explains: "This starts a fresh scoreboard. Existing transactions remain available in history."

## Testing Plan

### Contracts

- Season schemas accept valid season context and start-season responses.
- Season-scoped requests reject caller-supplied organization or actor identity.

### API

- `POST /points/adjust` writes the active `seasonId`.
- Leaderboard defaults to active season.
- Leaderboard with historical `seasonId` returns historical totals.
- Cross-org `seasonId` is rejected.
- Starting a season:
  - requires `OWNER`;
  - closes the previous active season;
  - creates a new active season;
  - is atomic.
- Active season uniqueness is enforced by migration/database.

### Web

- Dashboard loads with active season selected.
- Choosing another season refreshes season-scoped data.
- Owner sees the season management card; admin/member do not.

## Implementation Slices

### Slice 1: Schema and contracts

- Add `Season` model and `PointTransaction.seasonId`.
- Add migration with legacy backfill and active-season unique index.
- Add season schemas and tests.
- Run `db:generate`, typecheck, tests, build.

### Slice 2: API season scope

- Add season scope helper.
- Add `POST /seasons/context`.
- Update `POST /points/adjust` to write active `seasonId`.
- Update leaderboard and member scores to filter by season.
- Add API tests.

### Slice 3: Reporting scope

- Update activity feed and dashboard summary to accept optional `seasonId`.
- Ensure monthly widgets are scoped to both season and calendar month.
- Add API and contract tests.

### Slice 4: Web read path

- Add season context server action.
- Add selected-season state to dashboard shell.
- Wire selected season into dashboard reads.
- Add focused component tests.

### Slice 5: Owner season management

- Add `POST /seasons/start`.
- Add owner-only Manage card.
- Add confirmation and error handling.
- Add API and web tests.

## Open Product Questions

1. What should the initial backfilled season be called in production: `Legacy Season`, `Season 0`, or something friendlier?
2. Should starting a season use the exact current timestamp, or should owners be allowed to schedule a future `startsAt`?
3. Can owners rename a season after creation?
4. Should members see historical seasons immediately, or should historical views be admin/owner-only at first?
5. Should the current dashboard's "This month's standout" remain calendar-month based inside a season, or become "season standout" once seasons exist?

## Recommendation For First Build

Build slices 1 and 2 first. That establishes the data invariant and active-season write behavior without changing the dashboard UI yet.

After that, add read scoping endpoint by endpoint. The app can keep rendering the active season while the backend gains historical capability behind the contracts.
