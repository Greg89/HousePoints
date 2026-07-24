# Manage Resource Workspaces Design

Product and implementation plan for evolving Manage from a collection of administrative forms into a consistent set of resource workspaces.

---

## Problem

Manage has a strong navigation foundation:

- Administrative tools are separated from the member-facing dashboard.
- Owner-only sections remain visible but disabled for admins.
- Each section has a focused purpose.

The content inside those sections has become less cohesive as capabilities have grown. Members, for example, presents assignment, invitations, display-name changes, removal, invite reporting, and activity as separate cards. Houses, Seasons, and Organization Settings similarly expose operations as adjacent forms.

This creates three product problems:

1. New capabilities look appended instead of belonging to a shared system.
2. Administrators must choose a tool before locating the resource they intend to manage.
3. Manage Overview is a point-adjustment report rather than an administrative overview, so it does not help an admin decide what to do next.

---

## Goals

- Make Manage feel like a coherent administration product rather than a form gallery.
- Organize sections around the resources an administrator manages.
- Give each workspace the same interaction hierarchy and visual language.
- Make common operations faster without making consequential actions easier to trigger accidentally.
- Turn Overview into an actionable administration home.
- Preserve the visible-but-disabled permission model.
- Allow the refactor to ship in small, independently useful slices.
- Reuse existing API behavior and server actions unless a workspace genuinely needs new data.

## Non-Goals

- Replacing the dashboard's top-level Manage tab.
- Changing the owner/admin authorization model.
- Hiding tools that an administrator cannot access.
- Redesigning member-facing Overview, Leaderboard, or Activity.
- Adding bulk mutation operations in the initial refactor.
- Replacing the full audit history with a second activity system.
- Introducing hard deletes for organization data.

---

## Product Principles

### Resources before operations

The default view in a resource workspace should show the resources that exist. The user locates a member, house, or season first and then sees the operations available for that record.

### One clear primary action

Each workspace header has at most one primary action:

| Workspace | Primary action |
|---|---|
| Members | Invite member |
| Houses | Create house |
| Seasons | Start next season |
| Organization | Save organization details, shown in context rather than as a global header action |
| Audit | None |

Secondary operations belong in record details, an overflow menu, or a clearly named subsection.

### Progressive disclosure

Editing controls should not occupy the page until the user chooses to create or edit something. Use a drawer on wider screens and a full-screen sheet on narrow screens for record details. Use a confirmation dialog for consequential mutations.

### Consistent hierarchy

Every workspace uses the same order:

1. Workspace header and description.
2. Primary action and relevant filters.
3. Resource list, status content, or report.
4. Selected-resource details.
5. Destructive controls at the end of the relevant detail view.

Avoid using nested bordered cards as the default layout. Reserve cards for status summaries, warnings, empty states, and distinct resource previews.

### Permissions remain understandable

Owner-only workspaces remain in the navigation for admins with disabled styling and an `Owner only` explanation. Within a workspace shared by owners and admins, record actions that require ownership remain visible but disabled with an explanation.

Server-side authorization remains authoritative. Disabled UI is guidance, not enforcement.

---

## Target Information Architecture

The target navigation is:

1. **Overview**
2. **Members**
3. **Houses**
4. **Seasons**
5. **Organization**
6. **Audit**

Changes from the current navigation:

- **Roles** moves into Members because role is part of a member's organization membership.
- **Settings** becomes **Organization** to describe the resource rather than the UI mechanism.
- Point-adjustment reporting moves from Overview to Audit as an activity/reporting view.

### Permission Matrix

| Workspace or action | Admin | Owner |
|---|---:|---:|
| View Manage Overview | Yes | Yes |
| Invite members | Yes | Yes |
| Edit member display name | Yes | Yes |
| Assign member to a house | Yes | Yes |
| Remove ordinary member | Visible, disabled | Yes |
| Change admin roles | Visible, disabled | Yes |
| View Houses | Visible, disabled | Yes |
| Create or edit a house | Visible, disabled | Yes |
| View Seasons | Visible, disabled | Yes |
| Start or rename a season | Visible, disabled | Yes |
| View Organization | Visible, disabled | Yes |
| Change organization identity or ownership | Visible, disabled | Yes |
| View Audit | Yes | Yes |

This matrix describes the intended UX and must remain aligned with API authorization.

---

## Shared Workspace Shell

The existing desktop sidebar and mobile picker remain. The content area gains a shared workspace shell with:

