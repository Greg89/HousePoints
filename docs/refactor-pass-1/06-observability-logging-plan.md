# Observability And Logging Plan

## Purpose

HousePoints should have one dependable way to answer production questions:

- What failed?
- Which service failed?
- Which user action caused it?
- Did the request reach the API?
- Was the failure expected, recoverable, or a defect?
- Did the user see a safe message while operators received useful detail?

The current app is small enough to fix this deliberately. The goal is to make logging boring, structured, correlated, and privacy-safe before the product grows and before chaos engineering experiments begin.

## Current State

### API

The API uses Pino and can write to both stdout and SEQ when `SEQ_SERVER_URL` is configured.

Strengths:

- Structured event names exist.
- Fastify request IDs are enabled.
- `x-request-id` is accepted.
- Sensitive headers are redacted.
- API logs include domain events such as auth failures, invite handling, point awards, and dashboard summary reads.

Gaps:

- The API logger is not shared with the web app.
- Event fields are useful but not yet documented as a contract.
- There is no single query recipe for tracing one user action across web and API.
- Some events use different field names for similar concepts.

### Web

The web app uses Pino to write structured logs to stdout and, when `SEQ_SERVER_URL` is configured, SEQ.

Strengths:

- Server Actions and dashboard render paths emit structured events.
- Next.js `onRequestError` instrumentation captures Server Component render failures.
- Expired Auth0 access-token sessions are logged and treated as re-authentication instead of dashboard 500s.
- Web calls send `x-request-id` to the API.
- Sensitive web log fields are redacted before logs are written.

Gaps:

- Web and API redaction rules are not yet shared from one module.
- Server render logs and action logs do not yet share one request context.
- Browser/client-side errors are not captured centrally.
- Railway access logs must still be checked separately from application logs.

## Target State

SEQ is the primary operational log destination for every server-side application component:

- API service
- Web service
- Next.js request instrumentation
- Server Actions
- Future workers, scheduled jobs, or background processors

Railway logs remain useful for platform-level debugging, but SEQ should be the main place to investigate app behavior.

The browser should never receive raw operational detail. Users get safe, actionable messages. Operators get structured logs with enough context to diagnose.

## Log Event Contract

Every structured log should follow this shape where applicable:

```json
{
  "timestamp": "2026-06-17T12:00:00.000Z",
  "level": "info",
  "service": "housepoints-web",
  "environment": "production",
  "event": "web.dashboard.render_failed",
  "requestId": "request-id",
  "traceId": "trace-id",
  "route": "/",
  "method": "GET",
  "statusCode": 500,
  "durationMs": 42,
  "userId": "user-id",
  "auth0Sub": "auth0|subject",
  "organizationId": "org-id",
  "role": "OWNER",
  "errorName": "ApiResponseError",
  "errorCode": "API_REQUEST_FAILED",
  "digest": "3928859417"
}
```

Not every field is required on every event. Missing fields should mean "not available" rather than "forgotten".

### Required Fields

All logs:

- `timestamp`
- `level`
- `service`
- `environment`
- `event`

Request-scoped logs:

- `requestId`
- `route` or `path`
- `method` when available

Error logs:

- `errorName`
- `errorMessage`
- `errorCode` when available
- `statusCode` when available
- `digest` when provided by Next.js
- `causeName` and `causeMessage` when safe and useful

Tenant-scoped domain logs:

- `userId` when known
- `organizationId` when known
- `role` when relevant

## Correlation Model

Use one correlation ID per user-visible operation.

For a dashboard render:

1. Web receives `GET /`.
2. Web creates or reads a request ID.
3. Web logs `web.dashboard.render_started`.
4. Web sends `x-request-id` to each API request.
5. API uses the same ID for Fastify `request.id`.
6. API logs domain events with that same ID.
7. Web logs `web.dashboard.render_completed` or `web.dashboard.render_failed`.

The SEQ query should be able to show the whole path:

```text
requestId = 'same-request-id'
```

If one web render fans out into multiple API calls, keep the same `requestId` for the render and add an `operationId` or `spanId` later if we need finer-grained child operations.

## Event Naming

Use stable, dot-separated event names:

```text
web.auth.access_token_expired
web.dashboard.render_started
web.dashboard.render_failed
web.action.failed
api.auth.token_invalid
api.dashboard.summary_loaded
api.orgs.join.token_expired
api.points.adjusted
```

Guidelines:

- Prefix with the service boundary: `web`, `api`, `worker`.
- Use domain nouns: `auth`, `dashboard`, `orgs`, `points`.
- Use past-tense outcomes for completed events: `created`, `loaded`, `failed`.
- Avoid event names that include IDs or variable data.
- Treat event names as an operator-facing API. Rename only deliberately.

## Redaction Rules

Never log:

