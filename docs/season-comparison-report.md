# Season Comparison Report

## Product Intent

Give members a clear way to compare how houses performed across seasons without turning the main Overview into a dense analytics page.

The report should answer three questions:

1. Which houses improved or declined compared with another season?
2. Which houses had the strongest point velocity in each season?
3. Which members contributed most to a house's result in each season?

This is a reporting feature only. It does not change season management, point-award behavior, or historical ledger data.

## Access And Placement

- All authenticated organization members can view season comparisons.
- Owners still own season start and rename actions.
- Admins still own day-to-day points and member workflows.
- The first UI entry point should live in the Overview tab near the season selector/report widgets.
- Do not add this to Manage for the first slice. Manage should stay operational; Overview should become the reporting surface.

## MVP Scope

The first implementation should compare two seasons inside the current organization:

- Baseline season: selected historical season.
- Comparison season: defaults to the active season, but can be changed to any other season.
- House comparison rows for every house in the organization.
- Per-house metrics:
  - total points;
  - rank;
  - rank change;
  - point change;
  - award count;
  - average points per active day;
  - top contributor by received points.
- Empty-state handling for seasons with no transactions.

Out of scope for MVP:

- scheduled seasons;
- winner ceremony/snapshot;
- CSV export;
- cross-organization comparisons;
- member-level drilldown beyond top contributor;
- charts that require a visualization library.

## UX Shape

Use a compact comparison card below the existing Overview reporting widgets:

- Header: `Compare seasons`
- Controls:
  - `From` season select.
  - `To` season select.
  - Disable comparing a season to itself, or show a small inline hint if both are selected.
- Summary strip:
  - biggest house gain;
  - biggest rank climb;
  - most consistent house, defined as smallest absolute point change with activity in both seasons.
- Table/list:
  - House name and color dot.
  - From points/rank.
  - To points/rank.
  - Delta badge.
  - Velocity label.
  - Top contributor.

On mobile, render each row as a stacked card instead of a wide table.

## Data Rules

- Only include `PointTransaction` rows where:
  - `organizationId` matches the actor organization;
  - `seasonId` is one of the selected seasons;
  - `deletedAt` is null.
- Include both awards and deductions in point totals.
- Award count should count point transactions, regardless of positive or deduction type. If we later need separate counts, add `awardCount` and `deductionCount`.
- Rank is ordered by total points descending. Ties should use house name ascending for stable display.
- Active days:
  - Use the season's `startsAt` and `endsAt` when available.
  - For an active season with no `endsAt`, use current server time.
  - Minimum active-day divisor is `1` to avoid divide-by-zero.
- Top contributor means the user in that house with the highest received point total for that season.
- If a house has no transactions in a season, its points are `0`, rank is still computed, velocity is `0`, and top contributor is null.

## API Contract

Add a focused endpoint rather than overloading `POST /dashboard/summary`:

`POST /seasons/compare`

Request:

```json
{
  "fromSeasonId": "season-0",
  "toSeasonId": "season-active"
}
```

Response:

```json
{
  "fromSeason": {
    "id": "season-0",
    "name": "Season 0",
    "startsAt": "2026-06-01T00:00:00.000Z",
    "endsAt": "2026-06-15T00:00:00.000Z",
    "isActive": false
  },
  "toSeason": {
    "id": "season-active",
    "name": "Q3 2026",
    "startsAt": "2026-06-15T00:00:00.000Z",
    "endsAt": null,
    "isActive": true
  },
  "houses": [
    {
      "houseId": "house-1",
      "houseName": "Slytherin",
      "houseColor": "#22c55e",
      "from": {
        "rank": 2,
        "points": 120,
        "transactions": 8,
        "averagePointsPerDay": 8,
        "topContributor": {
          "userId": "user-1",
          "displayName": "Gregory Dodson",
          "points": 75
        }
      },
      "to": {
        "rank": 1,
        "points": 180,
        "transactions": 11,
        "averagePointsPerDay": 12,
        "topContributor": {
          "userId": "user-2",
          "displayName": "Caitlin Swanson",
          "points": 100
        }
      },
      "delta": {
        "rankChange": 1,
        "pointChange": 60,
        "averagePointsPerDayChange": 4
      }
    }
  ]
}
```

Contract schemas should live in `@housepoints/contracts` with runtime parsing in the web client.

## API Behavior

- Authenticate with the existing actor flow.
- Validate both seasons belong to the actor's organization.
- Return `404 SEASON_NOT_FOUND` if either season is missing or cross-org.
- Return `400 VALIDATION_ERROR` when the two IDs are the same.
- Log `seasons.compare.loaded` with organization ID, both season IDs, and house count.
- Keep the query implementation set-based:
  - fetch houses once;
  - fetch selected seasons once;
  - group point totals by `seasonId` and `targetHouseId`;
  - group top contributors by `seasonId`, `targetHouseId`, and `targetUserId`;
  - assemble and rank in memory.

## Web Behavior

- Fetch comparison data from a Server Action.
- Keep the selected comparison pair in client component state.
- Do not change the dashboard's selected reporting season when users adjust comparison controls.
- Show a loading state on comparison changes.
- Show an empty state when both selected seasons have no point activity.
- Show a safe error toast if the comparison request fails.

## Testing Plan

Contracts:

- request validation rejects identical season IDs;
- response schema accepts null top contributors and active-season `endsAt: null`;
- response schema rejects missing house deltas.

API:

- compares two same-org seasons and computes rank/point/velocity deltas;
- includes houses with zero transactions;
- rejects cross-org season IDs;
- rejects identical season IDs;
- excludes soft-deleted transactions;
- includes deductions in totals.

Web:

- renders comparison controls and default active-vs-previous selection;
- loads a new comparison when a select changes;
- shows positive, negative, and flat deltas clearly;
- handles no-activity empty state;
- handles expected API failure with a toast.

## Recommended Slices

1. Contracts and API endpoint with route tests.
2. Web Server Action and focused component with unit tests.
3. Overview integration and responsive polish.
4. Optional performance check with a larger fixture once real data volume grows.
