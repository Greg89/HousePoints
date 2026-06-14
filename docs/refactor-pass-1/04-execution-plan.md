# Execution Plan

## Scope Of Pass One

Pass one is complete when the existing product works through safer, testable boundaries. It should not implement Seasons, Dashboard Widgets, The Hex, multi-org membership, or broad visual redesign.

## Phase 0: Resolve Product Decisions

Document decisions before changing behavior:

1. Can every assigned member award points, or only admins/owners?
2. Must owners belong to a house?
3. Is the API directly callable by web and future mobile clients using Auth0 access tokens?
4. Are invite links single-use, and should an already-enrolled user consume one?

Output: short architecture decision records or a decisions section in the roadmap.

## Phase 1: Close Release Blockers

1. Add API credential verification.
2. Derive actor subject from the verified credential.
3. Remove actor identity from request contracts.
4. Restrict CORS origins.
5. Repair first-owner setup so house creation and self-assignment are reachable.
6. Add tests proving impersonation attempts fail.
7. Add an end-to-end or integration-level first-owner setup test.

Keep route behavior otherwise stable in this phase.

## Phase 2: Establish Testable Boundaries

1. Move Fastify construction to `app.ts`.
2. Move listening and shutdown handling to `server.ts`.
3. Add central error and auth plugins.
4. Extract actor resolution and authorization helpers.
5. Split routes into domain modules without redesigning every query.
6. Update tests to import only the side-effect-free app factory.

Add characterization tests before moving each route group.

## Phase 3: Consolidate Web Server Code

1. Create a cached `getCurrentSession()`/`getCurrentUser()` server-only module.
2. Create one authenticated API client with timeout and request ID support.
3. Split the 740-line action file by domain.
4. Convert expected action failures to typed results.
5. Stop converting read failures to empty arrays.
6. Add route or section-level loading/error states where useful.

Expected result: one bootstrap/current-user resolution per render, not one per query.

## Phase 4: Harden Workflows And Contracts

1. Make org creation atomic.
2. Make invite consumption atomic and concurrency-safe.
3. Export response and error schemas from contracts.
4. Parse all API responses in the web client.
5. Add tests for owner/admin/member policy, tenant isolation, duplicate slug, expired invite, reused invite, and concurrent invite claims.
6. Add stable database constraints for settled ledger rules.

## Phase 5: Improve Queries And Tooling

1. Aggregate leaderboard totals in PostgreSQL.
2. Add cursor pagination to activity.
3. Add real ESLint/type-check scripts for API, contracts, and DB.
4. Add coverage reporting with meaningful thresholds for security-critical modules.
5. Remove recursive duplicate workspace builds.
6. Make font/build assets reproducible without external network access where practical.
7. Add database-backed integration tests for transaction and constraint behavior.

## Phase 6: Reconcile Documentation

1. Update README to one canonical setup guide.
2. Mark org management as implemented, partial, or deferred by sub-feature.
3. Rebuild the roadmap around current priorities.
4. Repair text encoding.
5. Link architecture decisions and migrations to the relevant roadmap items.

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

