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

## Progress Snapshot

Last updated: June 15, 2026

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

Current unit verification:

- `npm test`: 144 tests passed.
- Workspace type-check passed.
- Workspace lint passed.
- Full production build passed.

The detailed status of remaining work is tracked in
[Execution Plan](./04-execution-plan.md) and
[Acceptance Criteria](./05-acceptance-criteria.md).

## Pass-One Principle

Do not begin by moving files. First establish a trustworthy identity boundary and repair the onboarding lifecycle. Then extract modules around tested behavior. A cleaner folder tree that preserves the current authorization model would only make the primary defect harder to see.

