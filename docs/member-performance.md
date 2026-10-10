# Member performance overview

## Mobile behavior

Long press the Home season standout card or a Leaderboard contributor row to open
`/member/[memberId]`. Both use the same `MemberDetailsLink`, 350 ms threshold,
best-effort haptics, and screen-reader activation action.

The current-season view shows net/awarded/deducted points, award and deduction
counts, recognition breakdown, 14-day daily net points, contributions by recorded
house, and the latest eight transactions. It supports pull to refresh and typed
errors. Cached content survives transient failures but is hidden on access-denied
or not-found responses. IDs, not display names, identify members.

## Shared resources for web

- `POST /members/performance` accepts `{ memberId, seasonId? }`. Omitting season
  selects the current season. Organization scope comes from authenticated
  membership, never the request body.
- `memberPerformanceRequestSchema`, `memberPerformanceSchema`, and
  `MemberPerformance` are exported by `@housepoints/contracts` and registered in
  the typed API contract registry. A future web page can call this endpoint
  through the existing web API client.
- `topContributors` and `selectMemberOverview` are shared pure functions in
  contracts. Both mobile leaderboard ranks and member detail ranks use the same
  positive-score/current-member competition ranking, including tied ranks and
  totals across house moves. Former members and nonpositive totals are unranked;
  their report can still show historical contributions.
- The API shares access checks, scope validation, totals, transaction selection,
  and row mapping with the web's paginated report service. This bounded overview
  does not depend on report cursors or `REPORT_CURSOR_SECRET`.
- Rendering remains native on mobile. Web can reuse the complete data contract,
  server calculation, and selection functions without importing React Native.
  A web details UI is a follow-up, not part of this mobile slice.

## Data semantics and access

All reads require a current, active membership in an available organization and
run in one repeatable-read transaction. The requested person must have a
membership or recorded transaction association with that organization. Soft-
deleted transactions are excluded. Full-season totals are not calculated from
the limited recent-activity list.

Recognition totals include legacy traits and archived categories; category IDs
remain distinct even when labels match. Deductions are separate from recognition.
Daily totals use UTC dates, include deductions, and fill days without activity
with zero. Historical seasons end their trend on the season's last day.

House contributions retain the transaction's recorded house, so a house move
does not transfer historical points. Dashboard-based rank/contributions and the
performance response are independently refreshed snapshots.

## Cache and rollout

Member performance query keys include organization slug, member ID, and season ID.
Point, membership, and profile changes invalidate the member-performance family
only within the affected organization. Foreground, reconnect, focus, and manual
refresh use the standard mobile refresh policy.

Deploy the API change before installing/testing the new mobile preview. This
slice adds no environment variables, secrets, migrations, or native dependencies.
The earlier haptics change still requires a native preview build.

Verification on device: open the same person from standout and leaderboard,
check haptics/back navigation, compare totals with their report, pull to refresh
after an award/deduction, and confirm organization switching changes the scope.
