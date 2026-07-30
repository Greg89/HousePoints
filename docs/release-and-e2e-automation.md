# Release And E2E Automation Plan

## Purpose

HousePoints already has a strong commit-level CI gate. The next CI maturity step is separating two longer-lived operational concerns from the normal push pipeline:

- release communication, so production users can see what changed without watching GitHub or Railway;
- scheduled staging E2E testing, so core user workflows are exercised against a deployed environment on a predictable cadence.

These tracks should stay separate at first. Release communication touches production users and should move slowly. Staging E2E can start immediately as an ops safety net.

## Current State

- `.github/workflows/ci.yml` runs on every push and pull request.
- CI installs dependencies, generates Prisma, lints, type-checks, runs tests and coverage, deploys migrations into a PostgreSQL service, runs database integration tests, and builds the apps.
- `npm run test:e2e` runs the existing Playwright happy path from `apps/web/e2e/happy-path.spec.ts`.
- The E2E test requires staging/local credentials and skips when required environment variables are missing.

## Track A - Release Communication

### Phase A1 - Generated Release Notes

Implemented first slice:

- Adopt Conventional Commits for release intent.
- Publish static release notes to GitHub Pages from the `site` directory.
- Keep a release note template under `site/releases/template.html`.
- Run the `Publish Release Notes` workflow manually while the project is still before semantic automation.

Future A1 automation can generate GitHub Releases and static release pages from the same release metadata. The current manual version gives the project a durable public release history without notifying users inside the app yet.

Automation scaffolding is staged under `tools/release/`. The committed `templates/release-page.html` file is the future machine-rendered release page shape, while the current `site/releases/template.html` remains the human-copyable manual template.

### Phase A2 - In-App Release Records

Status: workflow handoff implemented; broadcast deferred.

Add an app-owned release record instead of having CI write notification rows directly.

Implemented model:

- `ReleaseAnnouncement`
  - `id`
  - `version`
  - `title`
  - `summary`
  - `releaseNotesUrl`
  - `releasedAt`
  - `broadcastAt`
  - `createdAt`

The first API surface is `POST /system/releases/record`. It is protected by `RELEASE_AUTOMATION_SECRET`, upserts by `version`, and returns the stored release announcement. The `Publish Release Notes` workflow calls this endpoint after GitHub Pages deploys successfully, using the deployed Pages URL plus the selected release note path.

Required workflow configuration:

- `RELEASE_AUTOMATION_SECRET` as a GitHub secret, matching the API environment variable.
- `RELEASE_RECORD_API_BASE_URL` as a GitHub variable, pointing to the public API base URL.

The app should own the release business rules, including duplicate prevention and notification fanout. Notification fanout remains deferred to Phase A3.

### Phase A3 - Production Notification Broadcast

Status: first slice implemented.

After a production release is deployed and healthy, CI or an operator can call a protected API endpoint:

```text
POST /system/releases/broadcast
```

The API should:

- require the release automation secret;
- verify the release exists and was not already broadcast;
- create durable informational notifications for active users in active organizations;
- record `broadcastAt`;
- log the broadcast.

The first implementation accepts a release `version`, uses the same `RELEASE_AUTOMATION_SECRET` as release recording, and creates idempotent `RELEASE_ANNOUNCEMENT` notifications with dedupe keys scoped by release version and organization. The endpoint returns the release, the number of notifications inserted, and whether the release had already been broadcast.

The `Publish Release Notes` workflow includes an explicit `broadcast_release` input. Leave it disabled while rehearsing release notes and enable it only after production health is verified.

Do not allow GitHub Actions to write directly to the production database. CI should trigger app behavior; the app should enforce product rules.

### Phase A4 - User-Facing What's New

Status: implemented.

Release announcement notifications include a "View release notes" action that opens the public release notes page from the account menu. The account menu also includes a persistent "What's New" entry when `APP_RELEASE_NOTES_URL` is configured on the web app. External release-note actions are limited to `https://` URLs, while existing internal notification actions continue to use scoped dashboard navigation.

Future additions:

