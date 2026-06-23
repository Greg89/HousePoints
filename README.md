# HousePoints

HousePoints is a private, organization-scoped points app for recognizing team members. Members award points to other assigned members, points roll up to house totals, and activity/reporting views stay scoped to the signed-in user's organization.

The app is a production-oriented npm workspace monorepo:

- `apps/web`: Next.js 16 App Router web app with Auth0
- `apps/api`: Fastify 5 API service
- `packages/contracts`: shared Zod schemas and TypeScript types
- `packages/db`: Prisma schema, migrations, seed script, and Prisma client wrapper

## Current Architecture

The web app authenticates users with Auth0, obtains an access token, and calls the API with `Authorization: Bearer <token>` plus `x-request-id`. The API validates Auth0 access tokens directly and derives the actor from the verified token subject. Clients do not send trusted actor identity in request bodies.

All user, house, season, point, invite, and reporting operations are scoped through the actor's organization. Shared API responses are parsed at runtime in the web app with schemas from `@housepoints/contracts`.

Structured logs are emitted by both services and can be sent to SEQ with `SEQ_SERVER_URL`. Web render logs, Server Action logs, and API logs share request IDs for correlation.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop, or another local PostgreSQL 16+ instance
- Auth0 tenant with:
  - Regular Web Application for the web app
  - API configured with RS256 signing
  - The Auth0 API Identifier used as `AUTH0_AUDIENCE` in both services

## Install

```bash
npm install
```

## Environment

Copy the example files:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item packages/db/.env.example packages/db/.env
```

The DB package uses `packages/db/.env` for Prisma commands and database-backed tests:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/housepoints_local"
```

API variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/housepoints"
PORT="4000"
API_PORT="4000"
LOG_LEVEL="info"
SERVICE_NAME="housepoints-api"
AUTH0_DOMAIN="your-tenant.us.auth0.com"
AUTH0_AUDIENCE="https://api.housepoints.example"
CORS_ALLOWED_ORIGINS="http://localhost:3000"
POINT_ADJUSTMENTS_ENABLED="false"
SEQ_SERVER_URL=""
SEQ_API_KEY=""
DEFAULT_ORGANIZATION_SLUG="default"
DEFAULT_ORGANIZATION_NAME="Default Org"
```

Web variables:

```env
AUTH0_SECRET="replace-with-long-random-string"
AUTH0_DOMAIN="your-tenant.us.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"
AUTH0_AUDIENCE="https://api.housepoints.example"
APP_BASE_URL="http://localhost:3000"
APP_API_BASE_URL="http://localhost:4000"
SERVICE_NAME="housepoints-web"
APP_ORGANIZATION_SLUG="default"
SHOW_SEASON_OVERVIEW_CARD="false"
POINT_ADJUSTMENTS_ENABLED="false"
SEQ_SERVER_URL=""
SEQ_API_KEY=""
```

Set `CORS_ALLOWED_ORIGINS` to exact web origins only, comma-separated when there is more than one origin.
Set `POINT_ADJUSTMENTS_ENABLED="true"` on both the API and web apps to enable the admin/owner `Deduct points` flow. Leave it unset or `"false"` to hide the web action and block the API endpoint.

## Database

For local development with Docker:

```powershell
docker run --name housepoints-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=housepoints_local `
  -p 5432:5432 `
  -d postgres:16
```

Start or stop that container later with:

```powershell
docker start housepoints-postgres
docker stop housepoints-postgres
```

Apply local migrations and optionally seed data:

```bash
npm run db:generate
npm run db:deploy
npm run db:seed -w @housepoints/db
```

Use `db:migrate` only when creating a new migration during schema development:

```bash
npm run db:migrate
```

Production and CI deploy existing migrations with:

```bash
npm run db:deploy
```

## Development

Run the API and web app in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Defaults:

- API: `http://localhost:4000`
- Web: `http://localhost:3000`

## Verification

Run the full local gate before considering a unit of work complete:

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

When a local PostgreSQL database is available, also run:

```bash
npm run test:integration
```

Useful focused commands:

