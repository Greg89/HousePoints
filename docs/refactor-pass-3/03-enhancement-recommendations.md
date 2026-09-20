# Refactor Pass 3 — Enhancement Recommendations

Ideas that would add real product value in the next couple of quarters. Each one is grounded in something the codebase already has, so scoping should be smaller than a green-field feature. These are recommendations, not a commitment — the team can accept, defer, or drop each one.

Each entry: what it is, why it fits the current app, and a rough shape of the work.

---

## Web

### EW1. Cache-tagged, streamed dashboard with skeletons

**Grounded in:** the refactor plan already introduces cache tags and `<Suspense>` (W1, W2). Once those primitives exist, they unlock a materially better dashboard UX.

**Value:** leaderboard and activity render as soon as they resolve. Season comparison and admin audit only load if the user opens their tab. Perceived load time drops significantly.

**Shape:** skeleton components mirror card/table layouts; each dashboard section is a small server component wrapped in `<Suspense>`. No new API endpoints.

---

### EW2. Command palette (`Cmd+K`) for admin power users

**Grounded in:** the admin surface already has full server-action coverage for award, deduct, promote, edit house, change role. Actions are already keyboard-accessible via forms.

**Value:** admins run five or six actions in a session; a palette turns those into 1–2 seconds each. Same pattern users already know from GitHub, Linear, VS Code.

**Shape:** one client component (`CommandPalette.tsx`) mounted at the layout level. Commands are declarative entries `{ label, keywords, run, requiresRole }` that call existing server actions. Filter by current org and role.

---

### EW3. Bulk admin actions (multi-select in Team + Houses)

**Grounded in:** `TeamManagement.tsx` and `HouseManagement.tsx` already render member lists with per-row action buttons.

**Value:** promoting a new cohort of team leads or reassigning members after an org restructure is currently one action per member. Multi-select turns it into a single action.

**Shape:** add row-level checkbox state, a sticky action bar when selection is non-empty, and one new server action per bulk operation (`bulkUpdateRole`, `bulkAssignHouse`). Reuse existing single-item helpers on the API side; wrap them in a transaction.

---

### EW4. CSV export for activity and season comparison

**Grounded in:** the same reads that power `SeasonComparisonReport.tsx` and the activity tab can be projected to rows.

**Value:** admins take data out of the app for HR reviews, exec summaries, or archival. No new API queries required.

**Shape:** server action returns a signed download URL (or streams `text/csv`). A small "Export" button on each existing report. Rate-limit like other admin reads.

---

### EW5. Saved filters on the activity feed and admin audit

**Grounded in:** `ActivityFeed.tsx` already stores filter state in URL search params (`activeFilter`, `activeActorMemberId`, house, date range).

**Value:** admins reuse combinations like "point deductions in the last 7 days" or "awards from Alice to Bob" without re-entering them.

**Shape:** new `SavedFilter` model `(orgId, creatorUserId, name, filterConfig JSON)`. Small UI in the filter panel to save / rename / load / delete. Only visible to the creator or share to org.

---

## Mobile

### EM1. Offline award queue + sync indicator

**Grounded in:** the mobile app already has network-state awareness in `QueryLifecycleManager`. Awards and deductions are the highest-value actions and the ones most affected by spotty connectivity. Also finding M5.

**Value:** the primary product action becomes reliable in the field. Users award without worrying about connection quality.

**Shape:** AsyncStorage-backed queue, retry on reconnect with backoff. Small "N pending" pill in the tab bar or home header. Server side needs an idempotency key on `POST /points/award` and `POST /points/deduct` to make retries safe.

---

### EM2. Haptics on award / deduct / reaction

**Grounded in:** `expo-haptics` is not yet a dependency but is one line to add. All three flows already have clear success/failure moments.

**Value:** tactile feedback in loud rooms, meetings, hallways. Small polish that meaningfully increases perceived quality.

**Shape:** `hooks/useHaptics.ts` with `success()`, `warning()`, `error()`. One call at each mutation `onSuccess`. Respect the OS "reduce motion" and haptics settings.

---

### EM3. Quick-award recipient shortcuts

**Grounded in:** the activity feed already surfaces recent recipients, and mobile already has AsyncStorage in use for auth state.

**Value:** the same three or four people receive most awards. One-tap access shortens the flow from three or four screens to one.

**Shape:** remember the last N distinct recipients per current user + org in AsyncStorage. Render as a horizontal chip row at the top of the award screen and, later, as an iOS/Android Quick Action from the app icon.

---

### EM4. Home-screen widget (leaderboard preview)

**Grounded in:** home already queries the leaderboard. Expo supports both platforms' widget APIs via the `expo-modules` bridge.