- add a richer release-history surface inside the app if users need more than the public Pages link;
- add user notification preferences if release noise becomes a problem.

## Track B - Scheduled Staging E2E

### Phase B1 - Scheduled Workflow

Implemented first:

- Add `.github/workflows/e2e-staging.yml`.
- Run manually through `workflow_dispatch`.
- Run automatically on a weekday schedule.
- Scope secrets through the `staging` GitHub Environment.
- Upload Playwright reports and traces as artifacts.
- Validate required E2E configuration before running so missing secrets fail loudly.

Required staging environment secrets:

- `E2E_BASE_URL`
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`
- `E2E_TARGET_MEMBER`
- `E2E_ORG_SLUG`

Optional manual input:

- `base_url`, which overrides `E2E_BASE_URL` for an ad-hoc run.

### Mobile Maestro staging smoke

`.github/workflows/mobile-e2e-staging.yml` runs the mobile Auth0 sign-in,
dashboard, and award-points flow in Maestro Cloud on pushes to `develop` and
manual dispatches. It downloads a prebuilt staging APK; CI does not build or
sign a native binary in this slice.

Required secrets in the GitHub Environment named `staging`:

- `MOBILE_E2E_ANDROID_APP_URL` — HTTPS URL for an installable staging APK;
- `MOBILE_E2E_USER_EMAIL`;
- `MOBILE_E2E_USER_PASSWORD`;
- `MOBILE_E2E_TARGET_MEMBER`;
- `MAESTRO_CLOUD_API_KEY`.

Required GitHub Environment variable:

- `MAESTRO_PROJECT_ID`.

The APK must target the staging API and staging Auth0 Native Application. The
test account must belong to exactly one organization so the smoke reaches the
dashboard without an organization-picker choice. The target member must be an
assigned, active member in that organization and must not be the test actor.
The smoke intentionally creates a five-point Teamwork award on each run.

The manual `android_app_url` input overrides
`MOBILE_E2E_ANDROID_APP_URL` for one run. No new Railway variables are required;
the existing staging API/Auth0 configuration remains authoritative.

### Phase B2 - Test Data Contract

Status: first slice implemented.

The staging test data contract is documented in [Staging E2E Test Data Contract](./staging-e2e-test-data-contract.md), and the Playwright specs share a single environment contract module under `apps/web/e2e/support/config.ts`.

Current contract:

- one member test user for scripted login;
- required staging admin and owner credentials for Manage permission and workspace coverage;
- at least one target member in a different account;
- at least one house assignment for both users;
- feature flags set to the same values expected in staging.

The E2E account should not be a real user. If tests mutate data, the staging org should either tolerate that history or gain a reset job later.

### Phase B3 - Coverage Expansion

Grow the suite slowly:

1. Smoke: login, dashboard render, primary tabs navigate, account menu renders, notifications are reachable, and role-specific Manage access is enforced.
2. Core: award points, Activity shows the transaction, Leaderboard shows the target.
3. Manage: six-workspace navigation, role restrictions, URL history, responsive picker, detail
   surfaces, Audit modes, and non-mutating confirmation flows. Read-only coverage implemented.
4. Team mutations: reversible house assignment and optional dedicated-target owner promote/demote
   coverage are implemented with persistence verification and `finally` cleanup. Invite generation
   remains deferred until invite records have a safe cleanup expectation.
5. Seasons: historical Overview report, season recap, and Leaderboard switching are implemented
   when the optional completed-season staging fixture exists.
6. Notifications: receive, preview, mark read.
7. Manage Audit pagination: filter coverage is implemented; pagination remains future coverage.
8. Organization lifecycle: an optional dedicated staging organization validates multi-org switching,
   owner archive, archived-state authorization, and owner restore with cleanup. It runs only when
   `E2E_LIFECYCLE_ORG_SLUG` is configured so the primary staging organization is never archived.

Each added E2E path should be stable against real Auth0 and staging timing. Prefer fewer high-value tests over a broad brittle suite.

## Operating Rules

- Main CI remains the merge confidence gate.
- Scheduled E2E is an environment confidence monitor, not a blocker for every commit.
- Failures should create investigation work, not automatic production rollback.
- Keep E2E secrets in a GitHub Environment named `staging`.
- Upload artifacts on success and failure so the last known browser behavior is visible.
- Do not run production-user release notifications until release records and broadcast idempotency exist.

## Mobile EAS build and update operations

`apps/mobile/eas.json` defines:

- `development`: internal development-client build using the EAS
  `development` Environment;
- `preview`: internal build on the `preview` update channel using the EAS
  `preview` Environment; Android emits an APK for Maestro;
- `production`: auto-incremented store build on the `production` update channel
  using the EAS `production` Environment.

Each EAS Environment must define the mobile values listed in
`apps/mobile/.env.example`, including API/web origins, the native Auth0
application settings, EAS project ID, and rollout flags. Public-prefixed values
are embedded in the application and are configuration, not secrets. Store
credentials and Expo access tokens stay in EAS/GitHub secret storage.

Run EAS commands from `apps/mobile`. Publish preview and production updates
separately with their matching `--environment` value. A preview bundle normally
targets staging, so do not republish it to production. Validate the same commit
with production configuration, then publish it directly to the production
channel.

Rollback procedure:

1. Stop further publishes and identify the bad update and its runtime version.
2. Use `eas update:rollback` to select the previous update, or run
   `eas update:republish --group <known-good-group-id>
   --destination-channel <channel>`.
3. Confirm recovery on an installed build with the same runtime version.
4. If native code/configuration changed, OTA rollback is insufficient; increment
   the app version, build again, and release through the store track.

## Mobile store release gate

The manually dispatched `.github/workflows/mobile-release.yml` workflow is the
store handoff for task 6.8. Internal releases submit the production binary to
TestFlight and the Google Play internal track. Public releases must build
`master`; before EAS is invoked, the workflow queries the latest two completed
`Mobile Staging E2E` runs on `develop` and requires both conclusions to be
`success`. A failure, cancellation, or other non-success conclusion resets the
consecutive-run gate.

Use protected GitHub Environments to keep the two authority levels separate:

- `mobile-internal-release`: internal TestFlight/Play rehearsal;
- `mobile-production-release`: public release, with required reviewers.

Both need an `EXPO_TOKEN` secret. iOS releases also require the non-secret
`EXPO_ASC_APP_ID` variable. Store signing and submission credentials remain in
EAS. Google Play's first service-account-backed upload may require a manual
Play Console upload before API submission is accepted.

EAS Submit uploads iOS builds to App Store Connect/TestFlight; it does not send
them to App Review. After a successful public workflow run, an operator must
complete the App Store Connect release record, choose the processed build, and
submit it for review. Android public submission targets the production track,
and the protected-environment approval is therefore the final automated safety
gate before EAS queues it.

Operational completion evidence for 6.8 consists of links to:

1. successful TestFlight and Play internal submissions;
2. physical-device smoke results for both platforms;
3. the two qualifying consecutive mobile staging E2E runs;
4. public App Store Connect and Play Console submissions.

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| A1 - Generated release notes | Implemented | Manual GitHub Pages release notes scaffold, workflow, and future generator template added; semantic generation deferred. |
| A2 - In-app release records | Implemented | `ReleaseAnnouncement` model, secret-protected record endpoint, and workflow handoff implemented; broadcast remains deferred. |
| A3 - Production notification broadcast | Implemented | Secret-protected broadcast endpoint and manual workflow handoff implemented. |
| A4 - What's new UX | Implemented | Release notifications and the persistent account-menu What's New entry link to public release notes. |
| B1 - Scheduled staging E2E workflow | Implemented | Manual and weekday scheduled workflow added. |
| B2 - Test data contract | In progress | Staging data contract documented and centralized in Playwright config helpers; owner/admin actors, two active houses, and an optional dedicated lifecycle organization support reversible Manage coverage. |
| B3 - E2E coverage expansion | In progress | Dashboard, account-menu, role access, complete Manage workspace, Manage Audit, reversible team mutations, optional lifecycle recovery, and optional historical season reporting coverage added. Notification read behavior and Audit pagination remain. |
