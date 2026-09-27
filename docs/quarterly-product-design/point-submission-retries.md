# Point submission retries (F2)

Implemented September 26, 2026. Deployment and native device verification remain pending.

## Server contract

`POST /points/adjust` and `POST /points/deduct` accept an optional UUID `idempotencyKey` in the JSON body. Updated clients send it; requests without it retain legacy behavior and **can still duplicate awards after an uncertain response**. Request IDs remain per-attempt tracing identifiers, not mutation keys.

The F1 organization lock serializes each keyed submission. Inside the same transaction, the server rechecks active actor/target membership, house assignment, organization/account availability, and deduction permissions. It looks up a record scoped to organization, actor, operation, and key before resolving the active season or checking deduction cooldowns. A SHA-256 fingerprint covers the validated target, amount, reason, and trait (fixed amount and no trait for deductions). Server-derived house/season assignments are not request fields.

A new request commits the ledger change, existing durable notification/audit effects, reporting revision, and `PointMutationRequest` together. Failure rolls them all back. A successful keyed response is HTTP 201 with `{ id }`; retries return that same result without another mutation, revision increment, notification, audit event, or push attempt. Legacy awards retain their existing response shape. The replay identifies the original transaction even if subsequently corrected/deleted; it does not restore it. Authorization is never cached in the record.

Changed payloads return HTTP 409 `IDEMPOTENCY_KEY_CONFLICT`. Replays are allowed for 30 days from commit. Thereafter the server returns HTTP 409 `IDEMPOTENCY_KEY_EXPIRED`, telling the user to check Activity. Expired records remain as compact tombstones indefinitely: no cleanup job may delete them or make their keys reusable. Records contain a hash and result ID, not the reason text or a cached user profile. Organization hard deletion cascades its records. Future retention work must preserve non-reuse semantics.

## Client lifecycle

Web and mobile forms keep pending keys in memory and reuse them for the same payload after any failed/uncertain response. Changing the payload starts a separate submission; returning to an earlier unresolved payload reuses its key. Success clears that payload's key so a later intentional identical award gets a new key. Web server actions forward keys unchanged; mobile contract validation includes them in the request body.

This is form-lifetime retry protection, not a durable offline queue. A full page reload, component unmount, or app restart loses pending client keys. After abandoning an uncertain submission, check Activity before starting again. Server records still prevent any saved key from being applied twice. Do not automatically replace a key after conflict or expiry.

## Push deadline

Post-commit push delivery has a single three-second deadline covering device lookup, all Expo batches, HTTP response bodies, and custom dispatchers. Timeout is logged as `notifications.push_failed` and does not turn committed scoring into a failed API response. An abort signal reaches Expo fetch; no further batches or late success logs occur after cancellation. A custom provider or database driver may ignore cancellation and finish in the background, but cannot hold confirmation open indefinitely. The deadline bounds push work only, not the complete request/transaction.

There is no durable external push queue or automatic redelivery. A provider may accept a push whose response is lost; retries of scoring intentionally do not resend it. The durable in-app notification remains available.

## Release order and rollback

1. Apply `20260927010000_point_mutation_requests` after the F1 migration. It adds one table, indexes, and an organization foreign key; no backfill.
2. Deploy the compatible API and generated Prisma client, then web and mobile clients. Older APIs reject the added key because request schemas are strict, so client-first rollout is unsupported.
3. Exercise award and deduction retries in staging, then verify the updated Android build on a device before mobile release.

No environment variables, secrets, native dependencies, or feature flags are added. Existing deduction enablement remains in force. Rolling back only clients leaves server protection for keyed requests intact. Rolling back the API removes retry safety; do not run updated clients against that API. Keep the table and records across rollback/redeployment; dropping them allows old keys to apply again.

## Verification

Real PostgreSQL integration tests cover overlapping award/deduction retries, one durable effect, replay after a lost response and season rollover, payload conflict, revoked access, expiry, actor/operation/organization isolation, and rollback of the request record with the ledger/revision. Route tests cover successful confirmation after a stalled push followed by replay without duplicate effects. Unit tests cover stalled lookups, providers, fetches and response bodies, and cancellation before the next batch. Web dialog tests simulate a lost response; action and mobile transport tests verify key forwarding, reuse, and rotation after success.

Local verification on September 26, 2026 passed: root typecheck, all 1,008 unit/component tests, coverage thresholds, production build, lint in all five touched workspaces, fresh PostgreSQL 16 migration plus ledger/concurrency integration tests, and Android JavaScript/Hermes bundle export. No staging or production migrations were applied.

Native release/device testing remains a separate gate; local typechecks, JavaScript tests and web/API builds do not replace it.
