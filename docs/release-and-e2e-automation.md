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

Status: first slice implemented.

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

The first API surface is `POST /system/releases/record`. It is protected by `RELEASE_AUTOMATION_SECRET`, upserts by `version`, and returns the stored release announcement. This gives CI a safe idempotent handoff point for release metadata without notifying users.

The app should own the release business rules, including duplicate prevention and notification fanout. Notification fanout remains deferred to Phase A3.

### Phase A3 - Production Notification Broadcast

After a production release is deployed and healthy, CI can call a protected API endpoint:

```text
POST /system/releases/{releaseId}/broadcast
```

The API should:

- require a release-broadcast secret or machine credential;
- verify the release exists and was not already broadcast;
- create durable informational notifications for active users;
- record `broadcastAt`;
- log and audit the broadcast.

Do not allow GitHub Actions to write directly to the production database. CI should trigger app behavior; the app should enforce product rules.

### Phase A4 - User-Facing What's New

Once release records exist:

- add a "What's new" entry to the account menu;
- link release notifications to the release notes page;
- later, add user notification preferences if release noise becomes a problem.

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
- `E2E_TARGET_MEMBER`

Optional manual input:

- `base_url`, which overrides `E2E_BASE_URL` for an ad-hoc run.

### Phase B2 - Test Data Contract

Define a stable staging test organization:

- one owner/admin test user for scripted login;
- at least one target member in a different account;
- at least one house assignment for both users;
- feature flags set to the same values expected in staging.

The E2E account should not be a real user. If tests mutate data, the staging org should either tolerate that history or gain a reset job later.

### Phase B3 - Coverage Expansion

Grow the suite slowly:

1. Smoke: login, dashboard render, primary tabs navigate, and Manage renders when available.
2. Core: award points, Activity shows the transaction, Leaderboard shows the target.
3. Team: generate invite, assign house, promote/demote admin.
4. Seasons: switch historical season and verify reports/standings update.
5. Notifications: receive, preview, mark read.
6. Manage Audit: filter and paginate audit history.

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
| A2 - In-app release records | In progress | `ReleaseAnnouncement` model and secret-protected record endpoint implemented; broadcast remains deferred. |
| A3 - Production notification broadcast | Deferred | Should be app-owned, not direct DB writes from CI. |
| A4 - What's new UX | Deferred | Depends on release records. |
| B1 - Scheduled staging E2E workflow | Implemented | Manual and weekday scheduled workflow added. |
| B2 - Test data contract | Deferred | Needs stable staging account/org setup. |
| B3 - E2E coverage expansion | In progress | Read-only dashboard smoke coverage added. |
