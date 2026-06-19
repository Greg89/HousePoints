# SEQ Query Runbook

## Purpose

This runbook gives practical SEQ queries for debugging HousePoints production issues without jumping first to Railway deploy logs.

Use Railway logs for platform failures, deployment failures, process crashes before the logger starts, and network edge details. Use SEQ for application behavior.

## Common Fields

Useful fields to start with:

- `event`
- `service`
- `environment`
- `requestId`
- `route` or `path`
- `method`
- `statusCode`
- `durationMs`
- `userId`
- `auth0Sub`
- `organizationId`
- `errorName`
- `errorCode`
- `digest`

## Trace One User-Visible Operation

When a page or action shows an error and you have a request ID:

```text
requestId = 'request-id-here'
```

Expected result:

- web render or Server Action events;
- API request events with the same `requestId`;
- the first warning or error that explains the failure;
- final completion event with status and duration when available.

## Dashboard Render Failures

```text
event in ['web.dashboard.render_failed', 'web.request.failed']
```

When the result has a `requestId`, pivot to:

```text
requestId = 'request-id-here'
```

Check whether the web failure was caused by:

- an API 4xx expected failure;
- an API 5xx or dependency outage;
- Auth0 session state;
- a Next.js Server Component digest.

## Server Action Failures

```text
event = 'web.action.failed'
```

Filter by action name when present:

```text
event = 'web.action.failed' and action = 'awardPoints'
```

Expected user mistakes should usually have warning-level API events nearby, not application errors.

## Auth And Session Problems

```text
event like 'auth.%' or event like 'web.auth.%'
```

Useful focused queries:

```text
event = 'web.auth.access_token_expired'
```

```text
event in ['auth.token_missing', 'auth.token_invalid']
```

Expired web access tokens without refresh tokens should be warnings that lead the user back through sign-in, not dashboard 500s.

## API Errors That Need Operator Attention

```text
service = 'housepoints-api' and event = 'request.unhandled_error'
```

Then pivot by request:

```text
requestId = 'request-id-here'
```

Unhandled API errors should be rare and should usually correspond to defects, unavailable dependencies, or unexpected database behavior.

## Expected Warning Noise

Expected user or setup failures should normally be warning-level:

```text
statusCode >= 400 and statusCode < 500
```

Examples:

- validation failures;
- forbidden actions;
- expired or reused invite links;
- missing active season setup;
- invalid or missing auth tokens.

If one warning class becomes noisy, decide whether it is normal product behavior, a UX issue, or something that deserves an alert.

## Redaction Checks

Spot-check new logging changes before release:

```text
accessToken is not null or refreshToken is not null or inviteToken is not null or authorization is not null or cookie is not null
```

Those fields should be absent or have `[REDACTED]` as the value.

Never add raw session objects, Auth0 payloads, invite URLs, cookies, or bearer tokens to log context.

## Suggested Dashboard Tiles

Start with dashboard-only views before adding alerts:

- error events by `service` and `event`;
- warning events by `event`;
- dashboard render failures over time;
- API unhandled errors over time;
- auth token failures over time;
- 401/403 rates by route;
- validation failures by route;
- slow API requests by route using `durationMs`;
- invite join conflicts by event.

Alert only on signals with a clear owner and response:

- `request.unhandled_error` in production;
- repeated `web.dashboard.render_failed`;
- sustained API 5xx responses;
- repeated SEQ delivery failures;
- severe dependency outage signals.

## Chaos Experiment Checklist

Before a chaos experiment, record the baseline queries:

- `requestId = '...'` for the test operation;
- `service = 'housepoints-web' and level = 'error'`;
- `service = 'housepoints-api' and level = 'error'`;
- expected warning event for the failure being injected.

After the experiment, answer:

1. Did the user see a safe message?
2. Did SEQ show the complete request path?
3. Was the failure classified at the right level?
4. Was any sensitive data redacted?
5. Did the system recover when the injected failure stopped?
