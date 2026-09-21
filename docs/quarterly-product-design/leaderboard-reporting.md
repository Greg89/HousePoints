# Leaderboard drill-through reporting

Status: proposed reporting design. D1 (category lifecycle), D2 (audited historical corrections with a required reason), D3 (transaction-time house attribution), and D4 (shared ranks and co-winners for this release) are approved in [the design overview](./README.md).

## Current foundation

The app has house standings, top member scores, activity pagination, overview widgets, and season comparisons. `loadLeaderboard` and `loadDashboardSummaryData` live in `apps/api/src/routes/dashboard.ts`; activity contracts live in `point-schemas.ts`. Some current member reporting filters to active membership. House totals use transaction house IDs, so simply reusing current-member lists will not explain every historical total.

## User journey

From a season's house standings, select a house to see its net points, awards, deductions, recipient contributions, category breakdown, and matching activity. Select a member contribution to inspect the awards/deductions behind it. A member view can show all houses they contributed to during the selected season, with the originating house filter preserved when navigating from a house.

Selecting a category or giver narrows the details. Breadcrumbs and back navigation retain organization, season, house, member, category, giver, and transaction-type context. Filtered subtotals are labeled separately from the full season score. No control silently switches to the active season.

Use authenticated, shareable URL state. Proposed web entry is `/o/{slug}/reports`, with typed query parameters for the selected view and IDs. Resolve aliases and authorize every read. A copied URL grants no access. Load report detail on demand instead of adding it to initial dashboard loading.

Approved September 20, 2026 (D9): web is the first rich reporting surface. Mobile continues to show correct totals/category labels and can open an authenticated web report; native drill-through is a follow-up, not a reason to ship incompatible mobile reads.

## Metric contract

| Metric | Definition |
|---|---|
| Net points | Sum of deltas on non-deleted transactions matching the scope |
| Awarded points/count | Sum of positive award deltas / count of award transactions |
| Deducted points/count | Positive magnitude of deduction deltas / count of deduction transactions |
| Member contribution | Received net points in the selected scope, not points the member gave |
| Recognitions given | Award count attributed to the actor; separate from received score |
| Category points/count | Award points/count grouped by category ID; deductions are a separate uncategorized adjustment subtotal |
| Rank | Shared competition rank by net points; stable name then ID ordering inside a tie |

Approved historical-results policy: closed-season corrections require a reason and audit trail and update standings, including winners. Reports disclose corrections rather than presenting closed results as immutable.

Within the same scope, `net = awarded - deducted`. Category award totals minus the separate deduction total reconcile to net. House member contributions include former members and an unattributed/anonymized bucket where recipient identity is unavailable, so their sum still matches the house total. Negative and zero scores remain visible in complete reports even if compact dashboard widgets omit them.

Approved September 20, 2026: use `PointTransaction.targetHouseId`, not the recipient's current house. A member who earns 20 points in A and 10 in B contributes 20 to A and 10 to B; their season total is 30. Leaving the organization must not remove those contributions. Former members do not gain access to reports by remaining in historical data.

Approved September 20, 2026 for this release: equal scores share competition rank (1, 1, 3) in both house and member rankings, and tied highest scores are co-winners. Alphabetical ordering, then stable ID, only orders tied rows; it does not declare a winner. More elaborate tiebreakers are deferred. If there are no transactions, display no winner. If transactions exist and totals tie at zero or below, label the tied highest score accurately.

Participation rates and historical headcount-normalized metrics are deferred until membership history supports a defensible denominator. Do not divide historical participation by today's membership and label it a historical rate.

## Query consistency and API

Introduce a shared typed report-scope schema and query service consumed by standings, detail, and recap. New operations may follow existing POST read conventions; endpoint names are finalized when slicing. Inputs include explicit season ID, optional dimension IDs/type, and bounded page size/cursor. Dates, if added later, need explicit timezone and half-open interval rules.

Summary and the first page of detail are read from one consistent database snapshot. Maintain an organization reporting revision advanced atomically with score-affecting writes/deletions; return it with results and bind pagination cursors to scope and revision. If the revision changes while paging, return a typed refresh-required response rather than silently mixing totals/pages. A timestamp alone is not snapshot consistency. Cross-org and altered cursors are rejected.

Ensure mutations and migration/backfill paths all maintain the revision before readers depend on it. Profile the revision update's contention at expected write volumes. Optimize its granularity only if evidence warrants it.

Use aggregate queries and stable cursor ordering, not one query per row. Existing organization/season indexes are a starting point; query plans and realistic data determine additions. No shared personalized cache without explicit scope and invalidation rules.

Approved September 20, 2026: all current organization members may view standings drill-through, including contributing awards, recipients, givers, categories, and reasons, consistent with existing Activity visibility and access restrictions. Deleted-record evidence and administrative audit details remain admin/owner-only. Former members lose report access, while their historical contributions remain reportable. Revalidate organization access on every report request; membership appearing in historical data never grants access. Deleted rows are excluded from normal reports; administrative audit retains deletion evidence. CSV export, saved filters, and public sharing are outside the first release.

## Acceptance

- Complete paginated details and all breakdowns reconcile with the same-revision summary.
- Cover awards, deductions, deletions, no activity, tied/negative scores, archived/replacement categories (including separate identities with reused names), house moves, removed members, and anonymized recipients.
- A concurrent award/correction causes a clean refresh path, with no duplicates or silently mixed revisions.
- Cross-org IDs and stale access are rejected at every detail endpoint.
- Browser back/forward and shared links preserve filters; reports load independently of hidden dashboard tabs.
- Record query count, payload size, and response-time baselines using realistic season sizes before rollout.
