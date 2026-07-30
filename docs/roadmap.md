# HousePoints Roadmap

Production readiness work organised into tiers by priority.
Each tier has its own file with detailed task breakdowns.

## Status key
- [done] Done
- [doing] In progress
- [todo] Not started

---

## Tier 1 - Correctness & Security
> Must-haves before this is used by a real team. See [01-correctness.md](./01-correctness.md)

| # | Task | Status |
|---|------|--------|
| 1.1 | Display name edit (in-app profile settings) | [done] |
| 1.2 | `revalidatePath` after all mutating server actions | [done] |
| 1.3 | Toast feedback on server action success / failure | [done] |
| 1.4 | Rate limiting on API (`@fastify/rate-limit`) | [done] |
| 1.5 | Error boundary - API failure shows graceful UI with retry, logout, and home recovery | [done] |
| 1.6 | Confirm `db:deploy` runs on Railway API start so migrations auto-apply | [done] |
| 1.7 | Auth identity linking for alternate Auth0 social providers sharing one verified email | [done] |

---

## Tier 2 - Reliability & Observability
> Makes failures visible and the system self-healing. See [02-reliability.md](./02-reliability.md)

| # | Task | Status |
|---|------|--------|
| 2.1 | Wire up structured server logs to SEQ | [done] |
| 2.2 | Configure Railway health check against `GET /health` | [done] |
| 2.3 | `error.tsx` global error boundary in Next.js app | [done] |
| 2.4 | Structured error responses from API (consistent `code` + `message`) | [done] |
| 2.5 | Browser-side client error reporting | [done] |

---

## Tier 3 - User Experience
> Brings the UI to a polished, daily-use standard. See [03-ux.md](./03-ux.md)

| # | Task | Status |
|---|------|--------|
| 3.1 | Per-member points on Leaderboard tab (new API endpoint) | [done] |
| 3.2 | Leaderboard refreshes after awarding points without a full browser refresh | [done] |
| 3.3 | Activity feed cursor pagination API | [done] |
| 3.4 | Activity feed load-more UI | [done] |
| 3.5 | Admin: edit existing house color / description | [done] |
| 3.6 | Mobile header - collapse nav into a menu on small screens | [done] |
| 3.7 | Admin/owner soft delete for point awards plus recent-deletions Manage report | [done] |
| 3.8 | Seasons UX pass: selector, historical reports, Manage controls, and current-season status | [done] |
| 3.9 | Manage Team layout cleanup plus invite-generation/use reporting | [done] |
| 3.12 | Manage resource workspaces refactor | [done] |

---

## Tier 4 - Testing & CI
> Prevents regressions as the team grows. See [04-testing-ci.md](./04-testing-ci.md)

| # | Task | Status |
|---|------|--------|
| 4.1 | Vitest unit tests - Zod schemas + utility functions | [done] |
| 4.2 | Fastify integration tests via `app.inject` | [done] |
| 4.3 | GitHub Actions workflow: install, generate, lint, type-check, test, coverage, build | [done] |
| 4.4 | Database-backed integration tests in CI | [done] |
| 4.5 | Playwright e2e: login -> award points -> see score update, with scheduled staging workflow | [done] |
| 4.6 | Manual GitHub Pages release notes publishing | [done] |

---

## Tier 5 - Scale & Ops
> Prepares for growth and multi-team use. See [05-scale-ops.md](./05-scale-ops.md)

| # | Task | Status |
|---|------|--------|
| 5.1 | DB backups configured in Railway | [done] |
| 5.2 | Staging environment (Railway environments) | [done] |
| 5.3 | Connection pooling via capped direct Postgres pool | [done] |
| 5.4 | Self-serve org creation and single-use invite joining | [done] |
| 5.5 | Org settings, owner transfer, member removal, and archive/restore lifecycle | [done] |
| 5.6 | Multi-org membership model | [done] |
| 5.7 | Query count and response-time baselines for empty, typical, and larger orgs | [done] |

---

## Tier 6 - Mobile
> First-party iOS/Android app that reuses the existing API, contracts, and Auth0 tenant. See [mobile-app-design.md](./mobile-app-design.md)

