# Independent review and quarterly planning input

Reviewed September 20, 2026. Planning horizon: Q4 2026, assuming calendar quarters.

This is a source review of the current checkout, the three pass-3 documents, existing roadmap/design records, and selected tests. It is not a production audit or a fresh certification that CI, builds, store submissions, or live deployments pass. No runtime code was changed and no tests were run. Existing staged documents were preserved.

## Overall assessment

HousePoints has a substantial foundation: organization-scoped membership and permissions, a durable point ledger, seasons and historical reports, reactions, notifications, mobile workflows, and support/moderation tooling. The next quarter can build on that foundation. A third comprehensive refactor should not become a prerequisite for feature delivery.

Copilot's review is useful as a candidate backlog, but several evidence statements are incorrect or incomplete. Its recommended first three enhancements—streaming, offline writes, API tokens—are not justified by customer or usage evidence in the reviewed documents. They serve three different audiences and could spread a small team's capacity too thinly.

The most consequential missing planning question is: what should improve for a new organization and its members over their first month? The existing roadmap predominantly tracks implementation and production readiness. The next roadmap should also track activation, repeated participation, owner usefulness, and trust in scoring.

## What is already valuable

| Existing capability | Why it matters | Source |
|---|---|---|
| Shared contracts and organization-aware authorization | Web and mobile can share behavior without duplicating the entire backend; role and tenant boundaries already have dedicated code. | `packages/contracts/src`, `apps/api/src/actor.ts`, `apps/api/src/route-helpers.ts` |
| Durable points, seasons, soft deletion, audit history | A credible base for historical reporting and explainable corrections. | `packages/db/prisma/schema.prisma`, `apps/api/src/routes/points.ts`, `seasons.ts` |
| Self-serve organization creation, invitations, ownership and lifecycle management | Core administration already exists; onboarding can be improved incrementally. | `apps/web/src/components/OrgOnboarding.tsx`, `apps/api/src/routes/orgs.ts` |
| Reactions and targeted notifications | Recognition already has a social feedback loop. | `apps/api/src/notifications.ts`, `apps/web/src/components/ActivityCard.tsx` |
| Mobile auth reconciliation, organization persistence, query lifecycle handling | Mobile is beyond a screen-only prototype. Preserve these behaviors during any refactor. | `apps/mobile/src/context`, `apps/mobile/src/components/QueryLifecycleManager.tsx` |
| Support cases, account deletion, moderation and organization controls | Considerable operational work already exists; finish and verify those workflows before expanding platform scope. | `apps/web/src/components/Platform*`, `apps/api/src/routes/platform.ts` |
| Unit/component tests, database integration checks, Playwright and Maestro scaffolding | A useful verification foundation, although presence does not prove current runs pass. | `apps/web/e2e`, `apps/mobile/e2e/sign-in-dashboard-award.yaml`, `packages/db/tests/point-ledger.integration.ts` |

## Corrections to the pass-3 findings

### Web

