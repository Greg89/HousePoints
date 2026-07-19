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
4. Team mutations: reversible house assignment and owner promote/demote coverage are implemented
   with persistence verification and `finally` cleanup. Invite generation remains deferred until
   invite records have a safe cleanup expectation.
5. Seasons: historical Overview report, season recap, and Leaderboard switching are implemented.
6. Notifications: receive, preview, mark read.
7. Manage Audit pagination: filter coverage is implemented; pagination remains future coverage.

Each added E2E path should be stable against real Auth0 and staging timing. Prefer fewer high-value tests over a broad brittle suite.

## Operating Rules

- Main CI remains the merge confidence gate.
- Scheduled E2E is an environment confidence monitor, not a blocker for every commit.
- Failures should create investigation work, not automatic production rollback.
- Keep E2E secrets in a GitHub Environment named `staging`.
- Upload artifacts on success and failure so the last known browser behavior is visible.
- Do not run production-user release notifications until release records and broadcast idempotency exist.

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| A1 - Generated release notes | Implemented | Manual GitHub Pages release notes scaffold, workflow, and future generator template added; semantic generation deferred. |
| A2 - In-app release records | Implemented | `ReleaseAnnouncement` model, secret-protected record endpoint, and workflow handoff implemented; broadcast remains deferred. |
| A3 - Production notification broadcast | Implemented | Secret-protected broadcast endpoint and manual workflow handoff implemented. |
| A4 - What's new UX | Implemented | Release notifications and the persistent account-menu What's New entry link to public release notes. |
| B1 - Scheduled staging E2E workflow | Implemented | Manual and weekday scheduled workflow added. |
| B2 - Test data contract | In progress | Staging data contract documented and centralized in Playwright config helpers; owner/admin actors and two active houses support reversible Manage coverage. |
| B3 - E2E coverage expansion | In progress | Dashboard, account-menu, role access, complete Manage workspace, Manage Audit, reversible team mutations, and historical season reporting coverage added. Notifications and Audit pagination remain. |
