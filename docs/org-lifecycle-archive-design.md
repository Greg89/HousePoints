# Organization Lifecycle And Archive Design

Product and engineering plan for owner-controlled organization archival, restore, and future hard-delete policy.

---

## Goal

Give owners a safe way to remove an organization from day-to-day use without destroying historical records or global user accounts.

This is intentionally an archive-first design. "Delete organization" can be the user-facing phrase later, but the first production-grade behavior should preserve data, auditability, and recovery.

---

## Current State

Implemented:

- Users belong to organizations through `OrganizationMembership`.
- Role and house assignment are membership-scoped.
- Owners can rename org display name and slug.
- Owners can transfer ownership.
- Owners can promote/demote members and remove non-owner users from an organization.
- Removed members keep their global `User` row; only the org membership is archived.
- Audit history preserves org-scoped administrative events.
- `Organization.archivedAt` and `Organization.archivedById` are available for archive state.
- Normal actor/app-user resolution ignores memberships whose organization is archived.
- Owners can archive their active organization through `POST /admin/org/archive`; the API writes an `ORG_ARCHIVED` audit event.
- Archived `/o/{slug}` routes render an archived-state page for members instead of the dashboard.
- Owners can restore their archived organization from that page through `POST /admin/org/restore`; the API writes an `ORG_RESTORED` audit event and normal dashboard access resumes.
- The Manage Organization danger zone provides the owner-facing archive UI, and the archived state provides the owner-facing restore UI.

Not implemented:

- Hard delete.

---

## Product Rules

### Archive

Only an `OWNER` can archive an organization.

Archiving should:

- set the organization into an archived state;
- prevent normal dashboard access for that organization;
- prevent new point awards, deductions, invite creation, house edits, season changes, and member management;
- preserve all historical data;
- keep slug aliases reserved;
- keep existing memberships, points, seasons, houses, notifications, invites, and audit events for history;
- write a durable audit event.

Archiving should not:

- delete global users;
- delete memberships;
- delete point transactions;
- release slugs for reuse;
- remove the organization from backups or operator recovery.

### Restore

Only an active `OWNER` membership of the archived organization can restore it. The restore endpoint uses a dedicated archived-owner resolver because normal actor resolution intentionally excludes archived organizations.

Restore should:

- clear the archived state;
- re-enable dashboard access and normal org-scoped actions;
- preserve the same current slug and aliases;
- write a durable audit event.

Organization archive preserves memberships, so the owner remains recoverable. An operator path is still appropriate for exceptional data repair, but it is not required for the normal product workflow.

### Hard Delete

Hard delete is not a product workflow for the first slice.

Future hard delete should be:

- operator-only;
- retention-policy driven;
- blocked while legal, audit, billing, or support retention applies;
- implemented only after archive/restore has been running safely.

---

## Data Model

Recommended first schema fields on `Organization`:

```prisma
archivedAt   DateTime?
archivedById String?
archivedBy   User?     @relation("ArchivedOrganizations", fields: [archivedById], references: [id], onDelete: SetNull)
```

Optional later fields:

```prisma
archiveReason String?
restoredAt    DateTime?
restoredById  String?
```

For the first slice, `archivedAt` is enough for filtering and authorization. `archivedById` is useful for audit/recovery context but audit metadata can also carry the actor.

---

## API Behavior

Add owner-only endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /admin/org/archive` | Archive the actor's active organization. |
| `POST /admin/org/restore` | Restore an archived organization after resolving an active owner membership by authenticated subject and confirmed current slug. |

Expected failure codes:

| Code | Meaning |
|---|---|
| `OWNER_REQUIRED` | Actor is not an owner. |
| `ORG_NOT_FOUND` | Active organization cannot be resolved. |
| `ORG_ALREADY_ARCHIVED` | Archive requested for an archived org. |
| `ORG_NOT_ARCHIVED` | Restore requested for an active org. |
| `LAST_OWNER_REQUIRED` | Optional guard if restore/archive requires at least one active owner. |

Authorization rule:

- Actor resolution must not allow archived orgs for normal app actions.
- Archive/restore routes need explicit archived-org handling so restore does not become impossible.

---

## Web Behavior

Recommended first UI:

- Manage Settings gets a danger-zone card visible to owners. [done]
- The card says "Archive organization" rather than "Delete organization".
- Confirmation requires typing the current organization slug.
- Success redirects the user to an org switcher/onboarding state or a neutral archived confirmation page. [done]

Archived org access:

- `/o/{slug}` should show an archived-state page for members of the org.
- Members should not see dashboard tabs for archived orgs.
- Owners see a slug-confirmed restore action.
- Non-members should continue to get the current safe not-found/blocked behavior.

---

## Audit And Notifications

Add audit event types:

- `ORG_ARCHIVED`
- `ORG_RESTORED`

Audit metadata should include:

- organization id;
- organization name;
- organization slug;
- actor user id/name;
- archived/restored timestamp;
- optional reason.

Notifications are optional for the first slice. A later slice can notify all active members when an org is archived or restored.

---

## Rollout Plan

1. Add schema fields and audit event types. [done]
2. Update actor/org route resolution to consistently reject archived orgs for normal app actions. [done]
3. Add owner-only archive API with tests. [done]
4. Add archived-state web handling for `/o/{slug}`. [done]
5. Add Manage Settings danger-zone UI. [done]
6. Add owner restore API, archived-state UI, audit event, and tests. [done]
7. Leave hard delete as operator-only future work.

---

## Verification

API tests:

- Owner can archive their active org.
- Admin/member cannot archive.
- Archived org blocks point, invite, season, house, role, and member-management mutations.
- Archived org no longer appears as a normal active context.
- Archive writes audit.
- Slug aliases remain reserved.

Web tests:

- Owner sees archive danger-zone action.
- Admin/member do not see an enabled archive action.
- Confirmation requires slug.
- Archived org route shows archived state instead of dashboard.
- Owner sees the restore action on the archived state; admin/member do not.
- Restore confirmation requires the current slug and returns through the organization switch route.

Operational checks:

- Migration is additive for the first archive slice.
- No hard deletes are introduced.
- Existing production orgs default to active.

---

## Post-Ops Product Follow-Up

Implemented first slice:

**Allow an existing member of one organization to create another organization.**

Account now exposes a create-organization action for signed-in members, reuses the first-org setup form, and switches the user into the newly created organization after setup. Follow-up product hardening should define:

- how Account and the org switcher present the new org;
- whether owner onboarding should guide first-house setup differently for second orgs;
- how release notes and E2E smoke tests cover the multi-org create/switch flow.
