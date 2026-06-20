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

## Roadmap And Planning

- [Roadmap](./roadmap.md): production-readiness tiers and feature work tracked before the refactor pass.
- [Upcoming features](./upcoming-features.md): unscheduled product concepts and open design questions.
- [Seasons design plan](./seasons-design.md): proposed product and technical plan for season-scoped scoring.

## Tier Detail Notes

- [Tier 1: Correctness and Security](./01-correctness.md)
- [Tier 2: Reliability and Observability](./02-reliability.md)
- [Tier 3: User Experience](./03-ux.md)
- [Tier 4: Testing and CI](./04-testing-ci.md)
- [Tier 5: Scale and Ops](./05-scale-ops.md)

The refactor review should be used as the engineering gate for upcoming feature work. The older tier documents remain useful history, but some statuses and assumptions no longer match the code.
