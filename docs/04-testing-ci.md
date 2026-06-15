# Tier 4 — Testing & CI

Prevents regressions as the codebase grows.

---

## 4.1 Vitest unit tests ⬜

**Scope:** Pure logic — Zod schemas, utility functions, data transformations.

**Setup:**
```bash
npm install -D vitest @vitest/coverage-v8 -w @housepoints/contracts
npm install -D vitest -w @housepoints/api
```

**Test targets:**
- `packages/contracts` — every schema: valid inputs pass, invalid inputs produce the right error paths
- `apps/api/src/logging.ts` — `info`, `warn`, `error` call logger methods with correct shape
- Future utility functions (e.g. point total calculations)

---

## 4.2 Fastify integration tests ⬜

**Scope:** API route behaviour — correct status codes, response shapes, auth guards.

**Approach:** Use `app.inject()` (no real network) with a mocked Prisma client.

```typescript
// apps/api/src/app.test.ts
import { buildApp } from "./app.js"; // extract app setup into a factory function
const app = await buildApp();
const res = await app.inject({ method: "GET", url: "/health" });
expect(res.statusCode).toBe(200);
```

**Prerequisite:** Complete. `apps/api/src/app.ts` exports a side-effect-free `buildApp()` factory, while `apps/api/src/server.ts` owns the network listener.

**Key routes to test:**
- `GET /health`
- `POST /users/bootstrap` — creates user, returns idempotent on repeat
- `POST /points/adjust` — rejects unmapped actor, rejects cross-org house, creates transaction
- `POST /admin/houses` — rejects non-admin, creates house
- `POST /admin/users/assign-house` — rejects different-org target

---

## 4.3 GitHub Actions CI ⬜

**Trigger:** Every push and PR to `main`.

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint --workspaces --if-present
      - run: npm run build --workspaces
```

Add `DATABASE_URL` as a GitHub Actions secret (or use a SQLite adapter for CI if you want to avoid a real DB dependency during type-check-only runs).

---

## 4.4 Playwright e2e ⬜

**Scope:** Critical happy path only — not exhaustive.

**Prerequisite:** A seeded test database (or a Railway staging environment, see Tier 5).

**Test plan:**

1. **Login flow** — visit `/`, get redirected to Auth0, sign in with test credentials, land on dashboard
2. **Award points** — click Award Points, select a house, enter amount + reason, submit, confirm house score increments
3. **Activity feed** — switch to Activity tab, confirm the new transaction appears
4. **Settings** — navigate to `/settings`, update display name, return to dashboard, confirm name updated

**Setup:**
```bash
npm install -D @playwright/test -w @housepoints/web
npx playwright install chromium
```