**Value:** at-a-glance house standings without opening the app. Good for competitive orgs.

**Shape:** widget target reads a snapshot from AsyncStorage that the app refreshes on foreground and on push. Widget deep-links back into the leaderboard tab.

---

### EM5. Biometric gate for sensitive admin actions

**Grounded in:** the app already uses secure storage for auth material; `expo-local-authentication` is a small add.

**Value:** an accidentally-open device cannot deduct points, change roles, or invite/remove members. Reduces the reputational risk of a lost phone in a shared workspace.

**Shape:** a `withBiometrics(action, reason)` wrapper. Applied to deduct, role changes, invitation revocation, and account deletion. Fallback to passcode. Per-user off-switch in settings.

---

## Platform (both clients benefit)

### EP1. Org-scoped read-only API tokens

**Grounded in:** the API already has Auth0 auth, rate limits, and structured logging. Adding a second auth mode (bearer token) is well-scoped.

**Value:** third-party integrations (Slack bot posts the weekly leaderboard, Zapier syncs new members, CSV pull for BI tools) without spinning up a bespoke endpoint each time.

**Shape:** new `ApiToken(orgId, createdByUserId, hashedToken, scopes, lastUsedAt, revokedAt)` model. Owner-only settings UI to create/revoke. Rate limits scoped to the token, not to the underlying user. Bearer auth middleware runs before Auth0 in the auth chain.

---

### EP2. Webhook subscriptions

**Grounded in:** structured logging + typed API events already exist for the main mutations. Extending them to a webhook dispatcher is small.

**Value:** partners react to `point.awarded`, `season.started`, `member.joined`, `org.suspended` in real time — Slack channels, HR systems, dashboards.

**Shape:** subscription model with URL + HMAC secret + subscribed event set. Signed delivery, at-least-once with retry and exponential backoff, a small DLQ for poison messages. Reuse the push dispatcher's outbound plumbing shape.

---

### EP3. Audit trail search and replay

**Grounded in:** audit event storage already exists. Once P6 tightens the metadata types, a searchable UI becomes tractable.

**Value:** compliance investigations, dispute resolution, and support case timelines all get much faster. Especially valuable for platform admins working across many orgs.

**Shape:** search API over audit events with filters (actor, event code, time window, target). Detail view shows before/after snapshots. Deep-linkable rows so support cases can reference specific events.

---

### EP4. Org-level analytics endpoints (time series)

**Grounded in:** the DB already stores point transactions with timestamps and trait/tag context. Web dashboards already display aggregates.

**Value:** owners see engagement curves and trends over time, not just this-season snapshots. Enables data-driven decisions on trait weights, season length, house configuration.

**Shape:** small set of endpoints (`GET /orgs/:id/analytics/points-per-day?range=90d`, `/analytics/engagement?range=90d`) with pre-aggregated queries. Web dashboard adds a small charts section. Mobile can consume the same data for a "trends" tab later.

---

### EP5. Notification templates + scheduled sends

**Grounded in:** `NotificationType` enum + notification factories in `apps/api/src/notifications.ts` are the right seam. Push dispatcher already batches.

**Value:** the platform admin team can broadcast "Season 3 kickoff", "Winners announcement", or "Reminder: enter votes by Friday" without asking engineering to ship a release.

**Shape:** template model `(name, subject, body, variables)`, targeting rule (`orgId`, `role`, `houseId`, cohort filter), scheduler with timezone awareness. Reuse the existing `notification.createMany` + push dispatch path.

---

## Sizing summary

Rough T-shirt sizing. Numbers are rough and depend on how far you carry each item.

| Item | Size | Depends on |
|------|:-:|---|
| EW1 Streamed dashboard | M | W1, W2 |
| EW2 Command palette | S | — |
| EW3 Bulk admin actions | M | — |
| EW4 CSV export | S | — |
| EW5 Saved filters | M | — |
| EM1 Offline queue | M | server-side idempotency |
| EM2 Haptics | XS | — |
| EM3 Quick-award shortcuts | S | — |
| EM4 Home-screen widget | M | — |
| EM5 Biometric gate | S | — |
| EP1 API tokens | M | — |
| EP2 Webhooks | L | EP1 (share auth surface) |
| EP3 Audit search | M | P6 (typed audit metadata) |
| EP4 Analytics endpoints | M | P4 (timing logs help sizing) |
| EP5 Notification templates | M | — |

Recommended first three, if scheduling only three: **EW1 (streamed dashboard)**, **EM1 (offline queue)**, **EP1 (API tokens)**. Each unlocks a different customer segment (existing daily users, field users, integration partners) with different risk profiles.
