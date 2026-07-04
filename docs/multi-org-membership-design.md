# Multi-Org Membership Design

## Purpose

HousePoints currently models organization membership directly on `User` with `organizationId`, `role`, and `houseId`. That works for the first production shape, but it blocks users from belonging to more than one organization and makes future organization archive/delete behavior riskier than it needs to be.

The goal of this design is to move organization-specific state into an explicit membership record while preserving the current single-active-organization user experience during the migration.

## Current State

Current `User` organization fields:

- `organizationId`
- `role`
- `houseId`

Current actor resolution:

- `AuthIdentity.providerSubject` resolves to a global `User`.
- `getActorBySub` returns a single organization context.
- `requireActor`, `requireAdminActor`, and `requireOwnerActor` assume one active organization.

Current product behavior:

- A user can belong to zero or one organization.
- Invites fail with `ALREADY_IN_ORG` if the user already belongs to another organization.
- Removing a user from an org clears org-scoped fields on the global `User` row.
- House theme preference is global on `User`, even though the house color is organization-scoped.

## Target Model

Add `OrganizationMembership`:

```prisma
model OrganizationMembership {
  id             String       @id @default(cuid())
  organizationId String
  userId         String
  role           Role         @default(MEMBER)
  houseId        String?
  isActive       Boolean      @default(true)
  archivedAt     DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  user           User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  house          House?       @relation(fields: [houseId], references: [id], onDelete: Restrict)

  @@unique([organizationId, userId])
  @@index([userId, archivedAt])
  @@index([organizationId, role])
  @@index([organizationId, houseId])
}
```

Eventually:

- `User` owns global identity and profile state.
- `OrganizationMembership` owns organization role, house assignment, and membership lifecycle.
- Organization removal archives a membership, not the global user.
- User-facing reads operate against an active membership.

## Relationship Rules

- A user can have many memberships.
- A user can have at most one membership per organization.
- A membership can be active or archived.
- `houseId` must belong to the membership's organization. This cannot be fully expressed as a simple Prisma relation today; enforce it in service code and integration tests.
- An organization should always have at least one active owner.
- Owner transfer changes membership roles inside one organization.
- Admin promotion/demotion changes membership role, not global user role.
- Invite joining creates or reactivates a membership for the invite organization.

## Active Organization Selection

The first multi-org version should keep the current app experience: one active organization at a time.

Recommended approach:

1. Use URL slug context as the active organization when navigating `/o/{slug}`.
2. Validate that the signed-in user has an active membership in the requested organization.
3. If the route is `/`, redirect to the user's preferred or most recent organization.
4. Add explicit org switching later after multiple memberships exist in real use.

Potential active-org storage:

- `User.lastActiveOrganizationId`
- or a web session value
- or URL-only selection for the first slice

Recommended first slice: URL-only plus current fallback behavior. Add persisted preference only when an org switcher exists.

## Actor Shape

Replace single-org actor state with membership-scoped actor state:

```ts
type ActorRecord = {
  id: string;
  auth0Sub: string;
  displayName: string;
  membershipId: string;
  role: UserRole;
  houseId: string | null;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};
```

The type can remain named `ActorRecord`, but `membershipId` must become part of it before code switches from legacy `User` fields.

New helpers likely needed:

- `getUserBySub(auth0Sub)` - resolves global user only.
- `getActorBySub(auth0Sub)` - temporary compatibility helper using the user's current single membership.
- `getActorBySubForOrganization(auth0Sub, organizationId | slug)` - resolves membership-scoped actor for slug routes and invite contexts.
- `getUserOrgContextsBySub(auth0Sub)` - returns all active memberships for org switching and blocked-route messaging.

## Migration Strategy

Do this in safe, reversible slices.

### Phase 1 - Add Membership Table And Backfill

Status: implemented.

Schema:

- Add `OrganizationMembership`.
- Add relations from `User`, `Organization`, and `House`.
- Keep `User.organizationId`, `User.role`, and `User.houseId`.

Data migration:

- For every user with `organizationId`, create one membership.
- Copy `User.role` to `OrganizationMembership.role`.
- Copy `User.houseId` to `OrganizationMembership.houseId`.
- Do not change existing reads yet.

