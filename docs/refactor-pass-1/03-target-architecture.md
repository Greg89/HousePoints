# Target Architecture

## Design Goals

- Identity is derived from verified credentials.
- Authorization is close to domain operations and cannot be bypassed by transport input.
- HTTP handlers are thin adapters.
- Database operations express atomic domain workflows.
- The web app has one server-only session and API access layer.
- Shared contracts validate both sides of the network boundary.
- Features can be added by domain without expanding central files.

## API Shape

Recommended structure:

```text
apps/api/src/
  app.ts
  server.ts
  config.ts
  plugins/
    auth.ts
    errors.ts
    observability.ts
  shared/
    actor.ts
    authorization.ts
    api-error.ts
  modules/
    users/
      routes.ts
      service.ts
      repository.ts
    organizations/
      routes.ts
      service.ts
      repository.ts
    houses/
      routes.ts
      service.ts
      repository.ts
    points/
      routes.ts
      service.ts
      repository.ts
    leaderboard/
      routes.ts
      queries.ts
```

Responsibilities:

- `app.ts` creates Fastify and registers plugins/modules without listening.
- `server.ts` loads config, calls `buildApp()`, and listens.
- Auth plugin verifies credentials and attaches a minimal principal.
- Actor resolution maps the verified subject to the internal user once per request.
- Route files parse transport data and map results to HTTP.
- Services enforce authorization and workflow invariants.
- Repositories/queries own Prisma access and tenant predicates.

Avoid a generic repository framework. Small domain-specific functions are easier to audit.

## Identity Boundary

Target request flow:

1. Client obtains an Auth0 access token for the HousePoints API audience.
2. API verifies signature, issuer, audience, expiry, and required claims.
3. API reads `sub` from the verified token.
4. API maps `sub` to the internal user.
5. Services authorize the internal actor against the requested operation and resource.

Request bodies contain domain input only:

```json
{
  "targetUserId": "user-id",
  "delta": 10,
  "reason": "Helped unblock the release",
  "trait": "TEAM_SUPPORT"
}
```

They do not contain actor identity or organization identity.

## Web Shape

Recommended structure:

```text
apps/web/src/
  app/
    actions/
      points.ts
      organizations.ts
      profile.ts
  lib/server/
    session.ts
    api-client.ts
    api-errors.ts
  features/
    dashboard/
    onboarding/
    admin/
    points/
```

Key rules:

- Mark server infrastructure with `import "server-only"`.
- Cache current-session/current-user lookup for one render pass.
- Put base URL, authorization header, request ID, timeout, parsing, and error conversion in one API client.
- Keep Server Actions thin: validate action input, call a domain client function, and revalidate or redirect.
- Return explicit action result unions for expected failures.
- Pass minimal DTOs to Client Components.

This follows the local Next.js 16 guidance to centralize authorization in a data access layer and treat Server Actions as public entry points.

## Contracts

Organize contracts by operation or domain:

```text
packages/contracts/src/
  common/
    errors.ts
    pagination.ts
  users.ts
  organizations.ts
  houses.ts
  points.ts
  leaderboard.ts
  index.ts
```

Each operation should expose:

- input schema and inferred type;
- success-response schema and inferred type;
- documented error codes;
- pagination metadata where applicable.

The API parses input. The web API client parses success and error responses. Type assertions should not be the network validation strategy.

## Database And Domain Invariants

Pass one should establish:

- Organization creation and owner assignment are one transaction.
- Invite claim and membership assignment are one transaction.
- A single-use invite can be claimed once under concurrency.
- House assignment verifies both records belong to the actor's organization.
- Award policy is explicit and tested.
- Transaction creation derives organization and house from trusted database records.

Before Seasons or Hex, introduce a deliberate transaction taxonomy and constraint plan. Do not overload the current ledger with nullable fields until valid combinations are written down.

## Read Model

Dashboard data should be assembled through a small number of purpose-built queries:

- one session/current-user lookup;
- one dashboard summary query or a small parallel set without repeated bootstrap;
- database-side aggregation for house and member scores;
- cursor pagination for activity.

Do not add a dashboard mega-endpoint until widget requirements are stable. First remove repeated identity calls and measure the remaining request cost.

## Observability

Web, API, and future worker logs should use one structured logging contract and one primary operational destination. SEQ should receive server-side application logs from every service, while Railway logs remain a platform-level fallback.

Every user-visible operation should be traceable with a request ID across web render/action logs and API logs. User-facing errors should stay safe and terse; operator logs should include structured context, stable error codes, request IDs, route names, and Next.js digests where available.

See [Observability And Logging Plan](./06-observability-logging-plan.md) for the detailed schema, redaction rules, rollout slices, and chaos engineering readiness checklist.

