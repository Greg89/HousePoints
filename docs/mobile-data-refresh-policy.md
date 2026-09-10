# Mobile data refresh policy

## Purpose

HousePoints mobile should converge on server changes without requiring users to
pull to refresh every screen. The policy deliberately targets **fresh on use**,
not real-time synchronization: changes made on web or another device should
normally appear when the mobile app returns to the foreground or when the user
opens the affected screen.

TanStack Query remains the source of truth for server-state caching. Pull to
refresh remains available as an explicit fallback.

## Implemented behavior

- Collaborative queries default to a 30-second `staleTime`; member-selection
  and admin-context queries use 60 seconds.
- App foreground, network reconnect, and screen-focus triggers refetch stale
  active queries.
- Primary data screens expose pull to refresh.
- Mobile mutations use an audited, exact, organization-scoped key catalog.
- Expo Router focus hooks handle tabs that remain mounted.
- Web and other-device mutations cannot invalidate this device's in-memory
  cache directly; the lifecycle and focus triggers reconcile them on use.

`staleTime` is not a polling interval. It only determines when cached data is
eligible for a later refresh trigger.

## Target behavior

1. When the app becomes active after being backgrounded, active stale queries
   refetch automatically.
2. When connectivity returns, active stale queries refetch automatically.
3. When a primary screen gains navigation focus, its stale queries refetch.
4. Data less than its freshness window is reused without another request.
5. Successful mobile mutations update or invalidate every affected cache
   surface.
6. Organization membership and authorization context refresh after relevant
   mutations and when the app resumes after a meaningful absence.
7. Pull to refresh always forces a request, regardless of freshness.
8. Failed background refreshes retain usable cached data and do not sign the
   user out. Errors remain observable through structured mobile logging.

## Freshness classes

| Data | Target stale time | Automatic triggers |
| --- | ---: | --- |
| Dashboard, leaderboard, activity | 30 seconds | App foreground, reconnect, screen focus |
| Notifications | 30 seconds | App foreground, reconnect, screen focus |
| Members and admin context | 60 seconds | App foreground, reconnect, screen focus |
| Auth user, memberships, roles, house assignment | 60-second background threshold | App foreground after absence and membership mutations |

No query uses `refetchInterval`; there is no polling.

## Delivery slices

### Slice 1: app and network lifecycle integration

**Status:** Implemented.

Connect React Native `AppState` to TanStack Query's focus manager and native
connectivity to its online manager. Restore automatic refetch-on-focus and
refetch-on-reconnect for active stale queries.

Acceptance criteria:

- Backgrounding and reopening the app refetches active queries that are stale.
- Reopening within 30 seconds does not create redundant requests.
- Restoring connectivity refetches active stale queries.
- Cached content remains visible while a background refetch is in flight or
  fails.
- Listener cleanup is covered and lifecycle mapping has focused tests.

### Slice 2: screen-focus refresh

**Status:** Implemented.

Add a reusable Expo Router focus hook and apply it to Dashboard, Leaderboard,
Activity, Notifications, Members/Admin, and Profile. The hook refreshes only
the screen's active, stale query keys.

Acceptance criteria:

- A server change made on web appears after navigating away from and back to
  the affected screen once its data is stale.
- Switching tabs within the freshness window does not issue duplicate calls.
- Infinite activity refresh resets/reconciles the first page without
  duplicating entries.
- Pull to refresh continues to force an immediate refresh.

### Slice 3: mutation invalidation audit

**Status:** Implemented.

| Mutation group | Exact organization-scoped cache surfaces |
| --- | --- |
| Award or deduct points | Activity, dashboard summary, house leaderboard, admin context |
| Assign house, change role, remove member | Members, admin context, dashboard summary, house leaderboard, activity |
| Change display name | Members, admin context, dashboard summary, activity |
| React to activity | Activity |
| Mark notifications read | Notification list and unread badge |