| # | Task | Status |
|---|------|--------|
| 6.0 | Triage open questions in the mobile design doc (push provider, bootstrap endpoint, shared theme, admin scope, bundle id/scheme, Expo Updates) | [done] |
| 6.0a | Extract `packages/theme` (design tokens + house-color math) and refactor `apps/web` to consume it | [done] |
| 6.1 | Spike: scaffold `apps/mobile` (Expo + TS) and prove Auth0 native PKCE against the existing API `AUTH0_AUDIENCE` | [done] |
| 6.2 | Phase 1 MVP - sign in, org picker, dashboard, leaderboard, activity feed with pagination, award points, profile display-name edit | [done] |
| 6.3 | Phase 1 MVP - in-app notifications list, mark-read, and pull-to-refresh across primary tabs | [done] |
| 6.4a | Phase 2 - `DeviceRegistration` Prisma model + migration, `device-schemas` contracts, `POST /devices/register` + `POST /devices/unregister` routes with tests | [done] |
| 6.4b | Phase 2 - `PushDispatcher` interface + Expo Push implementation, wire into notification-writer call sites (points, admin, orgs, seasons, releases), structured logging (`notifications.push_dispatched`, `notifications.push_failed`), env config (`EXPO_ACCESS_TOKEN`, `PUSH_DISPATCH_ENABLED`). See §7.2 of [mobile-app-design.md](./mobile-app-design.md) | [done] |
| 6.5a | Phase 2 - Mobile-side device registration: request notification permission on first launch, obtain Expo push token, call `POST /devices/register` on sign-in and on active-org change; call `POST /devices/unregister` on sign-out | [done] |
| 6.5b | Phase 2 - Deep links: `expo-router` linking config for `housepoints://o/<slug>/dashboard`, `housepoints://o/<slug>/activity/<pointId>`, `housepoints://invite/<token>`. Notification tap → route through the same linking config | [done] |
| 6.5c | Phase 2 - Point reactions on activity feed (`POST /transactions/react`, `GET /transactions/reactions`) with optimistic updates and long-press affordance mirroring the web pattern | [done] |
| 6.6a | Phase 3 - Admin gate: `MOBILE_ADMIN_ENABLED` feature flag + admin tab that only renders for `ADMIN`/`OWNER` roles; empty-state that deep-links to web for out-of-scope flows | [done] |
| 6.6b | Phase 3 - Manage members: house assignment (`POST /admin/users/assign-house`), role changes (`POST /admin/users/role`), remove member (`POST /admin/users/remove`) | [done] |
| 6.6c | Phase 3 - Invite generation + native share sheet (`POST /orgs/invite` + React Native `Share`; `expo-sharing` is file-only) | [done] |
| 6.6d | Phase 3 - Point deduction flow (`POST /points/deduct`), gated by `POINT_ADJUSTMENTS_ENABLED` from `EXPO_PUBLIC_POINT_ADJUSTMENTS_ENABLED` | [done] |
| 6.7a | Mobile CI - GitHub Actions workflow mirroring api/web: typecheck + lint + test for `@housepoints/mobile` on PR; caching for Expo/EAS | [done] |
| 6.7b | Mobile CI - Maestro E2E flow (sign-in → dashboard → award-points) against staging on `develop`; secret + environment plumbing documented in [release-and-e2e-automation.md](./release-and-e2e-automation.md) | [done] |
| 6.7c | Mobile CI - EAS Build profiles (`development`, `preview`, `production`) + Expo Updates channels; document rollback via `eas update --republish` | [todo] |
| 6.8 | Release - TestFlight + Play internal tracks, then public store submissions after two consecutive clean staging E2E runs | [todo] |

### Tier 6 handoff notes (2026-07-30)

Phase 1 MVP is fully in place (6.0 – 6.3). Phase 2 backend is complete:
6.4a provides device registration and 6.4b provides best-effort Expo push
dispatch after committed in-app notifications. Mobile-side device registration
and deep links are complete. Phase 2 mobile activity reactions are complete;
the role-aware mobile admin gate, member management, invite sharing, and
feature-gated point deduction, mobile pull-request CI, and the Maestro staging
smoke are complete. EAS Build profiles and Expo Updates channels (6.7c) are
the next slice.

Key context for whoever picks this up next:

- **Server notification dispatch** — `dispatchPushForNotifications` runs after
  notification-producing transactions commit in `points.ts`, `admin.ts`,
  `orgs.ts`, `seasons.ts`, and `releases.ts`. It looks up active,
  organization-scoped device registrations and calls the injected
  `PushDispatcher`. The Expo implementation batches at 100 messages and remains
  replaceable without changing notification writers.
- **Eligible notification types for push** — `POINT_AWARD_RECEIVED`, `POINT_DEDUCTION_RECEIVED`, `POINT_REACTION_RECEIVED`, `INVITE_ACCEPTED`, `ROLE_CHANGED`, `SEASON_STARTED`, `RELEASE_ANNOUNCEMENT`, `MEMBER_NEEDS_HOUSE_ASSIGNMENT` (admins only). Non-pushable types should short-circuit before the HTTP call.
- **Test approach** — mock `deviceRegistration.findMany` and the `PushDispatcher` in `apps/api/src/app.test.ts` (`deviceRegistration` delegate is already in the top-level `vi.mock` block). Assert both the persist happens and the dispatcher is called with the expected payload.
- **Mobile screens shipped** — Home, Leaderboard, Activity (paginated), Award (modal), Profile (display-name edit), Notifications (list + mark-read + mark-all-read). All under `apps/mobile/src/app/`. The `AlertsHeaderButton` in `apps/mobile/src/components/` drives the Home-tab unread badge.
- **Mobile push registration** — `DeviceRegistrationManager` observes the
  authenticated user and active organization. It requests permission only when
  undetermined, skips simulators, registers the Expo token after sign-in and
  org changes, and unregisters the stored token during sign-out.
- **Mobile deep links** — Expo Router adapters implement the dashboard,
  activity, and invite URLs. `NotificationResponseManager` sends foreground,
  background, and cold-start notification taps through the shared parser.
  Invite tokens remain untrusted until `/orgs/join` verifies them.
- **Mobile reactions** — award rows expose a visible picker and long-press
  shortcut. Optimistic summaries roll back on failure and reconcile after the
  mutation settles. Summary chips load `/transactions/reactions`; deductions
  remain non-reactable.
- **Mobile admin gate** — `EXPO_PUBLIC_MOBILE_ADMIN_ENABLED` and the active
  membership role jointly control the Admin tab, and the route repeats the
  authorization guard. The empty state links to the active organization’s web
  Manage workspace for intentionally out-of-scope flows.
- **TanStack Query gotcha (documented in `/memories/repo/ui-notes.md`)** — `z.output<generic>` collapses to `any` at the queryFn boundary. Workaround: destructure to a local with an explicit annotation, e.g. `const data: PagedNotifications | undefined = query.data`. Continue this pattern in 6.5c reactions and 6.6b admin screens.
- **Working agreement (from `AGENTS.md`)** — one focused slice per commit; agent does not commit or push. Definition of done for a slice touching production runtime: typecheck + test + build + lint green for touched workspaces. Contracts must be rebuilt (`npm.cmd run build -w @housepoints/contracts`) after schema edits so downstream workspaces see them.

