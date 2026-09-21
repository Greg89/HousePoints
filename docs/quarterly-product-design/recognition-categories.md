# Custom recognition categories

Status: category defaults, owner-only add/archive-only management, fixed names, archived-name reuse as a separate identity, and historical reporting approved September 20, 2026. Remaining validation and implementation details are proposed. See [shared decisions](./README.md#decision-register), especially D1 and D9.

## Current foundation

`packages/contracts/src/point-schemas.ts` defines a fixed `TRAITS` list and strict award input. `PointTransaction.trait` is a Prisma enum. Web/mobile pickers, activity labels, notification text, and trait-based reports depend on it. Existing awards have one trait; deductions have none.

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
