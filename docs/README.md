# HousePoints Documentation

The documents in this folder serve three purposes:

1. Capture the current shape of the application.
2. Track production-readiness and roadmap work.
3. Preserve design notes for future feature work.

## Current State And Refactor Record

- [First refactor pass](./refactor-pass-1/README.md): the main engineering gate before new feature work.
- [Current state](./refactor-pass-1/01-current-state.md): deployed shape, request flow, package responsibilities, and verification notes.
- [Findings](./refactor-pass-1/02-findings.md): risks and gaps found during the June 2026 review.
- [Target architecture](./refactor-pass-1/03-target-architecture.md): intended API, web, contracts, database, and logging boundaries.
- [Execution plan](./refactor-pass-1/04-execution-plan.md): recommended order for the first refactor pass.
- [Acceptance criteria](./refactor-pass-1/05-acceptance-criteria.md): release-blocker and pass-one criteria.
- [Pass one closeout](./refactor-pass-1/09-closeout.md): completion evidence, done definition, deferred work, and recommended next tracks.

## Roadmap And Planning

- [Roadmap](./roadmap.md): current production-readiness tiers and feature work.
- [Upcoming features](./upcoming-features.md): unscheduled product concepts and open design questions.
- [Manage resource workspaces design](./manage-workspaces-design.md): phased refactor from administrative form galleries to Overview, Members, Houses, Seasons, Organization, and Audit workspaces.
- [Seasons design plan](./seasons-design.md): proposed product and technical plan for season-scoped scoring.
- [Organization settings design](./org-settings-design.md): owner-only organization settings, slug-change safety, and future URL alias planning.
- [Organization lifecycle and archive design](./org-lifecycle-archive-design.md): owner-only org archive/restore rules and hard-delete non-goals.
- [Dashboard slug routes design](./dashboard-slug-routes-design.md): implemented `/o/{slug}` dashboard routing behavior, alias redirects, and security rules; the optional root redirect remains deferred.
- [Notification system design](./notifications-design.md): durable in-app notifications, account-menu inbox, and toast delivery plan.
- [Activity reactions design](./activity-reactions-design.md): emoji reaction rules for Activity cards, notification dedupe behavior, and the card refactor path.
- [Multi-org membership design](./multi-org-membership-design.md): staged migration from single `User.organizationId` membership to membership-scoped org access.
- [Release and E2E automation plan](./release-and-e2e-automation.md): phased release notes, in-app release announcements, and scheduled staging Playwright coverage.
- [Mobile store launch checklist](./mobile-store-launch-checklist.md): ordered Expo, Auth0, Apple, Google, GitHub, E2E, device-testing, and public-release setup for completing Tier 6.
- [Google Play store listing](./google-play-store-listing.md): prepared title, descriptions, public contact URLs, and reviewer-access notes for the Android listing.
- [Google Play Console declarations](./google-play-console-declarations.md): recommended category, ads and access answers, content-rating guidance, target-audience decision, and UGC compliance blockers.
- [Google Play Data Safety draft](./google-play-data-safety.md): field-level Android data inventory, purposes, security answers, SDK checks, and account-deletion decision.
- [Auth0 production social connections](./auth0-production-social-connections.md): Google and GitHub provider-owned OAuth credentials, environment isolation, minimum scopes, and physical-device verification.
- [Staging E2E test data contract](./staging-e2e-test-data-contract.md): required staging users, org state, and GitHub Environment secrets for Playwright runs.
- [Release process](./release-process.md): current manual GitHub Pages release note flow and commit convention.

## Tier Detail Notes

- [Tier 1: Correctness and Security](./01-correctness.md)
- [Tier 2: Reliability and Observability](./02-reliability.md)
- [Tier 3: User Experience](./03-ux.md)
- [Tier 4: Testing and CI](./04-testing-ci.md)
- [Tier 5: Scale and Ops](./05-scale-ops.md)

The refactor review should be used as the engineering gate for upcoming feature work. The tier detail notes now mirror the current roadmap status and call out deferred items explicitly.
