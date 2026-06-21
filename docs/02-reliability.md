# Tier 2 - Reliability & Observability

Makes failures visible before users notice them.

---

## 2.1 Structured log drain to SEQ [done]

**Original problem:** API and web errors were split between Railway logs, Next.js production error pages, and ad-hoc local debugging.

**Implemented approach:**

- API logs are structured through Pino.
- Web server logs use the shared logging helpers and can write to SEQ when configured.
- Dashboard renders share one request ID across web logs and API reads.
- Server Actions use a shared action logging context.
- Expected failures are warning-level where appropriate.
- Shared redaction and error serialization helpers live in contracts.
- Practical SEQ queries are documented in [refactor-pass-1/07-seq-query-runbook.md](./refactor-pass-1/07-seq-query-runbook.md).

Runtime configuration:

- `SEQ_SERVER_URL`
- `SEQ_API_KEY` when the SEQ instance requires one
- `LOG_LEVEL=info`

**Key log events to alert on:**
- `request.unhandled_error` - 500s in the API
- `web.dashboard.render_failed` - dashboard render failure
- `web.action.failed` - server action failures
- `points.cross_organization_target` - potential security probe

---

## 2.2 Railway health check [done]

**Original problem:** Railway did not know if the API process was up and serving; it only knew if the process was running.

**Implemented fix:** Railway is configured to call the API health endpoint before considering a deploy live.

Railway API service settings:

- Path: `/health`
- Interval: 30s
- Timeout: 5s

The endpoint already exists and returns `{ ok: true }`.

---

## 2.3 `error.tsx` global error boundary [done]

See [01-correctness.md section 1.5](./01-correctness.md). The route error boundary now shows retry, home, and logout recovery actions, and the app has a clean `not-found.tsx` page.

---

## 2.4 Consistent API error responses [done]

**Original problem:** Some error responses included a `code` field, others only had `message`. Client code could not reliably branch on error type.

**Implemented target shape:**
```typescript
type ApiError = {
  code: string;       // e.g. "ACTOR_NOT_MAPPED", "VALIDATION_ERROR"
  message: string;    // human-readable
  errors?: unknown;   // zod flatten output for 400s
};
```

Web-consumed API errors now preserve stable codes through the shared API response parser. The central API error handler returns `code: "INTERNAL_ERROR"` for unhandled failures without leaking internal details.

---

## 2.5 Browser-side client error reporting [done]

Server-side render, Server Action, and browser-only runtime failures are now visible in structured logs.

Implemented approach:

- `ClientErrorReporter` listens for `window.error` and `window.unhandledrejection`.
- Reports are sent to the same-origin `POST /api/client-errors` route.
- The route validates and truncates payloads before writing `web.client.error_reported`.
- Invalid or malformed reports write `web.client.error_report_rejected` without leaking raw browser payloads.
- SEQ credentials stay server-side; browsers never write directly to SEQ.
