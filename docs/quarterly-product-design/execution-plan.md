# Quarterly execution plan

Created September 20, 2026. Status: sliced and ready for implementation planning; no slice has started. This is an ordered backlog, not a calendar or a commitment to finish every item in Q4.

The [decision register](./README.md#decision-register) is the product authority. This plan preserves the approved scope: category add/archive only, correctable historical results, transaction-time house attribution, shared ranks, manual season rollover, member-capacity billing, and essential mobile compatibility.

## Working rules and release gates

- Each ID is one bounded outcome. Most should be one focused PR; schema/compatibility work may need multiple small commits within that outcome. Do not combine unrelated IDs just because they touch the same route file.
- Prerequisites listed below are required before enabling dependent behavior, not necessarily before drafting its code. Keep incomplete client/server features disabled. No category enablement before the compatibility gate, and no paid enforcement before the billing launch gate.
- Use existing services/contracts and refactor only the paths needed by a slice. The whole pass-3 refactor backlog is not a prerequisite.
- Before implementation, re-read affected code and the installed Next.js guides for any web change. Choose ordinary validation limits and UI details within the approved design; surface only unresolved commercial/product choices that affect scope.
- Every implementation slice includes relevant tests and docs. Production-facing completion requires `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`, and lint for touched workspaces. Run `npm.cmd test:integration` for schema/database behavior and real concurrency checks; rebuild contracts when changed. Root build does not replace native mobile build/device verification.
- Apply expand/backfill/validate before making new fields mandatory or removing legacy behavior. State environment variables, migration order, feature flags, and rollback limitations in each release slice. No automatic commit, push, migration against production, or deployment is implied by this plan.

## Order and checkpoints

| Checkpoint | Required slices | Reviewable result |
|---|---|---|
| Trustworthy scoring | F1–F4 | Safe retries, concurrent mutations, corrections, and notification targeting |
| Custom categories | C1–C5 | Owners add/archive; both clients award and display categories safely |
| Explainable standings | R1–R4 | Shared ranking rules and house/member/category drill-through |
| Season workflow | S1–S3 | Prepare, manually start, and review a season with consistent reports |
| Billing decision | B1–B3 | Cost-informed commercial specification and tested sandbox architecture |
| Conditional paid pilot | P1–P7, after billing decision | Verified owner subscriptions, platform oversight, and recovery workflows |

Start with F1. B1 is independently actionable once someone is ready to conduct the spike; it does not block category/reporting work. S1 can be developed once categories are available, while final recap integration waits for reports. No background season-closing service is part of any slice.

## F — Targeted scoring and navigation reliability

### F1 — Serialize point writes and season rollover

Dependencies: none. Surfaces: API point/season services, DB integration tests.

Choose and document a shared transaction/locking protocol. Resolve the active season within that protocol; enforce deduction cooldown checks and insertion together. Bring the existing manual rollover path under the same protocol now, rather than waiting for the new season UI. Add an organization reporting revision advanced by every score-affecting write/deletion; inventory administrative/moderation/deletion paths that can change results so none bypass it.

Done when real database tests prove concurrent deductions cannot bypass cooldowns, a concurrent award/rollover belongs to exactly one correctly ordered season, rollback leaves no partial changes, and score changes advance revision atomically. No UI change required. Profile lock contention before broadening the protocol.

### F2 — Make award/deduction retries safe and bound push latency

Dependencies: F1. Surfaces: contracts, DB, API, web/mobile submission flows, push dispatcher.

Persist an idempotency key and request fingerprint scoped to organization/actor/operation with the committed result. Both clients reuse the key after an uncertain response and create a new key for a genuinely new submission. Reject the same key with a different payload; recheck current authorization before returning a prior result. Define retention and what expired keys mean. Bound post-commit push calls so external delivery cannot indefinitely delay confirmation. Durable push delivery is not required to complete this slice.

Done when parallel retries create one transaction and one durable notification/audit effect, changed payloads conflict, and a simulated lost response or push timeout does not create duplicate points. Stage as persistence/API, then client adoption, if needed; preserve legacy requests until clients update, explicitly documenting their remaining retry risk.

### F3 — Require a reason for closed-season corrections

Dependencies: F1. Surfaces: existing point deletion/correction API, web confirmation, audit and recap labels.

Require a nonblank reason server-side for corrections to a closed season. Commit actor, affected record, reason, timestamp, before/after scoring effect, and revision with the correction. Preserve existing role and organization restrictions. Show that historical results can reflect corrections; do not invent an arbitrary historical-deduction feature.

Done when missing reasons fail, failed audit persistence rolls back correction, unauthorized/cross-org corrections fail, and a valid correction changes historical totals. Final co-winner-change notices are integrated in S3 after ranking rules converge.

### F4 — Route notification taps to their actual organization

Dependencies: none. Surfaces: push payload/parser, mobile route adapters/tests.

Resolve notification organization identity against current memberships instead of using the active organization as a fallback for another organization's event. Reuse the auth/hydration gates and membership switching already present. Provide a safe unavailable state for removed access.

Done when same-org, cross-org, cold-start, and revoked-access cases are tested with the actual server payload shape. Preserve notification dedupe and avoid clearing an unhandled notification prematurely.

## C — Custom recognition categories

### C1 — Add category persistence and repeatable backfill

Dependencies: F1. Surfaces: DB schema/migrations, organization creation, fixtures.

Add organization-owned immutable categories and nullable award category references. Seed the current defaults on new organization creation; backfill existing organizations/awards once using legacy mappings. Retain the enum and legacy readers. Add tenant integrity, active-name uniqueness, and archival metadata; reused archived names get new IDs.

Done when a migration rehearsal and rerun preserve award counts/totals, every migrated award maps to its own organization's category, and ordinary reads never reseed archived defaults. Default seeding and organization creation are atomic. No owner controls enabled yet.

### C2 — Introduce category-aware API compatibility

Dependencies: C1, F2. Surfaces: contracts, API award/read/report/notification mapping.

Add list/create/archive operations with owner authorization, audited changes, idempotent creation, and last-active-category enforcement under concurrency. Accept category-based awards through an explicit compatibility boundary; keep legacy requests mapped to seeded categories. Inventory every enum-dependent response, including activity, summaries, notifications, and bootstrap-dependent client parsing. Never map a custom category to a fabricated legacy trait.

Done when archive-vs-award and simultaneous-last-archive races are safe, reused names remain distinct, and unsupported clients have a tested recovery/version path. Category mutation remains disabled until C5; API compatibility is not permission to enable it early.

### C3 — Web category management and award selection

Dependencies: C2. Surfaces: Manage Recognition, award dialog, activity/report labels.

Deliver owner Add/Archive controls, archived history visibility, and the agreed last-category guidance. Admin controls show restricted access. Use available categories in awards, retain a draft if its category is archived mid-submit, and display fixed names from category identity throughout web reads.

Done when owner/member permissions, archive/add with the same name, picker exclusion, preserved historical labels, and error recovery pass component/API tests. Keep behind the category release gate.

### C4 — Mobile category compatibility

Dependencies: C2. Surfaces: mobile picker, activity/home/report models, notifications, version handling.

Support custom-category selection, fixed historical names, archived/unavailable categories, and compatible summary parsing. No native category-management screen. Keep the idempotency behavior from F2.

Done when the upgraded app completes an award and renders archived/custom categories on a device, and the currently supported old binary follows the documented compatibility path rather than crashing on strict enum parsing.

### C5 — Enable categories with a cross-client release rehearsal

Dependencies: C3, C4. Surfaces: deployment/release docs, compatibility gate and targeted E2E.

Rehearse migration plus old/new client combinations, then enable for a controlled organization. Verify add → award → archive → report → reuse-name across web/mobile. Record supported versions, required configuration, and backfill evidence.

Done when deployment order and rollback are executable. Once custom awards exist, enum-only rollback is forbidden; disable management if needed while retaining compatible reads. Legacy enum removal is deferred, not bundled into this release.

## R — Leaderboard drill-through

### R1 — Unify score attribution and tied rankings

Dependencies: C2, F3. Surfaces: shared report service/contracts, existing standings/comparison/recap consumers on web/mobile.

Define one tested scoring/ranking implementation: transaction-time house, personal totals across houses, former/anonymized recipients retained, net = awards minus deductions, and competition ranks (1, 1, 3). Represent all co-winners; empty seasons have no winner. Adapt existing winner contracts and both clients before enabling the behavior so surfaces do not disagree.

Done when house moves, departures, negative/zero totals, deductions, ties, and corrections reconcile across existing reports. Preserve safe display-name anonymization.

### R2 — Add scoped report queries and consistent pagination

Dependencies: R1. Surfaces: typed report API/contracts, DB queries and cursor validation.

Implement season/house/member/category/giver/type scope, aggregate summary, and paginated ledger detail with bounded inputs. Read summary/first page consistently; bind cursors to scope and reporting revision. Return a recoverable refresh-required result when score data changes. Restrict all IDs and reads to current access.

Done when complete pages reconcile to the same-revision summary, altered/cross-org cursors fail, category deductions are separately explained, and query counts/payloads are measured on realistic fixtures. Add indexes only when query evidence supports them.

### R3 — Ship house and member drill-through on web

Dependencies: R2, C5. Surfaces: standings links, authenticated report route, breadcrumbs/URL state.

House → recipients → contributing transactions, plus member season totals across houses. Preserve organization/season/filter context and browser back/forward. Load reports on demand, outside initial dashboard loading. All current members can inspect normal details; administrative evidence stays restricted.

Done when links, stale-revision refresh, revoked access, former-member contributions, empty/error states, and mobile-width layout pass targeted E2E. No public links or native reporting expansion.

### R4 — Add category/giver breakdown and filter combinations

Dependencies: R3. Surfaces: report controls and breakdowns.

Expose category and giver drill-through, award/deduction filters, and clear filtered subtotal versus full-season total. Distinguish same-named archived/replacement categories; keep deductions outside award category totals.

Done when combined filters, shareable authenticated URLs, and all breakdowns reconcile without losing scope. CSV, saved filters, and a custom report builder remain deferred.

## S — Season preparation and reporting

### S1 — Prepare the next season without changing the active one

Dependencies: C5. Surfaces: SeasonPlan storage/contracts/API, owner Manage UI.

One draft per organization: name, optional message/planned dates, timezone, readiness summary, edit/discard with audit and stale-edit conflict handling. Add optional planned-end metadata for active seasons and compatible mobile displays. Dates are informational; passing them never closes a season or stops awards.

Done when owner/admin permissions, timezone edge cases, draft conflicts, and past-planned-end messaging are tested. Existing start remains available until S2 connects the draft flow.

### S2 — Start the prepared season atomically

Dependencies: S1, F1, F2, F4. Surfaces: existing transition service, owner confirmation, notifications.

Add expected-active-season/plan-version checks and idempotent kickoff. Close the previous season and create the successor at one server timestamp using F1's protocol. Persist one kickoff announcement and consume the draft only on success. Reuse this service for legacy start requests.

Done when double-click/retry produces one transition, simultaneous award/start is correct, stale plans conflict, and rollback preserves the original active season and draft. No scheduler or standalone close.

### S3 — Connect season recap, comparison, and correction notices

Dependencies: S2, R4, F3. Surfaces: Overview/season reports, recap notification links.

Use the same reporting service for closed-season totals, co-winners, contributions, and comparisons. Connect recap notices to the actual organization/season rather than embedding an immutable winner claim. Surface correction disclosure and send a deduplicated owner/admin informational notice when a correction changes the winning set.

Done when kickoff → old-season recap → drill-through and later correction → updated winner/report are verified end to end. Update prior season/winner/comparison docs to match implemented behavior.

## B — Billing spike (current commitment)

### B1 — Cost, provider, and lifecycle decision record

Dependencies: none. Deliverable: a reviewed architecture/commercial decision record, not production billing code.

Estimate hosting at realistic member/activity levels; propose Standard price and initial Plus bands. Compare providers using current official sources and verify the intended mobile purchase/recovery flow. Resolve upgrade timing/proration, plan-catalog changes, ownership/archive handling, exception expiry/revocation, and the exact limited-mode endpoint matrix. Preserve every approved policy; no paid-tier trials or feature differences between capacity tiers.

Done when each unresolved item has a recommendation, evidence, and owner decision needed before implementation. Time-box discovery to producing this record, not building a generic billing framework.

### B2 — Prove the lifecycle in an isolated sandbox

Dependencies: B1 provider selection and sandbox access. Deliverable: small runnable harness/tests plus observed results; no production credentials or real charges.

Prove checkout activation, renewal/failure/recovery, seven-day deadline stability, cancellation, scheduled downgrade capacity, duplicated/out-of-order events, missed-event reconciliation, and complimentary/grace exceptions. Include indefinite grants, expiry/revocation, and provider failure while stopping future charges.

Done when event → local state → capabilities mappings are documented and reproducible. If provider access is unavailable, record that gate; do not label a mocked-only exercise a completed provider spike.

### B3 — Specify notifications, operations, and launch decision

Dependencies: B1, B2. Deliverable: reviewed implementation backlog/runbook and go/defer decision.

Choose owner email delivery and dedupe/retry strategy; verify failure/deadline/recovery content and recipient changes. Specify secrets/environments, operator alerts, reconciliation, data retention, and rollout. Rehearse the 30-day existing-organization transition without restarting deadlines on rerun. Finalize acceptance scenarios and estimates from spike evidence.

Done when pricing, provider mechanics, exception transitions, and distribution constraints are concrete enough to approve a paid pilot. Completion of B3 does not authorize production billing rollout.

## P — Conditional billing implementation outline

These are provisional slices to refine after B3, not a promise to implement provider-dependent behavior now. All remain gated until the launch decision.

| ID | Outcome | Dependencies | Required proof before enablement |
|---|---|---|---|
| P1 | Local plan/capacity state, counted membership, capability decisions in observation-only mode | B3 | Correct owner/admin/unassigned/suspended counts; no access changes during backfill |
| P2 | Owner checkout and durable provider event ingestion/reconciliation | P1 | Signature validation, idempotency/order recovery; redirect alone never activates access |
| P3 | Platform billing visibility and audited complimentary/grace exceptions | P2 | Amount versus collected-payment accuracy; required reasons, revocation, dated/indefinite grants; billing effects verified |
| P4 | Upgrade, scheduled downgrade, cancellation, and atomic join capacity | P2, P3 | Owner-approved charges; concurrent joins safe; blocked invite stays unused; lower scheduled limit enforced |
| P5 | Grace/limited enforcement, owner notices/email, essential mobile messages | P4 | Stable seven-day deadline, endpoint allowlist, email retries, recovery; no trial/cancellation grace confusion |
| P6 | Existing-organization transition and selected paid pilot | P5 | Free up to 4; 30-day larger-org grants; no automatic charge/deletion; native checks and recovery rehearsal |
| P7 | Pilot closeout and wider rollout decision | P6 | Reconciliation/notification evidence, support runbook, billing correctness and approved rollout plan |

Each provisional slice must keep payment enforcement disabled outside enrolled test/pilot organizations until the whole applicable path works. Disabling new enrollments is distinct from stopping charges; rollback must reconcile actual provider subscriptions and retain customer history.

## Explicitly deferred

Full pass-3 refactor, offline mutation queue, generic API tokens/webhooks, native management/reporting expansion, scheduled season closure, immutable winner snapshots, category editing/restore/weights, CSV/public reporting, paid trials, discounts, and bespoke pricing. Revisit only through an explicit scope change.

## Tracking

All F/C/R/S/B slices: **todo**. P1–P7: **gated pending B3**. Update this file as slices complete with verification and release evidence; do not mark a slice done merely because code is merged while a required compatibility or rollout check remains open.

Recommended first implementation request: **F1 — serialize point writes and season rollover**, including the database concurrency tests and reporting-revision groundwork. This addresses a concrete correctness risk and supports categories, reporting, and season work without initiating a broad refactor.
