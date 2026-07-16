<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# HousePoints Agent Instructions

## Team Working Agreement

- Keep changes small, focused, and commit-ready.
- Prefer one logical unit of work per commit.
- Do not create commits unless the user explicitly asks.
- Do not push unless the user explicitly asks.
- Preserve unrelated local changes.
- Do not revert user changes unless explicitly requested.
- When the user says a change is committed, move to the next task without reworking the committed slice unless new information shows a defect.

## Definition Of Done

A unit of work is not done until:

- The implementation is complete.
- Relevant docs are updated when behavior, setup, workflows, roadmap status, or operational expectations change.
- Tests are added or updated for changed behavior.
- Typecheck passes.
- Relevant tests pass.
- Build passes when the change affects production runtime behavior.
- Lint passes for touched workspaces.

## Verification Commands

Use the smallest meaningful set first, then broaden when needed.

Common targeted checks:

- `npm.cmd run typecheck -w @housepoints/api`
- `npm.cmd run typecheck -w @housepoints/web`
- `npm.cmd test -w @housepoints/api -- --run <test-file>`
- `npm.cmd test -w @housepoints/web -- --run <test-file>`
- `npm.cmd run lint -w @housepoints/api`
- `npm.cmd run lint -w @housepoints/web`

Before considering a production-facing unit complete:

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`

Run `npm.cmd run lint -w <workspace>` for touched workspaces when lint is not already covered by a broader command.

## Product And Engineering Preferences

- Prefer production-grade, maintainable code over quick patches.
- Prefer shared helpers when two code paths perform the same business operation.
- Keep API behavior structured, typed where practical, and logged with useful context.
- Known or user-facing errors should return typed responses where practical.
- Unexpected errors should be logged with structured context and should not leak sensitive details to users.
- Update refactor, roadmap, and operational docs as items are completed or reprioritized.
- Favor "show but disable" for permission-gated UI when it helps users understand access levels.
- Keep notification behavior intentional: action-required items should remain visible until the underlying work is handled; transient informational items may archive after read when that matches the user workflow.

## Release And Environment Discipline

- Treat `develop` as the staging-linked branch and `master` as the production-linked branch unless the repo configuration changes.
- Environment variable or secret changes should be called out clearly before deployment.
- CI/E2E changes should document required GitHub Environment secrets and Railway variables.
- Release-note and notification changes should keep the public release page, app release records, and in-app notification behavior aligned.

## Multi-Org And Data Safety

- Preserve organization scoping in all user, notification, point, audit, and reporting flows.
- Prefer soft-delete/archive patterns over hard deletes for product data.
- Admins manage member and point operations; owners manage organization-level configuration.
- Be careful with tests and helpers that assume one organization per user.