All keys include the active organization slug, and invalidation uses exact-key
matching. Create/join and account deletion update authentication state rather
than ordinary query caches and remain governed by Slice 4.

Document the query-key ownership map and audit every mobile mutation. Prefer a
shared invalidation helper when multiple mutations affect the same business
surfaces.

Acceptance criteria:

- Award/deduct updates activity, dashboard, leaderboard/houses, and relevant
  admin context.
- Member, house, role, profile, reaction, and notification mutations update or
  invalidate every affected view.
- Query keys remain scoped by organization slug; one organization's mutation
  cannot refresh or overwrite another organization's cached data.
- Tests assert the key groups for cross-screen operations.

### Slice 4: account and membership reconciliation

**Status:** Implemented.

Refresh `/users/bootstrap` after create/join and membership-affecting actions,
and when returning to the foreground after a longer absence. Reconcile the
active organization against the returned memberships.

Create and join responses synchronize the returned user immediately. A signed-
in app also reconciles after at least 60 seconds in the background. Bootstrap
is single-flight, so overlapping lifecycle or explicit refresh calls share one
request. A failed refresh retains the established user and ready state.

Acceptance criteria:

- Invites, role changes, house assignments, removals, and newly available
  organizations appear without signing out.
- Removed access clears an invalid active organization and routes to a valid
  organization or onboarding picker.
- A transient refresh failure preserves the existing signed-in session and
  displays cached data where safe.
- Repeated app-state events are deduplicated so bootstrap cannot loop.

### Slice 5: tune and observe

**Status:** Implemented.

Measure request volume and perceived freshness during emulator and physical
device testing. Add per-resource stale times only where useful. Do not add
polling, WebSockets, or Server-Sent Events unless testing demonstrates a
specific product need.

Acceptance criteria:

- Lifecycle and screen-focus refresh events are logged without sensitive data.
- A documented manual test covers web mutation → mobile foreground/tab focus.
- Request volume shows no repeated refresh loop.
- Polling remains disabled by default.

Implemented structured events:

| Event | Purpose |
| --- | --- |
| `mobile.queries.app_focus_changed` | App active/background focus transition |
| `mobile.queries.network_changed` | Online/offline transition |
| `mobile.queries.screen_focused` | Screen cache groups considered for stale refresh |
| `mobile.api.request_completed` | Actual endpoint, request ID, status, and duration |
| `mobile.api.request_failed` | Transport failure endpoint, request ID, duration, and safe error summary |
| `mobile.auth.foreground_reconciliation.started` | Membership bootstrap triggered after background absence |

These events omit request bodies, access tokens, email addresses, and
organization slugs. API request IDs provide correlation with server/SEQ logs.

## Out of scope

- Real-time sockets or Server-Sent Events.
- Continuous background synchronization.
- Treating push delivery as a guaranteed cache synchronization mechanism.
- Persisting the complete TanStack Query cache across app restarts.

Push or notification navigation may invalidate relevant query keys later, but
foreground, reconnect, and screen-focus refresh remain authoritative because
push delivery is not guaranteed.

## Verification

Each runtime slice must pass mobile typecheck, lint, tests, and an Android/iOS
lifecycle smoke proportional to the change. The end-to-end manual scenario is:

1. Open a populated mobile screen and note its current data.
2. Change the corresponding organization data in the web app.
3. Background and reopen mobile, or navigate away and back after the freshness
   window.
4. Confirm the change appears without pull to refresh.
5. Repeat within the freshness window and confirm no unnecessary request.
6. Disable and restore connectivity; confirm cached content survives and stale
   active data reconciles after reconnect.

For Android development builds, capture the relevant client events with:

```powershell
adb logcat -d -t 2000 | Select-String `
  "mobile.queries|mobile.api.request|foreground_reconciliation"
```

Expected request-volume result: revisiting a screen inside its freshness window
logs the focus event but no corresponding API request; revisiting after the
window logs one request per stale active resource. No repeated requests should
appear while the screen remains idle.