Verification:

- Migration backfills one active membership for every existing user with an organization.
- Integration tests cover membership creation, uniqueness by organization/user, and unassigned memberships.
- Contract tests do not need to change because application response shapes are unchanged.

### Phase 2 - Dual-Read Actor Resolution

Status: implemented. Actor resolution now uses the active membership fallback path even when the legacy current-org shadow is empty or stale.

- Update `getActorBySub` to prefer `OrganizationMembership` when it exists.
- Fall back to legacy fields for safety.
- Add `membershipId` to `ActorRecord`.
- Keep response contracts unchanged.

This gives the API a membership-aware identity boundary without changing UI behavior.

### Phase 3 - Move Admin And Member Reads To Memberships

Status: complete. `/members` and `/admin/context` now read active membership rows for user role and house assignment while preserving the existing response shapes. Notification recipient fanout now reads active membership rows for admin/owner and org-wide announcements. Dashboard summary, house leaderboard member counts, season comparison contributor names, point award/deduction target validation, deduction house cooldown checks, and Team management candidate lists now use active memberships for org-scoped member reads. Invite activity remains org-scoped through `OrgInvite`, `AuditEvent`, and invite count queries.

Update reads that currently query `User.organizationId`:

- `/members` - implemented.
- admin context user lists - implemented.
- notification recipient lookups for admins/owners - implemented.
- dashboard summary member rankings - implemented.
- house leaderboard member counts - implemented.
- season comparison contributor names - implemented.
- point award/deduction target validation - implemented.
- deduction house cooldown checks - implemented.
- invite activity and role-management candidate lists - implemented.

Response shape can stay the same:

- user id
- display name
- membership role
- membership house assignment
- house metadata

### Phase 4 - Move Membership Mutations

Status: in progress. Invite preview now determines membership status from active memberships instead of legacy current-org shadows, and dashboard route-context now uses active memberships without legacy current-org fallback. Create org now creates an owner membership, no longer blocks users who already belong to another organization, and reloads the user after membership writes so the response includes current membership contexts. Invite join now creates or reactivates a membership for the invite organization instead of blocking users who belong to another organization, then reloads the user after membership writes so the response includes current membership contexts. House assignment now validates the target user through active membership and updates only `OrganizationMembership.houseId`. Admin promotion/demotion and ownership transfer now validate targets through active membership, update `OrganizationMembership.role`, and shadow-write legacy `User.role`. Member removal now archives the active membership and shadow-clears legacy user org fields.

Update workflows:

- Create org: create global user if needed, then create owner membership - implemented with legacy current-org shadow write and post-membership response reload.
- Join org: allow joining another org by creating or reactivating membership instead of returning `ALREADY_IN_ORG` - implemented with legacy current-org shadow write and post-membership response reload.
- Assign house: update membership `houseId` - implemented without legacy `User.houseId` shadow write.
- Promote/demote: update membership `role` - implemented with legacy `User.role` shadow write.
- Transfer ownership: update membership roles - implemented with legacy `User.role` shadow writes.
- Remove member: archive membership and archive relevant notifications - implemented with legacy `User` org-field shadow clear.

At the end of this phase, `User.organizationId`, `User.role`, and `User.houseId` are legacy shadows only.

### Phase 5 - Web Active Org UX

Status: complete for the first multi-org UX slice. Bootstrap responses and the web session summary now include active organization membership contexts while keeping the existing current-org fields for compatibility during the migration. Bootstrap organization contexts mark the first active membership as current without consulting the legacy current-org shadow, and bootstrap top-level role/org/house fields now derive from active memberships. When active memberships exist, app-user mapping no longer adds stale legacy org context or falls back to legacy role/org/house values; when no active memberships exist, app-user mapping now returns an empty org context instead of reviving legacy shadows. The API now centralizes the preferred-membership selection rule so actor resolution and app-user mapping both use the first active membership unless a slug-scoped request resolves a specific membership. The web session summary derives active organization, role, and house fields from that membership context. Web admin authorization and admin context reads now resolve the active membership before checking role/org fields. Route org-context fallback now prefers active memberships before legacy current-org fields. The account menu now exposes a URL-based organization switcher when the user belongs to more than one active organization. The web stores the selected org slug in an HTTP-only cookie through a switch route and forwards it to the API, where actor resolution validates the user has an active membership for that slug before scoping reads or mutations. The root route redirects assigned users to their selected scoped `/o/{slug}` dashboard using the resolved session organization before membership or legacy fallbacks.