- A consistent title and one-sentence description.
- An optional count or compact status beside the title.
- A primary-action slot.
- An optional filter/search row.
- A main content region with standardized loading, empty, and error states.

The current persistent metric strip should be removed from every Manage section. Metrics that help the user decide what to do belong on Overview; contextual counts belong in their relevant workspace header or filters.

### URL and navigation state

Manage sections should become deep-linkable through the dashboard URL, for example:

- `/o/{slug}?tab=manage&manage=members`
- `/o/{slug}?tab=manage&manage=houses`

Optional filters may use additional query parameters when a link from Overview needs to open a meaningful state, such as `memberStatus=unassigned`.

Requirements:

- Refreshing preserves the selected workspace.
- Browser back/forward traverses workspace changes.
- An invalid or unauthorized workspace falls back to the first accessible workspace without enabling restricted content.
- A detail drawer does not need a URL in the first implementation, but the design should not prevent adding record deep links later.

---

## Overview Workspace

### Purpose

Overview answers:

> What needs administrative attention, and what is the current operating state of this organization?

It is not a general analytics page and should not duplicate the member-facing dashboard.

### Content order

#### 1. Needs attention

Render actionable items derived from current organization data. Initial candidates:

| Condition | Message | Destination |
|---|---|---|
| One or more members have no house | `{count} members need a house assignment` | Members filtered to Unassigned |
| No active season | `No season is currently active` | Seasons |
| A house has no assigned members | `{house} has no members` | That house's details, or Houses until record links exist |
| No houses exist | `Create the first house` | Houses |

Later candidates may include expiring invites or abnormal point-adjustment activity once the underlying data supports a reliable signal.

Rules:

- Do not manufacture warnings from neutral metrics.
- Order items by urgency, then by likely frequency.
- Every item has a direct action.
- When nothing requires attention, show a compact healthy state rather than an empty container.

#### 2. Organization status

Show a compact snapshot:

- Active season name and relevant dates.
- Total members.
- Unassigned members.
- Houses.
- Active or recently generated invite status when accurately available.

Counts should link to their relevant workspace where useful. Avoid displaying deleted-point or deduction counts as top-level health metrics without an explicit threshold or action.

#### 3. Recent administration

Show the newest three to five audit events in a compact feed with a `View audit history` action. Reuse the audit event vocabulary and formatting rather than creating a second interpretation of events.

### Empty and restricted states

- A new organization should receive setup-oriented attention items in the correct order: create houses, invite members, assign members, start a season.
- Admins can see owner-required attention items, but their actions are disabled and explain that an owner must complete them.

---

## Members Workspace

Members is the first target resource workspace and establishes the pattern for the rest of Manage.

### Default view

The main content is a member list rather than a set of forms.

Recommended columns on desktop:

- Member
- House
- Role
- Status
- Joined, when the current contract exposes a reliable value
- Row action or disclosure indicator

On mobile, render the same information as compact rows without forcing a wide table.

### Filters and search

Initial filters:

- All
- Unassigned
- Members
- Admins

Search matches display name. Filters should be represented as controls above the list and should produce an explicit empty result.

### Member details

Selecting a member opens a drawer/sheet with:

- Identity summary.
- Display name edit.
- House assignment.
- Organization role.
- Relevant recent administrative activity when available.
- Remove from organization at the end of the panel.

Behavior:

- Save each logical field independently; do not create one large form that can accidentally submit unrelated changes.
- Successful mutations refresh the row and detail view without closing the drawer unless removal makes the record unavailable.
- The owner cannot remove or demote themselves through ordinary member controls.
- Owner-only role controls remain visible and disabled for admins.
- Member removal uses an explicit confirmation dialog naming the affected member.

### Invite flow

`Invite member` opens a focused dialog or sheet. After generation it shows:

- The invite link.
- Expiration.
- Copy action.
- A clear statement that the link is single-use, when that remains the product rule.

Invite activity is not a standalone card in the default Members view. Recent invitation events belong in Audit; invite-specific state may appear in the invite dialog if useful.

### Role navigation migration

The Roles navigation entry can be removed when all existing promote/demote behavior is available from member details and covered by tests. Until then, it may remain temporarily with a migration note, but the target UI must not maintain both interaction paths indefinitely.

---

## Houses Workspace

### Default view

Show existing houses first as a responsive list or compact card grid. Each item includes:

