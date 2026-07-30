# Mobile App Design

Status: draft / not started
Owner: TBD
Related docs: [multi-org-membership-design.md](./multi-org-membership-design.md), [notifications-design.md](./notifications-design.md), [activity-reactions-design.md](./activity-reactions-design.md), [staging-e2e-test-data-contract.md](./staging-e2e-test-data-contract.md)

## 1. Goals

- Ship a first-party HousePoints mobile app (iOS + Android) that reuses the existing API, contracts, database, Auth0 tenant, and organization/multi-org model with **no forks** of business logic.
- Provide the day-to-day member experience on mobile: sign in, view leaderboard/dashboard, award points, react to activity, receive notifications (in-app + push).
- Provide a "good enough" admin/owner subset (member management, invite generation, point deductions) so mobile is not just a read-only companion.
- Keep the mobile client an additional consumer of the existing Fastify API, not a divergent product surface. Contracts stay the source of truth.

### Non-goals (initial release)

- Full parity with the web Manage workspaces surface (audit deep-dives, org lifecycle/archive, release management stay web-only for now).
- Season creation / transition management.
- Offline-first authoring (award/deduct while offline). Read caching is fine; writes require connectivity.
- A second design system. We adapt the existing tokens; we do not redesign.

## 2. What the current architecture already gives us

The repo is set up such that the mobile app is largely an additional API consumer:

