# Findings

Severity meanings:

- **P0**: security or lifecycle defect that blocks production use.
- **P1**: high regression, integrity, or operability risk.
- **P2**: maintainability or scale issue that should be addressed before major features.

## P0 Findings

### P0-1: The API does not authenticate callers

The API enables permissive CORS and derives identity from `actorAuth0Sub` in the JSON body. It does not validate an Auth0 access token, a signed service assertion, or another credential.

Impact:

- A caller can impersonate any known user.
- Impersonating an admin or owner grants organization-management capabilities.
- Rate limiting does not fix the identity flaw.
- Tenant checks are bypass-resistant only if the asserted actor identity is trustworthy, which it currently is not.

Required direction:

- Authenticate every non-health API request.
- Derive the Auth0 subject from verified credentials, never request data.
- Remove `actorAuth0Sub` from public request schemas.
- Restrict CORS to actual clients, while treating CORS as browser policy rather than authentication.

Decision needed: validate Auth0 JWT access tokens in Fastify for all clients, or make the web-to-API hop private and use a signed service credential carrying verified user context. JWT validation is the cleaner default for the stated future-mobile architecture.

### P0-2: New organization owners enter a setup deadlock

Creating an organization makes the user an `OWNER` with no house. The home page returns the "Waiting for Assignment" screen for any user with an organization and no house before it loads or renders admin controls.

Impact:

- The first owner cannot create the first house.
- The owner cannot assign themselves.
- Self-serve organization creation cannot complete without direct database intervention.

Required direction:

- Model organization setup separately from ordinary unassigned-member state.
- Permit owners to access setup/admin controls without a house.
- Define whether an owner must eventually join a house.
- Cover first-owner setup with an end-to-end test.

## P1 Findings

### P1-1: Authorization policy for awarding points is ambiguous

`POST /points/adjust` allows any assigned member to award points. Product copy and README language say admins award points.

Required direction: decide the policy, encode it in one authorization function, test it, and update UI and docs together.

### P1-2: Organization and invite workflows are not atomic

Organization creation inserts the organization and then creates or updates the owner in separate operations. Invite consumption checks `usedAt`, mutates the user, and marks the invite used in separate operations.

Impact:

- A failed owner update can leave an orphan organization.
- Concurrent invite requests can race and consume a single-use invite more than once.
- Partial failures can leave user and invite state inconsistent.

Required direction: use Prisma transactions and a conditional invite-consumption update or equivalent database-enforced claim.

### P1-3: Tests start a real API server

`buildApp()` and `app.listen()` live in the same imported module. Vitest imports that module and opens port 4000 before running injected requests.

Impact:

- Tests can conflict with a developer server or parallel worker.
- A test advertised as network-free has a network side effect.
- Startup failures are coupled to route-unit tests.

Required direction: move process startup to `server.ts`; keep `app.ts` side-effect free.

### P1-4: Shared contracts are not enforced on responses

The web layer casts `response.json()` to TypeScript types instead of parsing it with Zod. Several response shapes are locally re-declared rather than exported from `packages/contracts`.

Impact:

- API drift reaches the UI as runtime failures or incorrect rendering.
- The contracts package gives compile-time confidence without runtime boundary validation.
- Error responses are handled inconsistently as text or loosely typed JSON.

Required direction: define request, response, and error schemas per operation and parse at the HTTP boundary.

### P1-5: Read failures are silently converted into empty states

Dashboard read actions return `null` for many API failures, and the page converts those values to empty arrays.

Impact:

- An outage can look like "no houses" or "no activity."
- Partial failures are not visible or recoverable by section.
- Operators receive logs, but users receive misleading data.

Required direction: use typed result states and segment-level error or retry UI. Do not turn transport failures into valid empty domain data.

### P1-6: Database invariants are mostly application-only

The database does not enforce positive award deltas, required traits for current awards, or cross-field transaction rules. Upcoming Point Adjustments and Seasons work will increase the number of invariants.

Required direction: document ledger invariants and enforce stable rules with schema constraints where practical, backed by service validation.

## P2 Findings

### P2-1: API and web modules mix too many responsibilities

Route registration, identity resolution, policy, Prisma queries, DTO mapping, and logging are interleaved. The web action module repeats session/bootstrap/fetch/error logic for every operation.

Required direction: extract by responsibility and domain after characterization tests exist.

### P2-2: Dashboard rendering repeats identity work

Every dashboard data function independently loads the session and bootstraps the user. This produces excessive internal HTTP calls and repeated database lookups.

Required direction: create a cached server-only current-user function and an authenticated API client. Pass verified identity through one request context rather than request payloads.

### P2-3: Leaderboard aggregation loads every transaction

The house leaderboard fetches every transaction delta for every house and sums in JavaScript.

Impact: response time and memory grow with the entire ledger.

Required direction: aggregate in PostgreSQL/Prisma, then add season-aware indexes when Seasons are designed.

### P2-4: Tooling coverage is narrower than CI names imply

Only the web workspace has real lint rules. There is no explicit type-check command, coverage threshold, database integration suite, or web component/action test suite.

Required direction: add real lint/type-check scripts to every TypeScript workspace and layer tests by risk.

### P2-5: Build and dependency scripts repeat work

Workspace builds recursively build dependencies, so contracts and DB are built multiple times. The web build also requires network access to Google Fonts.

Required direction: define a single topological build path and consider checked-in/local font assets for reproducible builds.

### P2-6: Client boundaries are broad

Most dashboard display components are Client Components primarily for mount animation. This increases client JavaScript and hydration work.

Required direction: keep interactive shells client-side, but render static cards and feed rows as Server Components where that improves bundle size without harming UX.

### P2-7: Documentation has drifted from implementation

Current and future work are mixed together, completed statuses conflict, and setup instructions disagree.

Required direction: maintain one current-state index, one product roadmap, and dated architecture/refactor records.

## Work Missing From The Existing Roadmap

The following should be added ahead of the current feature backlog:

1. Authenticate the API and remove caller-supplied identity.
2. Repair first-owner organization setup.
3. Decide and enforce point-award authorization policy.
4. Make org creation and invite use transactional.
5. Split API construction from process startup.
6. Add runtime response validation and typed API errors.
7. Stop masking failed reads as empty data.
8. Add real lint/type-check coverage outside the web workspace.
9. Reduce repeated bootstrap/session/API calls.
10. Move leaderboard aggregation into the database.
11. Reconcile and repair project documentation.

