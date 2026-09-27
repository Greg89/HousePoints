# Notification organization routing (F4)

Implemented September 26, 2026. Mobile deployment and device verification remain pending.

## Destination identity

The existing API push payload contains `organizationId`, notification `type`, optional `entityId`, and optional web `actionHref`. Mobile now resolves the ID against the signed-in user's current bootstrap memberships, using that membership's current slug. The active organization is never a fallback for a notification destination. This also handles a renamed organization when the ID is unchanged.

Award and deduction notifications open the point's Activity destination in that organization. Other notification types retain their organization-dashboard destination. In particular, a reaction notification's entity ID is a reaction ID, so it must not be treated as a point ID. Arbitrary web action URLs are not passed to native navigation.

Canonical `housepoints://` URLs remain supported. Organization URLs must match a membership; if a payload supplies both an organization ID and a URL, their identities must agree. Invite URLs remain supported when no conflicting organization ID is supplied. Malformed, missing-identity, conflicting, or revoked-access destinations show **Notification unavailable**, with an explicit way back to HousePoints. They do not switch to an unrelated organization.

Membership resolution uses the existing bootstrap and foreground reconciliation lifecycle. The server still authorizes every destination's data request; notification data does not grant access, and a stale bootstrap cannot grant server access after revocation.

## Cold-start and response lifecycle

The response manager subscribes once and queues taps while authentication, organization storage hydration, or root navigation is not ready. It waits for entry/login/picker redirects to settle before pushing a destination, including when the home tab's public pathname is `/`. A newer live tap takes precedence over a delayed initial-response read.

The pending queue deduplicates by the notification request identifier. It marks a response handled only after the router accepts either the resolved adapter route or the unavailable screen. A failed navigation remains pending for another lifecycle change or tap. It then clears the native last-response slot only if that slot still identifies the handled notification, so a known newer response is not cleared. Clearing failures are logged and do not cause duplicate navigation within the mounted session. Queued taps pause again if auth/hydration becomes unavailable or the manager unmounts.

Acknowledgement means the route has accepted responsibility, not that a remote point has been fetched. Organization adapters use the existing `DeepLinkAuthGate` and `selectOrg`, recheck membership, wait for successful selection persistence and the matching active context, and only then navigate to the dashboard/activity screen. Losing focus cancels their pending navigation. Selection failures remain on a retryable screen rather than becoming unhandled promises; revoked membership shows an unavailable state.

This is not a new durable notification queue. The OS retains its last response until acknowledgement, while additional pending taps and dedupe state live in memory. The existing in-app notification read/archive behavior is unchanged.

## Release and rollback

No server payload change, migration, new environment variable, secret, feature flag, or native dependency is required. Release the updated mobile JavaScript through the existing compatible mobile preview/release workflow. It works with the currently emitted API payload. Older binaries retain the active-organization routing defect; rolling back mobile restores that defect.

Before releasing to testers, verify on Android:

1. Tap an award/deduction from the active organization and confirm Activity opens there.
2. While organization A is selected, tap a notification from B and confirm B is selected before its Activity/dashboard data is shown.
3. Tap from a terminated or signed-out app, complete sign-in if needed, and confirm the original destination survives bootstrap/hydration without duplicate navigation.
4. Remove access to B, refresh membership state, and tap an older B notification: confirm the unavailable screen and no fallback to A.
5. Repeat a tap and exercise a selection/storage failure: confirm dedupe and the retryable adapter state.

## Local verification

Tests use the API's actual field layout (`organizationId`, `type`, `entityId`, `actionHref`) and cover point notifications, other types, renamed organizations, legacy URLs, conflicts, malformed data, and revoked access. Queue tests cover cold start, auth/hydration/navigation delays, duplicate delivery, acknowledgement/navigation failures, and newer pending taps. The shared route-adapter state tests cover same-org/cross-org selection readiness and access checks after selection.

Native OS delivery, router focus timing, and end-to-end phone behavior still require the device rehearsal above; JavaScript tests and bundle export do not replace it.

Local checks passed on September 26, 2026: root typecheck, all 1,037 unit/component tests (132 mobile), mobile lint, production build, and Android JavaScript/Hermes bundle export. No database or server changes were required.
