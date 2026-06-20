# Acceptance Criteria

Feature work may resume after all release-blocker criteria and the agreed pass-one criteria are met.

Status markers:

- `[x]` met
- `[-]` partially met
- `[ ]` not yet met

## Security

- [x] Every non-health API route rejects requests without valid credentials.
- [x] Actor identity comes only from verified credentials.
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

## Architecture

- [x] Importing the API app factory does not open a network port.
- [x] API routes are grouped by domain.
- [x] Authorization and actor resolution are shared and testable.
- [x] Web session lookup and HTTP transport are centralized in server-only modules.
- [x] Server Actions contain minimal orchestration and revalidation logic.

## Contracts And Errors

- [x] API inputs and web-consumed outputs are validated with shared schemas.
- [-] Expected errors have stable codes and typed UI handling. The web response boundary preserves codes, but mutation UI handling remains incomplete.
- [x] A failed dashboard dependency is not rendered as valid empty data.
- [x] Dashboard error messages shown to users do not expose raw internal responses.

## Data Integrity

- [x] Organization creation and owner assignment are atomic.
- [x] Invite consumption and user membership update are atomic.
- [ ] Settled point-ledger invariants are enforced in service logic and, where stable, in the database.
- [x] Score queries derive tenant and house scope from trusted records.

## Performance

- [x] Dashboard rendering performs one current-user mapping per request.
- [x] House totals are aggregated by the database.
- [x] Activity history supports bounded cursor pagination.
- [ ] Query count and response-time baselines are recorded for an empty, typical, and larger organization.

## Quality Gates

- [x] `npm test` passes without starting a real listener.
- [x] Every TypeScript workspace has a real lint and type-check command.
- [-] Security-critical services have direct tests. Authentication, actor resolution, and onboarding are covered; more extracted services should receive direct tests as they appear.
- [ ] At least one database-backed integration suite validates transactions and constraints.
- [ ] The production build does not depend on unplanned external network access.
- [ ] CI runs install, generate, lint, type-check, test, and build as distinct visible steps.

## Documentation

- [-] README setup instructions match actual environment variable names and supported Node version. Current variables are present, but duplicate and conflicting sections remain.
- [ ] The roadmap distinguishes implemented, partial, and proposed org-management work.
- [x] Product authorization decisions are documented.
- [ ] The docs index links current state, roadmap, upcoming features, and this refactor record.
- [ ] Markdown files render without corrupted characters.
