# @housepoints/mobile

Native iOS/Android client for HousePoints. Reuses `@housepoints/contracts`
(Zod schemas + types) and `@housepoints/theme` (design tokens + house-color
math) and calls the existing Fastify API in `apps/api`.

Design doc: [`docs/mobile-app-design.md`](../../docs/mobile-app-design.md).
Roadmap: Tier 6 in [`docs/roadmap.md`](../../docs/roadmap.md).

## Status

Phase 1 is complete. The app includes Auth0 native sign-in, organization
selection, dashboard, leaderboard, paginated activity, award-points, profile
editing, and in-app notifications. Phase 2 backend device registration and
Expo push dispatch are also available; mobile-side permission and device-token
registration is the next roadmap slice (task 6.5a).

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

## Run the app

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

Once the app boots, sign in through Auth0 Universal Login and select an
organization. A 401 during bootstrap usually means the API audience configured
for the native Auth0 application does not match `AUTH0_AUDIENCE`.

## Verify (dev laptop, no device)

Even without a simulator, these gates must pass before landing changes:

```powershell
npm run typecheck -w @housepoints/mobile
npm run lint -w @housepoints/mobile
npm run test -w @housepoints/mobile
```

## Next work

- Task 6.5a: request notification permission, obtain the Expo push token, and
  register/unregister the device as authentication and active organization
  change.
- Task 6.5b: add notification and invite deep links.
- Task 6.5c: add activity reactions.
