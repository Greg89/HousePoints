# Findings

These findings were produced by a structural review of the codebase after the first refactor pass closed on June 21, 2026. They are ordered by the priority used to build the execution plan.

---

## Finding 1 - Route handlers own business logic (SRP)

**Files affected:** `apps/api/src/routes/admin.ts` (987 lines), `apps/api/src/routes/orgs.ts` (768 lines), `apps/api/src/routes/points.ts` (658 lines), `apps/api/src/routes/seasons.ts` (548 lines)

**Problem:** Route handlers are doing HTTP routing, query orchestration, domain logic, and response shaping in the same function. The `/admin/context` handler fires 10 parallel Prisma queries, deduplicates a combined audit stream via `buildRecentAdminActions`, and computes aggregated stats via `buildPointAdjustmentStats` — all inline. Route handlers should be thin: validate input, delegate to a service or query function, return response. The logic that belongs in a service layer has accumulated inside the handlers.

**Impact:** New features require editing already-large handlers. Logic that should be shared between routes is copied inline. Unit testing business logic requires standing up a full route context.

---

## Finding 2 - Auth identity resolution is duplicated (DRY)

**Files affected:** `apps/api/src/actor.ts`, `apps/api/src/routes/orgs.ts`

**Problem:** The Auth0-sub-to-User lookup uses a two-step pattern (try `AuthIdentity` by provider subject, fall back to `User` by `auth0Sub`) in three places: `getActorBySub` in `actor.ts`, `getUserOrgContextBySub` in `orgs.ts`, and inline inside the `$transaction` block of the join handler in `orgs.ts`. The first two are module-level duplicates of the same resolution logic with different select shapes. The third is inside a transaction so it must use the transaction client and cannot easily share the same helper, but it is still a conceptual duplicate.

**Impact:** If the dual-path resolution logic needs to change (e.g., adding a new identity provider lookup), it must be updated in multiple places. The `getUserOrgContextBySub` function inside `orgs.ts` is undiscoverable — a future developer working in `actor.ts` will not know it exists.

---

## Finding 3 - Validation and actor-fetch boilerplate repeated in every handler (DRY)

**Files affected:** All 21 route handlers across `admin.ts`, `dashboard.ts`, `notifications.ts`, `orgs.ts`, `points.ts`, `seasons.ts`, `users.ts`

**Problem:** Every route handler opens with the same 10-line sequence:
```ts
const parsed = schema.safeParse(request.body);
if (!parsed.success) {
  warn(...); return reply.status(400).send({ code: "VALIDATION_ERROR", ... });
}
const actor = await getActorBySub(request.auth.subject);
if (!actor) {
  warn(...); return reply.status(403).send({ code: "ACTOR_NOT_MAPPED", ... });
}
```
Variants add `isAdminRole` or `isOwnerRole` checks with their own 403 responses. The `SeasonScopeError` try/catch block is also repeated in every route that accepts an optional season scope (at least five handlers).

**Impact:** Any change to error codes, log event names, or response shapes for these common cases requires touching 20+ handlers. The signal-to-noise ratio inside each handler is low because so much of the function body is boilerplate.

---

## Finding 4 - Notification creation is scattered with hardcoded strings

**Files affected:** `apps/api/src/routes/points.ts`, `apps/api/src/routes/admin.ts`, `apps/api/src/routes/orgs.ts`

**Problem:** Inline `tx.notification.createMany(...)` calls with hardcoded `title`, `body`, `actionHref`, and `dedupeKey` strings are spread across three route files. The `orgs.ts` file extracted one helper (`createMemberNeedsHouseAssignmentNotifications`) but the others did not. Each notification type's template is owned by the route that produces it, not by a central notification module.

**Impact:** Adding notification preferences, changing notification copy, or auditing all notification types requires searching across multiple route files. The deduplication key format is not standardized — a typo in one file creates a silent deduplication failure. Upcoming notification types (org setting changes, season starts) will add more scattered call sites.

---

## Finding 5 - `contracts/index.ts` is a flat 881-line barrel

**Files affected:** `packages/contracts/src/index.ts`

**Problem:** All schemas — points, users, seasons, dashboard, admin, notifications, org management — are defined in a single file with no internal organization. The file will grow with every new feature (point adjustments, dashboard widgets, season winner summary, season comparison).

**Impact:** Navigation is difficult. Unrelated schemas are coupled in one compilation unit. A merge conflict in this file blocks work on any feature that touches contracts, regardless of domain.

---

## Finding 6 - Mapper input types are manually maintained

**Files affected:** `apps/api/src/routes/points.ts` (`mapActivityItem`, `mapDeletedPoint`), `apps/api/src/app-user.ts` (`mapAppUser`)

**Problem:** Mapper functions declare their input type manually with inline structural types instead of deriving them from `Prisma.XxxGetPayload<{ select: ... }>`. If a Prisma query's `select` is widened, TypeScript will not report that the mapper is missing the new fields — the error only surfaces at runtime.

**Impact:** Silent type drift between queries and mappers as the schema evolves. Adding a field to a select shape requires manually remembering to update the mapper type.

---

## Finding 7 - `prisma` has no injection boundary in route modules

**Files affected:** All route modules in `apps/api/src/routes/`

**Problem:** `buildApp()` injects `verifyAccessToken` and `verifyIdToken` (enabling unit testing of auth), but `prisma` is imported as a module-level singleton in every route file. Route handlers cannot be unit-tested without module-level mocking via `vi.mock`. This was a deliberate pass-one trade-off documented as "route modules are still the clearest boundary."

**Impact:** Integration tests compensate adequately at this scale. This is recorded as a known deliberate trade-off, not an immediate action item. Revisit if the integration test suite becomes too slow or if route logic grows complex enough to warrant isolated unit tests.

---

## Finding 8 - All reads use POST (HTTP semantics)

**Files affected:** All read endpoints (`/dashboard/summary`, `/houses/leaderboard`, `/seasons/context`, `/members`, `/notifications/list`, etc.)

**Problem:** Every endpoint is a POST, including pure reads. The pragmatic reason — season ID or cursor passed in the body, Next.js server actions work cleanly with POST — is legitimate for the current deployment model. However, reads are not HTTP-cacheable at the edge and the API surface does not self-document its intent to HTTP tooling.

**Impact:** This is a deliberate trade-off, not an immediate action item. Recorded here as context if the API is ever made public-facing or placed behind an HTTP cache.
