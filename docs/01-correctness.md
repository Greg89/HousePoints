# Tier 1 - Correctness & Security

These items must be complete before the app is used by a real team day-to-day.

---

## 1.1 Display name edit [done]
Users can update their display name at `/settings`. The DB is the source of truth; Auth0 token name is ignored.

---

## 1.2 `revalidatePath` after mutating server actions [done]

**Problem:** After awarding points, creating a house, or assigning a user to a house the page doesn't re-fetch; users see stale data until they manually refresh.

**Fix:** Call `revalidatePath("/")` at the end of every mutating action.

**Actions to audit:**
- `awardPoints` - [done] already added
- `submitPointAdjustment` - [todo]
- `createHouse` - [todo]
- `assignUserHouse` - [todo]
- `updateDisplayName` - [done] already added

---

## 1.3 Toast feedback on success / failure [done]

**Problem:** Mutating actions (award points, admin operations) give no visual confirmation. Users don't know if the action succeeded.

**Approach:**
- `sonner` is already installed in `apps/web`
- Add a `<Toaster />` to the root layout
- Client components call `toast.success()` / `toast.error()` based on server action result
- Server actions need to return a result object `{ ok: true } | { ok: false; message: string }` instead of throwing, so the client can branch

**Files to change:**
- `apps/web/src/app/layout.tsx` - add `<Toaster />`
- `apps/web/src/components/AwardPointsDialog.tsx` - call toast after `onAward`
- `apps/web/src/components/DashboardShell.tsx` - call toast after admin form submissions
- `apps/web/src/app/settings/page.tsx` / `DisplayNameForm.tsx` - already has inline success state; optionally toast instead

---

## 1.4 Rate limiting on API [todo]

**Problem:** `/points/adjust` and other write endpoints have no rate limit. A misbehaving client could flood the DB.

**Approach:**
```bash
npm install @fastify/rate-limit -w @housepoints/api
```

Register per-route limits:
- `POST /points/adjust` - 20 req / minute per IP
- `POST /users/bootstrap` - 30 req / minute per IP
- All other write endpoints - 60 req / minute per IP

```typescript
// apps/api/src/app.ts
import rateLimit from "@fastify/rate-limit";
await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });
// Then override per-route with { config: { rateLimit: { max: 20 } } }
```

---

## 1.5 Error boundary [done]

**Problem:** If the API is down or returns an unexpected response during a server component render, Next.js shows a generic crash page.

**Fix:** Add `apps/web/src/app/error.tsx`, a client component that catches render errors and shows a friendly retry screen.

```typescript
// apps/web/src/app/error.tsx
"use client";
export default function GlobalError({ reset }: { reset: () => void }) { ... }
```

Also add `apps/web/src/app/not-found.tsx` for clean 404s.

---

## 1.6 Confirm `db:deploy` on Railway start [done]

**Problem:** New migrations won't apply on Railway unless the API start command runs `prisma migrate deploy` first.

**Check:** In Railway -> API service -> Settings -> Start Command, confirm it is:
```
npm run db:deploy -w @housepoints/db && npm run start -w @housepoints/api
```

If not, update it. This ensures the `20260613190000_house_color_description` migration (and all future ones) apply automatically on every deploy.
