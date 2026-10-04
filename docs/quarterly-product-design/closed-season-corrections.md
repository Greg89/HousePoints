# Closed-season corrections (F3)

Implemented September 26, 2026. Deployment remains pending.

## Behavior and authorization

The existing admin/owner `POST /points/delete` operation remains a soft deletion of an existing award or deduction. It now requires a nonblank, trimmed reason when the transaction's season is inactive or has an end timestamp. The existing 240-character limit applies. Missing, empty, and whitespace-only reasons return HTTP 422 `CORRECTION_REASON_REQUIRED` without changing the ledger, reporting revision, or audit history. Reasons remain optional for active-season deletions.

The route retains admin/owner authorization and organization scoping. The service rechecks the transaction's organization, deletion state, and season after acquiring the F1 organization lock. Consequently, a rollover that commits first makes a reason mandatory even if the user opened the confirmation while that season was active. Cross-organization records remain unavailable; already-deleted records retain their conflict response.

The web Activity confirmation collects the reason, explains the score recalculation, and requires a reason for historical records. On errors it preserves the draft. If the server reports an intervening season closure, the same dialog switches to requiring a reason. Cancellation does not submit a mutation.

## Atomic evidence and historical results

The point's deletion timestamp and audit timestamp use the same database clock read after lock acquisition. The transaction commits the soft deletion, actor, reason, existing `POINT_DELETED` audit event, and trigger-driven reporting revision together. Audit metadata includes:

- Transaction, season, recipient, and transaction-time house identity.
- Whether the correction affected a closed season.
- Original reason and correction reason.
- Correction timestamp, score contribution before deletion, contribution afterward (zero), and signed score change.
- The resulting organization reporting revision encoded as a decimal string to preserve BIGINT precision.

Removing a +5 award changes its contribution from +5 to zero; removing a -10 deduction changes it from -10 to zero. This is not a new deduction against a historical season. Failure to persist the audit rolls back the deletion and revision.

Audit history labels new closed-season events as corrections and displays their reasons and score contributions. Historical reports explain that totals and winners reflect recorded corrections and may change. Old audit records continue to render without the new metadata; no history is fabricated or backfilled. Final co-winner-change notifications remain part of S3 after the ranking work.

Platform moderation remains its separate privileged review workflow: it already requires an operator note and atomically retains that note with its report and platform audit, while the organization ledger receives its existing public moderation reason. F3 does not expose private operator notes in organization audit views or change moderation permissions.

## Release and rollback

This slice requires F1's reporting revision migration and locking protocol. It introduces no new schema migration, environment variables, secrets, feature flags, or native mobile changes. The reason field already exists in the API contract.

Deploy the updated web confirmation before, or together with, the API enforcement. Older web clients can still delete active-season records, but their reasonless closed-season requests will receive the new typed validation response until refreshed. The new web client remains compatible with the preceding API. Rolling back the API removes the server-side requirement; audit metadata already written remains readable by older code. Do not alter historical records during rollback.

## Verification

API tests cover missing/blank reasons, unchanged active-season behavior, member rejection, organization isolation, and audit metadata. Web tests cover required reason validation, trimming, error/draft recovery, season-closure recovery, cancellation, and audit/historical labels.

Real PostgreSQL tests cover corrections of both awards and deductions, changed historical totals, atomic revision/audit evidence, and a rollover ordered before a reasonless correction. A fixture-scoped database constraint deliberately rejects audit persistence after the ledger update to prove that the entire correction rolls back. The constraint is removed in a finally block.

Local verification passed on September 26, 2026: root typecheck, all 1,015 unit/component tests, coverage thresholds, production build, API/web lint, and the PostgreSQL 16 ledger/concurrency integration suite. Database verification used a disposable local container; no staging or production migrations were applied.
