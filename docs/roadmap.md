# HousePoints Roadmap

Production readiness work organised into tiers by priority.
Each tier has its own file with detailed task breakdowns.

## Status key
- ✅ Done
- 🔄 In progress
- ⬜ Not started

---

## Tier 1 — Correctness & Security
> Must-haves before this is used by a real team. See [01-correctness.md](./01-correctness.md)

| # | Task | Status |
|---|------|--------|
| 1.1 | Display name edit (in-app profile settings) | ✅ |
| 1.2 | `revalidatePath` after all mutating server actions | ✅ |
| 1.3 | Toast feedback on server action success / failure | ✅ |
| 1.4 | Rate limiting on API (`@fastify/rate-limit`) | ✅ |
| 1.5 | Error boundary — API failure shows graceful UI, not Next.js crash page | ✅ |
| 1.6 | Confirm `db:deploy` runs on Railway API start so migrations auto-apply | ✅ |

---

## Tier 2 — Reliability & Observability
> Makes failures visible and the system self-healing. See [02-reliability.md](./02-reliability.md)

| # | Task | Status |
|---|------|--------|
| 2.1 | Wire up a log drain (SEQ / Axiom / Logtail) on Railway | ⬜ |
| 2.2 | Configure Railway health check against `GET /health` | ⬜ |
| 2.3 | `error.tsx` global error boundary in Next.js app | ✅ |
| 2.4 | Structured error responses from API (consistent `code` + `message`) | ✅ |

---

## Tier 3 — User Experience
> Brings the UI to a polished, daily-use standard. See [03-ux.md](./03-ux.md)

| # | Task | Status |
|---|------|--------|
| 3.1 | Per-member points on Leaderboard tab (new API endpoint) | ✅ |
| 3.2 | Optimistic score update after awarding points | ⬜ |
| 3.3 | Activity feed pagination / load-more (currently capped at 50) | ⬜ |
| 3.4 | Admin: edit existing house color / description | ✅ |
| 3.5 | Mobile header — collapse nav into a menu on small screens | ✅ |

---

## Tier 4 — Testing & CI
> Prevents regressions as the team grows. See [04-testing-ci.md](./04-testing-ci.md)

| # | Task | Status |
|---|------|--------|
| 4.1 | Vitest unit tests — Zod schemas + utility functions | ✅ |
| 4.2 | Fastify integration tests via `app.inject` | ✅ |
| 4.3 | GitHub Actions workflow: lint → type-check → build on every PR | ✅ |
| 4.4 | Playwright e2e: login → award points → see score update | ⬜ |

---

## Tier 5 — Scale & Ops
> Prepares for growth and multi-team use. See [05-scale-ops.md](./05-scale-ops.md)

| # | Task | Status |
|---|------|--------|
| 5.1 | DB backups configured in Railway | ⬜ |
| 5.2 | Staging environment (Railway environments) | ⬜ |
| 5.3 | Connection pooling via PgBouncer or Prisma Accelerate | ⬜ |
| 5.4 | Multi-org onboarding flow (schema already supports it) | ⬜ |
