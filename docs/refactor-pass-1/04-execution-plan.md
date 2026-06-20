# Execution Plan

Status markers:

- `[x]` complete
- `[-]` partially complete
- `[ ]` not started

## Scope Of Pass One

Pass one is complete when the existing product works through safer, testable boundaries. It should not implement Seasons, Dashboard Widgets, The Hex, multi-org membership, or broad visual redesign.

## Phase 0: Product Decisions

Decisions confirmed by the product owner:

1. Every assigned member can award points.
2. Owners must belong to a house. Organization creation must include first-house setup rather than leaving the owner in an unreachable unassigned state.
3. The API will validate Auth0 access tokens directly so the web app and future mobile clients use the same trusted identity boundary.
4. Invite links are single-use.

One implementation detail remains for the onboarding unit: choose whether the first house uses a default name or is explicitly entered during organization creation. The preferred direction is explicit first-house setup because it avoids creating product data the owner must immediately correct.

## Phase 1: Close Release Blockers

1. [x] Add API credential verification.
2. [x] Derive actor subject from the verified credential.
3. [x] Remove actor identity from request contracts.
4. [x] Restrict CORS origins.
5. [x] Repair first-owner setup so house creation and self-assignment are reachable.
6. [x] Add tests proving impersonation attempts fail.
7. [x] Add an integration-level first-owner setup test.

Keep route behavior otherwise stable in this phase.

## Phase 2: Establish Testable Boundaries

1. [x] Move Fastify construction to `app.ts`.
2. [x] Move listening and shutdown handling to `server.ts`.
3. [x] Add central error and auth plugins. Authentication, request logging, response logging, and unhandled-error hooks are registered through a shared API hooks module.
4. [x] Extract actor resolution and authorization helpers. Actor lookup and admin-role checks live in a tested API actor module.
5. [x] Split routes into domain modules without redesigning every query. Health, seasons, admin, org, user, points, dashboard, and leaderboard routes are registered through focused route modules.
6. [x] Update tests to import only the side-effect-free app factory.

Add characterization tests before moving each route group.

## Phase 3: Consolidate Web Server Code

1. [x] Create a cached `getCurrentSession()`/`getCurrentUser()` server-only module.
2. [x] Create one authenticated API client with timeout and request ID support.
3. [x] Split the action file by domain. Web Server Actions are grouped by admin, dashboard, org, profile, point, and season modules with shared admin authorization kept in a server-only helper.
4. [-] Convert expected action failures to typed results. Current-user bootstrap, dashboard, and admin-context reads use typed response errors; point awards, legacy point-adjustment submissions, onboarding mutations, invite creation, profile updates, house creation, and house assignment preserve typed API errors, while mutation actions still throw rather than return expected failures. Auth account-link conflicts now return stable API codes and no longer surface as unhandled Prisma errors.
5. [x] Stop converting dashboard read failures to empty arrays.
6. [-] Add route or section-level loading/error states where useful. Dashboard failures use the route error boundary, which now includes retry, home, and logout recovery actions; section-level recovery is not implemented.

Expected result: one bootstrap/current-user resolution per render, not one per query.

## Phase 4: Harden Workflows And Contracts

1. [x] Make org creation atomic.
2. [x] Make invite consumption atomic and concurrency-safe.
3. [-] Export response and error schemas from contracts. Shared schemas cover all currently web-consumed API success responses and typed error parsing preserves stable error codes; future operations should add schemas with their endpoint contracts.
4. [x] Parse all API responses in the web client. Web-consumed responses now flow through the shared response parser and contract schemas.
5. [-] Add tests for owner/admin/member policy, tenant isolation, duplicate slug, expired invite, reused invite, concurrent invite claims, and account-link conflicts. Core auth, role, read/write tenant isolation, onboarding, invite, and duplicate-email account-link cases exist; coverage is not yet complete.
6. [x] Add stable database constraints for settled ledger rules. New point-ledger writes now require positive deltas, non-empty award reasons, and a trait at the database layer, with database-backed integration coverage.

## Phase 5: Improve Queries And Tooling

1. [x] Aggregate leaderboard totals in PostgreSQL.
2. [x] Add cursor pagination to activity.
3. [x] Add real ESLint/type-check scripts for API, contracts, and DB.
4. [x] Add coverage reporting with meaningful thresholds for security-critical modules. API auth, actor resolution, hooks, config, logging, and shared contracts now have CI-enforced coverage thresholds.
5. [x] Remove recursive duplicate workspace builds.
6. [x] Make font/build assets reproducible without external network access where practical. The web root layout no longer uses `next/font/google`, so production builds do not fetch Google font assets.
7. [x] Add database-backed integration tests for transaction and constraint behavior. CI now runs Prisma migrations against a PostgreSQL service and verifies point-ledger relationships, foreign-key failures, uniqueness, and restrict-delete behavior.
8. [x] Unify structured web and API logs in SEQ. Web render/auth instrumentation exists, web logs are delivered to SEQ when configured, dashboard renders share one request ID across web logs and API reads, Server Actions use a shared action logging context, common expected failures are warning-level, shared redaction/error serialization helpers live in contracts, and a SEQ query runbook exists. Browser-side client error reporting remains deferred outside pass one.
9. [x] Record dashboard query-count and response-time baselines for empty, typical, and larger organizations with a repeatable local benchmark.

## Phase 6: Reconcile Documentation

1. [x] Update README to one canonical setup guide.
2. [x] Mark org management as implemented, partial, or deferred by sub-feature.
3. [x] Rebuild the roadmap around current priorities.
4. [x] Repair text encoding. Older roadmap and feature docs now use ASCII status markers and punctuation so markdown renders consistently across editors and terminals.
5. [x] Link architecture decisions, operational runbooks, and migrations to the relevant roadmap items.

## Recommended Pull Request Sequence

Keep changes reviewable:

1. Test-safe API startup split.
2. API authentication foundation.
3. Request contract identity removal.
4. Owner setup lifecycle fix.
5. Transactional org/invite workflows.
6. Web session/API client consolidation.
7. Domain module extraction.
8. Response validation and error-state work.
9. Query/tooling improvements.
10. Documentation reconciliation.

Security changes may require coordinated API and web edits, but avoid combining them with cosmetic component refactors.
