# Acceptance Criteria

Feature work may resume after all release-blocker criteria and the agreed pass-one criteria are met.

## Security

- Every non-health API route rejects requests without valid credentials.
- Actor identity comes only from verified credentials.
- Request schemas no longer accept `actorAuth0Sub`.
- Admin and owner routes have explicit role tests.
- Tenant-isolation tests cover reads and mutations.
- CORS is configured for known origins.
- Logs do not record access tokens, invite tokens, or sensitive authorization headers.

## Onboarding

- A new user can create an organization.
- The first owner can create the first house without database intervention.
- The owner can complete the configured house-membership path.
- An invited user can join and reaches the correct assigned/unassigned state.
- Expired, reused, malformed, and concurrently claimed invites behave deterministically.

## Architecture

- Importing the API app factory does not open a network port.
- API routes are grouped by domain.
- Authorization and actor resolution are shared, testable modules.
- Web session lookup and HTTP transport are centralized in server-only modules.
- Server Actions contain minimal orchestration and revalidation logic.

## Contracts And Errors

- API inputs and web-consumed outputs are validated with shared schemas.
- Expected errors have stable codes and typed UI handling.
- A failed dashboard dependency is not rendered as valid empty data.
- Error messages shown to users do not expose raw internal responses.

## Data Integrity

- Organization creation and owner assignment are atomic.
- Invite consumption and user membership update are atomic.
- Settled point-ledger invariants are enforced in service logic and, where stable, in the database.
- Score queries derive tenant and house scope from trusted records.

## Performance

- Dashboard rendering performs one current-user mapping per request.
- House totals are aggregated by the database.
- Activity history supports bounded cursor pagination.
- Query count and response-time baselines are recorded for an empty, typical, and larger organization.

## Quality Gates

- `npm test` passes without starting a real listener.
- Every TypeScript workspace has a real lint and type-check command.
- Security-critical services have direct tests.
- At least one database-backed integration suite validates transactions and constraints.
- The production build does not depend on unplanned external network access.
- CI runs install, generate, lint, type-check, test, and build as distinct visible steps.

## Documentation

- README setup instructions match actual environment variable names and supported Node version.
- The roadmap distinguishes implemented, partial, and proposed org-management work.
- Product authorization decisions are documented.
- The docs index links current state, roadmap, upcoming features, and this refactor record.
- Markdown files render without corrupted characters.

