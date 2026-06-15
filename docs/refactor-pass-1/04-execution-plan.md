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
3. [-] Add central error and auth plugins. Shared hooks exist, but they remain in `app.ts`.
4. [-] Extract actor resolution and authorization helpers. Shared functions exist, but they remain in `app.ts`.
5. [ ] Split routes into domain modules without redesigning every query.
6. [x] Update tests to import only the side-effect-free app factory.

Add characterization tests before moving each route group.

## Phase 3: Consolidate Web Server Code

1. [x] Create a cached `getCurrentSession()`/`getCurrentUser()` server-only module.
2. [x] Create one authenticated API client with timeout and request ID support.
3. [ ] Split the action file by domain.
4. [-] Convert expected action failures to typed results. Dashboard and admin-context reads use typed response errors; point awards, invite creation, and profile updates preserve typed API errors, while mutation actions still throw rather than return expected failures.
5. [x] Stop converting dashboard read failures to empty arrays.
6. [-] Add route or section-level loading/error states where useful. Dashboard failures use the route error boundary; section-level recovery is not implemented.

Expected result: one bootstrap/current-user resolution per render, not one per query.

## Phase 4: Harden Workflows And Contracts

1. [x] Make org creation atomic.
2. [x] Make invite consumption atomic and concurrency-safe.
3. [-] Export response and error schemas from contracts. Current-user, dashboard, admin-context, point-adjustment, invite-link, and profile-update response schemas exist; remaining operations still need schemas.
4. [-] Parse all API responses in the web client. Current-user, dashboard, admin-context, point-award, invite-creation, and profile-update responses are parsed; remaining mutation responses are not.
5. [-] Add tests for owner/admin/member policy, tenant isolation, duplicate slug, expired invite, reused invite, and concurrent invite claims. Core auth, role, tenant, onboarding, and invite cases exist; coverage is not yet complete.
6. [ ] Add stable database constraints for settled ledger rules.

## Phase 5: Improve Queries And Tooling

1. [ ] Aggregate leaderboard totals in PostgreSQL.
2. [ ] Add cursor pagination to activity.
3. [ ] Add real ESLint/type-check scripts for API, contracts, and DB.
4. [ ] Add coverage reporting with meaningful thresholds for security-critical modules.
5. [ ] Remove recursive duplicate workspace builds.
6. [ ] Make font/build assets reproducible without external network access where practical.
7. [ ] Add database-backed integration tests for transaction and constraint behavior.

## Phase 6: Reconcile Documentation

1. [ ] Update README to one canonical setup guide.
2. [ ] Mark org management as implemented, partial, or deferred by sub-feature.
3. [ ] Rebuild the roadmap around current priorities.
4. [ ] Repair text encoding.
5. [ ] Link architecture decisions and migrations to the relevant roadmap items.

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