- House name and visual identity.
- Member count.
- Current-season score when it is already available without an expensive new request; otherwise omit it.
- A disclosure affordance.

### Create and edit

- `Create house` opens a drawer/sheet using the existing theme-generation and custom-palette controls.
- Selecting a house opens the same surface in edit mode.
- Preview and palette controls are presented as parts of one house editor, not as nested standalone tools.
- Validation, confirmation, and existing tenant scoping remain unchanged.

The workspace must support a clear empty state with `Create the first house`.

---

## Seasons Workspace

### Default view

Present season state before operations:

- Current season summary at the top.
- Historical seasons in a list ordered newest first.
- Clear active/completed/upcoming state labels supported by current data.

### Operations

- `Start next season` is the primary action and opens a focused confirmation flow.
- Selecting a season opens details where its name can be changed.
- The rollover impact described by the existing season behavior must be shown before confirmation.
- Rename remains a secondary action and must not visually compete with starting the next season.

Historical reporting remains on the member-facing dashboard unless the report is specifically administrative.

---

## Organization Workspace

### Structure

Use a settings-style page because Organization is a singleton resource:

1. Organization identity.
2. URL and slug.
3. Ownership.
4. Danger zone.

Each subsection should use a restrained row or section layout rather than wrapping every operation in another card.

### Behavior

- Organization name can be edited in context.
- Slug change remains a separate confirmed action because it affects links.
- Ownership transfer remains a separate confirmed action and explains the acting owner's resulting role.
- Archive organization remains the final action in a visually distinct danger zone.
- The workspace remains visible but disabled in navigation for admins.

Existing slug alias, audit, archive, and organization-scoping guarantees are unchanged.

---

## Audit Workspace

Audit remains the full administrative history and gains the point-adjustment report currently shown on Overview.

### Initial structure

Use two local views:

- **History**: existing cursor-paged audit event list and event-type filter.
- **Point adjustments**: selected-season deduction summary and by-house breakdown.

These views are reporting modes inside Audit, not new Manage navigation entries.

Requirements:

- History remains the default.
- Filters and pagination retain current behavior.
- Moving point adjustments must not remove current season-selection behavior.
- Deleted points continue to appear in the unified audit history rather than a separate deletion report.

---

## Interaction and Accessibility Requirements

- Preserve proper navigation semantics. If the control changes the URL and represents page navigation, prefer links with current-page state over tab semantics.
- Disabled owner-only destinations must be focusable or otherwise expose their explanation to keyboard and assistive-technology users; a native disabled button alone cannot receive focus. The implementation should use an accessible disabled-link pattern or nearby explanatory text.
- Drawers and dialogs must trap focus, have an accessible title, close with Escape, and restore focus to the invoking control.
- Tables must have appropriate headers; mobile alternatives must retain equivalent labels.
- Status and role must not be communicated by color alone.
- Pending mutations disable only the affected operation where practical.
- Errors appear next to the affected workflow and use the existing safe error/toast conventions.
- All layouts must remain usable at narrow mobile widths and at 200% zoom.

---

## Data and Engineering Considerations

### Reuse first

The first slices should compose existing admin-context data and server actions:

- Members, roles, house assignment, and display names already exist.
- Houses and their editing behavior already exist.
- Seasons and point-adjustment reporting already exist.
- Organization settings and audit history already exist.

Do not add an endpoint solely to reproduce data already present in the admin context.

### Likely follow-up data needs

Potential additions should be evaluated separately:

- Accurate active/expired invite inventory rather than audit-derived counts.
- Member join date if it is not currently present in the admin contract.
- Per-resource recent activity lookup if filtering the existing audit page client-side is insufficient.
- Server-side member search/pagination when organization size makes the loaded member collection impractical.

### Scale transition

The initial member workspace can filter the currently loaded collection. Before relying on that model for large organizations, define a threshold and move to server-side pagination/search while keeping the workspace interface stable.

All new queries and mutations must preserve organization scoping and multi-organization membership behavior.

---

## Delivery Plan

### Phase 0: Shared foundations

- Add deep-linkable Manage workspace state. Implemented.
- Add the shared workspace header, filter row, empty state, and drawer/sheet primitives. Implemented.
- Remove the persistent metrics strip or keep it only until the new Overview ships. Implemented.
- Preserve all current workflows during the transition.