- **W1: refresh targeting deserves review; the explanation is inaccurate.** Many actions call `revalidatePath("/")`, but platform actions already invalidate specific platform paths. The installed Next 16.2.9 guide distinguishes a page path from `revalidatePath("/", "layout")`; the former is not inherently whole-tree layout invalidation. It also documents temporary broader refresh behavior for previously visited pages. The API requester explicitly uses `cache: "no-store"`. Replacing path calls with tags alone therefore does not implement a useful cache. First verify freshness on `/o/[slug]`, defer hidden reads, and measure. Any cache design must specify organization, user/permission, season, revocation, and mobile-originated mutation behavior. Tag names do not provide access isolation. See `apps/web/src/lib/api-client.ts`, `apps/web/src/app/actions/platform.ts`, and the installed `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` and `revalidateTag.md` guides. The single-argument `revalidateTag` form is deprecated; stale-while-revalidate also differs from immediate read-after-write behavior.
- **W2: confirmed, with a sharper first step.** `dashboard-page.tsx` awaits eight reads, then an initial season comparison. Admin context and comparison contribute to startup before their UI is needed. Defer hidden work first; streaming can be a subsequent change. Adding Suspense around already-resolved data will not help.
- **W3/W4/W7: reasonable incremental cleanup.** Repeated submit/error/validation logic exists. Extract helpers when touching a flow and preserve intentional differences. Do not make a generic form abstraction a dependency for unrelated features.
- **W5: the named examples do not support the claim.** `ActivityCard` has hooks and several interactive controls. `HouseCard` has a selectable button and motion; `Leaderboard` uses motion. Removing directives alone does not remove client dependencies or move descendants of a client import boundary to the server. A deliberate composition change may help, but needs bundle evidence.
- **W6: useful direction, mismatched route proposal.** Manage is a tab inside the organization dashboard, not an existing `/o/[slug]/manage` segment. A boundary at that proposed path would not isolate the current tab. Admin context already has a soft fallback; notifications and comparison failures also degrade without crashing the entire dashboard. Choose component isolation or a real route split intentionally.
- **W8: low priority.** Accessible role queries are useful, but text assertions can legitimately test user-visible behavior. Avoid rewriting tests solely to satisfy a preferred style.
- **W9: partially incorrect.** `PlatformSupportCases.test.tsx` and `PlatformUserSearch.test.tsx` exist, as do other platform component tests. Moderation component coverage and dedicated platform E2E coverage remain useful gaps. Test meaningful permission and state transitions, not simply one new file per component.

### Mobile

- **M1/M2: real maintainability opportunities.** Screens mix concerns and repeat styling. Adopt existing `packages/theme` concepts through a native-compatible adapter rather than establishing a competing token source. Shared tokens currently include web-oriented color/font values and cannot all be copied straight into native styles. A 250-line screen limit is not a product outcome.
- **M3: narrower than claimed.** Native splash coordination is absent, but `app/index.tsx` already gates initialization, bootstrapping, and organization hydration with a loading view. A login flash is not established by reading `_layout.tsx` alone. Preload custom fonts only if the app actually uses them.
- **M4/M7: valuable gaps, incorrect integration assumption.** The mobile logger only emits console JSON, and there is no custom app recovery boundary in the reviewed layout. However, the API exposes `/telemetry/client-error`, not a general `/telemetry` event collector. Its strict schema accepts error reports, and the handler persists organization error signals. Screen views and adoption events need a separate contract and delivery design; pre-auth failures cannot depend exclusively on an authenticated organization-scoped endpoint.
- **M5/M6: product changes, not behavior-preserving refactors.** Offline writes need durable idempotency, visible pending/rejected states, account/organization isolation, and explicit rules for season rollover or lost permissions. Optimistic confirmed totals are especially questionable for deductions with server cooldowns. Prefer responsive submission feedback without pretending the ledger has committed.
- **M8: diagnosis mostly incorrect, but a different gap exists.** `NotificationResponseManager` re-reads the last response when `activeOrgSlug` changes. Explicit URL adapters wait for auth and hydration, check membership, and call `selectOrg`. The actual backend payload mismatch is described below.
- **M9: reuse existing schemas.** `adjustPointsSchema` and `deductPointsSchema` already exist in contracts. Awards accept a positive delta and a trait; deductions are a distinct operation with a server-fixed amount. Share genuine rules without collapsing those differences into one generic schema.
- **M10: targeted coverage is worthwhile.** Device-registration core tests already exist. The existing E2E choice is Maestro, so absence of Detox is not itself a gap. Add mounted-screen and lifecycle coverage where current utility tests cannot catch regressions.

### Platform

