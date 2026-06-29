# Organization Settings Design

Product and engineering notes for organization-level settings that sit above houses, members, seasons, and point activity.

---

## Current State

Organizations already have two user-facing identifiers:

- `name`: mutable display name shown in Manage Settings.
- `slug`: unique URL-safe identifier collected during organization creation.

The first settings slice is implemented:

- Owners can rename the organization display name from Manage Settings.
- Owners can change the organization slug from a separate confirmed Manage Settings form.
- The API derives the organization from the authenticated actor; the client does not submit an organization id.
- Display-name and slug changes are audited as `ORG_SETTINGS_UPDATED`.
- Old slugs stay reserved through `OrganizationSlugAlias`.
- New invites return a slug-bearing join path while the token remains the one-time secure credential.

Today, the slug is mostly identity metadata. It is stored uniquely, returned in app/user/admin context, shown in Settings, used during organization creation to prevent duplicates, and included in newly generated invite links. Invite joining is based on single-use token hashes and the invite's `organizationId`; slugged invite routes provide context and canonical redirects but do not replace token authority. The app does not currently route dashboards by `/:orgSlug`. The recommended dashboard route behavior is captured in [Dashboard Slug Routes Design](./dashboard-slug-routes-design.md).

Product direction has shifted toward making the slug more visible in URLs and invite links. That means slug history should be treated as durable routing metadata before the app exposes slug-based entry points.

---

## Product Direction

Owners own organization-level configuration. Admins run day-to-day operations such as points, members, invites, and assignment.

That means organization slug changes should stay owner-only. They are more sensitive than changing the display name because slugs can become part of future links, discovery, invite policy, or organization switching.

Implemented product behavior:

- Keep the slug visible in Manage Settings so owners understand the organization identifier.
- Allow slug changes only after an explicit owner action, not inline with the display-name form.
- Treat slug changes as rare administrative events with audit history.
- Do not let admins or members change the slug.
- Reserve old slugs for the original organization once slugs appear in URLs or invite links.

---

## Slug Change Risk

Changing a slug is low-risk in the current app shape because:

- Dashboard routes are not slug-based.
- Invite tokens are not slug-scoped in the URL or join payload.
- Membership, points, houses, seasons, and audit records all reference `organizationId`.

Changing a slug becomes higher-risk if we later add:

- Public org URLs such as `/orgs/acme`.
- Invite links that include the slug.
- Org discovery by slug.
- Multi-org switching with slug-based deep links.
- External documentation or shared bookmarks that reference the slug.

The design should preserve today's safety while avoiding a future trap where old links silently break.

---

## Recommended MVP

Because slugs are intended to become visible in URLs and invite links, the MVP includes slug alias/reservation before enabling slug-based links. That keeps the first public slug experience from creating broken links or accidental slug takeovers later.

Behavior:

- Backfill an alias/reservation row for every existing organization's current slug. Implemented.
- Owner opens a dedicated "Change organization slug" control. Implemented.
- Form requires the new slug and confirmation of the current slug. Implemented.
- Server validates with the existing shared slug rules: lowercase letters, numbers, hyphens, no leading/trailing hyphen, length limits.
- Server checks uniqueness against both current organization slugs and reserved slug aliases.
- Server derives `organizationId` from the actor and updates only that organization.
- Server keeps the previous slug reserved for the same organization.
- Server writes an audit event with previous and new slug metadata.
- Existing invite tokens remain valid because invite consumption is token-hash based.
- New invite copy displays a slug-bearing URL while still using the single-use token as the secure join credential. Implemented.
- UI revalidates the dashboard/settings view so the new slug is displayed immediately.

Expected failure codes:

| Code | Meaning |
|---|---|
| `OWNER_REQUIRED` | Actor is authenticated but not an owner. |
| `VALIDATION_ERROR` | Body does not match the contract. |
| `SLUG_INVALID` | Slug fails the shared slug rules. |
| `SLUG_TAKEN` | Another organization already owns the slug. |
| `SLUG_UNCHANGED` | Submitted slug matches the current slug. |
| `ORG_NOT_FOUND` | Actor organization no longer exists. |

Audit:

