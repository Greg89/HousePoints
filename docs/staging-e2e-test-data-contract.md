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

### Optional Admin E2E User

GitHub Environment secrets:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Required staging state when configured:

- The user can authenticate through the staging Auth0 application.
- The user belongs to the staging E2E organization.
- The user has an `ADMIN` or `OWNER` role so Manage and Audit are visible.
- The user has a house assignment so the dashboard renders normally.

### Target Member

GitHub Environment secret:

- `E2E_TARGET_MEMBER`

Required staging state:

- The value must match the target member's display name as rendered in the Award Points member picker.
- The target member belongs to the same staging E2E organization as the primary E2E user.
- The target member has a house assignment.
- The target member should remain active and should not be removed from the organization.

### Organization Scope

GitHub Environment secret:

- `E2E_ORG_SLUG`

Playwright starts from `/o/{E2E_ORG_SLUG}` instead of `/`. The scheduled staging workflow requires this value so the E2E account always targets the known-good staging E2E organization, especially when the account belongs to more than one organization.

## Current Required Organization State

The staging E2E organization should contain:

- one active organization;
- at least two active members;
- at least one active house;
- an active season;
- the primary E2E user with permission to award points;
- the configured target member with a stable display name.

The mutating happy-path test intentionally creates point activity. The staging organization should tolerate this accumulated history. If that history becomes noisy, add a reset or cleanup job before making scheduled E2E failures block releases.

The read-only account-menu smoke test also expects the primary E2E user to reach the normal dashboard and open the account menu. Multi-organization switching and the What's New link are asserted only when those controls are visible in the target environment, so staging can enable those product surfaces without adding new required secrets.

The read-only Manage Audit smoke test uses `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` when they are configured. If those optional secrets are missing, that spec skips cleanly while the member-level smoke and happy-path tests continue to run.

## Future Actor Expansion

The next E2E expansion should add dedicated owner and admin actors instead of reusing one broad account for every permission level.

Recommended future GitHub Environment secrets:

- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_MEMBER_EMAIL`
- `E2E_MEMBER_PASSWORD`

Recommended role split:

- Owner actor: org configuration, houses, seasons, ownership-only controls.
- Admin actor: point awards, point deductions, team assignment, invite generation.
- Member actor: dashboard read path, notification center, profile settings.

Do not add these secrets to the workflow as required until tests use them. Required-but-unused secrets make the scheduled monitor harder to operate.

## Local Run

```powershell
$env:E2E_BASE_URL = "https://your-staging-web-url"
$env:E2E_USER_EMAIL = "test-admin@example.com"
$env:E2E_USER_PASSWORD = "test-password"
$env:E2E_TARGET_MEMBER = "Stable Target Member"
$env:E2E_ORG_SLUG = "staging-e2e"
npm run test:e2e
```

## Ownership

When a staging E2E failure is caused by missing data, fix the staging data or update this contract in the same change that updates the test. The tests should not silently drift away from the documented environment shape.
