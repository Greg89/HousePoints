# Tier 5 - Scale & Ops

Prepares the system for growth and multi-team use.

---

## 5.1 DB backups [todo]

**Problem:** Railway Postgres has no automatic backup configured out of the box on the free/hobby plan.

**Options:**
- **Railway Pro** - enables point-in-time recovery automatically
- **pg_dump via cron** - a small Railway cron service runs `pg_dump` nightly and uploads to S3 / Cloudflare R2

For an internal team app the simplest approach is upgrading to Railway Pro and enabling the built-in backup.

---

## 5.2 Staging environment [todo]

**Goal:** Test migrations and new features against real data shapes without risking production.

**Approach:**
- Create a new Railway environment (`staging`) from the same repo
- Separate Postgres service in staging
- GitHub Actions deploys to staging on merge to `main`, production on tagged releases

**Env var differences to manage:**
- `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` - separate Auth0 application for staging (or same tenant, different application)
- `APP_BASE_URL` - staging URL
- `DATABASE_URL` - staging Postgres

---

## 5.3 Connection pooling [todo]

**Problem:** Each API process opens a direct `pg` pool to Postgres. At low traffic this is fine, but under load (or with multiple API replicas) connection count grows linearly.

**Options:**

| Option | Effort | Notes |
|--------|--------|-------|
| Reduce pool size in `PrismaPg` constructor (`max: 5`) | Minimal | Quick win, reduces idle connections |
| PgBouncer sidecar on Railway | Medium | Transaction-mode pooling, requires `pgbouncer` service |
| Prisma Accelerate | Low | Drop-in replacement for the adapter, adds connection pooling + query caching |

**Recommended first step:** Set `max: 5` in the `Pool` constructor in `packages/db/src/client.ts` - low effort, immediate reduction.

---

## 5.4 Self-serve org creation and single-use invite joining [done]

**Original problem:** New teams could only be set up by direct database inserts, and first owners could become stuck without a house assignment.

**Implemented approach:**

- A signed-in user without an organization can create a new organization.
- Organization creation requires explicit first-house setup.
- Organization creation, first house creation, owner assignment, active-season creation, and auth identity linking happen atomically.
- Admin/owner users can generate single-use invite links.
- Invited users can join the organization and land in the correct assigned/unassigned state.
- Expired, reused, malformed, and concurrently claimed invites return deterministic stable errors.
- Same-email alternate provider conflicts return `ACCOUNT_LINK_REQUIRED` unless the email claim is verified and safe to link.

---

## 5.5 Org settings, owner transfer, admin removal, and org deletion [todo]

The app supports creating and joining organizations, but broader organization administration remains future work.

Deferred sub-features:

- Rename organization.
- Change organization slug safely.
- Transfer owner role.
- Promote/demote admins beyond the existing owner/admin policy checks.
- Remove users from an organization.
- Delete or archive an organization.

---

## 5.6 Multi-org membership model [todo]

Current users belong to one organization through `User.organizationId`. That is enough for the first production shape, but it does not support one person switching between multiple organizations.

Future approach:

1. Add an `OrganizationMembership` join table with role and house assignment per organization.
2. Move role and house assignment out of `User` and into membership scope.
3. Add active-organization selection in the web session.
4. Update actor resolution to return a membership-scoped actor.
5. Backfill existing users into one membership each before switching reads.

---

## 5.7 Dashboard performance baselines [done]

The dashboard API bundle now has a repeatable benchmark for empty, typical, and larger organizations:

```powershell
npm run db:deploy
npm run benchmark:dashboard
```

The current owner dashboard bundle has an expected route-level Prisma operation budget of 26 operations. The June 20, 2026 local Docker/PostgreSQL baseline recorded:

| Scenario | Bundle p50 ms | Bundle p95 ms |
|---|---:|---:|
| Empty | 44.3 | 47.4 |
| Typical | 41.9 | 50.2 |
| Larger | 51.1 | 60.0 |

Full endpoint detail lives in [Dashboard Performance Baselines](./refactor-pass-1/08-performance-baselines.md).
