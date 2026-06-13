# HousePoints

Monorepo scaffold for a house-based team points app, designed so web and a future mobile app can share the same backend API and contracts.

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
- Auth0 variables in `apps/web/.env` (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`)

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

- `House` with four enum values: `AURORA`, `EMBER`, `TIDE`, `GROVE`
- `User` linked to house and Auth0 subject
- `PointTransaction` as immutable score log (`delta`, `reason`, actor, target house)

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
	- `leaderboard.fetched`
	- `points.actor_not_found`
	- `points.actor_house_unassigned`
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

## Next Steps

- Add Auth0 route handlers and session integration in `apps/web`.
- Add API authorization middleware to map Auth0 users to internal `User` records.
- Add leaderboard and transaction feed UI in `apps/web` using `@housepoints/contracts` types.
