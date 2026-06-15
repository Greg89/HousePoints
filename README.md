# HousePoints

A private, org-scoped house points app for recognising team members. Admins award points to individuals tied to a specific behavioural trait (Leadership, Collaboration, Innovation, etc.). Points roll up to house totals on a live leaderboard, and every award appears in a real-time activity feed.

Built as a production-grade monorepo: one Fastify API serves both the Next.js web app and any future mobile clients, with all shared types enforced through a contracts package.

---

## Workspace Layout

```
apps/
  web/          Next.js 16 frontend (App Router, Auth0, Tailwind)
  api/          Fastify 5 API (standalone, Railway service)
packages/
  db/           Prisma 7 schema, migrations, and client wrapper
  contracts/    Shared Zod schemas, TypeScript types, and Trait definitions
.github/
  workflows/
    ci.yml      GitHub Actions — lint → test → build on every push/PR
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web framework | Next.js 16.2 (App Router, Turbopack, `force-dynamic`) |
| API framework | Fastify 5 |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth0 (`@auth0/nextjs-auth0` v4) |
| Validation | Zod 4 (shared via `@housepoints/contracts`) |
| UI components | Radix UI, Framer Motion, Phosphor Icons, Sonner toasts |
| Styling | Tailwind CSS, oklch design tokens, Cinzel / Inter / JetBrains Mono |
| Testing | Vitest 4 — unit tests (contracts) + integration tests (API via `app.inject`) |
| CI | GitHub Actions |
| Hosting | Railway (separate web + API services, shared Postgres) |
| Package manager | npm workspaces |

---

## Features

- **House leaderboard** — real-time aggregate scores per house, with per-member breakdown
- **Award points dialog** — select a team member, choose a point amount, pick a trait, leave a note
- **Trait system** — 20 behavioural traits (Leadership, Collaboration, Technical Excellence, etc.) stored on every transaction for future reporting
- **Activity feed** — live log of all awards showing actor, recipient, house, delta, trait badge, and note
- **Admin panel** — create/edit houses (name, colour, description), assign members to houses
- **Settings page** — users can update their display name
- **Mobile responsive** — icon-only tabs on small screens, floating award button
- **Rate limiting** — `POST /users/bootstrap` capped at 30/min, `POST /points/adjust` at 20/min
- **Structured logging** — stable `event` keys, request IDs, org/user context on every log line
- **Graceful errors** — `error.tsx` boundary, consistent API `{ code, message }` shape

---

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL (local or Railway)
- An Auth0 application (Regular Web App, with `http://localhost:3000/auth/callback` as an allowed callback URL)

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

**`packages/db/.env`**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/housepoints
```

**`apps/api/.env`**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/housepoints
PORT=4000
AUTH0_DOMAIN=<your-tenant>.us.auth0.com
AUTH0_AUDIENCE=https://api.housepoints.example
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

**`apps/web/.env.local`**
```env
AUTH0_SECRET=<random 32+ char string>
AUTH0_DOMAIN=<your-tenant>.us.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_AUDIENCE=https://api.housepoints.example
APP_BASE_URL=http://localhost:3000
APP_API_BASE_URL=http://localhost:4000
```

Create an Auth0 API with RS256 signing and use its Identifier as
`AUTH0_AUDIENCE` in both services.

### 3. Set up the database

```bash
# Generate the Prisma client
npm run db:generate

# Run all migrations
npm run db:migrate

# (Optional) seed initial houses
npm run db:seed -w @housepoints/db
```

### 4. Start development servers

```bash
# Run both in separate terminals:
npm run dev:api     # Fastify on http://localhost:4000
npm run dev:web     # Next.js on http://localhost:3000
```

---

## Commands Reference

| Command | Description |
|---|---|
| `npm run dev:web` | Start Next.js dev server (Turbopack) |
| `npm run dev:api` | Start Fastify dev server (tsx watch) |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all Vitest tests across workspaces |
| `npm run lint` | Run ESLint across workspaces |
| `npm run db:generate` | Generate Prisma client from schema |
| `npm run db:migrate` | Create and apply a new migration (dev) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:studio` | Open Prisma Studio |

---

## Running Tests

```bash
# All workspaces
npm run test

# Contracts only (Zod schema unit tests — 40 tests)
npm run test -w @housepoints/contracts

# API only (Fastify integration tests — 17 tests)
npm run test -w @housepoints/api
```

Tests run against mocked Prisma — no live database required.

---

## API Overview

All endpoints accept and return JSON. Actors are identified by `actorAuth0Sub` (never a raw user ID from the client).

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/users/bootstrap` | First-login user creation / lookup |
| `POST` | `/users/profile` | Update display name |
| `POST` | `/users/scores` | Per-member point totals (grouped by target user) |
| `POST` | `/points/adjust` | Award points to a member (requires trait) |
| `POST` | `/admin/context` | Org-scoped user + house list (admin only) |
| `POST` | `/admin/houses` | Create or update a house (admin only) |
| `POST` | `/admin/users/assign-house` | Assign a member to a house (admin only) |
| `POST` | `/members` | List org members with house info |
| `POST` | `/transactions/recent` | Last 50 activity items with trait |
| `POST` | `/houses/leaderboard` | House scores with member counts |

Error responses always have the shape `{ code: string, message: string }`.

---

## Railway Deployment

1. Create a Postgres service in Railway.
2. Create two services from this repo — one for `apps/api`, one for `apps/web`.
3. Set environment variables per service:
   - **API**: `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and `CORS_ALLOWED_ORIGINS`; Railway injects `PORT` automatically
   - **Web**: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `AUTH0_AUDIENCE`, `APP_BASE_URL`, and `APP_API_BASE_URL`
   - Use the same Auth0 API Identifier for `AUTH0_AUDIENCE` in both services.
   - Point `APP_API_BASE_URL` at the Railway API service URL.
