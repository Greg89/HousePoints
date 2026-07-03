# Acceptance Criteria

Feature development may resume after all criteria below are met.

Status markers:

- `[x]` met
- `[-]` partially met
- `[ ]` not yet met

---

## Phase 1 Criteria

- [x] `getUserOrgContextBySub` is exported from `actor.ts` and not defined in `orgs.ts`.
- [x] `apps/api/src/route-helpers.ts` exists and exports `parseBody`, `requireActor`, `requireAdminActor`, `requireOwnerActor`, and `resolveSeasonOrReject`.
- [x] Every route handler in `admin.ts`, `dashboard.ts`, `notifications.ts`, `orgs.ts`, `points.ts`, `seasons.ts`, and `users.ts` uses `parseBody` instead of inline `safeParse` + 400 response.
- [x] Every route handler that requires an actor uses `requireActor`, `requireAdminActor`, or `requireOwnerActor` instead of inline `getActorBySub` + 403 response.
- [x] Every route handler that accepts a season scope uses `resolveSeasonOrReject` instead of inline try/catch.
- [x] `route-helpers.ts` has unit tests covering the null-return path for each helper.
- [x] Full quality gate passes: `npm run lint` + `npm run typecheck` + `npm test` + `npm run build`.

## Phase 2 Criteria

- [x] No route handler in `admin.ts`, `orgs.ts`, `points.ts`, `dashboard.ts`, or `seasons.ts` contains inline Prisma query logic that is not delegated to a named function.
- [x] `buildRecentAdminActions` and `buildPointAdjustmentStats` are named, exported functions tested directly rather than embedded in the handler.
- [x] The `/admin/context` handler body delegates to a named `loadAdminContext` function.
- [x] Full quality gate passes.

## Phase 3 Criteria

- [x] `apps/api/src/notifications.ts` exists and exports one factory function per implemented notification type.
- [x] No route handler contains an inline `notification.createMany` call with hardcoded string templates.
- [x] `createMemberNeedsHouseAssignmentNotifications` is removed from `orgs.ts`.
- [x] Each factory function has a unit test.
- [x] Full quality gate passes.

## Phase 4 Criteria

- [x] `packages/contracts/src/index.ts` contains only re-exports from domain schema modules.
- [x] Domain schema files exist for points, users, seasons, dashboard, admin, notifications, and org.
- [x] No consumer import paths change (`from "@housepoints/contracts"` remains valid for all existing exports).
- [x] Full quality gate passes.

## Phase 5 Criteria

- [x] `mapActivityItem`, `mapDeletedPoint`, `mapAppUser`, and `mapNotification` derive their input types from Prisma payload types rather than manually typed inline structs.
- [x] Full quality gate passes.

## Overall Pass Criteria

- [x] All phase criteria above are met.
- [x] No new route handler added after this pass embeds inline query logic, inline `safeParse` + 400 boilerplate, or inline `getActorBySub` + 403 boilerplate.
- [x] Docs are updated to reflect pass completion.
