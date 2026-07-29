# @housepoints/mobile

Native iOS/Android client for HousePoints. Reuses `@housepoints/contracts`
(Zod schemas + types) and `@housepoints/theme` (design tokens + house-color
math) and calls the existing Fastify API in `apps/api`.

Design doc: [`docs/mobile-app-design.md`](../../docs/mobile-app-design.md).
Roadmap: Tier 6 in [`docs/roadmap.md`](../../docs/roadmap.md).

## Status

**Task 6.1 — spike scaffold.** The current app is a single-screen probe that
runs three smoke tests:

1. Sign in via Auth0 Universal Login (Authorization Code + PKCE).
2. `GET /health` against the API (unauthenticated).
3. `POST /users/bootstrap` with a `Bearer <accessToken>` header (proves the
   API accepts tokens issued to the native Auth0 application).

If all three succeed on a device, 6.1 is done and Phase 1 (task 6.2) can
start on the real dashboard, org picker, and activity feed.

## Prerequisites

- Node.js 22+ and npm 10+ (same as the rest of the repo).
- An Auth0 tenant with:
  - A **Native Application** registered (separate from the existing web
    Regular Web Application).
  - Callback URL `housepoints://com.housepoints.app/callback`.
  - Logout URL `housepoints://com.housepoints.app/logout`.
  - The existing HousePoints API audience granted to the native application.
  - Refresh token rotation + reuse detection enabled.
- One of:
  - Xcode 15+ and iOS Simulator (macOS host only).
  - Android Studio with an AVD (any host).
  - A physical device with Expo Go **is not sufficient** — `react-native-auth0`
    is a native module, so this spike requires a development build (see below).

## Configure

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Fill in:

- `EXPO_PUBLIC_API_BASE_URL` — reachable API host. On the iOS Simulator
  `http://localhost:4000` works; on the Android Emulator use
  `http://10.0.2.2:4000`; on a physical device use your workstation's LAN IP
  (`http://192.168.x.y:4000`) and start the API with `--host 0.0.0.0`.
- `EXPO_PUBLIC_AUTH0_DOMAIN` — same tenant as `apps/api/.env`.
- `EXPO_PUBLIC_AUTH0_CLIENT_ID` — the **native** application's client id
  (NOT the web app's client id).
- `EXPO_PUBLIC_AUTH0_AUDIENCE` — matches `AUTH0_AUDIENCE` in `apps/api/.env`.

## Run the spike

`react-native-auth0` requires a native development build; Expo Go will not
work. From the repo root:

```powershell
# 1. Generate native ios/android/ project folders (one time, or after any
#    app.config.ts change).
npm run prebuild -w @housepoints/mobile

# 2a. iOS (macOS only)
npm run ios -w @housepoints/mobile

# 2b. Android
npm run android -w @housepoints/mobile
```

The API must be running in another terminal (`npm run dev:api`) and reachable
from the simulator/device at the URL configured above.

Once the app boots, tap through the three cards in order:

1. **Sign in with Auth0** — opens Auth0 Universal Login in a system browser.
2. **GET /health** — should return `{ "status": "ok" }` (or equivalent).
3. **POST /users/bootstrap** — should return the current user record; a 401
   means the access token is missing or the API's `AUTH0_AUDIENCE` does not
   match the value the token was issued for.

## Verify (dev laptop, no device)

Even without a simulator, these gates must pass before landing changes:

```powershell
npm run typecheck -w @housepoints/mobile
npm run lint -w @housepoints/mobile
npm run test -w @housepoints/mobile
```

## What ships in Phase 1 (task 6.2, not yet started)

- Replace the spike screen with the real Expo Router structure (dashboard,
  leaderboard, activity feed, profile, org picker).
- Wrap `apiRequest` in TanStack Query with per-org cache keys.
- Persist active org slug in `expo-secure-store`.
- Parse every response with Zod schemas from `@housepoints/contracts`.
- Adopt design tokens from `@housepoints/theme` via a small RN style helper.
