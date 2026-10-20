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

## Collaborative Railway Debugging

The user prefers a shared browser workflow for Railway investigation. Suggest it when debugging deployed behavior, failed deployments, environment differences, resource usage, or hosting costs. Use an already available authenticated connector or CLI when it fits; browser access is a useful path when those are unavailable or the Railway UI provides the clearest evidence.

1. Explain briefly what you will inspect and why. Reuse the relevant Railway browser tab if available; otherwise open Railway in the in-app browser. Show the tab when the user needs to sign in or follow the investigation.
2. If Railway requires authentication, ask the user to sign in directly in that tab and tell you when ready. Do not ask them to paste passwords, tokens, or MFA codes into chat. Continue independent local investigation while waiting.
3. After the user confirms sign-in, refresh the browser state and continue from their current page. Avoid restarting the login flow or asking again for permission to perform already-authorized read-only investigation.
4. Verify the project, environment, and service before interpreting evidence or taking action. HousePoints staging was named `beta` in Railway on October 11, 2026; production is a separate environment. Confirm the current labels and deployment source rather than assuming a tab opens in staging or that a successful deployment contains the local changes.
5. Inspect the relevant Deployments, Metrics, Logs, or Project Settings → Usage views. Record the active deployment identity/revision, time window and timezone, service/replica configuration, and observed symptoms as needed. Re-read page state after navigation; distinguish active deployments from skipped or failed attempts.
6. Validate the scope of every measurement. During the October 11 investigation, Project Settings → Usage showed the same project-wide totals with beta and production selected. An environment query parameter alone does not prove costs are environment-scoped. Separate accrued usage from projected bills, approximate chart readings from exact exports, and missing metrics from zero traffic.
7. Share concise findings as the investigation progresses, connecting each finding to the next check. Keep routine read-only work moving autonomously. Before a deployment, restart, configuration change, or data mutation, establish that the action is within the user's authorized scope; a debugging request alone does not authorize production changes.
8. Save useful findings in the relevant operational/design document: observation date, source link, environment/service, deployment identity, measured values, limitations, and remaining checks. Keep secrets and personal/payment data out of repository evidence. Do not mark a release gate or collection period complete based on a partial inspection.
9. Leave the relevant browser tab available when the user needs to inspect it or continue later. End with what was learned, what changed, validation performed, and the next concrete step. Do not imply ongoing monitoring is running unless a collector or automation has actually been configured and verified.

Example from this workflow: [B1 Railway measurement log](docs/quarterly-product-design/staging-measurements.md). It records the initial shared sign-in investigation, beta service inventory, project-wide cost snapshot, and remaining measurement limitations.
