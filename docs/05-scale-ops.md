# Tier 5 - Scale & Ops

Prepares the system for growth and multi-team use.

---

## 5.1 DB backups [done]

**Status:** Covered operationally through Railway Postgres point-in-time recovery (PITR).

**Problem:** Railway Postgres has no automatic backup configured out of the box on the free/hobby plan.

**Options:**
- **Railway Pro** - enables point-in-time recovery automatically
- **pg_dump via cron** - a small Railway cron service runs `pg_dump` nightly and uploads to S3 / Cloudflare R2

For an internal team app the simplest approach is enabling Railway's built-in PITR/backups. Cost should be monitored after enabling, but no application code is required.

---

## 5.2 Staging environment [done]

**Status:** Implemented operationally. The Railway staging environment exists and is linked to the `develop` branch.

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

## 5.3 Connection pooling [done]

**Problem:** Each API process opens a direct `pg` pool to Postgres. At low traffic this is fine, but under load (or with multiple API replicas) connection count grows linearly.

**Implemented first step:** The shared Prisma/Postgres client caps the direct `pg` pool with `DATABASE_POOL_MAX`, defaulting to `5` connections per process. This is a conservative low-effort pool cap, not a replacement for PgBouncer or Prisma Accelerate if traffic later grows.

**Options:**

| Option | Effort | Notes |
|--------|--------|-------|
| Reduce pool size in `PrismaPg` constructor (`max: 5`) | Minimal | Quick win, reduces idle connections |
| PgBouncer sidecar on Railway | Medium | Transaction-mode pooling, requires `pgbouncer` service |
| Prisma Accelerate | Low | Drop-in replacement for the adapter, adds connection pooling + query caching |

**Current setting:** Leave `DATABASE_POOL_MAX` unset to use the default of `5`, or set it explicitly per Railway environment if staging or production needs different tuning.

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

## 5.5 Org settings, owner transfer, deeper admin removal, and org deletion [doing]

The app supports creating and joining organizations. Owners can update organization settings from Manage Settings, and sensitive changes are audited. Broader organization administration remains future work.

Deferred sub-features:

- Rename organization display name. Implemented for owners in Manage Settings.
- Change organization slug safely. Alias/reservation support, owner-only slug changes, slug-bearing invite URLs, and slug-based dashboard routes are implemented. Design guidance lives in [Organization Settings Design](./org-settings-design.md).
- Transfer owner role. Implemented for owners in Manage Settings. The acting owner becomes an admin, the selected member becomes owner, and the change is audited.
- Define deeper admin-removal rules. Owner-only member promotion and admin demotion are implemented in Manage Team with audited role changes.
- Remove users from an organization. Implemented for owners in Manage Team. The user row is preserved, org-scoped fields are cleared, role resets to member, related notifications are archived, and the removal is audited.
- Delete or archive an organization. Archive-first product and engineering rules are specified in [Organization Lifecycle And Archive Design](./org-lifecycle-archive-design.md). The first data/API slice is implemented: organizations can be archived by owners, normal active-context resolution excludes archived organizations, and archive actions are audited.

Recommended remaining order:

1. Add archived-state web handling for `/o/{slug}`.
2. Add Manage Settings lifecycle danger-zone UI with owner-only archive confirmation.
3. Continue release automation phase 2.
4. Expand staging E2E coverage for owner and admin flows.
5. Return to product work with existing-member create-new-org support.

---

## 5.6 Multi-org membership model [done]

Users now belong to organizations through `OrganizationMembership`, with role and house assignment scoped per organization. The legacy `User.organizationId`, `User.role`, and `User.houseId` fields have a removal migration after the membership backfill and read/write migration.

Design status: the staged migration plan lives in [Multi-Org Membership Design](./multi-org-membership-design.md). Runtime reads and writes use active memberships, the web resolves active organization state through membership contexts, and the schema-removal migration is in place.

Implemented approach:

1. Add and backfill `OrganizationMembership`.
2. Move role and house assignment reads/writes out of `User` and into membership scope.
3. Add active-organization selection in the web session.
4. Update actor resolution to return a membership-scoped actor.
5. Remove legacy user org, role, and house fields after the backfill and compatibility guards are in place.

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
