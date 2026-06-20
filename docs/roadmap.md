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
| 2.5 | Browser-side client error reporting | [todo] |

---

## Tier 3 - User Experience
> Brings the UI to a polished, daily-use standard. See [03-ux.md](./03-ux.md)

| # | Task | Status |
|---|------|--------|
| 3.1 | Per-member points on Leaderboard tab (new API endpoint) | [done] |
| 3.2 | Leaderboard refreshes after awarding points without a full browser refresh | [done] |
| 3.3 | Activity feed cursor pagination API | [done] |
| 3.4 | Activity feed load-more UI | [todo] |
| 3.5 | Admin: edit existing house color / description | [done] |
| 3.6 | Mobile header - collapse nav into a menu on small screens | [done] |

---

## Tier 4 - Testing & CI
> Prevents regressions as the team grows. See [04-testing-ci.md](./04-testing-ci.md)

| # | Task | Status |
|---|------|--------|
| 4.1 | Vitest unit tests - Zod schemas + utility functions | [done] |
| 4.2 | Fastify integration tests via `app.inject` | [done] |
| 4.3 | GitHub Actions workflow: install, generate, lint, type-check, test, coverage, build | [done] |
| 4.4 | Database-backed integration tests in CI | [done] |
| 4.5 | Playwright e2e: login -> award points -> see score update | [todo] |

---

## Tier 5 - Scale & Ops
> Prepares for growth and multi-team use. See [05-scale-ops.md](./05-scale-ops.md)

| # | Task | Status |
|---|------|--------|
| 5.1 | DB backups configured in Railway | [todo] |
| 5.2 | Staging environment (Railway environments) | [todo] |
| 5.3 | Connection pooling via PgBouncer or Prisma Accelerate | [todo] |
| 5.4 | Self-serve org creation and single-use invite joining | [done] |
| 5.5 | Org settings, owner transfer, admin removal, and org deletion | [todo] |
| 5.6 | Multi-org membership model | [todo] |
| 5.7 | Query count and response-time baselines for empty, typical, and larger orgs | [done] |