- **P1: cross-device preference is an enhancement.** The fallback helper does choose the first membership, but bootstrap sorts by organization name, web uses an active-organization cookie, and mobile persists a selected slug. This is not universally random organization selection. A server preference could improve cross-device consistency, with defined fallbacks for revoked access. Do not assume a migration can recover every user's active client session.
- **P2: consolidate carefully.** Membership lookup is already shared by point flows. A broader helper should preserve transaction context, permissions, error compatibility, and differences between target operations; it should not become a substitute for atomic writes.
- **P3: a shared error schema and handler already exist.** `apiErrorSchema` is in `packages/contracts/src/shared.ts`; `api-hooks.ts` installs a global `setErrorHandler`. The cited route samples use code/message responses, and the alleged `{ error: ... }` examples were not established in this review. Identify concrete exceptions before introducing another schema or handler.
- **P4: observability already has a base.** Global `request.completed` includes duration; leaderboard, dashboard summary, notification reads, and reaction-detail reads already emit events. Per-query timing and missing activity context could improve diagnosis. This is targeted instrumentation, not absent read-side observability.
- **P5: investigate before caching.** Aggregates are scoped by organization and season and relevant indexes exist. Absence of `take` does not demonstrate a full-table scan, and truncating aggregates could break totals. The velocity read does materialize all matching transactions in its time window, and some aggregates overlap. Refresh the existing benchmark with realistic volumes and query plans. Next's `unstable_cache` is not a drop-in cache for the Fastify API service.
- **P6/P7: useful improvements.** Audit/evidence typing can improve consumers while preserving older records. Push ticket handling exists, but per-token cleanup and receipt processing do not. Preserve successful tickets when one ticket fails.
- **P8: target uncovered invariants.** Direct admin helper tests already exist, although point services remain good candidates. More mocked service tests alone will not establish database concurrency correctness; use real database tests for it.
- **P9: partially incorrect.** Slug resolution returns `archivedAt`, though it omits suspension state. Central actor resolution already handles archived/suspended organizations. Make caller-specific changes where needed; a resolver's missing field is not proof of an authorization bypass.

## Additional reliability findings

These are source-supported concerns, not reproduced production incidents.

1. **Deduction cooldown race.** `checkDeductionCooldowns` runs before `createPointDeduction`, whose transaction only performs the writes. Concurrent requests can both observe no recent deduction and then commit. The reviewed migrations enforce delta/type constraints, not these time-window rules. Move checks and writes into a concurrency-safe design, using suitable locking or serializable transactions with retry, and add a real database concurrency test. Merely wrapping writes in a transaction is insufficient. Source: `apps/api/src/routes/points.ts:218`, `:274`, `:943`.
2. **Ambiguous award success and duplicate retries.** Award creation commits before the route awaits push delivery. The Expo fetch has no explicit application timeout; web API requests have a 10-second timeout. Slow push can therefore outlast the caller after points have committed. No request-level idempotency mechanism was found in the point input contracts or creation path. A user retry can create another award. Add idempotent point submission and bounded push delivery; use a durable outbox if reliable asynchronous delivery is required. Source: `apps/api/src/routes/points.ts:185`, `:819`, `apps/api/src/notifications.ts:72`, `apps/api/src/push-dispatcher.ts`, `apps/web/src/lib/api-client.ts`.
3. **Notification organization targeting mismatch.** Server push data contains `organizationId`, `type`, `entityId`, and potentially `actionHref`. The mobile parser handles `data.url` or falls back to `activeOrgSlug`, ignoring `organizationId`. A notification associated with another organization can therefore open the wrong organization route. Resolve the target organization from the payload against current memberships, then use the existing gated route adapters. Test cold start, another active organization, and removed access. This is a navigation defect; this review does not establish cross-organization data disclosure. Source: `apps/api/src/notifications.ts:60`, `apps/mobile/src/lib/deep-links.ts:63`.

## Product opportunities missing or underweighted

These are hypotheses to validate with users, not claims about observed demand.

| Opportunity | Small useful first release | Measure |
|---|---|---|
| Get a team to its first useful session | Owner setup checklist, clear house-assignment recovery, cohort invitations and bulk assignment | Time from organization creation to first member join and first peer award; join-to-assignment delay |
| Make recognition repeatable | Recent-recipient shortcuts, clear recognition prompts, personal received/given history | Award completion rate; weekly distinct givers and recipients; four-week organization retention |
| Show owners participation breadth | Extend existing velocity/season reports with participation trends and recognition coverage; export a complete filtered report | Owners returning to reports; share of active members recognized, with an explicit time window |
| Let organizations express their own culture | Owner-managed recognition categories and sensible point presets; preserve historical category meanings | Setup adoption and award completion; category usage |
| Build a recurring season ritual | Planned season dates, kickoff/winner summaries, a simple recap with notification preferences | Organizations running a second season; recap engagement |
| Make the point policy understandable | Explain deduction rules and explore owner-level enablement/policy settings | Correction disputes/support cases and successful correction flows |

