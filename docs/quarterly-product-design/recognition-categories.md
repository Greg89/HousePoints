# Custom recognition categories

Status: C1–C4 code is implemented and locally verified; deployed to production per the release owner October 4, 2026. C4 Android device and old-binary checks remain pending. C5 uses environment-wide feature flags, beta before production, without organization-ID allowlists. Live category enablement evidence remains to be recorded. See [shared decisions](./README.md#decision-register), especially D1 and D9.

## C1 persistence foundation

Implemented and locally verified September 26, 2026. Deployment is pending. The additive schema retains the fixed `TRAITS` list and `PointTransaction.trait` enum while introducing organization-owned `RecognitionCategory` records and nullable award category references. Existing API and client behavior remains enum-based until C2; C1 exposes no owner controls.

The migration seeds the 20 current labels once for every existing organization and maps legacy awards by trait. An organization-insert trigger seeds the same versioned defaults inside the creation transaction; reads never seed or restore categories. The rerunnable maintenance function only fills missing mappings, rejects legacy awards without a trait, preserves archived mappings, and uses organization-scoped foreign keys so an award cannot reference another tenant's category.

Names and descriptions are fixed after creation. The database trims and collapses name whitespace, stores a lowercase normalized name, and permits only one active normalized name per organization. Archiving leaves the record and historical references intact, while a replacement may reuse the archived name with a new ID. Deductions cannot receive a category.

Apply `20260927020000_recognition_categories` after the F1 and F2 migrations. It takes access-exclusive locks on organizations and point transactions with a five-second lock timeout, so schedule a maintenance window and retry the migration if active traffic prevents lock acquisition. No environment variables, secrets, client deployment, or feature flags are added. On application rollback, retain the additive table, column, trigger, and mappings. Before C2/custom writes there is no user-visible category behavior to disable; after custom awards exist, enum-only database rollback is unsafe.

Local PostgreSQL 16 verification applied every migration to a fresh database and covered 20-category seeding, transactional rollback, legacy award backfill, unchanged award counts/totals, zero-change rerun, tenant reference rejection, immutable names/descriptions, active-name normalization/uniqueness, archived-name reuse, and deduction exclusion. Database lint and typechecks passed. No staging or production migration was applied.

## C2 category-aware API compatibility

Implemented and locally verified September 27, 2026. The typed `categories-v1` contract adds category list/create/archive operations, category-ID awards, fixed category identity on activity, and category leaders on dashboard summaries. Owners may create and archive; authenticated organization members may list. Create uses an organization-scoped idempotency key, and create, archive, and award writes share the scoring lock. Archiving the final active category fails even under concurrent requests, and archive-versus-award ordering produces one consistent outcome. Creation and archival write dedicated audit events.

`RECOGNITION_CATEGORY_MUTATIONS_ENABLED` defaults to `false`. While disabled, create, archive, and category-ID awards return `RECOGNITION_CATEGORY_MUTATIONS_DISABLED`; legacy trait awards and compatible reads continue unchanged. This flag must remain false through C3 and C4 and is enabled only through the C5 release rehearsal.

C5 rollout is environment-wide. Enabling the API mutation flag permits category writes in every organization in that environment, subject to existing owner/member permissions and organization scoping. No organization-ID allowlist is required; listing and category-capable reads remain available to authenticated members in their own organization.

Compatibility matrix:

| Client/request | No custom-category awards in result | Custom-category award in result |
|---|---|---|
| Legacy trait award | Maps to that organization's active seeded category | Same; fails if the mapped category is archived |
| `categories-v1` category award | Accepted only while the mutation flag is enabled | Accepted only for an active category in the actor's organization |
| Legacy activity/dashboard read | Preserves the legacy response shape | Returns HTTP 426 with `RECOGNITION_CATEGORY_CLIENT_UPGRADE_REQUIRED` |
| `categories-v1` activity/dashboard read | Returns category-capable response fields | Returns fixed category IDs/names, including archived categories |

Notification text is resolved from the category's fixed name rather than inventing a legacy trait for a custom category. Existing seeded categories retain their legacy mapping. Unknown and cross-organization category IDs share the unavailable response and do not disclose another organization's data.

Deploy `20260927030000_recognition_category_api` after C1, then deploy the compatible API with `RECOGNITION_CATEGORY_MUTATIONS_ENABLED=false`. Release category-capable web and mobile clients before enabling the flag in C5. The migration adds category audit values, idempotent creation keys, category-only award validation, and the remaining category immutability enforcement. It requires no secrets and no new infrastructure.

Rollback before enablement may restore the prior application while retaining the additive migration. After category creation or category-ID awards are enabled, rollback means setting the mutation flag to false while keeping category-capable readers and schema in place. Dropping the migration or returning to enum-only readers is unsafe once custom data exists.

Local verification covered shared contract parsing, route authorization and disabled behavior, idempotent create, fixed-name responses, legacy response compatibility, HTTP 426 recovery, fresh application of all 46 migrations on PostgreSQL 16, tenant integrity, archived-name reuse, archive/award ordering, simultaneous final-category archives, and point-write retry/concurrency suites. No staging or production migration was applied, and old native binary/device verification remains part of C4/C5.

The C2 review also closed a moderation evidence gap: point-report snapshots and point-deletion audit metadata now retain the category ID and fixed name, including for custom awards whose legacy trait is null.

## C3 web category management and awards

Implemented and locally verified September 27, 2026. `RECOGNITION_CATEGORIES_WEB_ENABLED=false` is the default; enable it in beta before production. Dashboard and activity reads always declare `categories-v1` in the upgraded web app. While the write flag is false, the web app keeps the legacy trait picker. When the flag is true, the award picker lists only active categories and Manage > Recognition shows active and archived records for each organization. Owners can add and archive, while admins can inspect the list with controls disabled. The last-active category cannot be archived and the API remains authoritative under concurrent changes. Adding a category with an archived name creates a separate identity; archived history stays visible.

If a category is archived while an award form is open, the API rejects the award, the web app refreshes categories, and the recipient, points, and reason remain in the draft until another active category is chosen. Activity and overview reports display the category's fixed name, including archived names. Create retries reuse their idempotency key. Web and API mutation flags both remain off until the C5 staging rehearsal. On web rollback after custom awards exist, keep category-aware read capability and the C2 API/schema in place; returning to enum-only readers is unsafe.

The web award dialog refreshes categories once per opening, not on recipient
selection or changes to the server-action callback reference. Category reads use
the authenticated, organization-scoped list endpoint without repeating user
bootstrap. Refresh failures remain inline with an explicit retry and preserve
the award draft; the server logs failures with the request ID.

## C4 mobile compatibility

Implemented and locally verified September 27, 2026; Android device and currently supported old-binary checks remain pending. The upgraded app declares `categories-v1` on dashboard and activity reads even while category awards are disabled. Activity uses the category's fixed name, including archived custom categories, and dashboard summary parsing accepts category leaders and custom recent activity. Notification bodies already come from the C2 API's category name and need no native management screen or enum substitution.

`EXPO_PUBLIC_RECOGNITION_CATEGORIES_ENABLED` defaults to `false` in the mobile app. With the flag off, the legacy trait award flow remains available. When enabled in an EAS build or compatible update, the picker fetches organization-scoped categories for every active organization, excludes archived entries, and submits a `categories-v1` category ID with the existing retry key. An archive race keeps the recipient, amount, reason, and selected identity in the draft, refreshes categories, and requires a new available selection. The app does not expose Add or Archive controls.

The C4 rollout adds no database migration. EAS preview and production environments must set the new Expo public flag only during C5's controlled staging rehearsal and subsequent release decision; changing it requires a new build or update containing the changed public environment. Keep `RECOGNITION_CATEGORY_MUTATIONS_ENABLED=false` on the API until the staging rehearsal. To roll back mobile category awards, build with the mobile flag false while retaining the category-aware API readers and schema. Before wider enablement, verify in staging that an upgraded Android build can award and display archived/custom categories and that the currently supported old binary surfaces HTTP 426's update guidance without a parsing crash. A supported app-update path is a C5 prerequisite.

## C5 release rehearsal — prepared, not enabled

The category-aware web and mobile readers advertise `categories-v1` even with their award/management flags off. This is required for rollback after custom awards exist. Web and API writes remain disabled by default. Rollout is environment-wide, beta first and production afterward: set `RECOGNITION_CATEGORY_MUTATIONS_ENABLED=true` on the Railway API, `RECOGNITION_CATEGORIES_WEB_ENABLED=true` on Railway web, and `EXPO_PUBLIC_RECOGNITION_CATEGORIES_ENABLED=true` in the matching EAS Environment. Redeploy API/web and deliver a mobile build or compatible update containing the new value. No organization-ID list is required. Remove obsolete category rollout ID-list settings from Railway and EAS; they are no longer read. Existing tenant scoping and owner-only category management remain unchanged.

Before the staging rehearsal, record the `develop` commit, staging API/web deployment IDs, candidate Android APK build ID and app version, and the APK/build ID of the oldest currently supported Android binary. Confirm which app-update route that older binary offers. Use a dedicated staging owner, awarder, recipient, and organization; preserve the category IDs and award IDs in the evidence record. Do not use a production organization for the rehearsal.

1. During a scoring-write maintenance window, deploy migrations `20260927020000_recognition_categories` and `20260927030000_recognition_category_api` to staging. The first takes access-exclusive locks with a five-second lock timeout. If lock acquisition fails, retry in another window; do not force it during live scoring traffic. Deploy the category-capable API with `RECOGNITION_CATEGORY_MUTATIONS_ENABLED=false`, then web and Android clients with their category write flags false. Confirm legacy awards, activity, dashboard, and notifications still work.
2. Record before/after award count and sum of `delta` for the controlled organization. Verify every existing award has a category ID, every legacy-trait award points to the same seeded category's `legacyTrait`, there are 20 seeded category mappings, and `SELECT backfill_recognition_categories()` changes zero rows on a repeat run. Check the migration table for both migration names and no failed migration. Save sanitized query output and deployment links; never put database credentials in the evidence record.
3. Install the candidate Android APK and the supported old APK on separate devices or emulator instances. Confirm the candidate can display existing activity. Enable `RECOGNITION_CATEGORY_MUTATIONS_ENABLED=true` on the **staging API**, `RECOGNITION_CATEGORIES_WEB_ENABLED=true` on the **staging web service**, and `EXPO_PUBLIC_RECOGNITION_CATEGORIES_ENABLED=true` in the EAS **preview** Environment. Build a new preview APK with that value; changing an Expo public variable does not change an already installed binary. Confirm a second staging organization also sees the category picker while its categories and awards remain isolated from the first organization.
4. Dispatch `Staging E2E` with `category_rehearsal=true`. It exercises owner Add → award → Archive → reuse-name and checks the original activity label. Run the normal web smoke against the enabled site as well. Create a distinct active custom category for mobile, set the staging GitHub Environment secret or variable `MOBILE_E2E_CATEGORY_NAME` to its exact name (the secret takes precedence if both exist), then dispatch `Mobile Staging E2E` with `recognition_mode=categories` and the new APK URL. The flow awards that category and checks its activity label. Archive it on web; on the upgraded Android device, reload activity and confirm the historical fixed label remains and the category disappears from the picker. Confirm the summary/report group retains the original category ID after adding another category with the same name. Leave seeded legacy categories active so old clients can still submit their mapped trait awards during rollback.
5. With custom award data present, open the old APK and record the actual dashboard/activity behavior when the API returns `RECOGNITION_CATEGORY_CLIENT_UPGRADE_REQUIRED` (HTTP 426). Its update guidance must be understandable and actionable, without a parsing crash. Record the supported-version decision and the working update path before any wider enablement. Also verify category notifications use the fixed name and that another organization cannot read, award, archive, or reuse the controlled organization's category IDs.
6. Rehearse rollback on staging: turn the API mutation and web management flags off, and build or publish a compatible mobile update with category awards off. Confirm custom-category activity, summaries, notifications, and reports remain readable in upgraded clients, while new custom writes are blocked. Do **not** roll back the additive migrations or category-capable API/readers after custom data exists. Old binaries may continue receiving HTTP 426 until users update.

`Staging E2E` uses the `staging` GitHub Environment secrets `E2E_BASE_URL`, `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`, `E2E_TARGET_MEMBER`, and `E2E_ORG_SLUG` (plus the existing normal smoke credentials). Set the optional `E2E_RECOGNITION_CATEGORY_NAME` variable if the standard award smoke should select a non-seeded active category. `Mobile Staging E2E` needs its existing APK URL and account/member secrets plus `MOBILE_E2E_CATEGORY_NAME` for category mode. The scheduled mobile workflow reads `MOBILE_E2E_RECOGNITION_MODE` from the staging Environment; set it to `categories` only while the scheduled APK points to a category-enabled build, otherwise leave it `legacy`.

Completion evidence: migration/query results and unchanged totals; linked web and mobile E2E runs; candidate and old APK identifiers; device screenshots for active, archived, and HTTP 426 states; category/award IDs proving same-name history stays separate; notification and cross-organization checks; and a successful staging rollback rehearsal. None of these live results has been recorded yet. After beta verification and a supported client-version decision, enable the same three flags in production and deliver a production mobile build or compatible update using the production EAS Environment.

## Confirmed direction — September 20, 2026

- New organizations receive their own initial categories matching the current default trait set.
- Category management is scoped to organization owners. Owners can add categories and remove them from future award selection.
- Use **Archive** for removal: retain the category record and its existing award references; do not hard-delete it.
- Archived categories are absent from the award picker and cannot be used for new awards, but remain visible on past awards and in reports wherever they were used. Archiving never changes scores.
- Seeding runs during organization creation (and migration for existing organizations), not on every read; it must not recreate categories an owner archived.

Owners have only Add and Archive actions. Names are fixed after creation; changing a category means archiving it and adding a new one with a separate identity. Rename, other in-place editing, reordering, and restoration are outside this release. The remaining validation and implementation recommendations below are not yet approved.

## Experience

Owners open Manage > Recognition to see active and archived categories. Admins can inspect this configuration with editing disabled. Members select from active categories in the award flow.

Owners can add a category with a name and optional description, or archive a category. Name and description are fixed at creation. Start each existing/new organization with categories matching the current trait list so existing behavior is recognizable. A short description explains the behavior being recognized.

Recommended input limits: trimmed names of 2-60 characters and descriptions up to 240 characters. Archived-name reuse approved September 20, 2026: owners may create a new category using an archived category's name. It receives a separate identity, does not inherit earlier awards, and is not a restoration. Reports distinguish the archived and replacement categories instead of merging them. Proposed implementation: active names are unique within the organization after case/whitespace normalization, enforced in the database. Label archived entries clearly and distinguish repeated archived names with creation/archive dates where needed. Approved September 20, 2026: at least one category must remain active. Reject archival of the final active category with: "Add another category before archiving this one." Enforce this on the API and serialize concurrent archives so two requests cannot jointly remove the last available categories. Final category-count limits are a capacity decision before implementation.

One award selects exactly one active category. Keep the existing award point range for this release. Category weights, automatic point amounts, and multiple-category awards are separate product decisions.

Archiving prevents new awards but preserves history, filters, and reporting. If a category becomes unavailable while the award form is open, retain the draft and ask for a new selection. Do not silently replace it.

## Identity and historical meaning

Proposed `RecognitionCategory` fields: ID, organization ID, name, normalized name, description, archived timestamp, legacy trait mapping where applicable, creator/archiver IDs, and timestamps. Use deterministic name/ID ordering without owner-managed reordering. There is no product hard-delete operation.

Add a category ID to awards; deductions have none. Because category names are immutable and category records are retained, historical wording can be read from the referenced category without a separate award-time name snapshot. Validate category ownership and availability inside the write transaction and coordinate with archive operations.

Reports group by stable category ID and display its fixed name, including archived categories. A replacement is a separate category; never merge old awards into it automatically, even if the names match.

House and person names continue to use current display/anonymized names for this release. The design preserves attribution and category wording, not a full immutable identity snapshot.

## API and audit

Provide typed list/create/archive operations only. Derive organization from actor context. Return all categories to authorized reporting/management reads and only eligible categories to award selection. Create retries are idempotent; repeated archive requests return the existing archived state.

Award input evolves from `trait` to `categoryId`. Keep old and new request forms explicitly discriminated during migration; reject ambiguous payloads. Proposed error cases: category unavailable, cross-org/unknown category, duplicate name, last active category, and client upgrade required. Do not expose another organization's category existence.

Audit category creation and archival with actor, category ID, and before/after state. Archiving does not regenerate old notifications or alter ledger entries.

## Delivery scope

Approved September 20, 2026 (D9): owner category management ships on web first. Mobile custom-category selection and historical labels ship alongside the backend changes; native category management is deferred.

## Migration and compatibility

1. Add new tables/nullable columns; seed one mapped category per legacy trait per organization. Make backfill repeatable and validate tenant ownership.
2. Backfill award category IDs from legacy traits, preserving the current trait labels on the seeded categories. Verify counts and point totals before/after. Investigate any missing award trait rather than guessing its meaning.
3. Deploy compatible API readers/writers and both clients. Legacy award writes map their enum to the organization's seeded category; archived mapped categories still reject writes.
4. Keep existing strict response contracts intact until compatible clients exist. A custom category cannot safely be fabricated as a legacy trait. Use an explicit API/client capability boundary; unsupported clients receive a recoverable upgrade-required response before requesting incompatible data. Test the actual old mobile binary's handling and establish a supported-version path before enabling custom categories.
5. Enable owner customization only after that compatibility gate. Retain legacy columns until supported-client policy and rollout evidence permit removal.

Rollback can disable new category management and new-client feature exposure. Once custom-category awards exist, rolling back to an enum-only reader is unsafe. Database and reader compatibility must remain in place.

## Acceptance

- Owner-only writes and cross-org IDs are covered by API tests; admin/member controls reflect access.
- No rename/edit/restore operation is exposed; archive-and-add preserves earlier awards under the original category and leaves totals unchanged.
- Reusing an archived name creates a new category ID. Awards and report filters retain their original IDs; matching names never merge historical totals.
- Archiving the final active category is rejected with the agreed guidance. Concurrent archive requests cannot leave the organization without an active category.
- Award retries create one ledger entry; archiving during submission produces a consistent result.
- Existing and upgraded clients follow the documented compatibility matrix without response parsing crashes.
- Award pickers, activity, reactions, notifications, reports, and season recaps use the same category identity.
