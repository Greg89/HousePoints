# Tier 4 - Testing & CI

Prevents regressions as the codebase grows.

---

## 4.1 Vitest Unit Tests

**Scope:** Pure logic, server helpers, component behavior, Zod schemas, and data transformations.

**Status:** Implemented for API, web, and contracts.

Test targets:

- `packages/contracts` - shared request, response, logging, and error schemas.
- `apps/api` - Fastify route behavior, auth helpers, actor resolution, logging helpers, and config parsing.
- `apps/web` - selected server helpers and client components.

Run:

```bash
npm test
npm run test:coverage
```

---

## 4.2 Fastify Integration Tests

**Scope:** API route behavior - correct status codes, response shapes, auth guards, and tenant boundaries.

**Approach:** Use `app.inject()` with a mocked Prisma client. These tests do not open a real network listener.

```typescript
import { buildApp } from "./app.js";

const app = await buildApp();
const res = await app.inject({ method: "GET", url: "/health" });
expect(res.statusCode).toBe(200);
```

**Status:** Implemented. `apps/api/src/app.ts` exports a side-effect-free `buildApp()` factory, while `apps/api/src/server.ts` owns the network listener.

Key route groups covered include:

- health;
- user bootstrap and profile;
- point awards and scores;
- dashboard reads;
- organization creation, invites, and joins;
- admin house/user operations;
- season context, start, and rename flows.

---

## 4.3 GitHub Actions CI

**Trigger:** Every push and pull request.

**Status:** Implemented.

The workflow runs visible steps for:

- install;
- Prisma client generation;
- lint;
- type-check;
- fast tests;
- coverage;
- PostgreSQL service startup;
- migration deployment;
- database integration tests;
- production build.

---

## 4.4 Database-Backed Integration Tests

**Scope:** Real PostgreSQL and Prisma behavior - migrations, foreign keys, uniqueness, and stable relational constraints.

**Status:** Implemented for point-ledger relationships and constraint behavior.

Local setup:

```powershell
Copy-Item packages/db/.env.example packages/db/.env

docker run --name housepoints-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=housepoints_local `
  -p 5432:5432 `
  -d postgres:16
```

Apply migrations and run the suite:

```bash
npm run db:deploy
npm run test:integration
```

The integration suite intentionally asserts that invalid operations fail. Prisma may print expected constraint errors while the command exits successfully.

---

## 4.5 Playwright E2E

**Scope:** Critical happy path only, not exhaustive.

**Status:** Deferred.

Prerequisite: a seeded test database, test Auth0 tenant, or staging environment.

Initial test plan:

1. Login flow - visit `/`, get redirected to Auth0, sign in with test credentials, land on dashboard.
2. Award points - click Award Points, select a house, enter amount and reason, submit, confirm house score increments.
3. Activity feed - switch to Activity tab and confirm the new transaction appears.
4. Settings - navigate to `/settings`, update display name, return to dashboard, confirm name updated.

Setup when this tier is prioritized:

```bash
npm install -D @playwright/test -w @housepoints/web
npx playwright install chromium
```
