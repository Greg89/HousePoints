# Season kickoff and reporting

Status: proposed. Extends [implemented seasons](../seasons-design.md), [winner summary](../season-winner-summary.md), and [comparison](../season-comparison-report.md). D2 (closed-season corrections with required reason and audit trail), D3 (transaction-time house attribution), and D4 (shared ranks and co-winners for this release) are approved September 20, 2026; D5 (manual rollover with informational planned dates and no background season-transition service) is also approved September 20, 2026. Other implementation details remain proposed.

## Current foundation and intended change

Today an owner supplies a name and immediately starts a new season, atomically closing the previous one. Exactly one active season is the application invariant; the database partial unique index enforces at most one. Historical recaps and comparisons already exist. There is no planned-season workflow, independent closing action, or scheduler.

Approved September 20, 2026: keep manual rollover through a prepare/review/kickoff flow. Starting the next season closes the previous season in the same operation. Planned dates are informational only; passing a planned end does not stop awards. There is no background service for closing or starting seasons. Do not introduce a no-active-season state in this release.

## Delivery scope

Approved September 20, 2026 (D9): season planning and richer management ship on web first. Mobile season information and compatible reads ship alongside backend changes; richer native reporting and management follow later.

## Owner workflow

1. **Prepare:** create or edit one next-season plan containing name, optional kickoff message, optional intended start and end, and an IANA organization timezone. Show a readiness summary: active recognition categories, houses, unassigned members, and the current season that will close.
2. **Review:** preview the announcement and explain that existing points remain in the old season while new awards begin at zero in the successor. Planned dates are expectations, not automation. Warn about unassigned members without blocking kickoff; invalid dates or no active category are blocking errors.
3. **Kick off now:** owner confirms the current season and successor. Recheck permissions, expected active-season ID, plan version, category readiness, and future entitlement eligibility. Close the old season and create the new season at one server timestamp in one transaction.
4. **Communicate:** persist the kickoff announcement and the previous season's recap notification transactionally. Deliver push after commit through a bounded or durable dispatch mechanism. Link recipients to the correct organization and season.
5. **Review results:** select any historical season to see standings, co-winners, counts, awarded/deducted/net points, recipient contributions, category breakdown, and comparison links. Drill-through uses exactly the reporting rules in [leaderboard reporting](./leaderboard-reporting.md).

Admins can inspect plans and reports but cannot edit or start seasons. Members can see the active season context and permitted historical reports. The kickoff message is optional plain text with a proposed 500-character limit.

## State and data

Use a separate organization-scoped `SeasonPlan` for the next season rather than forcing drafts into existing `Season` contracts that require `startsAt`. Proposed fields: organization ID (unique), name, kickoff message, planned start/end instants, timezone, version, creator/updater, timestamps. Discarding a draft is an audited configuration operation; it does not delete a real season or ledger history.

Add planned end and timezone metadata to actual seasons as needed. Keep existing `startsAt` and `endsAt` as actual boundaries. A missed planned end displays "Past planned end; awaiting next kickoff" and continues accepting awards. It must not silently close or pretend the actual end occurred.

The UI displays local dates with timezone labels; persistence uses UTC instants. Reject nonexistent daylight-saving local times and require explicit resolution of ambiguous times. Actual kickoff time remains server-controlled. Historical comparisons use actual elapsed time, not the intended schedule. Define points-per-day as net points divided by elapsed 24-hour periods, with a minimum denominator of one; label this consistently.

Support editing a plan, discarding it, renaming a season, and updating an active season's planned end with audit records. No backdated actual boundaries, historical award insertion, standalone close, reopen, automatic recurrence, or automatic kickoff in the first release.

## Atomic transition and award boundary

Kickoff input includes an idempotency key, expected active-season ID, and expected plan version. The retry of a successful kickoff returns the same transition and does not send duplicate announcements. A conflicting kickoff or changed plan returns a typed conflict with a refresh action.

The transition and all point writers use a common concurrency protocol, such as a transaction-scoped organization lock. Resolve the active season only after acquiring that protection and keep it through the write. An award that commits before rollover belongs to the old season; one serialized after rollover belongs to the new season. A pre-transaction active-season lookup alone cannot guarantee this.

Retain the partial unique index as a backstop. Update reporting revision, audit, announcement records, and season state atomically. An outbox worker may deliver external notifications after commit. A failed push cannot turn a successful kickoff into a reported failure.

Coordinate deduction cooldown checks and writes under the applicable lock/transaction protocol as well. Do not introduce a separate season path that bypasses these guards.

## Historical reporting and corrections

Approved September 20, 2026: authorized corrections after season closure update historical standings, including the winning set. A nonblank reason and durable audit trail are mandatory. Enforce the reason in the API, not just the UI; persist the correction and audit evidence atomically. Record actor, organization, season, affected transaction, reason, timestamp, and before/after scoring effect. Reports clearly disclose corrected results. No correction is accepted if its audit record cannot be persisted.

The remaining scope recommendation is unchanged: closed means no new normal awards. Use existing authorized correction mechanisms; do not add arbitrary historical deductions in this release.

Reports display "Results reflect recorded corrections" and an as-of/revision indicator. A correction advances the reporting revision and records the affected season. A recap announcement links to the report instead of embedding a permanent winner claim that may later be wrong. A correction that changes the winning set should produce a deduplicated informational notice to owners/admins; do not rebroadcast the entire season announcement automatically.

Empty seasons have no winner. Equal highest scores have co-winners. Recipient contributions include departed members, and transaction-time house attribution is preserved. Legacy closed seasons use the same live-ledger rules; this migration cannot reconstruct an original closing snapshot that was never captured.

## Migration, rollout, and acceptance

New metadata is nullable for existing seasons. Keep existing start/rename APIs functional during the compatibility period; legacy start calls must use the same transition service and concurrency protections. Do not require an old mobile client to understand a new draft state. Update existing documentation's ordinal tie rules only when the new reporting behavior is implemented.

Verify owner/admin/member access, stale-plan conflicts, duplicate kickoff, notification dedupe, transaction rollback, concurrent awards/kickoff, concurrent deductions, timezone edge cases, planned dates passing without automation, empty/tied/negative results, and closed-season correction notices. Use real database concurrency tests for ordering invariants.

Rollback can hide planning UI while retaining new fields and the compatible transition service. Do not roll back to a point writer that ignores the new concurrency protocol.