4. Set the API release command to `npm run db:deploy` so migrations run on every deploy.

---

## CI

Every push and pull request triggers [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

1. `npm ci` — clean install from lockfile
2. `db:generate` — generate Prisma client
3. Lint → Test → Build

---

## Pending Work

| # | Item |
|---|---|
| 2.1 | Wire up a log drain (Axiom / Logtail) on Railway |
| 2.2 | Configure Railway health check on `GET /health` |
| 3.2 | Optimistic score update after awarding points |
| 3.3 | Activity feed pagination / load-more |
| 4.4 | Playwright e2e tests (requires staging environment) |
| 5.1 | DB backups on Railway |
| 5.2 | Staging environment (Railway environments) |
| 5.3 | Connection pooling via PgBouncer or Prisma Accelerate |
| 5.4 | Multi-org onboarding flow (schema already supports it) |


## Workspace Layout

```text
apps/
	web/        Next.js frontend (Auth0 UI integration point)
	api/        Fastify API service (shared for web + future mobile)
packages/
	db/         Prisma schema, migrations, and Prisma client wrapper
	contracts/  Shared Zod schemas and TypeScript API contracts
```

## Why This Structure

- One API service supports multiple clients (web now, mobile later).
- Shared contracts reduce drift between frontend and backend.
- Shared DB package keeps data access and schema ownership in one place.
- Railway deployment can run `apps/api` and `apps/web` as separate services against one Postgres database.

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL (local or Railway)

## Environment Setup

Copy environment templates:

```powershell
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item packages/db/.env.example packages/db/.env
```

Set at minimum:

- `DATABASE_URL` in `apps/api/.env` and `packages/db/.env`
- `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` in `apps/api/.env`
- `CORS_ALLOWED_ORIGINS` in `apps/api/.env` as a comma-separated list of exact web origins
- Auth0 variables in `apps/web/.env` (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `AUTH0_AUDIENCE`, `APP_BASE_URL`)
- `APP_API_BASE_URL` in `apps/web/.env`

## Install

```bash
npm install
```

## Development Commands

- Web app: `npm run dev:web`
- API app: `npm run dev:api`
- Default dev (web): `npm run dev`

## Database Commands

- Generate Prisma client: `npm run db:generate`
- Run migration (dev): `npm run db:migrate`
- Deploy migrations (prod): `npm run db:deploy`
- Seed houses: `npm run db:seed -w @housepoints/db`
- Prisma Studio: `npm run db:studio`

## Initial Domain Models

- `Organization` as top-level tenant boundary
- `House` scoped by `organizationId`
- `User` linked to organization, optional house, and Auth0 subject
- `PointTransaction` immutable score log scoped by organization (`delta`, `reason`, actor, target house)

## Railway Deployment Notes

- Create one Postgres service.
- Deploy `apps/api` and `apps/web` as separate services from this repo.
- Provide service-specific env vars:
	- API: `DATABASE_URL`, `API_PORT`
	- Web: Auth0 vars + `APP_API_BASE_URL`
- Run `npm run db:deploy` during API release phase.

## Structured Logging (SEQ-Ready)

The API emits structured JSON logs with stable event names and contextual properties.

- Core fields included on all logs:
	- `service`
	- `env`
	- `event`
	- `requestId` (from `x-request-id` or generated)
- Request lifecycle events:
	- `request.received`
	- `request.completed`
	- `request.validation_failed`
	- `request.unhandled_error`
- Business events:
	- `users.bootstrap.created`
	- `users.bootstrap.loaded`
	- `admin.context.loaded`
	- `admin.house.created`
	- `admin.user.house_assigned`
	- `leaderboard.fetched`
	- `points.actor_not_found`
	- `points.actor_house_unassigned`
	- `points.cross_organization_target`
	- `points.adjusted`

The web app also emits structured JSON logs from server actions and auth/session boundaries.

- Web action events:
	- `web.action.invoked`
	- `web.action.completed`
	- `web.action.failed`
	- `web.auth.session_missing`
	- `web.session.read`
	- `points.adjust.requested`
	- `points.adjust.completed`

When you add new endpoints or server actions, log with an explicit `event` and attach domain fields (for example `actorUserId`, `targetHouseId`, `delta`, `transactionId`) as top-level properties.

Point adjustments now resolve the actor server-side using Auth0 subject (`actorAuth0Sub`) and never accept `actorUserId` directly from the client.

## User Bootstrap Flow

- Web server actions call `POST /users/bootstrap` after login.
- API creates a `User` row on first login (without house assignment) and returns the same record on subsequent calls.
- Point adjustments are blocked until the mapped user has a `houseId`.

## Admin Setup Endpoints

- `POST /admin/context`: admin-only org-scoped view of users and houses.
- `POST /admin/houses`: admin-only create/upsert house within actor organization.
- `POST /admin/users/assign-house`: admin-only assignment of user to house, scoped to same organization.

All admin and scoring endpoints enforce organization boundaries from the actor mapping.

## Next Steps

- Add Auth0 route handlers and session integration in `apps/web`.
- Add API authorization middleware to map Auth0 users to internal `User` records.
- Add leaderboard and transaction feed UI in `apps/web` using `@housepoints/contracts` types.