```bash
npm run test -w @housepoints/api
npm run test -w @housepoints/web
npm run test -w @housepoints/contracts
npm run test:integration
npm run build -w @housepoints/api
npm run build -w @housepoints/web
```

Current fast test count: 200 tests.

The database integration suite intentionally verifies failing database constraints. Prisma may print expected foreign-key or unique-constraint errors while the command still exits successfully.

## Build Scripts

The root build avoids rebuilding shared packages recursively:

```bash
npm run build
```

The API and web package builds remain self-sufficient for Railway service builds:

```bash
npm run build -w @housepoints/api
npm run build -w @housepoints/web
```

## Railway Deployment

Deploy as separate Railway services from this repo:

- API service rooted at `apps/api`
- Web service rooted at `apps/web`
- Shared PostgreSQL service

API service variables:

- `DATABASE_URL`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `CORS_ALLOWED_ORIGINS`
- optional `POINT_ADJUSTMENTS_ENABLED` (`"true"` enables `POST /points/deduct`)
- optional `SEQ_SERVER_URL`, `SEQ_API_KEY`, `LOG_LEVEL`, `SERVICE_NAME`

Web service variables:

- `AUTH0_SECRET`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE`
- `APP_BASE_URL`
- `APP_API_BASE_URL`
- optional `SHOW_SEASON_OVERVIEW_CARD` (`"true"` displays the Overview current-season status card)
- optional `POINT_ADJUSTMENTS_ENABLED` (`"true"` displays the admin/owner `Deduct points` action)
- optional `SEQ_SERVER_URL`, `SEQ_API_KEY`, `LOG_LEVEL`, `SERVICE_NAME`

Use the same Auth0 API Identifier for `AUTH0_AUDIENCE` in both services. Set `APP_API_BASE_URL` to the deployed API URL and include the deployed web URL in `CORS_ALLOWED_ORIGINS`.

Run `npm run db:deploy` during the API release phase so migrations are applied before the API serves traffic.

## API Overview

All protected API routes require a valid Auth0 access token. Request bodies contain operation input only; actor identity is derived server-side.

Common routes:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/users/bootstrap` | Create or load current app user |
| `POST` | `/users/profile` | Update display name |
| `POST` | `/members` | List organization members |
| `POST` | `/houses/leaderboard` | House leaderboard |
| `POST` | `/transactions/recent` | Recent point activity |
| `POST` | `/users/scores` | Member point totals |
| `POST` | `/dashboard/summary` | Dashboard reporting summary |
| `POST` | `/points/adjust` | Award points |
| `POST` | `/admin/context` | Admin user and house data |
| `POST` | `/admin/houses` | Create a house |
| `POST` | `/admin/users/assign-house` | Assign user to house |
| `POST` | `/orgs/create` | Create organization and first house |
| `POST` | `/orgs/invite` | Create invite link |
| `POST` | `/orgs/join` | Join organization from invite |
| `POST` | `/seasons/context` | Active and historical seasons |
| `POST` | `/seasons/start` | Start next season |
| `POST` | `/seasons/rename` | Rename a season |

Error responses use:

```json
{ "code": "ERROR_CODE", "message": "Safe user-facing message" }
```

## Logging

Both services emit structured logs with stable `event` names. Important fields include:

- `service`
- `environment`
- `event`
- `requestId`
- `route` or `path`
- `statusCode`
- `durationMs`
- safe user and organization identifiers when known

Configure SEQ by setting `SEQ_SERVER_URL`; `SEQ_API_KEY` is optional.

Useful SEQ correlation query:

```text
requestId = 'request-id-from-error-or-browser'
```

Never log tokens, cookies, invite tokens, secrets, or raw Auth0 session payloads.

## Refactor Notes

The current refactor plan and progress are tracked in `docs/refactor-pass-1/`.

Pass-one priorities:

- preserve the verified Auth0 identity boundary;
- keep organization-scoped behavior explicit;
- keep changes small and deployable;
- update refactor docs as work is completed;
- pass lint, typecheck, tests, and production build before each commit.