- Add org membership context to bootstrap/profile responses - bootstrap, session summary, and profile update responses now return active membership context plus top-level compatibility fields.
- Keep `/o/{slug}` as the canonical dashboard path.
- Add an org switcher only after the backend supports active memberships reliably - account-menu switcher persists the selected slug before navigating to `/o/{slug}`.
- Decide whether `/` redirects to the last active org or the first active membership - root redirects now prefer the selected session organization, then the current active membership, then the first active membership.

### Phase 6 - Remove Legacy User Org Fields

Only after production has run safely with membership reads/writes:

- remove `User.organizationId`;
- remove `User.role`;
- remove `User.houseId`;
- update contracts to stop exposing legacy global role/org/house fields except through active membership context;
- remove fallback paths from actor resolution - scoped and default actor resolution now require active memberships, default preferred membership selection no longer consults legacy current-org shadows, app-user mapping no longer falls back to legacy org/role/house shadows, house assignment no longer writes legacy `User.houseId`, and org-context helpers no longer select legacy org shadow fields.

## Endpoint Behavior Changes

### Organization Creation

Current:

- Fails if existing user already has an organization.

Target:

- Allow creating a new organization even when the user belongs to another organization.
- Create owner membership in the new organization.
- Do not mutate other memberships.

### Invite Preview

Current:

- `NONE`, `SAME_ORG`, or `OTHER_ORG` based on one `User.organizationId`.

Target:

- `NONE` - user has no active memberships.
- `SAME_ORG` - user already has active membership in invite org.
- `OTHER_ORG` - user has active membership in another org; this no longer blocks joining, but can be used for copy such as "You also belong to ...".
- Archived membership in invite org can be reactivated if product policy allows it.

Status: implemented for active memberships; stale legacy current-org shadows no longer affect invite preview membership status.

### Invite Join

Current:

- Blocks users already in another org.

Target:

- Creates membership for invite org if none exists.
- If archived membership exists, either reactivate it or return a stable `MEMBERSHIP_ARCHIVED` error. Recommended first behavior: reactivate only if the invite is valid.
- Keeps invite single-use semantics.

### Dashboard Slug Routes

Current:

- Route-context checks one actor org against the requested slug.

Target:

- Route-context checks active membership for requested slug - implemented without legacy current-org fallback.
- If the user lacks membership, show blocked state.
- If the slug is an alias for an organization where the user has membership, redirect to current slug.

## Data Ownership After Migration

Global `User`:

- auth identity links
- email
- display name
- global profile preferences that truly cross organizations

Membership:

- role
- house assignment
- active/archive state
- joined date
- removed date

Possibly membership-scoped later:

- house theme enabled
- notification preferences
- default landing tab

## Soft Delete And Archive Implications

Multi-org unlocks safer organization archive behavior:

- Removing a user from an organization archives one membership.
- Organization archive can archive memberships while preserving users.
- Audit, points, seasons, houses, and notifications remain organization-scoped historical records.
- Future hard delete can become an operator-only retention policy, not a product workflow.

## Risks

- Query drift: some reads may accidentally continue using `User.organizationId`.
- Role bugs: owner/admin checks must use membership role only.
- House assignment bugs: `houseId` must be validated against membership organization.
- Notification fanout bugs: admin/owner recipient lookups must use membership role.
- Contract churn: web currently expects active org fields directly on `AppUser`.

## First Implementation Slice

First code slice:

1. Add `OrganizationMembership` schema and migration.
2. Backfill memberships from existing user org fields.
3. Add integration checks for backfill and uniqueness.
4. Do not change application reads yet.
5. Update docs and leave quality gates green.

Status: implemented. This creates the new table with no intended application behavior change, which is the safest foundation for the larger migration.
