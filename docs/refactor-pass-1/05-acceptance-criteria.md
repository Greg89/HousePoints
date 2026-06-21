# Acceptance Criteria

Feature work may resume after all release-blocker criteria and the agreed pass-one criteria are met.

Status markers:

- `[x]` met
- `[-]` partially met
- `[ ]` not yet met

## Security

- [x] Every non-health API route rejects requests without valid credentials.
- [x] Actor identity comes only from verified credentials.
- [x] Alternate Auth0 provider subjects can resolve to the same internal user through the `AuthIdentity` mapping.
- [x] Request schemas no longer accept `actorAuth0Sub`.
- [x] Admin and owner routes have explicit role tests.
- [x] Tenant-isolation tests cover reads and mutations.
- [x] CORS is configured for known origins.
- [x] Logs do not record access tokens, invite tokens, or sensitive authorization headers.

## Onboarding

- [x] A new user can create an organization.
- [x] Organization creation includes first-house setup.
- [x] The first owner is assigned to that house atomically without database intervention.
- [x] An invited user can join and reaches the correct assigned/unassigned state.
- [x] Expired, reused, malformed, and concurrently claimed invites behave deterministically.
- [x] Same-email alternate provider logins link only from verified email token claims or fail with a stable `ACCOUNT_LINK_REQUIRED` response.

## Architecture

- [x] Importing the API app factory does not open a network port.
- [x] API routes are grouped by domain.
- [x] Authorization and actor resolution are shared and testable.
- [x] Web session lookup and HTTP transport are centralized in server-only modules.
- [x] Server Actions contain minimal orchestration and revalidation logic.

## Contracts And Errors

- [x] API inputs and web-consumed outputs are validated with shared schemas.
- [x] Expected errors have stable codes and typed UI handling. The web response boundary preserves codes, account-link conflicts no longer become generic 500s, and point awards, profile updates, invite creation, house creation, house assignment, onboarding mutations, plus season start/rename mutations now return typed expected-failure results. The unused legacy point-adjustment action was removed so points now have one typed mutation path.
- [x] A failed dashboard dependency is not rendered as valid empty data.
- [x] Dashboard error messages shown to users do not expose raw internal responses.
- [x] The route error boundary includes a logout recovery path for bad auth/session states.

## Data Integrity

- [x] Organization creation and owner assignment are atomic.
- [x] Invite consumption and user membership update are atomic.
- [x] Settled point-ledger invariants are enforced in service logic and, where stable, in the database.
- [x] Score queries derive tenant and house scope from trusted records.

## Performance

- [x] Dashboard rendering performs one current-user mapping per request.
- [x] House totals are aggregated by the database.
- [x] Activity history supports bounded cursor pagination.
- [x] Query count and response-time baselines are recorded for an empty, typical, and larger organization.

## Quality Gates

- [x] `npm test` passes without starting a real listener.
- [x] Every TypeScript workspace has a real lint and type-check command.
- [x] Coverage reporting enforces thresholds for security-critical API modules and shared contracts.
- [x] Security-critical services have direct tests. Authentication, actor resolution, user mapping, onboarding flows, action boundaries, API response parsing, and tenant-scoped season resolution are covered directly or through focused route tests.
- [x] At least one database-backed integration suite validates transactions and constraints.
- [x] The production build does not depend on unplanned external network access.
- [x] CI runs install, generate, lint, type-check, test, coverage, and build as distinct visible steps.

## Documentation

- [x] README setup instructions match actual environment variable names, supported Node version, local Docker/Postgres setup, and verification commands.
- [x] The roadmap distinguishes implemented, partial, and proposed org-management work.
- [x] Product authorization decisions are documented.
- [x] The docs index links current state, roadmap, upcoming features, and this refactor record.
- [x] Markdown files render without corrupted characters.
