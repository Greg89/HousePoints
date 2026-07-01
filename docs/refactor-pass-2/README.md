# Second Refactor Pass

Review date: July 1, 2026

## Purpose

This pass addresses structural debt identified after the first refactor pass was closed. The first pass fixed security and reliability blockers. This pass fixes the internal code quality issues that will slow down every new feature if left unaddressed: handler bloat, repeated boilerplate, scattered notification logic, and a contracts file that is outgrowing a single module.

No behavior changes are in scope. Every phase must leave the full quality gate green before work continues.

## Quality Gate

A unit of work is complete only when all of the following pass cleanly:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Database-backed integration tests (`npm run test:integration`) run in CI against a PostgreSQL service and are verified on each phase completion.

## Documents

1. [Findings](./01-findings.md) documents the eight structural issues this pass addresses and their impact.
2. [Execution Plan](./02-execution-plan.md) defines the phased order, the scope of each phase, and the commit slices within each phase.
3. [Acceptance Criteria](./03-acceptance-criteria.md) defines what must be true before feature development resumes.

## Progress Snapshot

Last updated: July 1, 2026

**Phase 1 - COMPLETE.** All quality gates green.

- ✅ Slice 1a: `getUserOrgContextBySub` moved to `actor.ts`, private copy removed from `orgs.ts`
- ✅ Slice 1b: `route-helpers.ts` created with `parseBody`, `requireActor`, `requireAdminActor`, `requireOwnerActor`, `resolveSeasonOrReject`
- ✅ Helpers applied to all 7 route files: `notifications.ts`, `users.ts`, `dashboard.ts`, `points.ts`, `seasons.ts`, `admin.ts`, `orgs.ts`
- ✅ Unit tests for `route-helpers.ts` (16 tests covering all 5 helpers, including null-return paths)
- ✅ Added `"auth.actor_not_found"` and `"owner.forbidden"` to `ApiLogEvent`

**Phase 2 - COMPLETE.** All quality gates green.

- ✅ Slice 2a: `notifications.ts` — 3 exported service functions (`listNotifications`, `markNotificationsRead`, `markAllNotificationsRead`)
- ✅ Slice 2a: `users.ts` — 7 exported service functions + `userSelect` hoisted to module scope
- ✅ Slice 2b: `dashboard.ts` — 2 exported service functions (`loadLeaderboard`, `loadDashboardSummaryData`)
- ✅ Slice 2b: `seasons.ts` — 7 exported service functions (`loadSeasonsForOrg`, `loadSeasonCompareData`, `loadSeasonCompareDetails`, `loadContributorNames`, `startSeasonTransaction`, `findSeasonForOrg`, `renameSeasonInDb`)
- ✅ Slice 2c: `points.ts` — 8 exported service functions; all 5 handlers updated with zero inline `prisma.*` calls
- ✅ Slice 2d: `admin.ts` — 10 exported service functions; all 8 handlers updated; `buildRecentAdminActions` and `buildPointAdjustmentStats` exported with 13 unit tests in `admin.test.ts`
- ✅ Slice 2e: `orgs.ts` — 5 exported service functions (`checkOrgCreatePreconditions`, `createOrgInDb`, `createOrgInviteInDb`, `loadJoinPreviewInDb`, `joinOrgInDb`); all 4 handlers updated
