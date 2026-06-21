# Tier 1 - Correctness & Security

These items must be complete before the app is used by a real team day-to-day.

---

## 1.1 Display name edit [done]
Users can update their display name at `/settings`. The DB is the source of truth; Auth0 token name is ignored.

---

## 1.2 `revalidatePath` after mutating server actions [done]

**Original problem:** After awarding points, creating a house, or assigning a user to a house the page did not re-fetch; users saw stale data until they manually refreshed.

**Implemented fix:** Mutating Server Actions revalidate the affected dashboard/settings paths after successful writes.

Covered actions:

- `awardPoints`
- `createHouse`
- `assignUserHouse`
- org create/join actions
- season start/rename actions
- `updateDisplayName`

---

## 1.3 Toast feedback on success / failure [done]

**Original problem:** Mutating actions (award points, admin operations) gave no visual confirmation. Users did not know if the action succeeded.

**Implemented approach:**

- `apps/web/src/app/layout.tsx` renders the shared Sonner `<Toaster />`.
- Award points, org onboarding, and admin management flows show success/error toasts.
- Settings keeps an inline success state for the display-name form.

Expected mutation failures are still being improved toward typed UI results one flow at a time; current client components catch known action failures and show safe user-facing messages.

---

## 1.4 Rate limiting on API [done]

**Original problem:** `/points/adjust` and other write endpoints had no rate limit. A misbehaving client could flood the DB.

**Implemented approach:**

- `@fastify/rate-limit` is registered globally in the API app factory.
- `POST /points/adjust` uses a tighter per-route limit.
- `POST /users/bootstrap` uses a per-route bootstrap limit.
- Other API routes inherit the global limit.

Current limits:

- `POST /points/adjust` - 20 req / minute per IP
- `POST /users/bootstrap` - 30 req / minute per IP
- All other write endpoints - 60 req / minute per IP

---

## 1.5 Error boundary [done]

**Problem:** If the API is down or returns an unexpected response during a server component render, Next.js shows a generic crash page.

**Implemented fix:** `apps/web/src/app/error.tsx` catches render errors and shows safe retry, home, and logout recovery actions. `apps/web/src/app/not-found.tsx` provides a clean 404 page.

---

## 1.6 Confirm `db:deploy` on Railway start [done]

**Problem:** New migrations won't apply on Railway unless the API start command runs `prisma migrate deploy` first.

**Check:** In Railway -> API service -> Settings -> Start Command, confirm it is:
```
npm run db:deploy -w @housepoints/db && npm run start -w @housepoints/api
```

If not, update it. This ensures the `20260613190000_house_color_description` migration (and all future ones) apply automatically on every deploy.

---

## 1.7 Auth identity linking for alternate Auth0 social providers [done]

**Original problem:** A user signing in with another Auth0 provider that shared the same email could hit a database unique constraint on `User.email`.

**Implemented approach:**

- Added the `AuthIdentity` table so multiple provider subjects can map to one HousePoints user.
- Actor resolution checks `AuthIdentity.providerSubject` before the legacy `User.auth0Sub` fallback.
- Bootstrap, org create, and org join flows link same-email identities only when the Auth0 email claim is verified.
- Unsafe or unverified same-email conflicts return `ACCOUNT_LINK_REQUIRED` instead of an unhandled Prisma error.
- The web error boundary includes a logout recovery action so a trapped user can restart login.