The fixed `Trait` enum and award range in contracts show a concrete customization limit. Existing reports already cover velocity, standouts, winners, and season comparison, so analytics should extend those rather than recreate them. Notification preferences are already deferred in `docs/upcoming-features.md` and deserve attention before broader scheduled broadcasts.

Goals, challenges, badges, rewards/redemption, a display leaderboard, or chat integrations could each be meaningful directions. None should be added just because a points product could support it. Validate the desired experience first. A rewards economy in particular changes point integrity and fulfillment requirements substantially.

## Enhancement triage

| Copilot proposal | Assessment |
|---|---|
| EW1 streamed dashboard | Keep, but begin with hidden-read deferral and measurements; caching is a separate design. |
| EW2 command palette | Defer until frequent-user friction warrants it. |
| EW3 bulk admin | Strong candidate for cohort onboarding; specify partial failures, owner-only role changes, limits and auditing. |
| EW4 CSV export | Strong bounded candidate. Full exports need complete pagination or a dedicated query, consistent filters, access checks, and safe CSV cell handling. Existing displayed rows are not automatically the complete dataset. |
| EW5 saved filters | Later. Activity currently stores filters in component state, not URL search parameters, and does not implement all the claimed filters. Shareable URLs may be the cheaper first increment. |
| EM1 offline queue | Conditional on actual connectivity problems, after idempotency and replay policy. Consider award-only first. |
| EM2 haptics / EM3 shortcuts | Shortcuts have a clear core-flow benefit; haptics can accompany polish without becoming a separate roadmap theme. |
| EM4 widget / EM5 biometric gate | Defer until demand supports native complexity or local reauthentication friction. A biometric wrapper is not server authorization. |
| EP1 API tokens / EP2 webhooks | Defer a generic platform until a named integration consumer exists. Read-only tokens cannot support the suggested member creation/sync use case. Webhooks need delivery infrastructure and outbound URL controls; they do not inherently depend on API tokens. |
| EP3 audit search and replay | Extend existing audit filtering/detail where support needs it. Define replay as historical inspection; mutation replay is a separate, risky feature. |
| EP4 analytics | High potential when framed as owner questions; existing trend/reporting surfaces reduce the starting scope. |
| EP5 notification templates/scheduling | Start with a specific seasonal communication need and preferences, not a general campaign system. |

## Proposed quarter shape

This is an ordering proposal, not an effort estimate or capacity commitment. It assumes the near-term audience is small teams using peer recognition.

1. **Establish trustworthy delivery.** Address deduction concurrency, ambiguous retries, and notification targeting. Close applicable mobile launch checklist items and add useful crash/error visibility. Record current core-flow performance and adoption baselines.
2. **Improve activation and daily recognition.** Choose cohort onboarding/bulk assignment and recent-recipient shortcuts as the main product slices. Refactor the affected screens only as needed. Defer non-visible dashboard reads alongside this work.
3. **Give owners a reason to keep running the program.** Deliver a focused participation report/export, then choose one larger direction—custom recognition categories, season automation, or a specific integration—using user feedback and measured behavior.

Reserve explicit capacity for reliability and launch work. Do not schedule every refactor phase plus every feature recommendation in the same quarter. Replace file-count/line-count exit criteria with working user scenarios and measured outcomes. Set numerical performance and activation targets after establishing baselines.

Mobile public release is still marked in progress in `docs/roadmap.md`, with unresolved evidence/setup items in `docs/mobile-store-launch-checklist.md`. Treat that as an explicit delivery track; checked-in mobile code is not evidence of public availability. Existing planning docs also contain stale statements, so reconcile their status as each slice is accepted.

Before final commitment, incorporate the owner's missing feature ideas, intended customer cohort, available capacity, and any production usage or support evidence. Those inputs may change the ordering substantially.
