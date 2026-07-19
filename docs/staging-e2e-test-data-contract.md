# Staging E2E Test Data Contract

## Purpose

The staging Playwright suite should exercise real deployed behavior without depending on personal accounts or hand-remembered database state. This contract defines the minimum staging data and GitHub Environment secrets required for stable scheduled E2E runs.

## Current Required Actors

### Primary E2E User

GitHub Environment secrets:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

Required staging state:

- The user can authenticate through the staging Auth0 application.
- The user belongs to the staging E2E organization.
- The user has a house assignment so the dashboard renders the normal member experience.
- The user can award points to the configured target member. Members can award points, so elevated access is not required for this user.
- The user can react to point awards in Activity. The happy-path smoke reacts to the award it creates and opens the reaction detail dialog.

### Admin E2E User

GitHub Environment secrets:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Required staging state:

- The user can authenticate through the staging Auth0 application.
- The user belongs to the staging E2E organization.
- The user has an `ADMIN` role so Manage and Audit are visible while owner-only tabs remain disabled.
- The user has a house assignment so the dashboard renders normally.

### Owner E2E User

GitHub Environment secrets:

- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`

Required staging state:

- The user can authenticate through the staging Auth0 application.
- The user belongs to the staging E2E organization.
- The user has an `OWNER` role so owner-only Manage tabs are enabled.
- The user has a house assignment so the dashboard renders normally.

### Optional Reaction Actor E2E User

GitHub Environment secrets:

- `E2E_REACTION_ACTOR_EMAIL`
- `E2E_REACTION_ACTOR_PASSWORD`

Required staging state when configured:

- The user can authenticate through the staging Auth0 application.
- The user belongs to the staging E2E organization.
- The user has a house assignment so the dashboard renders normally.
- The user can view the Activity tab and react to awards.
- Prefer a user that is different from both the primary E2E user and the configured target member, so the smoke reflects the real "someone else reacted" workflow.

### Optional Reaction Recipient E2E User

GitHub Environment secrets:

- `E2E_REACTION_RECIPIENT_EMAIL`
- `E2E_REACTION_RECIPIENT_PASSWORD`

Required staging state when configured:

- The user can authenticate through the staging Auth0 application.
- The user belongs to the staging E2E organization.
- The user has a house assignment so the dashboard renders normally.
- The user is selectable in the Award Points member picker. The reaction notification smoke reads this user's display name from the dashboard, awards points to that display name, and then verifies this user's notification tray.

### Target Member

GitHub Environment secret:

- `E2E_TARGET_MEMBER`

Required staging state:

- The value must match the target member's display name as rendered in the Award Points member picker.
- The target member belongs to the same staging E2E organization as the primary E2E user.
- The target member has a house assignment.
- The target member has the `MEMBER` or `ADMIN` role and is not the organization owner.
- The target member should remain active and should not be removed from the organization.

### Organization Scope

GitHub Environment secret:

- `E2E_ORG_SLUG`

Playwright starts from `/o/{E2E_ORG_SLUG}` instead of `/`. The scheduled staging workflow requires this value so the E2E account always targets the known-good staging E2E organization, especially when the account belongs to more than one organization.

## Current Required Organization State

The staging E2E organization should contain:

- one active organization;
- at least two active members;
- at least two active houses so team-assignment mutations can move and restore a member;
- an active season;
- at least one completed historical season for report and leaderboard switching;
- the primary E2E user with permission to award points;
- the configured target member with a stable display name.

The mutating happy-path test intentionally creates point activity and one reaction on that activity. The staging organization should tolerate this accumulated history. If that history becomes noisy, add a reset or cleanup job before making scheduled E2E failures block releases.

The read-only account-menu smoke test also expects the primary E2E user to reach the normal dashboard and open the account menu. The What's New link is asserted only when that control is visible in the target environment, so staging can enable that product surface without adding new required secrets.

The read-only Manage suite requires both elevated actors in the staging workflow. Local runs still
skip elevated specs when their credentials are absent, but staging configuration validation fails
when either actor is missing so permission regressions cannot silently pass.

## Role Smoke Coverage

Dedicated owner/admin/member smoke coverage is intentionally split by actor:

- Primary member actor: dashboard read path and member-level point award access.
- Admin actor: all six Manage destinations remain visible, with Members and Audit enabled and owner-only destinations focusable but unavailable.
- Owner actor: all six Manage destinations are enabled.

The admin and owner credentials remain optional for local development, but both are required in
the staging GitHub Environment. The Manage workspace suite also verifies deep-link URL state,
refresh and browser history, member filtering and detail-sheet focus restoration, Audit modes,
owner tool sheets, and the admin mobile picker without submitting mutations.

## Reversible Team Mutation Coverage

The Manage mutation smoke covers two reversible operations:

- the admin reassigns `E2E_TARGET_MEMBER` to a different existing house;
- the owner toggles that target between member and admin access.

Each test verifies the mutation survives fresh navigation and restores the original state in a
`finally` cleanup. The target member must begin assigned to a house, must not be the organization
owner, and the organization must retain at least two active houses. A cleanup failure fails the run
so staging fixture drift is visible rather than silently accumulating.

## Historical Season Coverage

The season-report smoke discovers the first completed season from the Overview reporting selector.
It verifies that the historical Overview report and season recap load, then confirms the
Leaderboard uses the same historical season. This path is read-only and requires no additional
secret, but staging must retain at least one completed season.

## Reaction Notification Smoke Coverage

Dedicated reaction-notification smoke coverage is intentionally optional because it requires two extra Auth0 users. When `E2E_REACTION_ACTOR_EMAIL`, `E2E_REACTION_ACTOR_PASSWORD`, `E2E_REACTION_RECIPIENT_EMAIL`, and `E2E_REACTION_RECIPIENT_PASSWORD` are configured, Playwright:

- signs in as the reaction recipient to read the recipient's current display name;
- signs in as the primary E2E user and awards points to that recipient;
- signs in as the reaction actor and reacts to that exact award from Activity;
- signs in as the reaction recipient and verifies the notification tray contains the reaction notification with the actor's display name and final reaction label.

For full staging reaction coverage, configure all four reaction secrets in the GitHub `staging` Environment:

- `E2E_REACTION_ACTOR_EMAIL`
- `E2E_REACTION_ACTOR_PASSWORD`
- `E2E_REACTION_RECIPIENT_EMAIL`
- `E2E_REACTION_RECIPIENT_PASSWORD`

If any one of these is missing, the reaction-notification smoke skips by design while the rest of the staging suite continues to run.

## Local Run

```powershell
$env:E2E_BASE_URL = "https://your-staging-web-url"
$env:E2E_USER_EMAIL = "test-member@example.com"
$env:E2E_USER_PASSWORD = "test-password"
$env:E2E_ADMIN_EMAIL = "test-admin@example.com"
$env:E2E_ADMIN_PASSWORD = "test-password"
$env:E2E_OWNER_EMAIL = "test-owner@example.com"
$env:E2E_OWNER_PASSWORD = "test-password"
$env:E2E_REACTION_ACTOR_EMAIL = "test-reaction-actor@example.com"
$env:E2E_REACTION_ACTOR_PASSWORD = "test-password"
$env:E2E_REACTION_RECIPIENT_EMAIL = "stable-target-member@example.com"
$env:E2E_REACTION_RECIPIENT_PASSWORD = "test-password"
$env:E2E_TARGET_MEMBER = "Stable Target Member"
$env:E2E_ORG_SLUG = "staging-e2e"
npm run test:e2e
```

## Ownership

When a staging E2E failure is caused by missing data, fix the staging data or update this contract in the same change that updates the test. The tests should not silently drift away from the documented environment shape.
