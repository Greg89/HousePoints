# Season Winner Summary

## Product Intent

Give a closed season a clear recap moment without changing scoring rules or season management.

The recap answers:

1. Which house won the season?
2. Who contributed the most points?
3. How much activity happened during the season?

## MVP Scope

- Show the recap only for historical seasons.
- Surface it on the Overview tab when a user selects a closed season.
- Keep it organization-scoped and read-only for all authenticated members.
- Include:
  - winning house by final points;
  - top contributor by received points;
  - total transactions;
  - award count and awarded points;
  - deduction count and deducted points;
  - season date range.

Out of scope:

- permanent winner snapshots;
- ceremony or animation;
- export/share;
- scheduled season rollover;
- tie-break configuration.

## Data Rules

- Use `PointTransaction` rows for the selected season where `deletedAt` is null.
- Include both awards and deductions in final house totals.
- Winning house is highest final point total.
- Ties sort by house name ascending for stable display.
- Top contributor is the user with the highest received point total in the selected season.
- Active seasons return `null` for the recap. They are still in progress.

## Implementation Status

1. [done] Shared contract field on `DashboardSummary`.
2. [done] API summary computation for closed seasons.
3. [done] Overview recap card for historical season selection.
4. [done] Contract, API, and UI regression coverage.