- MVP can reuse `ORG_SETTINGS_UPDATED` with metadata `{ field: "slug", previousSlug, newSlug }`.
- If filtering by slug changes becomes important, add a dedicated `ORG_SLUG_CHANGED` audit event.

---

## Slug Alias Model

Add a reservation or alias model before slugs become public URL or invite-link keys.

Recommended model:

```prisma
model OrganizationSlugAlias {
  id             String       @id @default(cuid())
  organizationId String
  slug           String       @unique
  createdAt      DateTime     @default(now())
  isPrimary      Boolean      @default(false)
  retiredAt      DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}
```

Usage:

- Backfill each existing `Organization.slug` as `isPrimary = true`.
- On slug change, keep the old slug as an alias for the same organization.
- Mark the new slug as primary and retire the old primary row without releasing it to other organizations.
- Resolve slug-based routes through aliases so old links still identify the correct organization.
- Redirect old slug URLs to the current slug for canonical display.
- Keep old slugs reserved indefinitely unless an owner-facing release policy is explicitly designed later.

This prevents a different organization from claiming an old slug and receiving traffic, invite attempts, or user confusion meant for the original organization.

`Organization.slug` can remain the fast current-slug column for common reads. The alias table becomes the historical routing and reservation source of truth.

---

## Slug-Based URLs And Invites

Recommended URL shape:

| Use | Shape | Notes |
|---|---|---|
| Organization landing/dashboard | `/o/{slug}` | Specified in [Dashboard Slug Routes Design](./dashboard-slug-routes-design.md); not implemented yet. |
| Invite link | `/o/{slug}/join/{token}` | Slug is context and user trust; token remains the secret credential. |
| Old slug redirect | `/o/{oldSlug}` -> `/o/{currentSlug}` | Uses alias lookup. |

Security notes:

- The token remains the only authority to join an organization.
- The slug in an invite URL should be validated against the invite's organization for clearer errors, but it should not replace token-hash lookup.
- A valid token with an old slug alias can redirect or continue as long as the token belongs to the same organization.
- Raw tokens should still never be logged.

---

## Non-Goals

This design does not include:

- Organization deletion or archival.
- Ownership transfer.
- Multi-org membership.
- Public org discovery.
- Domain allow-list joining.

Those should each get their own small design pass before implementation.

---

## Test Plan

API and contract tests:

- Existing organization slugs are backfilled into aliases.
- Contract accepts valid slug payloads and rejects invalid ones.
- Owner can change their organization slug.
- Admin/member cannot change slug.
- Duplicate slug returns `SLUG_TAKEN`.
- Reserved old slug returns `SLUG_TAKEN`.
- Same slug returns a stable expected failure.
- Successful change writes audit metadata with previous and new slug.
- The endpoint never accepts `organizationId` from the client.
- Slug resolution returns the organization for current and old aliases.
- Old slug routes redirect to the current slug once slug routes exist.

Web tests:

- Settings shows the current slug.
- Owner can open the slug-change form and submit a valid change.
- Expected failures show safe toast messages.
- Non-owner users do not get an enabled slug-change action.

Integration/regression checks:

- Existing invite token can still be consumed after the organization slug changes.
- Slug-bearing invite URL works when the URL slug is current.
- Slug-bearing invite URL with an old alias still resolves to the correct organization or redirects safely.
- `readAdminContext` and current-user/bootstrap responses return the new slug after the mutation.

---

## Phase Status

Slugs are intended to become visible in URLs and invites, so the work starts with reservation safety before public route changes.

Suggested order:

1. Add `OrganizationSlugAlias`, backfill current slugs, and add a shared slug resolver. Implemented.
2. Add owner-only slug change using the existing `Organization.slug` field plus alias reservation checks. Implemented.
3. Update invite generation to present slug-bearing invite URLs while keeping token-hash join security. Implemented.
4. Add slug-based landing/join routes that resolve aliases and redirect old slugs to the current slug. Implemented for invite join links.
5. Add slug-based dashboard routes at `/o/{slug}`. Specified in [Dashboard Slug Routes Design](./dashboard-slug-routes-design.md); implementation remains future work.
