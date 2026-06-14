# Current State

## Runtime Topology

HousePoints is an npm-workspaces monorepo with four runtime or library packages:

| Area | Current responsibility |
|---|---|
| `apps/web` | Next.js 16 App Router UI, Auth0 session handling, Server Actions, and calls to the API |
| `apps/api` | Fastify HTTP API, authorization decisions, domain workflows, and direct Prisma calls |
| `packages/contracts` | Shared Zod input schemas, labels, and TypeScript response types |
| `packages/db` | Prisma schema, migrations, PostgreSQL adapter, and singleton client |

The intended deployment is two public Railway services plus PostgreSQL. The web service authenticates users with Auth0 and then calls the API over HTTP.

## Main Request Flow

The dashboard render currently performs this sequence:

1. `readSessionSummary()` reads the Auth0 session.
2. It calls `POST /users/bootstrap` to load or create the internal user.
3. The page starts four or five reads in parallel.
4. Every read gets the Auth0 session again and calls `/users/bootstrap` again before calling its actual endpoint.

For an admin dashboard, this produces up to eleven API requests for one render: six bootstrap requests and five data requests. A member render produces up to nine.

All dashboard reads use `POST`, `cache: "no-store"`, and route-level `force-dynamic`. This is functionally simple, but it prevents useful caching and creates avoidable network, logging, and database load.

## Current Domain Behavior

- Users authenticate through Auth0 in the web app.
- A first login creates a user with no organization.
- A user may create an organization and become `OWNER`, or join one with a single-use invite token.
- Users belong to at most one organization and optionally one house.
- Assigned users can award positive points to another assigned member.
- House and member standings are calculated from the transaction ledger.
- `ADMIN` and `OWNER` users can manage houses and assignments.

The code does not currently limit point awards to admins, even though the README describes awarding as an admin capability. This is a product-policy decision that must be made explicit.

## Existing Strengths

- Organization scoping is present in the primary read and write queries.
- Point transactions are modeled as an append-only ledger.
- Shared Zod schemas validate the principal request bodies.
- API errors generally include stable codes.
- Structured log events and request IDs are already established.
- Fastify routes have integration tests through `app.inject()`.
- Contracts have focused schema tests.
- Database changes are represented as migrations.
- The web app follows the Next.js 16 `proxy.ts` convention.

## Structural Pressure

Two files now hold most application behavior:

- `apps/api/src/index.ts`: approximately 860 lines covering server construction, middleware, authentication lookup, every route, domain logic, and process startup.
- `apps/web/src/app/actions/points.ts`: approximately 740 lines covering session access, API transport, reads, mutations, logging, error conversion, and cache invalidation.

The size itself is not the defect. The problem is that security policy, transport behavior, and domain workflows cannot be tested or changed independently.

## Verification Baseline

Commands run during this review:

| Command | Result |
|---|---|
| `npm test` | Passed: 17 API tests and 39 contract tests |
| `npm run lint --workspaces --if-present` | Passed, but API/contracts/DB lint scripts are placeholders |
| `npm run build` | API, contracts, and DB built; web build could not fetch three Google Fonts in the restricted environment |

The API test run also started a real listener on port 4000. Importing `apps/api/src/index.ts` executes `app.listen()`, so the test suite has a hidden network side effect even though it uses `app.inject()`.

## Documentation State

The existing documentation is valuable but no longer a reliable representation of the repository:

- Org creation, owner roles, and invites are described as upcoming even though they are partly implemented.
- Some tier files show unchecked work while `roadmap.md` marks the same work done.
- README content is duplicated and contains conflicting Node and environment-variable instructions.
- Several documents contain corrupted character encoding.
- The API security model and onboarding deadlock are not documented.

