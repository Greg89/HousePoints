# Tier 2 — Reliability & Observability

Makes failures visible before users notice them.

---

## 2.1 Log drain (SEQ / Axiom / Logtail) ⬜

**Problem:** Both `apps/api` and `apps/web` already emit structured JSON logs to stdout, but nothing is capturing them. Errors disappear into Railway's ephemeral log buffer.

**Recommended:** Axiom (free tier, Railway-native integration) or Logtail.

**Steps:**
1. Add Axiom integration in Railway Dashboard → Integrations
2. Set `LOG_LEVEL=info` env var on both services (already in `.env.example`)
3. The existing Fastify JSON logger and `logInfo`/`logError` calls in the web app will flow through automatically

**Key log events to alert on:**
- `request.unhandled_error` — 500s in the API
- `web.action.failed` — server action failures
- `points.cross_organization_target` — potential security probe

---

## 2.2 Railway health check ⬜

**Problem:** Railway doesn't know if the API process is up and serving — it only knows if the process is running.

**Fix:** In Railway → API service → Settings → Health Check:
- Path: `/health`
- Interval: 30s
- Timeout: 5s

The endpoint already exists and returns `{ ok: true }`.

---

## 2.3 `error.tsx` global error boundary ⬜

See [01-correctness.md § 1.5](./01-correctness.md) — listed in Tier 1 as well because it affects correctness.

Additional `not-found.tsx` for 404 pages:
```typescript
// apps/web/src/app/not-found.tsx
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="font-display text-4xl text-primary">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <a href="/" className="text-sm text-primary hover:underline">Go home</a>
      </div>
    </div>
  );
}
```

---

## 2.4 Consistent API error responses ⬜

**Problem:** Some error responses include a `code` field, others only have `message`. Client code can't reliably branch on error type.

**Target shape:**
```typescript
type ApiError = {
  code: string;       // e.g. "ACTOR_NOT_MAPPED", "VALIDATION_ERROR"
  message: string;    // human-readable
  errors?: unknown;   // zod flatten output for 400s
};
```

**Work:** Audit all `reply.status(4xx).send(...)` calls in `apps/api/src/app.ts` and normalise to the above shape. Update `setErrorHandler` to use `code: "INTERNAL_ERROR"`.
