# Tier 5 — Scale & Ops

Prepares the system for growth and multi-team use.

---

## 5.1 DB backups ⬜

**Problem:** Railway Postgres has no automatic backup configured out of the box on the free/hobby plan.

**Options:**
- **Railway Pro** — enables point-in-time recovery automatically
- **pg_dump via cron** — a small Railway cron service runs `pg_dump` nightly and uploads to S3 / Cloudflare R2

For an internal team app the simplest approach is upgrading to Railway Pro and enabling the built-in backup.

---

## 5.2 Staging environment ⬜

**Goal:** Test migrations and new features against real data shapes without risking production.

**Approach:**
- Create a new Railway environment (`staging`) from the same repo
- Separate Postgres service in staging
- GitHub Actions deploys to staging on merge to `main`, production on tagged releases

**Env var differences to manage:**
- `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` — separate Auth0 application for staging (or same tenant, different application)
- `APP_BASE_URL` — staging URL
- `DATABASE_URL` — staging Postgres

---

## 5.3 Connection pooling ⬜

**Problem:** Each API process opens a direct `pg` pool to Postgres. At low traffic this is fine, but under load (or with multiple API replicas) connection count grows linearly.

**Options:**

| Option | Effort | Notes |
|--------|--------|-------|
| Reduce pool size in `PrismaPg` constructor (`max: 5`) | Minimal | Quick win, reduces idle connections |
| PgBouncer sidecar on Railway | Medium | Transaction-mode pooling, requires `pgbouncer` service |
| Prisma Accelerate | Low | Drop-in replacement for the adapter, adds connection pooling + query caching |

**Recommended first step:** Set `max: 5` in the `Pool` constructor in `packages/db/src/client.ts` — low effort, immediate reduction.

---

## 5.4 Multi-org onboarding ⬜

**Problem:** The schema fully supports multiple organisations, but there's no onboarding flow. New teams can only be set up by direct DB inserts.

**Approach:**

1. **Invite flow** — admin generates an invite link with a signed token containing `organizationSlug`
2. **New user signup** — if invite token present in session, `bootstrapUser` uses that org's slug instead of the default
3. **Org creation** — a super-admin screen (or CLI script) to create new orgs + initial houses
4. **`APP_ORGANIZATION_SLUG` env var** — currently hard-wires all users into one org; multi-org requires this to be dynamic (derived from the invite or subdomain)

This is the largest piece of work in the roadmap and should wait until the app is proven with the initial team.
