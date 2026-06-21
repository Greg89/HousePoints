# First Refactor Pass

Review date: June 14, 2026

## Purpose

This document set records a first-principles review of the current HousePoints codebase before more roadmap features are added. It focuses on behavior present in the repository, not the intended behavior described by older documents.

The review found a promising small application with clear domain concepts, shared validation, tenant-scoped queries, structured logging, and a useful baseline test suite. It also found two release-blocking issues:

1. The public API trusts `actorAuth0Sub` supplied in request bodies instead of authenticating the caller.
2. A newly created organization owner is blocked from the admin controls required to create a house and assign themselves.

Those issues should be resolved before implementing Seasons, Dashboard Widgets, The Hex, or expanding org management.

## Documents

1. [Current State](./01-current-state.md) describes the deployed shape, request flow, package responsibilities, and verification results.
2. [Findings](./02-findings.md) lists risks and gaps by severity, including work absent from the existing roadmap.
3. [Target Architecture](./03-target-architecture.md) proposes boundaries for the API, web data layer, contracts, and database.
4. [Execution Plan](./04-execution-plan.md) defines the recommended refactor order and limits the scope of pass one.
5. [Acceptance Criteria](./05-acceptance-criteria.md) defines what must be true before feature development resumes.
6. [Observability And Logging Plan](./06-observability-logging-plan.md) defines the target logging architecture, event schema, redaction rules, and chaos-readiness path.
7. [SEQ Query Runbook](./07-seq-query-runbook.md) gives practical production queries for tracing user-visible failures, auth issues, API errors, and warning noise.
8. [Dashboard Performance Baselines](./08-performance-baselines.md) records repeatable empty, typical, and larger organization query-count and response-time baselines.

## Progress Snapshot

Last updated: June 20, 2026

Completed units:

- Split API construction from process startup.
- Added Auth0 access-token verification and removed caller-supplied identity.
- Made organization creation and single-use invite joining atomic.
- Added first-house setup and assigned the first owner during organization creation.
- Centralized authenticated web API transport and cached current-user loading.
- Moved current-user bootstrap onto the shared API response parser.
- Restricted CORS to validated, configured origins.
- Added shared dashboard response schemas and stopped rendering failed dashboard reads as empty data.
- Added runtime validation for admin context and stopped hiding admin tools on dependency failure.
- Added runtime validation and safe error handling for point-award responses.
- Added runtime validation and safe error handling for legacy point-adjustment submissions.
- Corrected the invite response contract and added safe runtime validation for generated invite tokens.
- Added runtime validation and safe error handling for onboarding create/join responses.
- Added runtime validation and safe error handling for profile-update responses.
- Added runtime validation and safe error handling for house-creation responses.
- Added runtime validation and safe error handling for house-assignment responses.
- Added explicit workspace type-check scripts and wired them into preflight.
- Added real ESLint scripts for the API, contracts, and DB workspaces.
- Added read-side tenant isolation tests for dashboard and organization-scoped reads.
- Added web render error instrumentation so production dashboard failures emit structured logs.
- Handled expired Auth0 access-token sessions without refresh tokens as re-authentication instead of dashboard 500s.
- Added an observability and logging plan for unified SEQ logging, correlation, redaction, and chaos-readiness.
- Wired web server logs to SEQ with structured Pino output and redaction.
- Threaded one dashboard render request ID through web render logs and dashboard API reads.
- Added shared Server Action logging context so action logs, current-user bootstrap, and API calls use one request ID.
- Normalized expected web action and active-season setup failures to warning-level logs.
- Shared logging redaction and error serialization through contracts and applied shared context redaction in the API logger.
- Added a SEQ query runbook and marked the server-side logging baseline complete for pass one.
- Extracted API actor lookup and admin-role checks into a tested actor module.
- Extracted API authentication, request logging, response logging, and unhandled-error hooks into a shared hooks module.
- Extracted the API health route into the first route module to establish the route-registration pattern.
- Extracted the API seasons routes and shared season scope helper into focused modules without changing route contracts.
- Extracted the API admin routes into a focused route module without changing route contracts.
- Extracted the API org create, invite, and join routes into a focused route module without changing route contracts.
- Extracted the API user bootstrap, profile, and member-directory routes into a focused route module without changing route contracts.
- Extracted the API point adjustment, user score, and recent transaction routes into a focused route module without changing route contracts.
- Extracted the API dashboard summary and house leaderboard routes into a focused route module, completing the API route-module extraction pass.
- Split the web Server Actions into focused admin, dashboard, org, profile, point, and season modules without changing action contracts.
- Aggregated leaderboard score and transaction totals in the database instead of reducing per-house transactions in application code.
- Added bounded cursor pagination to the activity feed API while preserving the dashboard's first-page render behavior.
- Added CI-enforced coverage thresholds for security-critical API modules and shared contracts, with type-check and coverage as visible workflow steps.
- Added a PostgreSQL-backed database integration test suite in CI and documented local Docker/Postgres onboarding for DB-backed tests.
- Added database check constraints for settled point-award ledger rules and covered them with DB-backed integration tests.
- Removed recursive duplicate workspace builds while keeping app-level builds self-sufficient for Railway.
- Removed build-time Google font fetching from the web app so production builds use local/system font fallbacks.
- Replaced the duplicated root README with one canonical current setup and deployment guide.
- Expanded the docs index and normalized older markdown files to ASCII status markers and punctuation.
- Added an `AuthIdentity` table and migration so verified alternate Auth0 provider subjects can map to one HousePoints user.
- Added safe duplicate-email handling during bootstrap and onboarding so same-email provider conflicts return stable `ACCOUNT_LINK_REQUIRED` errors instead of Prisma unique-constraint 500s.
- Added a logout recovery action to the web error boundary so a user trapped in a bad auth/session state can sign out and restart login.
- Added a repeatable dashboard API benchmark and recorded empty, typical, and larger organization query-count and response-time baselines.
- Reconciled roadmap tier detail docs with implemented reliability, correctness, UX, testing, and org-management status.
- Converted point awards to typed expected-failure results while preserving warning-level SEQ logging for known API failures.
- Converted profile updates to typed expected-failure results while preserving warning-level SEQ logging for known API failures.
- Converted invite creation to typed expected-failure results while preserving warning-level SEQ logging for known API failures.
- Converted house creation to typed expected-failure results while preserving warning-level SEQ logging for known API failures.
- Converted house assignment to typed expected-failure results while preserving warning-level SEQ logging for known API failures.

Current unit verification:

- `npm test`: 232 fast tests passed.
- `npm run test:integration`: passed against local Docker PostgreSQL.
- `npm run benchmark:dashboard`: recorded dashboard API baseline against local Docker PostgreSQL.
- Workspace type-check passed.
- Workspace lint passed.
- Full production build passed.

The detailed status of remaining work is tracked in
[Execution Plan](./04-execution-plan.md) and
[Acceptance Criteria](./05-acceptance-criteria.md).

## Pass-One Principle

Do not begin by moving files. First establish a trustworthy identity boundary and repair the onboarding lifecycle. Then extract modules around tested behavior. A cleaner folder tree that preserves the current authorization model would only make the primary defect harder to see.

