# Refactor Pass 3 — Findings

Review date: September 19, 2026

Each finding lists the primary evidence, the maintainability or reliability impact, and a proposed design-level fix. Sizing is a rough order of magnitude only.

Categories:

- [Web app](#web-app)
- [Mobile app](#mobile-app)
- [Platform (API + shared packages)](#platform-api--shared-packages)

---

## Web app

### W1. Blanket `revalidatePath("/")` after every mutation

**Files:** [apps/web/src/app/actions/points.ts](../../apps/web/src/app/actions/points.ts), [apps/web/src/app/actions/admin.ts](../../apps/web/src/app/actions/admin.ts), [apps/web/src/app/actions/notifications.ts](../../apps/web/src/app/actions/notifications.ts), [apps/web/src/app/actions/profile.ts](../../apps/web/src/app/actions/profile.ts), [apps/web/src/app/actions/seasons.ts](../../apps/web/src/app/actions/seasons.ts), [apps/web/src/app/actions/orgs.ts](../../apps/web/src/app/actions/orgs.ts), [apps/web/src/app/actions/platform.ts](../../apps/web/src/app/actions/platform.ts).

**Evidence:** every server action success path calls `revalidatePath("/")`. `revalidateTag` is not used anywhere in the app.

**Impact:** every successful mutation (award, deduct, mark-read, rename season) invalidates the entire route tree instead of only the affected data regions. This makes it hard to add caching later (nothing meaningful stays warm across mutations) and adds unnecessary refetch pressure on the API.

**Proposed fix:** define a small set of cache tags per resource — `activity`, `leaderboard`, `members`, `admin-audit`, `notifications`, `dashboard-summary`. Fetch helpers pass the appropriate tag; server actions call `revalidateTag(...)` instead of `revalidatePath("/")`. Only fall back to `revalidatePath` when a slug or route segment is renamed.

---

### W2. Zero `<Suspense>` usage; dashboard loader awaits everything up front

**Files:** [apps/web/src/app/dashboard-page.tsx](../../apps/web/src/app/dashboard-page.tsx), all of `apps/web/src`.

**Evidence:** a workspace-wide search for `Suspense` in `apps/web/src` returns zero matches. `dashboard-page.tsx` collects its reads with `await Promise.all([...])` and only renders once every read has resolved.

**Impact:** dashboard time-to-first-paint is governed by the slowest single read (typically admin audit or season comparison). Faster reads (leaderboard, houses) cannot render progressively, and lazy tabs (season comparison, admin audit) load whether the user opens them or not.

**Proposed fix:** introduce `<Suspense>` around independently-loadable sections and split the loader into per-section async server components. Skeleton fallbacks live next to each section. Defer non-visible tabs (`SeasonComparisonReport`, admin audit table) so their reads only run when the tab activates.

---

### W3. Repeated `useState` + `useTransition` + toast wiring across forms

**Files:** [apps/web/src/components/OrgSettingsManagement.tsx](../../apps/web/src/components/OrgSettingsManagement.tsx), [apps/web/src/components/HouseManagement.tsx](../../apps/web/src/components/HouseManagement.tsx), [apps/web/src/components/TeamManagement.tsx](../../apps/web/src/components/TeamManagement.tsx), [apps/web/src/components/AwardPointsDialog.tsx](../../apps/web/src/components/AwardPointsDialog.tsx), [apps/web/src/components/DeductPointsDialog.tsx](../../apps/web/src/components/DeductPointsDialog.tsx).

**Evidence:** every form component follows the same pattern — one `useState` for form values, a `useTransition` per submit path, a submit handler that invokes the server action, then a `toast.success` / `toast.error` at the tail. `OrgSettingsManagement.tsx` alone declares four transitions (`isNamePending`, `isSlugPending`, `isOwnerPending`, `isArchivePending`).

**Impact:** adding a new form is ~30–50 lines of boilerplate before any real behavior. Fixes to error surfacing, toast copy, or pending-state UX have to be applied component-by-component, which drives inconsistency.

**Proposed fix:** extract a `useServerAction` hook that wraps `useTransition` + toast + error classification and returns `{ isPending, submit, error }`. Components that submit a single action shrink significantly; components with multiple actions call the hook per action instead of hand-rolling each transition.

---

### W4. Expected-vs-unexpected error classification duplicated per action file

**Files:** [apps/web/src/app/actions/points.ts](../../apps/web/src/app/actions/points.ts), [apps/web/src/app/actions/admin.ts](../../apps/web/src/app/actions/admin.ts), [apps/web/src/app/actions/dashboard.ts](../../apps/web/src/app/actions/dashboard.ts), [apps/web/src/app/actions/seasons.ts](../../apps/web/src/app/actions/seasons.ts), [apps/web/src/app/actions/profile.ts](../../apps/web/src/app/actions/profile.ts).

**Evidence:** `points.ts` defines `isExpectedAwardFailure` and `isExpectedPointMutationFailure`; `admin.ts` defines its own `isExpectedAdminMutationFailure`; several action files inline the same `error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500` check.

**Impact:** the definition of "expected client-side failure" drifts between action files. Anything that touches how the web logs unexpected server errors (Seq events, Sentry breadcrumbs) has to be replicated per file.

**Proposed fix:** move the classifier into `apps/web/src/lib/api-errors.ts` next to `ApiResponseError`. Provide two helpers — `isExpectedApiFailure` and `isRecoverableApiError` — and have every action file import them. Add a companion `logUnexpectedActionError(error, event, context)` that centralizes the Seq/telemetry path.

---

### W5. `"use client"` on presentational components with no client state

**Files (examples):** [apps/web/src/components/ActivityCard.tsx](../../apps/web/src/components/ActivityCard.tsx), [apps/web/src/components/HouseCard.tsx](../../apps/web/src/components/HouseCard.tsx), [apps/web/src/components/Leaderboard.tsx](../../apps/web/src/components/Leaderboard.tsx), and other cards under [apps/web/src/components](../../apps/web/src/components).

**Evidence:** the components directory contains many files that begin with `"use client"` yet only accept props and render JSX (no hooks, no event handlers beyond simple links).

**Impact:** unnecessary client bundle weight and hydration cost, and the boundary blocks server-only helpers (formatters, RSC-only data reads) from being used inline in these components.

**Proposed fix:** audit the components directory and drop `"use client"` from files that hold no client state. Where a component has one small interactive fragment (e.g. a menu, a toggle), extract that fragment into a client child and keep the parent server-rendered.

---

### W6. One global `error.tsx`; no per-segment error or loading boundaries

**Files:** [apps/web/src/app/error.tsx](../../apps/web/src/app/error.tsx), [apps/web/src/app/loading.tsx](../../apps/web/src/app/loading.tsx).

**Evidence:** a single root `error.tsx` shows "Something went wrong" for every failure. `loading.tsx` shows a single generic spinner. `AdminUnavailablePanel.tsx` is a hand-rolled soft fallback for admin loads but is not a route-segment `error.tsx`.

**Impact:** a partial failure in admin, platform, or settings crashes the whole page, and users lose the rest of the working UI. There is no visible signal during route transitions.

**Proposed fix:** add per-segment `error.tsx` at least for `app/o/[slug]/manage`, `app/platform`, and `app/settings`. Each error boundary should log the segment and request id and offer a scoped retry. Add per-segment `loading.tsx` where the segment does non-trivial data fetching so users get a skeleton, not a blank layout shift.

---

### W7. FormData validation duplicated between client and action

**Files:** [apps/web/src/app/actions/admin.ts](../../apps/web/src/app/actions/admin.ts), [apps/web/src/components/OrgSettingsManagement.tsx](../../apps/web/src/components/OrgSettingsManagement.tsx), [apps/web/src/components/HouseManagement.tsx](../../apps/web/src/components/HouseManagement.tsx).

**Evidence:** admin action handlers coerce with `String(formData.get("name") ?? "").trim()` and check length inline. The same limits (name max length, color hex pattern, description max length) also live in the component that renders the form.

**Impact:** validation rules must be updated in two places, and there is no shared source of truth to hand to E2E tests.

**Proposed fix:** define a small module of form-input Zod schemas in `apps/web/src/lib/form-schemas.ts` (or extend `@housepoints/contracts` if the same shapes belong on the API side). Action handlers call `schema.safeParse(Object.fromEntries(formData))` once; components read `maxLength`, patterns, etc. from the same schema.

---

### W8. Component tests match on rendered copy rather than roles

**Files:** [apps/web/src/components/AdminForms.test.tsx](../../apps/web/src/components/AdminForms.test.tsx), [apps/web/src/components/DashboardShell.test.tsx](../../apps/web/src/components/DashboardShell.test.tsx).

**Evidence:** admin tests assert against literal strings like `"1 member needs a house assignment"` and `"Needs attention"`, coupling behavioral assertions to marketing copy.

**Impact:** copy edits break tests that were not intended to cover copy. Screen-reader-relevant roles are undertested.

**Proposed fix:** prefer `getByRole` + `aria-label` for assertions that describe behavior. Reserve string matching for the specific test that owns the copy. Add role annotations (`role="region"`, `role="group"`, `aria-label="..."`) where they aid both users and tests.

---

### W9. Platform admin surface lacks unit and E2E coverage

**Files:** [apps/web/src/components/PlatformModerationQueue.tsx](../../apps/web/src/components/PlatformModerationQueue.tsx), [apps/web/src/components/PlatformSupportCases.tsx](../../apps/web/src/components/PlatformSupportCases.tsx), [apps/web/src/components/PlatformUserSearch.tsx](../../apps/web/src/components/PlatformUserSearch.tsx).

**Evidence:** several `Platform*` components have no colocated `.test.tsx`. `apps/web/e2e` covers organization lifecycle, team mutations, and role smoke but does not cover moderation resolution, support case status transitions, or user search from the platform admin console.

**Impact:** the platform team ships fixes to these tools with no automated safety net. Regressions surface as user reports.

**Proposed fix:** add unit tests for each platform component (happy path + one error state), and add two Playwright specs: `platform-moderation.spec.ts` and `platform-support-case.spec.ts`. Reuse the staging data contract already documented in [docs/staging-e2e-test-data-contract.md](../staging-e2e-test-data-contract.md).

---

## Mobile app

### M1. Screen files mix data, mutation, modal state, and presentation

**Files:** [apps/mobile/src/app/(tabs)/activity.tsx](../../apps/mobile/src/app/(tabs)/activity.tsx), [apps/mobile/src/app/award.tsx](../../apps/mobile/src/app/award.tsx), [apps/mobile/src/app/(tabs)/admin.tsx](../../apps/mobile/src/app/(tabs)/admin.tsx), [apps/mobile/src/app/(tabs)/index.tsx](../../apps/mobile/src/app/(tabs)/index.tsx).

**Evidence:** each of these screens combines several `useQuery` / `useInfiniteQuery` calls, multiple `useMutation` calls (react, report, award, assign house, change role), modal open/close state, form validation, and the layout in a single file (activity ~470 LOC, award ~540 LOC, admin ~550 LOC).

**Impact:** every new feature has to reason about the entire screen. Extracting business logic for unit tests requires mounting the full screen. Screens grow with each addition rather than composing.

**Proposed fix:** for each of the four screens, extract two things:

1. A hook that owns queries + mutations (e.g. `useActivityFeed`, `useAwardFlow`, `useAdminMembers`, `useHomeSummary`). The hook returns strongly-typed values and the mutation triggers only.
2. Presentation components for the sections that keep repeating (list row, empty state, error card, modal picker).

Screens then become a small composition of `useSomeHook()` + a few JSX blocks.

---

### M2. Duplicated `StyleSheet.create` blocks across screens

**Files:** every screen under [apps/mobile/src/app](../../apps/mobile/src/app).

**Evidence:** each screen defines its own `StyleSheet.create({...})` with near-identical entries for `container`, `centered`, `errorCard`, `errorTitle`, section headers, primary/secondary buttons. Colors (`#0f172a`, `#f8fafc`, `#3b82f6`, etc.) are inlined per file.

**Impact:** style drift between screens (spacing, radius, contrast). Theming (dark mode, house theme) is not viable while tokens are copied per file.

**Proposed fix:** introduce a single `src/lib/theme.ts` exporting `colors`, `spacing`, `radius`, `typography`. Add small style modules for the repeated primitives (`ErrorCard`, `SectionHeader`, `PrimaryButton`, `EmptyState`). Migrate one screen at a time.

---

### M3. Splash screen is not gated on auth bootstrap; no font preload

**File:** [apps/mobile/src/app/_layout.tsx](../../apps/mobile/src/app/_layout.tsx).

**Evidence:** `RootLayout` mounts providers directly and renders `<Stack>` immediately. There is no `SplashScreen.preventAutoHideAsync()` or `SplashScreen.hideAsync()` call, no `useFonts` gate, even though `expo-splash-screen` and `expo-font` are already installed (`apps/mobile/package.json`).

**Impact:** the splash hides before auth reconciliation finishes, so users can see a login screen flash before being redirected. Any font that gets loaded lazily can cause a first-paint layout shift.

**Proposed fix:** call `SplashScreen.preventAutoHideAsync()` at module scope. Load required fonts with `useFonts`. Hide the splash only once auth status has left `"initializing"` and fonts are ready. Add a test that asserts the gate condition.

---

### M4. No client-side error boundary or crash reporting

**Files:** [apps/mobile/src/app/_layout.tsx](../../apps/mobile/src/app/_layout.tsx), [apps/mobile/src/lib/logger.ts](../../apps/mobile/src/lib/logger.ts), [apps/mobile/package.json](../../apps/mobile/package.json).

**Evidence:** no error boundary component wraps the router. `logger.ts` writes structured JSON to `console` only. No Sentry / Bugsnag dependency is present. Screens each render their own `ErrorCard` when a query fails, but a render-time exception is not caught anywhere.

**Impact:** a render exception blanks the app with no recovery. Production crashes are only visible if a user files a report.

**Proposed fix:** add a lightweight `ScreenErrorBoundary` component and wrap the tabs group. Introduce Sentry (or a similarly small alternative) with the DSN in env config, initialized in `RootLayout`. Ship structured error breadcrumbs and screen-name context. Reuse the existing `logger` as a Sentry breadcrumb sink.

---

### M5. No offline queue for award / deduct mutations

**Files:** [apps/mobile/src/app/award.tsx](../../apps/mobile/src/app/award.tsx), [apps/mobile/src/app/deduct.tsx](../../apps/mobile/src/app/deduct.tsx), [apps/mobile/src/components/QueryLifecycleManager.tsx](../../apps/mobile/src/components/QueryLifecycleManager.tsx).

**Evidence:** `QueryLifecycleManager` already tracks focus and network state. Award and deduct mutations call the API directly; a failure surfaces a toast and the user must retry. Nothing is persisted for later replay.

**Impact:** in poor connectivity (which is the field environment for many use cases) the primary product action feels unreliable. Multiple retries are user-driven.

**Proposed fix:** introduce a persistent mutation queue backed by AsyncStorage (or `@tanstack/query-persist-client`). Award and deduct mutations enqueue on offline, retry with backoff on reconnect, and expose a small "pending sync" indicator in the tab bar or home header.

---

### M6. Optimistic updates only on reactions; awards/deducts feel slow

**Files:** [apps/mobile/src/app/(tabs)/activity.tsx](../../apps/mobile/src/app/(tabs)/activity.tsx), [apps/mobile/src/app/award.tsx](../../apps/mobile/src/app/award.tsx), [apps/mobile/src/app/deduct.tsx](../../apps/mobile/src/app/deduct.tsx), [apps/mobile/src/lib/mobile-query-keys.ts](../../apps/mobile/src/lib/mobile-query-keys.ts).

**Evidence:** activity reactions use optimistic `setOptimisticReactions` with `onMutate` / `onError` rollback. Award and deduct do not; the UI waits on the server round trip before any visible response. Cache invalidation is handled by a manually maintained `mobileMutationInvalidations.*` map.

**Impact:** the two most common flows (award, deduct) feel measurably slower than reactions. As new query keys are added, the invalidation map is easy to miss.

**Proposed fix:** apply the same optimistic pattern used for reactions to the dashboard summary and leaderboard for award/deduct: add an `onMutate` that bumps the target member and house totals, and roll back on error. For invalidation, expose per-resource `invalidate*` helpers next to each query-key factory so a new key adds its own invalidation contract in one place.

---

### M7. Mobile has no telemetry ship-out; only console logs

**Files:** [apps/mobile/src/lib/logger.ts](../../apps/mobile/src/lib/logger.ts), [apps/api/src/routes/telemetry.ts](../../apps/api/src/routes/telemetry.ts).

**Evidence:** the API exposes `/telemetry` for structured events, but mobile's `logger.ts` writes JSON to `console` and does not post to that endpoint. No mobile events surface in Seq.

**Impact:** the platform team has no visibility into mobile feature adoption, error rates, or startup performance except through user reports.

**Proposed fix:** add a small `telemetry.ts` module that batches events and POSTs to `/telemetry` with `service: "housepoints-mobile"`. Instrument the highest-value events first: screen views, award/deduct success/failure, notification tap, cold start duration. Respect user consent settings if any are added later.

---

### M8. Deep link handling silently drops when org context is not ready

**Files:** [apps/mobile/src/lib/deep-links.ts](../../apps/mobile/src/lib/deep-links.ts), [apps/mobile/src/components/NotificationResponseManager.tsx](../../apps/mobile/src/components/NotificationResponseManager.tsx).

**Evidence:** `NotificationResponseManager` returns early when the active org slug is null, and does not re-attempt after org context loads. There is no branch that switches org when the link targets a different one.

**Impact:** users who tap a notification during cold start, or a link that targets an org they are a member of but not currently active in, land on the wrong screen or nothing at all.

**Proposed fix:** queue the deferred link in a ref, wait for `useActiveOrg()` to become ready, then dispatch. When the link's org slug does not match the active one, switch orgs (or prompt) before navigating. Add unit coverage for the three cases: same org, different org, org that the user is not a member of.

---

### M9. Award / deduct validation is inlined per screen

**Files:** [apps/mobile/src/app/award.tsx](../../apps/mobile/src/app/award.tsx), [apps/mobile/src/app/deduct.tsx](../../apps/mobile/src/app/deduct.tsx), [apps/mobile/src/lib/award-members.ts](../../apps/mobile/src/lib/award-members.ts), [apps/mobile/src/lib/point-deduction.ts](../../apps/mobile/src/lib/point-deduction.ts).

**Evidence:** each screen inlines reason length rules (3–240) and delta range checks. Filtering rules for eligible members live in per-flow lib files with slightly different signatures.

**Impact:** the two flows can diverge silently. There is no shared unit test for "the rules the mobile client enforces before hitting the API."

**Proposed fix:** move the shared point operation schema into `@housepoints/contracts` (a `pointOperationInputSchema` used by both flows). Both screens compute `canSubmit` from the same schema. Add small unit tests for the shared schema.

---

### M10. Component and screen test coverage is very thin

**Files:** [apps/mobile/src/components/device-registration-manager-core.test.ts](../../apps/mobile/src/components/device-registration-manager-core.test.ts), the rest of [apps/mobile/src/components](../../apps/mobile/src/components), [apps/mobile/vitest.config.ts](../../apps/mobile/vitest.config.ts).

**Evidence:** lib utilities are well tested. Components (`ReactionPickerModal`, `ReactionDetailsModal`, `AlertsHeaderButton`, `DeviceRegistrationManager`) have no tests. No screen integration tests. The `e2e/` directory does not contain a runnable Detox suite.

**Impact:** any refactor of a component or screen risks regression with no safety net. This makes the M1 and M2 refactors riskier than they need to be.

**Proposed fix:** land a small set of component tests (`ReactionPickerModal` open/select/close, `AlertsHeaderButton` badge count, `DeviceRegistrationManager` register/unregister lifecycle) before starting M1. Land one integration test per critical flow (award happy path, notification tap → deep link) before starting M5.

---

## Platform (API + shared packages)

### P1. Multi-org membership preference is "first result wins"

**File:** [apps/api/src/membership-context.ts](../../apps/api/src/membership-context.ts).

**Evidence:** `pickPreferredMembership` returns `memberships[0]`. There is no persisted user preference and no tiebreak by recency or activity.

**Impact:** a user who belongs to multiple orgs can be routed to a different one across sessions or after DB result ordering changes. Documented multi-org support is undermined by an implicit non-choice.

**Proposed fix:** add `User.preferredOrganizationId` (nullable) plus a fallback rule (most recent activity, then most recent join). Expose the preference in profile settings on web and mobile. Migrate existing users by backfilling the preference from their current active session.

---

### P2. Membership + house preconditions are re-implemented per handler

**Files:** [apps/api/src/routes/points.ts](../../apps/api/src/routes/points.ts), [apps/api/src/routes/admin.ts](../../apps/api/src/routes/admin.ts), [apps/api/src/routes/dashboard.ts](../../apps/api/src/routes/dashboard.ts).

**Evidence:** most write handlers repeat some variant of "load target membership, verify `organizationId`, verify `houseId` is set, verify not archived, produce a typed error otherwise." Handlers each produce slightly different `code` strings.

**Impact:** the same rule is enforced in ~15 places and can drift. Clients see inconsistent error `code`s for the same underlying condition.

**Proposed fix:** add `requireTargetMembership(organizationId, userId, { requireHouse?, requireActive? })` in `route-helpers.ts`. Return `{ ok: true, membership } | { ok: false, code, statusCode, message }` with a fixed enum of codes (`MEMBER_NOT_FOUND`, `MEMBER_ARCHIVED`, `MEMBER_UNASSIGNED_HOUSE`, `MEMBER_CROSS_ORG`). Route handlers become one call + one guard.

---

### P3. Error response shape is not uniformly enforced

**Files:** [apps/api/src/routes/points.ts](../../apps/api/src/routes/points.ts), [apps/api/src/routes/seasons.ts](../../apps/api/src/routes/seasons.ts), [apps/api/src/routes/admin.ts](../../apps/api/src/routes/admin.ts), [apps/api/src/route-helpers.ts](../../apps/api/src/route-helpers.ts).

**Evidence:** some routes throw typed errors (`SeasonScopeError`, `OrganizationCapacityError`) that a wrapper converts; others `reply.status(...).send({ code, message })` inline; others send `{ error: "..." }`.

**Impact:** clients cannot rely on `error.code` being present. The web and mobile action-error paths hedge with fallback strings, which erodes error localization and Seq alerting.

**Proposed fix:** define `apiErrorResponseSchema` in `@housepoints/contracts` (`{ code: string, message: string, details?: ... }`). Add a Fastify `onError` hook that normalizes any thrown error into that shape. Update the small number of inline `reply.send` sites to use a `sendApiError(reply, code, message, status)` helper. Assert the shape in one integration test that runs every 4xx path.

---

### P4. Structured logging is defined for many events that are never emitted

**Files:** [apps/api/src/logging.ts](../../apps/api/src/logging.ts), [apps/api/src/routes/dashboard.ts](../../apps/api/src/routes/dashboard.ts), [apps/api/src/routes/points.ts](../../apps/api/src/routes/points.ts).

**Evidence:** `ApiLogEvent` declares 50+ events. Grep shows the read-side (dashboard summary, leaderboard, activity list, reactions list) rarely calls `info(request.log, ...)` around the load — the emit sites concentrate on writes.

**Impact:** Seq dashboards for slow-load investigation are incomplete. A slow dashboard on mobile shows up as "app was slow" without a matching API event to correlate.

**Proposed fix:** at each read service function boundary, emit one structured `info` event on success with request duration and result counts, and one `warn` on failure with the reason. Keep the event names inside `ApiLogEvent`. Add a small helper `withTiming(logger, event, fn)` that measures and logs once so this stays boilerplate-free.

---

### P5. Dashboard summary loads unbounded aggregates

**File:** [apps/api/src/routes/dashboard.ts](../../apps/api/src/routes/dashboard.ts).

**Evidence:** `loadDashboardSummaryData` runs several `pointTransaction.groupBy` calls (monthly totals, house totals, member totals, contributors) with no `take` limits, in parallel with the recent activity `findMany({ take: 10 })`. This is fine for the current member counts but is the shape that will fail first as orgs grow.

**Impact:** for a large org (thousands of members, hundreds of thousands of transactions), a single dashboard load fans out into full-table scans and pins connections. Mobile dashboards will start to time out before web does.

**Proposed fix:** two-step. First, add per-groupBy timing and result-count structured logging (see P4) so we can watch the curve. Second, introduce a lightweight summary cache — either a `unstable_cache` around the summary function keyed by `(orgId, seasonId)` with short TTL, or a materialized table refreshed on point mutation — before the p95 becomes a problem. Do not do this until logs show it is warranted.

---

### P6. Loose contract types for audit/evidence payloads

**Files:** [packages/contracts/src/admin-schemas.ts](../../packages/contracts/src/admin-schemas.ts), [packages/contracts/src/platform-schemas.ts](../../packages/contracts/src/platform-schemas.ts) (search: `z.record(z.string(), z.unknown())` and `z.record(z.string(), z.string().nullable())`).

**Evidence:** audit event metadata and evidence snapshots are typed as `z.record(z.string(), z.string().nullable())` and `z.record(z.string(), z.unknown())`.

**Impact:** clients cannot rely on shape. Seq queries on audit metadata require manual field awareness. Compliance work (export, redaction) has no compile-time contract to lean on.

**Proposed fix:** define a discriminated union of audit metadata per event `code`. Keep evidence snapshots typed to the actual moderation target shapes (member, org, notification) using existing schemas. Add one narrowing helper per audit type so downstream code gets typed fields instead of `unknown`.

---

### P7. Push dispatcher does not clean up dead device tokens

**File:** [apps/api/src/push-dispatcher.ts](../../apps/api/src/push-dispatcher.ts).

**Evidence:** `ExpoPushDispatcher.send()` sends the batch and does not act on ticket-level errors like `DeviceNotRegistered` or receipt-level errors returned by Expo's receipts endpoint.

**Impact:** stale tokens (user uninstalled, logged out of Expo) accumulate. Every notification wastes a dispatch attempt against them. The token pool grows silently.

**Proposed fix:** parse the ticket response. For `DeviceNotRegistered`, mark the corresponding `DeviceRegistration.revokedAt = now()` via a small revocation helper. Emit a `notifications.push_token_revoked` structured event (extend `ApiLogEvent`). Optionally, add a scheduled receipts-fetch job to pick up delayed device-not-registered signals.

---

### P8. Service functions are only tested via route-level tests

**Files:** [apps/api/src/routes/points.ts](../../apps/api/src/routes/points.ts), [apps/api/src/app.test.ts](../../apps/api/src/app.test.ts).

**Evidence:** most business-logic functions in `routes/*.ts` (e.g. `createPointAward`, `reactToPointTransaction`, `renameSeasonInDb`) have no colocated unit tests. Their edge cases are only exercised through `app.test.ts` route tests, which set up Fastify, Auth, and Prisma mocks.

**Impact:** every service-level regression check requires an HTTP-level test. Concurrency and rollback edge cases are hard to model.

**Proposed fix:** now that pass 2 has factored these into exported service functions, colocate a `points.service.test.ts` (and equivalents) with focused Prisma mocks. Route tests stay for wiring/auth checks; service tests own behavior.

---

### P9. Org slug resolution does not surface archived / suspended state

**File:** [packages/db/src/organization-slugs.ts](../../packages/db/src/organization-slugs.ts) and callers.

**Evidence:** slug resolution returns the org record without indicating whether it is archived or suspended. Route helpers check status inline in some paths.

**Impact:** the same guard is repeated at each entry point and is easy to omit on a new route.

**Proposed fix:** return `{ org, status: "active" | "suspended" | "archived" }` (or throw a typed error when a caller opts into strict). Update one caller at a time. Add an assertion in a shared helper so any handler that receives a non-active slug returns a consistent typed error.

---

## Not-a-finding — verified during audit

Two initial draft findings were disproven during verification and are not included above:

- **Missing `Notification (organizationId, type, createdAt)` index.** The index exists at `packages/db/prisma/schema.prisma` line ~374 (`@@index([organizationId, type, createdAt])`).
- **Reactions handler is missing `dispatchPushForNotifications`.** The handler at `apps/api/src/routes/points.ts` around line 1088 does dispatch on `result.pushNotification`.
