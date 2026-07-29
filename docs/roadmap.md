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
| 6.1 | Spike: scaffold `apps/mobile` (Expo + TS) and prove Auth0 native PKCE against the existing API `AUTH0_AUDIENCE` | [doing] |
| 6.2 | Phase 1 MVP - sign in, org picker, dashboard, leaderboard, activity feed with pagination, award points, profile display-name edit | [todo] |
| 6.3 | Phase 1 MVP - in-app notifications list, mark-read, and pull-to-refresh across primary tabs | [todo] |
| 6.4 | Phase 2 - `DeviceRegistration` model, `/devices` routes, and push dispatch hook alongside the existing notification writer | [todo] |
| 6.5 | Phase 2 - Expo Push integration on device, deep links (`housepoints://o/<slug>/...`), and point reactions on activity feed | [todo] |
| 6.6 | Phase 3 - admin subset: member house assignment, role changes, invite generation/share, point deduction (gated by `POINT_ADJUSTMENTS_ENABLED`) | [todo] |
| 6.7 | Mobile CI - typecheck/lint/test workspace gates, Maestro E2E flow against staging, EAS Build profiles for preview and production, Expo Updates enabled on both channels | [todo] |
| 6.8 | Release - TestFlight + Play internal tracks, then public store submissions after two consecutive clean staging E2E runs | [todo] |
