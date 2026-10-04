# Third Refactor & Enhancement Pass

Review date: September 19, 2026

## Purpose

Refactor passes 1 and 2 fixed security, reliability, and API-layer structural debt (route-service extraction, notification factories, contracts split, Prisma select-derived types, route helpers). Those are all complete and are not revisited here.

This pass is a fresh, application-wide review focused on:

- **Web app** — App Router usage, component composition debt, streaming/caching strategy, revalidation granularity, testing patterns.
- **Mobile app** — First dedicated review since the mobile MVP shipped. Screen composition, error handling, offline behavior, telemetry, accessibility, startup polish.
- **Platform (API + shared packages)** — Cross-cutting concerns not yet extracted, observability gaps, scale-oriented database concerns, and typed-error consistency.
- **Enhancement recommendations** — Feature ideas grounded in what the codebase already supports.

No behavior changes are in scope during the refactor phases. Enhancements are called out separately with rough scoping so the team can decide what to schedule.

## Documents

1. [Findings](./01-findings.md) — consolidated, evidence-backed findings across web, mobile, and platform.
2. [Execution Plan](./02-execution-plan.md) — phased plan and commit-sized slices.
3. [Enhancement Recommendations](./03-enhancement-recommendations.md) — product enhancement ideas that would add real user value.

## Quality Gate

Same as prior passes. A unit of work is complete only when all pass cleanly for the touched workspaces:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:integration` (when DB behavior changes)

## Method

Findings were gathered by three parallel read-only sweeps across `apps/web`, `apps/mobile`, and `apps/api + packages/*`, then spot-verified against the current source before publishing. Two draft findings (a missing `Notification(organizationId, type, createdAt)` index, and a missing push dispatch in the reactions handler) were disproven during verification and are not included here.

## Status

- Findings: **Drafted**
- Execution plan: **Drafted, not scheduled**
- Enhancements: **Drafted, not scheduled**

No implementation work has begun for this pass. Prioritization is proposed but not committed until the team reviews.
