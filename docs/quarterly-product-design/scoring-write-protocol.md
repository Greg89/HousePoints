# F1 scoring write protocol

Implemented September 26, 2026. Local PostgreSQL verification passed; deployment
has not been performed. This is the foundation for F2 retries and R2 reporting,
not client idempotency or a new reporting API.

## Transaction boundary

`apps/api/src/scoring-write.ts` provides the shared protocol:

1. Begin a PostgreSQL **Read Committed** interactive transaction.
2. Lock the authorized organization row with `SELECT ... FOR NO KEY UPDATE`.
3. Resolve the active season **after acquiring the lock**. For deductions, read
   both cooldown checks within this same transaction before inserting anything.
4. Read `clock_timestamp()` after lock acquisition for ledger/season timestamps.
   PostgreSQL `now()` denotes transaction start and could precede a lock wait.
5. Write the point or transition, audit where applicable, and durable
   notifications. Commit together. External push dispatch stays outside the lock.

Acquire the organization lock before point or season row locks. Transactions
spanning organizations must acquire organization locks in sorted ID order.
`FOR NO KEY UPDATE` serializes these mutations without conflicting with the key
share locks from unrelated foreign-key checks. Different organizations have
independent locks. Connection acquisition is bounded at 5 seconds; interactive
transactions at 10 seconds. A timeout fails and rolls back, not a partial success.

Awards and manual rollover are ordered by the lock, not by request arrival or
client timestamps. An award that acquires the lock before rollover belongs to
the old season; one that acquires it afterward belongs to the successor. The
old season's end and successor's start use the same database timestamp.

Existing deduction policy is preserved: fixed -10, another house, a 24-hour
window scoped to the active season, actor-house membership evaluated by the
existing current-active-membership rule, and recipient cooldown. Soft-deleting
a deduction does not erase its cooldown. Member moves/authorization lifecycle
are not redesigned by this slice. Duplicate season-start requests can still
start distinct seasons; request idempotency remains F2/S2.

## Reporting revision

`Organization.reportingRevision` is a non-null PostgreSQL BIGINT starting at 0.
The additive migration needs no historical ledger rewrite or separate backfill.
Database row triggers advance it atomically on inserts, actual updates, and
deletes of `PointTransaction` and `Season`. A rollover changes two season rows,
so revisions are monotonic change tokens, not transaction counts. No-op updates
do not advance the revision. A rollback restores the prior revision. A row moved
between organizations invalidates both, in sorted organization order.

Triggers cover writes outside the API helper, including moderation and trusted
maintenance scripts. They do not make an arbitrary caller's pre-write season or
cooldown reads safe: those callers must still adopt the transaction protocol.
Do not disable triggers for imports or maintenance. Maintenance touching existing
ledger/season rows must lock organizations first, including before bulk deletes.

The revision is internal groundwork. Do not serialize Prisma BigInt directly as
JSON; future R2 cursors must encode it losslessly, such as a decimal string.
It does not yet represent every display-name, membership, house-label, or
reaction change, and must not be used as a general cache key for existing legacy
views. R1/R2 will define consistent reporting reads and cursor invalidation.

## Mutation inventory

| Path | Ledger/season effect | F1 handling |
|---|---|---|
| `/points/adjust` | Insert award | Shared lock; active season and database timestamp read inside transaction; trigger revision |
| `/points/deduct` | Insert deduction | Same protocol; cooldown queries and insert atomic; audit/notification included |
| `/seasons/start` | Close active season, create successor | Same organization lock and one database timestamp; audit/notifications included |
| `/points/delete` | Soft-delete award or deduction | Same lock; recheck scope/deletion after waiting; duplicate deletes cannot duplicate audit/revision |
| `/platform/moderation/reports/resolve`, `REDACT_CONTENT` | Soft-delete reported points | Organization lock before lookup/update; trigger covers revision; audits remain atomic |
| Organization creation/seed | Create initial season/fixture awards | Initial organization is uncommitted or isolated; triggers advance revision |
| Season rename | Change report labels | Season trigger invalidates revision; no score/active-season change |
| Benchmark/test cleanup and future maintenance | Hard-delete ledger/season rows | Triggers invalidate revision; only isolated fixtures are deleted by current scripts |
| House reassignment, membership removal/suspension, account deletion request/completion | No ledger deletion or reassignment | Historical deltas and transaction-time house retained; no score revision needed. Legacy member-filtered views may still change until R1 unifies historical attribution |
| Organization archive/restore | Access/lifecycle only | Scores retained; no ledger revision change |
| Reactions, notification read/archive, user/house display edits | No score change | Outside score serialization; not covered by this revision |

Existing account deletion anonymizes users and retains historical points. A
future physical user deletion that nulls `targetUserId` will also fire the ledger
update trigger. New score-affecting tables or materialized standings must be
added to this inventory and revision protocol before enablement.

## Verification and contention baseline

`npm run test:integration` now runs the existing DB constraint suite and the API
scoring integration suite. CI already provisions PostgreSQL and supplies
`DATABASE_URL`; no new GitHub secrets or Railway variables are required. Use a
dedicated migrated test database and the default pool size of 5 (at least 4
connections are needed for the barrier, two writers, and lock observer).

The suite observes PostgreSQL lock waits before releasing the barrier, rather
than relying on sleeps to create a race. It exercises:

- same-house deductions against different recipients, and different-house
  deductions against one recipient;
- both serialized award/rollover orderings and matching timestamp boundaries;
- failed rollover, failed durable side effect, and atomic revision rollback;
- concurrent administrative deletion, direct moderation-style soft deletion,
  restoration/correction, hard deletion, no-op updates, and tenant isolation;
- progress in another organization while one is locked, plus 20 contending awards.

Initial local Docker PostgreSQL 16 baseline: 20 concurrent same-organization
awards, p50 26 ms, p95 44 ms, maximum 46 ms. These are end-to-end service timings
including pool waits, not production capacity estimates or pure lock timings.
Profile staging contention and timeouts before expanding this lock to unrelated
business operations. No production performance claim follows from this fixture.

## Release order and rollback

1. Apply `20260926210000_scoring_reporting_revision` through the existing migration
   deployment process. The column/default and triggers are additive.
2. Deploy the API and replace **all** old replicas. Mixed old/new replicas still
   contain the old pre-transaction-read races; full F1 safety starts after replacement.
3. Smoke-test award, deduction conflicts, manual rollover, and administrative /
   platform deletion in staging. Confirm expected audit/notification behavior and
   inspect API error/latency logs. No feature flag or client update is required.
4. Retain the column and triggers on application rollback. Old API code can use
   the additive schema, but rolling back restores the old concurrency risk.
   Do not reset revision values once future cursors depend on them.

No production migration, deployment, commit, or push is authorized by this note.
F2 handles idempotent retries and bounded external push calls; F3 adds reasons
for closed-season corrections. Neither is silently bundled into F1.

## Retry protection

F2 adds [keyed award/deduction retries and bounded post-commit push delivery](./point-submission-retries.md) within this locking protocol. Legacy requests remain compatible but are not protected against lost-response retries.
