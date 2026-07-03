# Execution Plan

Status markers:

- `[x]` complete
- `[-]` partially complete
- `[ ]` not started

Every phase must pass the full quality gate before the next phase begins:
`npm run lint` + `npm run typecheck` + `npm test` + `npm run build`

---

## Phase 1 - Eliminate Boilerplate and Consolidate Auth Resolution

Low-effort, high-value. Pure refactors with no behavior change. Each slice is independently committable.

### Slice 1a - Move `getUserOrgContextBySub` to `actor.ts`

- [ ] Add `getUserOrgContextBySub` to `actor.ts` as an exported function.
- [ ] Remove the private copy from `orgs.ts` and import from `actor.ts`.
- [ ] Gate: `npm run typecheck` + `npm test` pass.

**Rationale:** All Auth0-sub-to-User resolution logic lives in one module. Future identity lookup changes have one edit point.

### Slice 1b - Extract route request helpers

- [ ] Create `apps/api/src/route-helpers.ts` with:
  - `parseBody<T>(schema, request, reply)` - parses request body against a Zod schema, sends 400 and returns `null` on failure.
  - `requireActor(request, reply)` - fetches actor by sub, sends 403 and returns `null` if unmapped.
  - `requireAdminActor(request, reply)` - wraps `requireActor` and adds admin role check.
  - `requireOwnerActor(request, reply)` - wraps `requireActor` and adds owner role check.
  - `resolveSeasonOrReject(actor, seasonId, request, reply)` - wraps `resolveSeasonScope`, sends the correct error and returns `null` on failure.
- [ ] Apply helpers to all route files: `admin.ts`, `dashboard.ts`, `notifications.ts`, `orgs.ts`, `points.ts`, `seasons.ts`, `users.ts`.
- [ ] Add unit tests for `route-helpers.ts` covering the null-return paths.
- [ ] Gate: full quality gate passes.

**Rationale:** 20+ handler bodies become 3-5 lines of setup instead of 10-15. Common error codes and log events are defined once.

---

## Phase 2 - Extract Service Functions from Route Handlers

Medium effort. The goal is thin handlers that delegate to named functions. Work file by file, smallest first.

### Slice 2a - `notifications.ts` and `users.ts`

- [ ] Extract query and mapping logic from notification and user route handlers into local service functions or a co-located module. These files are smaller and serve as a template for the approach.
- [ ] Gate: full quality gate passes.

### Slice 2b - `dashboard.ts` and `seasons.ts`

- [ ] Extract the `buildRecentAdminActions` equivalent logic and season metric computation from `seasons.ts` into named functions (already partially done - validate and document the boundary).
- [ ] Extract dashboard query orchestration from `dashboard.ts` into named functions.
- [ ] Gate: full quality gate passes.

### Slice 2c - `points.ts`

- [ ] Extract award, deduct, delete, and score query logic from `points.ts` into service functions.
- [ ] Gate: full quality gate passes.

### Slice 2d - `admin.ts`

- [ ] Extract the `buildRecentAdminActions`, `buildPointAdjustmentStats`, and individual mutation handlers into service functions in `admin.ts` or a co-located module.
- [ ] The `/admin/context` handler's 10-query fan-out should be orchestrated by a named `loadAdminContext` service function.
- [ ] Gate: full quality gate passes.

### Slice 2e - `orgs.ts`

- [ ] Extract org creation, invite generation, join preview, and join logic into named service functions.
- [ ] Gate: full quality gate passes.

---

## Phase 3 - Notification Factory

Low effort. No behavior change.

### Slice 3a - Create notification factory module

- [ ] Create `apps/api/src/notifications.ts` with one exported factory function per notification type:
  - `buildPointAwardNotification(input)` - returns the `createMany` data for `POINT_AWARD_RECEIVED`.
  - `buildMemberNeedsAssignmentNotifications(input)` - replaces `createMemberNeedsHouseAssignmentNotifications` in `orgs.ts`.
  - `buildRoleChangedNotifications(input)` - returns the `createMany` data for `ROLE_CHANGED`.
  - `buildPointDeductionNotification(input)` - returns the `createMany` data for `POINT_DEDUCTION_RECEIVED`.
  - `buildSeasonStartedNotifications(input)` - for future use.
- [ ] Replace inline `notification.createMany` calls in route files with factory calls.
- [ ] Remove `createMemberNeedsHouseAssignmentNotifications` from `orgs.ts`.
- [ ] Add unit tests for each factory function.
- [ ] Gate: full quality gate passes.

---

## Phase 4 - Split `contracts/index.ts`

Low effort. No behavior change.

### Slice 4a - Create domain schema modules

- [ ] Create `packages/contracts/src/point-schemas.ts` - point transaction, award, deduct, delete, activity feed schemas.
- [ ] Create `packages/contracts/src/user-schemas.ts` - bootstrap, app user, org member, profile schemas.
- [ ] Create `packages/contracts/src/season-schemas.ts` - season, season context, season comparison, create/rename season schemas.
- [ ] Create `packages/contracts/src/dashboard-schemas.ts` - dashboard summary, leaderboard, dashboard standout schemas.
- [ ] Create `packages/contracts/src/admin-schemas.ts` - admin context, admin audit, house management, org settings, role change schemas.
- [ ] Create `packages/contracts/src/notification-schemas.ts` - notification, mark-read schemas.
- [ ] Create `packages/contracts/src/org-schemas.ts` - org creation, invite, join, route context schemas.
- [ ] Re-export everything from `packages/contracts/src/index.ts` so no consumer import paths change.
- [ ] Gate: full quality gate passes.

---

## Phase 5 - Derive Mapper Types from Prisma Payloads

Low effort. Improves type safety for future schema changes.

### Slice 5a - Update mapper input types

- [ ] Update `mapActivityItem` and `mapDeletedPoint` in `points.ts` to derive their input type from `Prisma.PointTransactionGetPayload<{ select: ... }>`.
- [ ] Update `mapAppUser` in `app-user.ts` to derive its input type from `Prisma.UserGetPayload<{ select: ... }>`.
- [ ] Update `mapNotification` in `notifications.ts` similarly.
- [ ] Gate: full quality gate passes.

---

## Deferred (not in scope for this pass)

- Prisma injection boundary for route handlers. The integration test suite compensates at current scale. Revisit if route logic grows complex enough to require isolated unit tests.
- HTTP GET for read endpoints. Revisit if the API becomes public-facing or sits behind an HTTP cache.
- Chaos engineering and fault-injection drills. Needs its own plan per the pass-one closeout recommendation.