The six workspaces now use a shared shell for their landmark, title, description, contextual
count, and primary-action slot. Members, Houses, and Seasons also use accessible modal detail
surfaces with focus containment, Escape handling, and focus restoration. Filters and empty
states retain resource-specific behavior, while Members and Audit use a shared responsive control
row for filters, search, counts, and inline errors. True empty and no-result states share a
consistent labelled presentation and optional recovery action. Consequential inline workflows
use a shared two-step confirmation panel with consistent pending and cancellation behavior;
member removal remains a modal confirmation and typed organization confirmations remain in context.
Members, season history, and audit history use the same labelled, bordered resource-list surface
while retaining resource-specific rows and responsive content.
Overview attention and recent-administration collections use that same surface, and the recent
feed uses the shared empty-state treatment before the first administrative event is recorded.

### Phase 1: Members

- Replace the form gallery with the member list and filters. Implemented.
- Move display name, house assignment, role, and removal into member details. Implemented.
- Move invite generation into a focused dialog/sheet. Implemented.
- Remove the Roles navigation entry after parity is verified. Implemented.

This phase establishes the reusable resource-workspace pattern.

### Phase 2: Overview

- Add actionable attention items. Implemented.
- Move useful metrics into organization status. Implemented.
- Add the compact recent-administration feed. Implemented.
- Move point-adjustment reporting to Audit. Implemented.

### Phase 3: Houses and Seasons

- Convert Houses to list plus create/edit details. Implemented.
- Convert Seasons to current-state summary plus season history and focused operations. Implemented.

### Phase 4: Organization and Audit

- Rename Settings to Organization and flatten its section hierarchy. Implemented.
- Add History and Point adjustments views to Audit. Implemented.
- Complete navigation labels and remove transitional UI. Implemented.

Each phase should be independently releasable and retain the current authorization boundaries.

---

## Acceptance Criteria

### Cross-workspace

- The Manage navigation contains Overview, Members, Houses, Seasons, Organization, and Audit in the target state.
- Admins can see owner-only destinations, understand why they are unavailable, and cannot activate them.
- Owners can access all six workspaces.
- A selected workspace survives refresh and supports browser back/forward navigation.
- Every workspace uses the shared title/action/content hierarchy.
- Restricted API operations remain protected when invoked outside the UI.
- Existing organization scoping and audit behavior are unchanged.

### Overview

- Overview shows actionable items rather than point-adjustment reporting as its primary content.
- An unassigned-member item opens Members in the Unassigned state.
- Owner-required attention remains visible but unavailable to admins with an explanation.
- Overview has an intentional healthy state when no action is needed.
- Recent administration links to the full Audit workspace.

### Members

- Existing members appear in a searchable, filterable resource list.
- An administrator can invite a member from the workspace primary action.
- Selecting a member exposes display-name and house-assignment controls.
- An owner can change eligible member/admin roles from member details.
- An admin sees but cannot use owner-only role controls.
- Removing a member requires confirmation and cannot bypass existing owner safeguards.
- The standalone Roles workspace is removed only after equivalent behavior and test coverage exist.

### Houses and Seasons

- Houses are shown before create/edit controls.
- House creation and editing use a consistent detail surface.
- Seasons show the current state and history before mutation controls.
- Starting a season remains clearly more consequential than renaming one.

### Organization and Audit

- Organization identity, slug, ownership, and archive controls retain their current confirmation and permission rules.
- Danger-zone operations are visually and semantically separated.
- Audit History retains filtering and cursor pagination.
- Point-adjustment reporting retains season selection after moving to Audit.

### Verification

- Component tests cover navigation state, accessible restrictions, filters, drawers/dialogs, confirmation behavior, and mutation results.
- API authorization and organization-scoping tests remain green.
- Web typecheck and lint pass.
- The full test suite and production build pass for each production-facing phase.
- Documentation is updated when a phase ships, including removal of transitional paths.

---

## Open Decisions

These decisions should be made during the relevant phase rather than blocking the overall direction:

1. Whether desktop record details use a side drawer or an inline split pane. A drawer is the recommended first implementation because it also maps cleanly to a mobile sheet.
2. Whether member filters are stored in the URL in Phase 1 or only when Overview deep links are introduced in Phase 2.
3. Whether Houses use rows or cards. Use cards only if the theme preview materially helps identification; otherwise prefer rows for density.
4. Whether Audit uses a segmented control or secondary tabs for History and Point adjustments.
5. What organization size triggers server-side member pagination and search.
