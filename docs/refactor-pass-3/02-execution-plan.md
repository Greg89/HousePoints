# Refactor Pass 3 — Execution Plan

Planned September 19, 2026. Not yet scheduled.

Order is proposed for lowest risk / highest leverage first, so later phases can adopt the primitives introduced by earlier ones. Each phase must leave `lint`, `typecheck`, `test`, `build` green for the touched workspaces.

## Phase 1 — Shared primitives (unlocks everything else)

Small, reversible changes that don't alter behavior but give later phases something to build on.

- **1a. Web** — extract `useServerAction` hook (unlocks W3, W4). One commit that introduces the hook + unit tests + one adopting component to prove it out.
- **1b. Web** — introduce `apps/web/src/lib/api-errors.ts` with `isExpectedApiFailure` / `logUnexpectedActionError`; migrate `points.ts` and `admin.ts` action files. Remaining action files migrate in follow-ups (W4).
- **1c. Platform** — add `sendApiError(reply, code, message, status)` helper and `apiErrorResponseSchema` in `@housepoints/contracts` (P3). No route migration yet.
- **1d. Platform** — add `requireTargetMembership` in `route-helpers.ts` with the fixed enum of member-precondition codes (P2). No route migration yet.
- **1e. Mobile** — introduce `src/lib/theme.ts` (colors, spacing, radius, typography) and a `styles/` module with `ErrorCard`, `SectionHeader`, `PrimaryButton`, `EmptyState` (M2). No screen migration yet.

Exit criteria: primitives merged and unit tested. No screens/routes migrated. All workspaces green.

## Phase 2 — Foundational safety net for mobile refactor

Mobile refactors (M1) are riskier than web because coverage is thin. Land the safety net first.

- **2a. Mobile** — add `SplashScreen.preventAutoHideAsync()` + `useFonts` + auth-gated hide in `RootLayout` (M3). Adds a small startup test.
- **2b. Mobile** — add `ScreenErrorBoundary` around the `(tabs)` group and integrate Sentry (M4). Ship DSN via existing env config; no PII in breadcrumbs.
- **2c. Mobile** — component tests for `ReactionPickerModal`, `ReactionDetailsModal`, `AlertsHeaderButton`, `DeviceRegistrationManager` (M10, part 1).

Exit criteria: cold-start test proves splash gating; a thrown render error surfaces in the boundary; four component test files exist and pass.

## Phase 3 — Web streaming, caching, and error boundaries

- **3a.** Introduce cache tags (`activity`, `leaderboard`, `members`, `admin-audit`, `notifications`, `dashboard-summary`); migrate fetch helpers to tag reads and server actions to call `revalidateTag(...)` instead of `revalidatePath("/")` (W1). One resource per commit.
- **3b.** Add per-segment `error.tsx` + `loading.tsx` for `app/o/[slug]/manage`, `app/platform`, `app/settings` (W6). Each error boundary logs segment + request id.
- **3c.** Introduce `<Suspense>` around independently-loadable dashboard sections (leaderboard, activity, admin audit, season comparison) with skeleton fallbacks. Split the dashboard loader (W2).
- **3d.** Drop `"use client"` from presentational components that have no client state (W5).
- **3e.** Migrate remaining action files onto `useServerAction` + `api-errors` (finish W3, W4).
- **3f.** Introduce `apps/web/src/lib/form-schemas.ts` and migrate admin forms to shared validation (W7).

Exit criteria: every server action either calls `revalidateTag` with a specific set or a scoped `revalidatePath("/o/[slug]/...")`. No blanket `revalidatePath("/")` remains. Dashboard renders faster reads first.

## Phase 4 — Mobile screen-level refactor

Once phase 2 provides the safety net and phase 1e provides the shared primitives, refactor the screens.

- **4a.** Activity screen — extract `useActivityFeed()` + presentational rows / empty / error blocks (M1).
- **4b.** Award and deduct screens — extract `useAwardFlow()` / `useDeductFlow()` and share validation via `pointOperationInputSchema` in contracts (M1, M9).
- **4c.** Admin screen — extract `useAdminMembers()` (M1).
- **4d.** Home screen — extract `useHomeSummary()` (M1).
- **4e.** Add optimistic updates to award/deduct against dashboard summary + leaderboard, mirroring the reactions pattern (M6). Centralize per-resource invalidation next to the query-key factories.

Exit criteria: each of the four screens is under ~250 LOC. Hook unit tests exist for `useActivityFeed`, `useAwardFlow`, `useAdminMembers`. Optimistic UI verified in tests for award and deduct.

## Phase 5 — Platform observability and correctness

- **5a.** Add `withTiming(logger, event, fn)` helper and instrument dashboard summary, leaderboard, activity, notifications, reactions services (P4).
- **5b.** Migrate route handlers onto `sendApiError` and `requireTargetMembership`; delete inline copies (P2, P3). One route file per commit.
- **5c.** Extend `ExpoPushDispatcher` to parse ticket responses, mark `DeviceRegistration.revokedAt` on `DeviceNotRegistered`, and emit `notifications.push_token_revoked` (P7).
- **5d.** Colocate service-level unit tests for `points.service`, `admin.service`, `seasons.service` (P8).
- **5e.** Tighten audit/evidence contract types with a discriminated union per event code (P6).

Exit criteria: every 4xx path is asserted against `apiErrorResponseSchema` in an integration test. All read services emit a timed success event. Push token cleanup verified in a unit test.

## Phase 6 — Mobile production polish + platform features

Only after phases 2 and 4 have landed.

- **6a. Mobile** — telemetry client that POSTs to `/telemetry` with `service: "housepoints-mobile"`; instrument screen views, award/deduct outcomes, notification tap, cold start (M7).
- **6b. Mobile** — deep-link deferral: queue links until org context is ready; switch org when link targets a different one; unit tests for the three cases (M8).
- **6c. Mobile** — persistent mutation queue for award/deduct, with tab-bar sync indicator (M5).
- **6d. Platform** — add `User.preferredOrganizationId`, migration, profile UI on web + mobile (P1).
- **6e. Platform** — return `{ org, status }` from slug resolution and adopt across handlers (P9).
- **6f. Web** — platform-admin unit + Playwright coverage (W9). Component tests migrate to role-based queries as they're touched (W8).

Exit criteria: mobile events flow to Seq. Preferred org survives sign-out/sign-in on both clients. `moderation-report-flow` and `support-case-resolution` E2E specs pass in CI.

## Definition of done for the pass

- All findings in [01-findings.md](./01-findings.md) either landed as commits or explicitly deferred with a rationale.
- No blanket `revalidatePath("/")` in the web app.
- Mobile splash + error boundary + telemetry are live.
- Every 4xx API response matches `apiErrorResponseSchema` in integration tests.
- Dashboard summary service emits timing events used by at least one Seq alert.
- Enhancement recommendations in [03-enhancement-recommendations.md](./03-enhancement-recommendations.md) are triaged (accepted / deferred / dropped) but not required to be implemented.