- Access tokens
- Refresh tokens
- ID tokens
- Cookies
- Authorization headers
- Invite tokens
- Client secrets
- Raw session objects
- Full Auth0 user payloads
- Passwords or future credential fields

Log safe identifiers only when they help investigation:

- Internal user ID
- Auth0 subject
- Organization ID
- House ID
- Request ID
- Stable error code
- Next.js digest

Invite flows should log invite IDs or token hashes only if needed. Raw invite URLs and raw tokens should not be logged.

## User Messages Vs Operator Logs

User-facing messages should be safe and action-oriented:

- "Please sign in again."
- "Dashboard data could not be loaded. Please try again."
- "Invite link is expired."
- "You do not have permission to perform this action."

Operator logs should preserve diagnostic context:

- API status code
- Stable error code
- Request ID
- Route
- Service
- Auth/session failure type
- Next.js digest
- Safe cause metadata

The same failure can produce both outputs, but raw operational detail belongs only in logs.

## Implementation Plan

### Slice 1: Shared Log Schema

Create a shared logging contract for web and API:

- common log levels;
- common base fields;
- common error serialization;
- common redaction helpers;
- documented event naming rules.

This can live in a small shared package or be duplicated briefly while the shape stabilizes. Prefer a shared package once both services use it.

### Slice 2: Send Web Logs To SEQ

Add a web logger that mirrors the API logger behavior:

- [x] stdout remains enabled;
- [x] SEQ is enabled when `SEQ_SERVER_URL` is configured;
- [x] `SEQ_API_KEY` is optional;
- [x] redaction rules apply before sending;
- [x] delivery failures are logged without crashing requests.

Acceptance:

- `web.auth.access_token_expired` appears in SEQ.
- `web.request.failed` appears in SEQ.
- `web.dashboard.render_failed` appears in SEQ.

### Slice 3: Request Context Propagation

Make request correlation consistent:

- [x] create or read request ID at the web boundary for dashboard renders;
- [x] attach request ID to dashboard render logs;
- [x] pass request ID to all API calls in the render;
- [x] ensure API logs use the incoming ID;
- [x] include request ID in Server Action logs.

Acceptance:

- One SEQ query can show a dashboard render and its API calls.
- Failed API responses can be traced back to the web action or render that caused them.

### Slice 4: Normalize Expected Failures

Expected failures should be logged at `warn` or `info`, not `error`, unless they represent a defect or system failure.

Examples:

- expired Auth0 token without refresh token: `warn`
- missing session on anonymous homepage load: `warn` or `info`, depending on route
- validation error: `warn`
- forbidden action: `warn`
- handled API 4xx responses from Server Actions: `warn`
- missing active season setup: `warn`
- unhandled exception: `error`
- dependency outage: `error`

Acceptance:

- Error-level logs represent things that need operator attention.
- Expected user mistakes do not pollute error-rate alerts.

### Slice 5: Client-Side Error Capture

Add lightweight browser-side error reporting when the product needs it:

- React error boundaries can report safe client errors.
- Unhandled browser exceptions can be reported through a small route handler.
- Reports must redact URLs, tokens, and user-provided content carefully.

This should wait until server-side logging is unified.

### Slice 6: Dashboards And Alerts

Create SEQ queries or dashboards for:

- web render failures;
- API unhandled errors;
- auth token failures;
- API 401/403 rates;
- validation failures by route;
- p95 API duration by route;
- invite claim conflicts;
- dashboard dependency failures.

Alert only on signals with clear action. Dashboards can be broader than alerts.

## Chaos Engineering Readiness

Chaos engineering is useful only when the system can explain what happened. Before injecting failures, HousePoints needs observable baseline behavior.

Minimum readiness:

- web and API logs land in one place;
- request IDs connect web and API events;
- expected failures are separated from defects;
- latency and error-rate baselines exist;
- dependency failures are visible;
- tests cover the recovery path for known failure modes.

Early chaos experiments should be small and reversible:

- make the API unreachable from web in a local or staging environment;
- force API timeout responses;
- force Auth0 token refresh failures;
- simulate database connection failure;
- simulate duplicate invite claims;
- simulate slow dashboard queries.

Each experiment should answer:

1. Did the user see a safe message?
2. Did the operator see a clear log trail?
3. Did the system recover without manual database repair?
4. Did the alert or dashboard show the right signal?
5. Did we learn anything new about system behavior?

Do not run chaos experiments in production until staging has representative observability and rollback paths.

## Open Decisions

- Should web and API use one shared logging package?
- Should request ID and trace ID be separate fields?
- Should SEQ remain the long-term log store, or should the abstraction support another sink later?
- Which events should become alerts versus dashboard-only signals?
- Should logs include hashed user identifiers for privacy in broader deployments?
- When should client-side error capture be added?

## Near-Term Recommendation

Implement request context propagation next so one SEQ query can follow a full dashboard render across web and API.