- **API-first split**. `apps/api` is a standalone Fastify 5 service. The web client is not a required dependency for any business flow. Every mobile feature can drive the same endpoints already used by `apps/web`.
- **Bearer-token auth**. The API validates Auth0 access tokens (RS256) directly in [apps/api/src/auth.ts](apps/api/src/auth.ts). There is no session cookie contract to reproduce. A native OIDC PKCE flow is enough.
- **Actor is derived from the token**. See [apps/api/src/actor.ts](apps/api/src/actor.ts) and [apps/api/src/api-hooks.ts](apps/api/src/api-hooks.ts). Clients never send trusted actor identity in bodies, so mobile inherits the same security posture as web.
- **Shared schemas**. `@housepoints/contracts` publishes Zod schemas + TS types used by both the API and the web app ([packages/contracts/src/index.ts](packages/contracts/src/index.ts)). The mobile app can import the same package for request/response validation.
- **Org scoping via header**. The web client already passes an active org through `x-housepoints-organization-slug` ([apps/web/src/lib/api-client.ts](apps/web/src/lib/api-client.ts#L75-L82)). Mobile reuses the same convention; no new server contract is needed for multi-org switching.
- **Structured errors and request IDs**. `apiErrorSchema`, `x-request-id`, and SEQ log correlation apply identically to mobile calls.
- **Rate limiting is transport-agnostic**. `@fastify/rate-limit` keys on the authenticated user (or IP fallback), so mobile clients are already rate-limited on day one without new work.
- **CORS is not a mobile concern**. Native fetch does not enforce CORS, so `CORS_ALLOWED_ORIGINS` does not need to include the mobile app.

Practical takeaway: the majority of the mobile MVP is client work. The API changes are additive (device registration + push dispatch, see §7).

## 3. Tech stack

Recommended stack, optimised for reuse of TypeScript + Zod + contracts:

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React Native + Expo (managed workflow, EAS Build)** | Reuses TS + Zod; single codebase for iOS/Android; Expo Router mirrors the App Router mental model already used in `apps/web`. |
| Language | TypeScript (strict) | Matches the rest of the monorepo. Enables direct import of `@housepoints/contracts`. |
| Auth | `react-native-auth0` (Auth0 native SDK) with Authorization Code + PKCE + refresh tokens (rotation on) | Same tenant, same Application (new "Native" Auth0 Application registered under the tenant), same `AUTH0_AUDIENCE`. |
| Secure storage | `expo-secure-store` (Keychain / Keystore) | Stores refresh tokens; access tokens can live in memory. |
| Data fetching | **TanStack Query** (`@tanstack/react-query`) | Cache, background refetch, mutations, and optimistic updates. Complements the Zod parsing layer. |
| Forms / validation | `react-hook-form` + Zod resolver against shared contract schemas | Consistent with the web app. |
| Styling | **NativeWind** (Tailwind for RN) or a small token layer that mirrors `apps/web/src/app/globals.css` variables | Reuses design tokens (colors, spacing, radius) from the web app so house-theme colors stay consistent. |
| Navigation | Expo Router | File-based routing, deep-link friendly. |
| Push | Expo Notifications (APNs + FCM under the hood) | Simplest path; can be swapped for direct APNs/FCM if needed. |
| Testing | Vitest for logic, React Native Testing Library for components, **Maestro** for E2E | Matches the web app's Vitest baseline; Maestro is simpler than Detox in CI. |
| Analytics / errors | Same client-error reporting path used by web (`ClientErrorReporter`), routed via API `/system/client-errors` if/when we add one; otherwise `logWarn` from a mobile logger to the API's SEQ pipeline. | Keeps observability unified. |

Rejected alternatives:

- **Bare React Native**: more control but forfeits Expo's push, updates, and EAS Build simplicity. Not worth it for a small team.
- **Flutter / Kotlin Multiplatform**: cannot reuse `@housepoints/contracts` Zod schemas or the web team's TS mental model. Would double the maintenance surface.
- **Progressive Web App only**: does not solve push notifications reliably on iOS, does not appear in app stores, does not unlock native invite deep-link handling as cleanly.

## 4. Monorepo placement

New workspace:

```
apps/
  mobile/
    package.json          # name: "@housepoints/mobile"
    app.config.ts         # Expo config; reads EXPO_PUBLIC_* env
    tsconfig.json         # extends the root TS config
    eas.json              # EAS Build profiles: development, preview, production
    src/
      app/                # Expo Router routes (mirrors apps/web/src/app conventions)
      components/         # RN components (analogous to apps/web/src/components)
      lib/
        api-client.ts     # native fetch wrapper (see §6)
        auth.ts           # Auth0 native session helpers
        active-organization.ts  # persisted org slug (SecureStore)
        query-client.ts   # TanStack Query config
        logging.ts        # structured log helpers
      features/           # feature-scoped screens + hooks (dashboard, activity, notifications, manage)
    e2e/                  # Maestro flows
```

Root `package.json` gains:

- `"dev:mobile": "npm run start -w @housepoints/mobile"`
- `mobile` workspace is picked up automatically by the existing `"apps/*"` workspace glob.
- `npm run typecheck` and `npm run lint` already fan out via `--workspaces --if-present`; mobile inherits the gates once it has those scripts.

`packages/contracts` and `packages/db` require no structural changes. `packages/db` should not be imported from the mobile app — only `packages/contracts` and (optionally) a tiny future `packages/mobile-ui` if we split reusable RN primitives.

## 5. Reuse map (per package)

| Package | Mobile reuse | Notes |
|---|---|---|
| `packages/contracts` | **Full reuse.** Import Zod schemas + inferred types for every request/response. | Requires building the package before running mobile (`npm run build -w @housepoints/contracts`) — same rule as web. |
| `packages/db` | **No reuse.** Prisma runs server-side only. | Guard: mobile `tsconfig` should not resolve `@housepoints/db`. |
| `apps/api` | **No source reuse.** Consumed over HTTP. | Additive endpoints for device registration and push preferences (§7). |
| `apps/web/src/lib/api-client.ts` | **Reference implementation.** The mobile client mirrors the header contract (`authorization`, `x-request-id`, `x-housepoints-organization-slug`, `content-type`) and Zod response parsing. | Do not import — the web client depends on Next.js `server-only` and Auth0 Node SDK. Port the small `createApiRequester` + `parseApiResponse` pattern. |
| `apps/web/src/lib/action-results.ts`, `logging.ts`, `active-organization.ts` | **Reference implementations.** Reimplement thin native equivalents. | Persisted values move from cookies/headers to `expo-secure-store` / `AsyncStorage`. |
| Design tokens in `apps/web/src/app/globals.css` and `apps/web/src/lib/house-theme.ts` | **Full reuse via a new `packages/theme`.** Extract token set and house-color math there; refactor web to consume it as part of the mobile Phase 1 prerequisite work. | Decided in §17. Pure logic only; DOM/CSS bits stay in the web app, RN styling in mobile. |

## 6. Auth flow

Mobile uses Authorization Code + PKCE with refresh token rotation:

1. User taps **Sign in** → app launches Auth0 Universal Login via `react-native-auth0`'s `webAuth.authorize()` with:
   - `audience`: same value as `AUTH0_AUDIENCE` used by the API.
   - `scope`: `openid profile email offline_access`.
2. Auth0 returns via the custom scheme redirect (`housepoints://<bundle-id>/callback`). SDK returns `{ accessToken, idToken, refreshToken, expiresAt }`.
3. `refreshToken` → `expo-secure-store` (Keychain / Keystore). `accessToken` + `idToken` → in-memory only.
4. All API calls attach `Authorization: Bearer <accessToken>` plus `x-request-id` (uuid v4 per request) plus `x-housepoints-organization-slug` when an active org is set.
5. When the API returns 401 with a token-related code, the client refreshes via `credentialsManager.getCredentials()` (which rotates the refresh token) and retries once. On refresh failure the user is signed out and returned to the login screen.
6. Identity linking for same-email social providers already exists on the API and reads `x-auth0-id-token` when present ([apps/api/src/routes/users.ts](apps/api/src/routes/users.ts) around the `readIdTokenHeader` call). Mobile passes the id token during the initial bootstrap call to keep behavior aligned with web.

**Auth0 tenant setup**

- Create a new **Native Application** in Auth0 (separate from the web Regular Web App).
- Add callback + logout URLs: `housepoints://<bundle-id>/callback`, `housepoints://<bundle-id>/logout`.
- Enable refresh token rotation and reuse detection.
- Grant the existing HousePoints API audience.
- Keep the API's `AUTH0_CLIENT_ID` set to the web app's client id (the id-token verification path in `apps/api/src/routes/users.ts` is web-only). If we ever need id-token verification for mobile, we introduce `AUTH0_NATIVE_CLIENT_ID` and accept either.

## 7. API changes (minimal, additive)

Everything below is additive — no breaking changes to existing endpoints.

### 7.1 Device registration for push (new)

**Status:** Implemented. The API registration endpoints and mobile lifecycle
are in place. On a physical device the app requests notification permission,
obtains an Expo token using `EXPO_PUBLIC_EAS_PROJECT_ID`, registers after
sign-in and active-organization changes, and best-effort unregisters before
sign-out clears Auth0 credentials.

New Prisma model:

```prisma
model DeviceRegistration {
  id             String   @id @default(cuid())
  userId         String
  organizationId String   // scoped like every other durable record
  platform       DevicePlatform
  pushToken      String   // Expo push token or raw APNs/FCM token
  appVersion     String?
  locale         String?
  lastSeenAt     DateTime @default(now())
  revokedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, pushToken])
  @@index([organizationId, userId])
  @@index([revokedAt])
}

enum DevicePlatform { IOS ANDROID }
```

New API routes (under `apps/api/src/routes/devices.ts`):

- `POST /devices` — body `{ platform, pushToken, appVersion?, locale? }`, returns `{ id }`. Upserts on `(userId, pushToken)`, clears `revokedAt`.
- `DELETE /devices/:id` — soft-revoke (sets `revokedAt`). Called on sign-out.
- `PATCH /devices/:id/heartbeat` (optional, batched) — updates `lastSeenAt` so we can prune stale tokens.

All routes go through the existing actor + org-scope hooks. Contracts live in a new `device-schemas.ts` in `@housepoints/contracts`.

### 7.2 Push dispatch alongside in-app notifications

**Status:** Implemented for the Phase 2 backend. The API dispatches eligible
notifications after their database transaction commits, looks up active device
registrations within the recipient organization, and sends through an
injectable Expo provider. Dispatch is synchronous best-effort and controlled by
`PUSH_DISPATCH_ENABLED`; failures are logged without rolling back in-app
notifications.

The existing `Notification` writer path in [apps/api/src/notifications.ts](apps/api/src/notifications.ts) becomes the single fan-out point. After a notification row is persisted, an async dispatcher looks up the recipient's active `DeviceRegistration` rows (org-scoped) and enqueues push messages. For MVP: synchronous best-effort send with structured logging (`notifications.push_dispatched`, `notifications.push_failed`); no external queue until volume demands it.

Send provider: **Expo Push API** first (single HTTP call, handles APNs + FCM). If we ever move off Expo, swap the implementation behind a `PushDispatcher` interface.

Notification types eligible for push (initial list): `POINT_AWARD_RECEIVED`, `POINT_DEDUCTION_RECEIVED`, `POINT_REACTION_RECEIVED`, `INVITE_ACCEPTED`, `ROLE_CHANGED`, `SEASON_STARTED`, `RELEASE_ANNOUNCEMENT`, `MEMBER_NEEDS_HOUSE_ASSIGNMENT` (admins only). Severity `INFO` items are pushable but do not require action.

### 7.3 Notification read/dismissal already works

The mobile app hits the same `POST /notifications/mark-read` endpoint used by web. No change required.

### 7.4 Optional: `GET /me/bootstrap`

The web app currently performs several sequential calls during dashboard load. Consider a single mobile-optimised bootstrap endpoint returning `{ appUser, activeOrg, memberships, unreadNotificationCount }` in one round-trip. Not required for MVP; add only if launch profiling shows cold-start latency is user-visible.

## 8. Feature phasing

**Phase 1 — MVP (member experience)**

- Sign in / sign out (Auth0 native).
- Org picker (reads `/orgs` memberships list; persists selection in SecureStore).
- Dashboard: house leaderboard + season context (`GET /dashboard`).
- Members tab: per-member scores in current season (`GET /dashboard/leaderboard`).
- Activity feed with pagination (`GET /activity`) and pull-to-refresh.
- Award points flow (`POST /points/award`) with trait picker and confirmation toast.
- In-app notifications list + mark-read (`GET /notifications`, `POST /notifications/mark-read`).
- Profile: display-name edit (`POST /profile`).

**Phase 2 — Notifications & reactions**

- Device registration on first launch after sign-in.
- Push notifications for the types listed in §7.2.
- Point reactions on the activity feed (`POST /points/:id/react`, `GET /points/:id/reactions`).
- Deep links: `housepoints://o/<slug>/dashboard`, `housepoints://o/<slug>/activity/<pointId>`, invite acceptance link.

**Status:** Implemented. Expo Router exposes the canonical dashboard, activity,
and invite routes. Organization routes verify membership before switching
context. Notification responses use the same resolver when the app is running
or cold-started, and invite tokens are accepted only through the authenticated
server join endpoint after explicit confirmation.

Activity reactions are also implemented using the current
`/transactions/react` and `/transactions/reactions` contracts. Award rows
provide a visible picker plus a long-press shortcut, update counts
optimistically with rollback, and expose the server-backed reaction details.
Deduction rows do not expose reaction controls.

**Phase 3 — Admin subset**

- Manage members: house assignment, role changes, remove member (implemented
  with `/admin/context` and the existing mutation routes under `/admin/*`).
- Invite generation + platform-native share sheet (implemented with
  `/orgs/invite` and React Native's link-capable `Share` API).
- Point deduction (gated by `POINT_ADJUSTMENTS_ENABLED`, same feature flag the web app respects).
- Recent admin actions read view.

Deferred (web-only for now): season creation/transition, org archive, release announcements, house theme QA, season comparison report.

## 9. Multi-org handling on mobile

- After sign-in, call the existing memberships endpoint used by the org switcher (see [apps/web/src/components/OrganizationSwitcher.tsx](apps/web/src/components/OrganizationSwitcher.tsx)).
- If the user has more than one membership and no persisted active slug, show a chooser. Otherwise auto-select.
- Persisted `activeOrgSlug` in `expo-secure-store` (not `AsyncStorage`) so it is wiped on device restore/uninstall alongside credentials.
- Every request adds `x-housepoints-organization-slug: <activeOrgSlug>`. Server behavior is already correct: [apps/api/src/actor.ts](apps/api/src/actor.ts) resolves the preferred membership from the header via `pickPreferredMembership`.
- Push tokens are registered **per active org**. When the user switches org, we call `POST /devices` again for the new org; the server can look up devices by `(userId, organizationId)` to route notifications correctly.

## 10. Design system

- Create a new `packages/theme` workspace that exports the token set (colors, spacing scale, radii, elevation, light/dark variants) as plain TS objects, plus the pure house-color math currently in `apps/web/src/lib/house-theme.ts`.
- Refactor `apps/web` to consume `packages/theme`: `globals.css` derives its CSS custom properties from the shared token object; `house-theme.ts` becomes a thin re-export. This is a Phase 1 prerequisite so mobile and web launch from one source of truth.
- Mobile consumes the same package via a small style helper (e.g. NativeWind config generated from the token object, or direct `StyleSheet` factories). DOM/CSS-specific code stays in `apps/web`; RN-specific code stays in `apps/mobile`.
- Screens use light + dark automatic mode by respecting `useColorScheme()`; the same token set exposes light/dark variants.
- Iconography: `@expo/vector-icons` (Feather) to match the web app's minimal outline style.

## 11. State, caching, and error handling

- TanStack Query keys are namespaced by `activeOrgSlug` so switching org clears the cache surface.
- `queryFn` uses the mobile `apiClient.request` wrapper, which:
  - Attaches auth + org + request-id headers.
  - Parses the response through the matching Zod schema from `@housepoints/contracts`.
  - Throws a typed `ApiResponseError` (mirroring [apps/web/src/lib/api-client.ts](apps/web/src/lib/api-client.ts#L20-L34)) with `statusCode` and `code`.
- Global error boundary + a toast surface (`sonner-native` or a small custom `Snackbar`) mirror the web `Toaster` + `error.tsx` pattern.
- Mutations use optimistic updates for reactions and mark-read; award/deduct wait for server confirmation.

## 12. Environment configuration

`apps/mobile/.env` (loaded via Expo's `EXPO_PUBLIC_*` convention):

```env
EXPO_PUBLIC_API_BASE_URL="https://api.housepoints.example"
EXPO_PUBLIC_WEB_BASE_URL="https://app.housepoints.example"
EXPO_PUBLIC_AUTH0_DOMAIN="your-tenant.us.auth0.com"
EXPO_PUBLIC_AUTH0_CLIENT_ID="your-native-client-id"
EXPO_PUBLIC_AUTH0_AUDIENCE="https://api.housepoints.example"
EXPO_PUBLIC_EAS_PROJECT_ID="your-eas-project-id"
EXPO_PUBLIC_DEFAULT_ORG_SLUG=""      # optional; usually blank
EXPO_PUBLIC_POINT_ADJUSTMENTS_ENABLED="false"
EXPO_PUBLIC_MOBILE_ADMIN_ENABLED="false"
EXPO_PUBLIC_SEQ_INGEST_URL=""        # optional client-side breadcrumb ingest
```

`eas.json` profiles map `development` → local API, `preview` → staging, `production` → prod. No secrets ship in the app bundle — Auth0 native flow does not use a client secret.

App identity (decided in §17 and locked in before Auth0 native app registration + store reservation):

- Display name: **HousePoints**
- iOS bundle id / Android application id: **`com.housepoints.app`**
- URL scheme: **`housepoints://`**
- Auth0 callback: `housepoints://com.housepoints.app/callback`
- Auth0 logout: `housepoints://com.housepoints.app/logout`

**Expo Updates (OTA)** is enabled from day one on both `preview` and `production` channels via `expo-updates`. Native code changes still require a store submission; JS-only fixes ship OTA within the same release channel. Rollback is `eas update --branch <channel> --republish` to the previous known-good runtime version.

## 13. Observability

- Every mobile request generates a `x-request-id` (uuid v4) so mobile → API → SEQ correlation matches the web pattern already documented in [docs/refactor-pass-1/07-seq-query-runbook.md](docs/refactor-pass-1/07-seq-query-runbook.md).
- Mobile logs a lightweight `app.startup` breadcrumb (platform, appVersion, locale, activeOrgSlug hash) after sign-in. Nothing sensitive is logged.
- Client errors: reuse the concept from `ClientErrorReporter` — batch caught errors and post to an API endpoint that funnels them into SEQ. If we do not want a new endpoint immediately, we can piggyback on the existing web client-error path once it is generalised.

## 14. Testing & CI

- `npm run typecheck -w @housepoints/mobile` — TS strict.
- `npm run test -w @housepoints/mobile` — Vitest for logic + React Native Testing Library for components.
- `npm run lint -w @housepoints/mobile` — ESLint with `eslint-plugin-react-native`.
- **Maestro** flows in `apps/mobile/e2e/` for sign-in → dashboard → award-points happy paths. Runs against staging in CI on `develop`.
- EAS Build in CI: `preview` builds on every merge to `develop`, `production` builds on tag from `master`, matching the web release discipline described in [docs/release-and-e2e-automation.md](docs/release-and-e2e-automation.md).
- Contract drift protection: the mobile Vitest suite imports the same Zod schemas and asserts a couple of representative fixtures parse — if a contract changes shape without a matching mobile update, CI fails.

## 15. Security considerations

- Refresh tokens only in `expo-secure-store` (Keychain / Keystore). Never in `AsyncStorage`, never logged.
- Access tokens live in memory, are not persisted, and are cleared on background timeout (configurable, default 15 min inactivity in-app; refresh is transparent to the user).
- Bundle inspection: no secrets are shipped. Auth0 client id is a public identifier for native apps.
- Push tokens are treated as identifiers, not secrets, but we still soft-delete on sign-out and on `PATCH /devices/:id/heartbeat` failures.
- Deep links: the invite-acceptance deep link **must** re-verify the invite token server-side; the app treats deep-link payloads as untrusted input.
- OWASP alignment (parallels the API):
  - A01 Broken access control — actor + org derived server-side; unchanged.
  - A02 Cryptographic failures — secure storage as above; TLS enforced (Expo disallows cleartext by default on Android; iOS ATS is default-on).
  - A07 Identification & auth failures — PKCE + refresh rotation + reuse detection.
  - A05 Security misconfig — API rate limits already apply per-user; nothing to relax for mobile.

## 16. Rollout plan

1. **Prereq**: extract `packages/theme` and refactor web to consume it (see §10, §17 decision). Land this before the mobile spike so the mobile app pulls from a shared token source day one.
2. **Spike (1 short iteration)**: bare Expo app + Auth0 sign-in + one authenticated API call (`GET /me`). Confirms Auth0 tenant + PKCE config end-to-end. Locks in bundle id `com.housepoints.app` and scheme `housepoints://`.
3. **MVP Phase 1** feature set behind a staging Auth0 connection. TestFlight + Play internal testing tracks. Expo Updates (`preview` channel) enabled here.
4. **Phase 2** push + reactions. Enables device registration and push endpoints in staging first. Expo Push API used as the dispatcher.
5. **Phase 3** admin subset (member mgmt, invites, point deduction). Gated by feature flag `MOBILE_ADMIN_ENABLED` in the mobile app for a soak period. Deeper Manage flows deep-link to the web dashboard.

**Phase 3 gate status:** Implemented. Because Expo only exposes public runtime
configuration to the client, the concrete variable is
`EXPO_PUBLIC_MOBILE_ADMIN_ENABLED`. The Admin tab and route require both the
flag and an active `ADMIN`/`OWNER` membership. The empty state links to the
slug-scoped Manage workspace using `EXPO_PUBLIC_WEB_BASE_URL`.
6. **Public release** on both stores after two consecutive clean staging E2E runs. Expo Updates (`production` channel) becomes the hotfix path.

Roadmap update: Tier 6 in [docs/roadmap.md](docs/roadmap.md) mirrors this phasing.

## 17. Decisions

Triaged 2026-07-29. These replace the previous open-questions list.

| # | Question | Decision | Notes |
|---|---|---|---|
| 17.1 | Push provider | **Expo Push API for MVP.** | Single HTTP call, APNs + FCM handled. Kept behind a `PushDispatcher` interface so a swap to native providers stays cheap if we later need rich pushes (images, action buttons, silent/data). |
| 17.2 | `GET /me/bootstrap` endpoint | **Not added for MVP.** Reuse existing per-resource calls. | Revisit only if launch profiling shows cold-start latency is user-visible on cell networks. |
| 17.3 | Design tokens | **Extract `packages/theme` immediately** and refactor web to consume it. | Firm prerequisite for the mobile spike. Web refactor is small and unblocks a single source of truth for house colors. Roadmap gains task 6.0a for the extraction. |
| 17.4 | Admin scope on mobile | **Match the design doc**: member house assignment, role changes, invite generation/share, point deduction (gated by `POINT_ADJUSTMENTS_ENABLED`). Everything else deep-links to web. | Deferred to web-only: season creation/transition, org archive, release announcements, house theme QA, season comparison report. |
| 17.5 | App identity | **Name: HousePoints. Bundle id: `com.housepoints.app`. Scheme: `housepoints://`.** | Locked before Auth0 Native Application registration and store identifier reservation. Callback + logout URLs recorded in §12. |
| 17.6 | Expo Updates (OTA) | **Enabled from day one** on `preview` and `production` channels. | JS-only hotfixes ship without store review. Native code changes still require an EAS Build + store submission. Rollback via `eas update --republish` to the previous runtime version. |

