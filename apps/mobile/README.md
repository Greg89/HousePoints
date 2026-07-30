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
- `EXPO_PUBLIC_EAS_PROJECT_ID` — EAS project UUID used when requesting an Expo
  push token. Find it in the Expo project dashboard or `eas project:info`.
- `EXPO_PUBLIC_WEB_BASE_URL` — deployed web origin used for admin handoffs.
- `EXPO_PUBLIC_MOBILE_ADMIN_ENABLED` — set to `true` to expose the role-gated
  mobile Admin tab during the Phase 3 rollout.

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

- Task 6.7b: add the Maestro staging E2E flow.

The main GitHub Actions CI now publishes a dedicated
`Mobile Lint, Type-check & Test` result on pushes and pull requests. It uses
the root npm cache plus Expo/EAS state caches and runs the three mobile
workspace gates without requiring device credentials or environment secrets.

When `EXPO_PUBLIC_POINT_ADJUSTMENTS_ENABLED=true` and the API's
`POINT_ADJUSTMENTS_ENABLED` flag is also enabled, admins and owners can deduct
the fixed 10 points from an assigned member in another house. The modal
explains the 24-hour limits, requires a public reason and confirmation, and
leaves eligibility and cooldown enforcement authoritative on the API.

Admins and owners can generate 24-hour, 3-day, or 7-day single-use invite
links from the Admin tab. The raw link is returned by the API only once and is
kept in screen state for the platform-native share sheet.

The native Members section loads organization-scoped users and houses. Admins
and owners can assign houses; only owners can promote, demote, or remove
non-owner members. Permission-sensitive changes use native confirmation
prompts, and pull-to-refresh reconciles the server state.

The Admin tab appears only when `EXPO_PUBLIC_MOBILE_ADMIN_ENABLED=true` and
the active organization role is `ADMIN` or `OWNER`. The route repeats the same
guard for direct navigation. Out-of-scope organization workflows open the
active organization’s Manage workspace at `EXPO_PUBLIC_WEB_BASE_URL`.

Activity award rows support reactions through the visible **React** action or
a long press on the row. Selection updates the displayed counts immediately,
rolls back on API failure, and reconciles with the server response. Tapping a
reaction summary loads the server-backed list of people who reacted.

## Deep links

Expo Router handles these canonical app URLs:

- `housepoints://o/<slug>/dashboard`
- `housepoints://o/<slug>/activity/<pointId>`
- `housepoints://invite/<token>`

Dashboard and activity links verify that the signed-in user belongs to the
requested organization before switching context. Invite links show an explicit
accept action and send the untrusted token to the API for verification.
Foreground, background, and cold-start notification responses use the same
route resolver.

Push registration requires a physical device. After sign-in and organization
selection, the app creates the Android notification channel when applicable,
requests permission if it has not been decided, obtains the Expo push token,
and registers it with the API. Organization switches update the registration;
sign-out unregisters it before Auth0 credentials are cleared.
