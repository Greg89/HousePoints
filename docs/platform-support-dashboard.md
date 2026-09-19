# Platform Support Dashboard

## Purpose

The platform support dashboard is the private operator surface for the HousePoints service. It is distinct from organization Manage: organization owners control one organization, while platform operators control service capacity, investigate support issues, moderate reported content, and protect the platform.

The dashboard is web-only. It lives at `/platform`, is never authorized by an organization role, and all API operations independently verify a platform role.

## Principles

- Default to read-only visibility; require explicit confirmation for mutations.
- Keep Railway environment values as hard safety ceilings.
- Never provide unrestricted user impersonation.
- Record every platform mutation in an immutable platform audit trail.
- Preserve organization scoping when inspecting product data.
- Prefer suspension or archive over deletion.
- Return only the minimum support data needed by the operator UI.

## Roles

| Role | Intended access |
| --- | --- |
| `SUPPORT` | Read organizations/users, diagnose invitations and device registrations, manage support cases. |
| `PLATFORM_ADMIN` | Support access plus moderation, account-deletion processing, and organization suspension. |
| `PLATFORM_OWNER` | All access, capacity settings, platform-role management, and destructive approvals. |

Slice 1 bootstraps `PLATFORM_OWNER` with the Railway `PLATFORM_OWNER_AUTH0_SUBS` allowlist. Database-backed role assignments and role administration are deferred until there is a second operator.

## Information architecture

### Overview

- Active, archived, and total organizations.
- Active members and recent platform activity.
- Organization capacity and registration state.
- Pending moderation, deletion, and support work.
- API, database, notification, and release health.
- Cost signals and threshold warnings.

### Organizations

- Search by name or slug.
- Status, creation date, member/owner counts, current season, last point activity, and device count.
- Detail view with owners, recent audit history, usage signals, and support notes.
- Suspend/resume, archive/restore, revoke invitations, and contact owners.

### Users and support

- Search by email, display name, or Auth0 subject.
- Memberships, roles, devices, deletion state, and recent relevant audit events.
- Revoke devices/invitations and assist with verified ownership transfers.
- No unrestricted impersonation; future diagnostics may calculate effective permissions.

### Moderation

- Queues for reported activity and users.
- Evidence snapshot, reporter, organization, prior reports, status, resolution, and operator notes.
- Redact content, warn/suspend users, suspend organizations, or dismiss reports.

### Account deletion

- Pending requests, last-owner conflicts, deletion/anonymization plan, retained-data basis, completion status, and operator notes.

### Operations and releases

- Error and request trends, database growth, push failures, client versions, current releases, maintenance messaging, and upgrade requirements.
- External observability remains authoritative; the dashboard summarizes actionable signals and links to detailed systems.

## Capacity policy

Railway defines hard limits:

- `PUBLIC_ORGANIZATION_CREATION_ENABLED`
- `MAX_ACTIVE_ORGANIZATIONS`

The dashboard stores an operating registration switch and operating cap. The effective switch is open only when both Railway and dashboard settings are open. The effective cap is the lower of the Railway and dashboard caps. Operators therefore cannot use the dashboard to exceed the owner-approved infrastructure ceiling.

Archived organizations do not consume capacity. Creation and restoration take the same PostgreSQL transaction lock before evaluating capacity.

## Organization states

- `ACTIVE`: normal access.
- `SUSPENDED`: data retained; normal organization operations rejected with a typed response; operator can review and resume.
- `ARCHIVED`: hidden from normal membership context; restorable subject to capacity.

Suspension requires centralized enforcement in actor and route-context resolution and is intentionally deferred until Slice 2.

## Audit model

Platform audit events include actor Auth0 subject, event type, safe summary, structured metadata, and timestamp. Secrets, access tokens, raw invite tokens, and sensitive free text must not be recorded. Initial events cover capacity-setting changes; later events cover organization status, moderation, deletion, device revocation, and role administration.

## Delivery slices

### Slice 1 — operating core

- [x] Environment-allowlisted platform owner authorization.
- [x] Web-only `/platform` dashboard.
- [x] Overview and searchable organization inventory.
- [x] Persistent operating registration switch and organization cap.
- [x] Railway hard-ceiling enforcement.
- [x] Platform settings audit history.

### Slice 2 — organization support controls

- [x] Organization detail route with owners, usage counts, and organization audit history.
- [x] Centrally enforced suspension/resumption with typed member-facing state.
- [x] Platform archive/restore with confirmation, capacity enforcement, and audit.
- [x] Owner email contact links and outstanding-invite revocation.
- [x] Recent-error signals backed by bounded, durable application telemetry.

Suspension is enforced in shared actor resolution, requires a platform-owner confirmation and reason, and is recorded in the platform audit log. Platform archive and restore use the same explicit confirmation model; restore uses the shared capacity transaction lock. Invite revocation expires every outstanding link atomically and audits the affected count.

Authenticated browser errors are stored as organization-scoped aggregates keyed by a SHA-256 fingerprint. The support view shows up to 20 fingerprints seen in the last seven days and their occurrence counts. Only the error type, a bounded message, and URL pathname are retained; query strings, stack traces, user agents, tokens, and arbitrary metadata are excluded. External logs remain authoritative for deeper diagnosis.

### Slice 3 — user support and compliance

- [x] User search and effective-permission diagnostics.
- [ ] Device-registration and invitation support actions.
- [ ] Account-deletion work queue and completion evidence.
- [ ] Support cases and private operator notes.

The first Slice 3 increment is read-only. Platform owners can search by display name, email, primary Auth0 subject, or linked identity subject and inspect active devices, deletion-request state, every membership, organization lifecycle state, effective access, and role-derived capabilities. It deliberately provides no user impersonation or mutation controls.

### Slice 4 — moderation and operations

- [ ] User/content reporting and moderation queue.
- [ ] Redaction, warning, member suspension, and escalation policy.
- [ ] Release/client-version overview and maintenance messaging.
- [ ] Cost, database-growth, push-delivery, and error thresholds.

### Slice 5 — multi-operator governance

- [ ] Database-backed platform roles and role-management UI.
- [ ] Reauthentication for high-impact actions.
- [ ] Two-person approval for destructive platform operations.
- [ ] Audit export and retention controls.

## Acceptance criteria for Slice 1

- A non-allowlisted authenticated user receives `403 PLATFORM_OWNER_REQUIRED` from every platform endpoint.
- A platform owner can see capacity and organization inventory without changing active organization context.
- Dashboard settings cannot relax Railway hard limits.
- New effective settings are enforced by organization creation and restoration immediately.
- Every settings mutation creates a platform audit event in the same database transaction.
- Typecheck, API/web tests, production build, and touched-workspace lint pass.
