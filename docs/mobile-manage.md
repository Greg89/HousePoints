# Mobile Manage workspace

The Manage tab is an organization overview rather than an inline member editor.
It shows actionable unassigned-member/empty-house notices, an Invite member action,
links to focused tools, the latest three admin events, and a compact web handoff.

## Native tools

- **Members:** name/email search, All/Unassigned/Admins filters (Admins includes
  owners), optional house filter, and compact rows with house and role. Results
  render in batches of 30. Tap a row to edit; long press is not required.
- **Member details:** display-name editing, confirmed house reassignment,
  performance navigation, and confirmed role/removal actions. Display names are
  user-level and change across organizations, as on web. Only owners can change
  roles or remove non-owner members; owners cannot be removed here.
- **Invites:** a dedicated screen with 24-hour/3-day/7-day expiration and the native
  share sheet. Links remain single-use; creating another does not revoke the old
  link. A previously generated link remains available if a new creation fails.
- **Houses:** house/member counts, filtered member navigation, performance links,
  and owner-only creation with name, color and optional description. Appearance
  customization remains on web.
- **Recognition categories:** available under the existing recognition feature
  flag; active and archived lists, owner-only creation/archive, and protection
  against archiving the last active category. Creates reuse the existing shared
  submission-key helper so retries of an uncertain request use the same key.
- **Admin activity:** organization-scoped, read-only history with cursor-based
  loading of 20 events per page and pull-to-refresh.
- **Deductions:** retained under the existing point-adjustments feature flag.

## Shared resources and permissions

Native routes use the existing typed `@housepoints/contracts` request/response
schemas and existing API endpoints used by the web. No new API routes, database
migrations, environment variables or secrets are required. API authorization is
unchanged and remains authoritative. `ManageUI` supplies consistent native
layout, fields, rows and disabled owner-only controls. `use-manage` owns context
loading, mutation feedback and organization-scoped cache invalidation.

Every management route requires signed-in, hydrated organization context and the
mobile-admin feature flag. Forms remount on organization/role changes. Leaving a
screen prevents late mutation callbacks from navigating or showing a toast;
success still invalidates the original organization's cache. Failed context reads
hide the management form rather than showing potentially revoked cached access.
Category management uses a separate include-archived cache from award selectors.
The API supplies human-readable audit summaries, shared with web reporting.

Season transitions, advanced appearance settings, ownership transfer,
organization archive/restore, and detailed reports remain available through the
full web dashboard link.

## Preview checks

Build a new preview for the native UI changes. Verify as both admin and owner:

1. Open Manage; follow attention links and member filters, then use native Back.
2. Edit a name and house; verify the member, dashboard and performance data refresh.
3. Verify owner-only controls are disabled for admins and owner removal is blocked.
4. Create/share an invite; verify expiration and cancellation of the share sheet.
5. Create a house; create/archive a category and verify award choices refresh.
6. Browse multiple activity pages, pull to refresh, and test a failed request.
7. Switch organizations with a form open; verify the old form and invite disappear.
8. Check keyboards, large text, and screen-reader labels on iOS and Android.

Automated coverage includes route gating, organization boundaries, directory
filters, owner controls, confirmation, schema validation, category retry keys,
and the last-active-category restriction. Native interaction/visual verification
still requires the preview run.
