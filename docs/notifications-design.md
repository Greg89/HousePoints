# Notification System Design

Product and engineering plan for durable in-app notifications, lightweight real-time cues, and an account-menu notification center.

---

## Product Goal

Admins and owners need to notice operational events without camping on the app all day.

The first concrete need is:

- A user accepts an invite.
- The user lands in the organization without a house assignment.
- Admins and owners should know that someone needs assignment.

A toast is useful when an admin is actively using the app, but it is not enough. The app should also keep a durable notification history that can be reviewed later from the account/profile area near the top-right header.

---

## Current State

The app currently has:

- Local success/error toasts through `sonner`.
- Durable per-user notification rows with read/unread and archived state.
- Account-menu notification center in the dashboard header.
- Unread count badge on the account menu trigger.
- Explicit mark-read and mark-all-read actions.
- Active-session polling that shows one toast per newly observed unread action-required notification.
- Automatic cleanup for resolved house-assignment notifications when a member is assigned to a house.
- Admin Manage Team with unassigned-member counts and grouped assignment dropdowns.
- Invite activity surfaced from the admin audit stream.
- Durable audit events for administrative history.

The app does not currently have:

- Server-sent events, websockets, or true real-time fanout.
- A dedicated full-page notification center.
- Notification archive/retention UI.
- Notification producers for org setting changes.
- User-level notification preferences.

---

## Design Principles

- Durable first, toast second. If a message matters, it must be stored before any toast appears.
- Notifications are user-specific views of organization events, not a replacement for audit history.
- Notifications should be actionable when possible.
- Delivery should be best-effort, but creation should be deterministic and idempotent.
- The system should avoid noisy streams. Only notify when attention or action is likely needed.
- Notifications should respect role boundaries and organization scope.
- The first version should not require users to stay connected to a live socket.

---

## Notification Types

Recommended initial types:

| Type | Recipients | Severity | Action |
|---|---|---|---|
| `MEMBER_NEEDS_HOUSE_ASSIGNMENT` | Admins and owners in the org | `ACTION_REQUIRED` | Open Manage Team |
| `INVITE_ACCEPTED` | Invite creator, admins, owners | `INFO` | Open Manage Team or Invite Activity |
| `ROLE_CHANGED` | Target user and owners | `INFO` | Open Manage Team |
| `SEASON_STARTED` | All org members | `INFO` | Open Overview |
| `POINT_AWARD_RECEIVED` | Target user | `INFO` | Open Activity |
| `POINT_DEDUCTION_RECEIVED` | Target user and owners/admins | `ACTION_REQUIRED` or `WARNING` | Open Activity |

Implemented types are `MEMBER_NEEDS_HOUSE_ASSIGNMENT`, `SEASON_STARTED`, `POINT_AWARD_RECEIVED`, `POINT_DEDUCTION_RECEIVED`, and `ROLE_CHANGED`. Other types are listed so the model does not paint us into a corner.

---

## Data Model

Use a durable `Notification` table rather than deriving the inbox from audit rows every time.

Recommended model:

```prisma
model Notification {
  id             String               @id @default(cuid())
  organizationId String
  recipientUserId String
  type           NotificationType
  severity       NotificationSeverity @default(INFO)
  title          String
  body           String
  actionLabel    String?
  actionHref     String?
  entityType     String?
  entityId       String?
  dedupeKey      String?
  readAt         DateTime?
  archivedAt     DateTime?
  createdAt      DateTime             @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  recipient      User         @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)

  @@index([recipientUserId, readAt, createdAt])
  @@index([organizationId, type, createdAt])
  @@unique([recipientUserId, dedupeKey])
}

enum NotificationType {
  MEMBER_NEEDS_HOUSE_ASSIGNMENT
  INVITE_ACCEPTED
  ROLE_CHANGED
  SEASON_STARTED
  POINT_AWARD_RECEIVED
  POINT_DEDUCTION_RECEIVED
}

enum NotificationSeverity {
  INFO
  ACTION_REQUIRED
  WARNING
}
```

For MVP, `dedupeKey` prevents repeatedly notifying the same admin about the same unassigned user:

```text
member-needs-house-assignment:{organizationId}:{userId}
```

When the user is assigned to a house, related `MEMBER_NEEDS_HOUSE_ASSIGNMENT` notifications are marked read and archived in the same transaction as the assignment and audit event.

---

## Creation Flow

First event: invite accepted and user needs house assignment.

1. User joins through the invite endpoint.
2. API completes the existing atomic invite claim and user organization assignment.
3. If the joined user has no `houseId`, create one notification per current admin/owner in the organization.
4. Use `dedupeKey` to make notification creation idempotent.
5. Keep the existing audit event for permanent administrative history.
6. Return the join response as usual.

Important behavior:

- Do not notify the newly joined member that they need assignment unless there is a separate member-facing notification design. They already see the waiting screen.
- Do not notify regular members.
- Do not include invite tokens or raw invite URLs in the notification body or metadata.
- If the invite creator is no longer an admin/owner, they should not receive the admin action-required notification.

Suggested notification copy:

```text
Title: New member needs a house
Body: Casey joined Example Org and has not been assigned to a house yet.
Action: Assign house
Href: /?tab=manage&section=team
```

The dashboard normalizes this legacy root dashboard href to the signed-in user's slugged dashboard route before navigation:

```text
/o/{orgSlug}?tab=manage&section=team
```

---

## API Surface

Recommended MVP endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /notifications/list` | Returns current user's notifications with unread count and cursor pagination. |
| `POST /notifications/mark-read` | Marks one or more notifications as read. |
| `POST /notifications/mark-all-read` | Marks all current user's visible notifications as read. |

`/notifications/list` response should include:

- `items`
- `unreadCount`
- `nextCursor`

Each item should include:

- `id`
- `type`
- `severity`
- `title`
- `body`
- `actionLabel`
- `actionHref`
- `readAt`
- `createdAt`

The API must derive `recipientUserId` and `organizationId` from the actor. The client should never submit a recipient id for reads or mark-read operations.

Assignment resolution is not a separate public notification endpoint. It is handled by `POST /admin/users/assign-house` so the task cleanup stays atomic with the state change that resolves it.

---

## Web UX

### Header Entry Point

Replace the standalone circular profile-settings button with an account menu trigger that can show notification state.

Recommended shape:

- Circular account button remains visually familiar.
- Add a small notification dot or count badge when unread notifications exist.
- Clicking opens a compact menu/popover.
- Menu sections:
  - Signed-in identity summary.
  - Notifications preview.
  - Profile settings.
  - Sign out.

For admins/owners with unread action-required notifications, the badge should be visible but modest. This is not a production incident system.

### Notification Center

The account menu can show the latest 3-5 notifications. A full-page center can come later if volume justifies it.

MVP popover content:

- Header: `Notifications`
- Unread count
- List of recent notifications
- Empty state: `You're all caught up.`
- Per notification:
  - Severity pill or small icon
  - Title
  - Body
  - Relative time
  - Action link when present
- Footer action: `Mark all read`

Action behavior:

- Opening the popover should not automatically mark everything read.
- Clicking a notification action should mark that notification read.
- `Mark all read` should be explicit.
- When an assignment notification is resolved by assigning the member to a house, it should disappear from the active menu list because it has been archived.

### Toast Behavior

Toasts should be generated only for newly observed unread notifications during an active session.

MVP uses lightweight polling:

- Load notification summary during dashboard render.
- Poll every 60-120 seconds while the dashboard is open.
- When a new unread action-required notification appears, show a toast.
- Toast links to the same action href.

This is enough for a fun internal app that people check occasionally. Server-sent events or websockets remain deferred until there is a stronger real-time need.

Suggested toast copy:

```text
New member needs a house
Casey joined and is waiting for assignment.
Action: Assign house
```

---

## Relationship To Audit

Audit and notifications should stay separate:

- Audit is the permanent administrative record.
- Notifications are a per-recipient attention layer.
- A single domain event can write both an audit row and notification rows.
- Notifications can be read, archived, or eventually expired without weakening audit history.

For invite joins, the existing `INVITE_USED` audit event remains the source of administrative history. The new notification is a task-oriented prompt for admins.

---

## Preferences And Noise Control

Do not build preferences in MVP.

Add them only when notification volume grows. Good future preference groups:

- Team setup alerts
- Point activity involving me
- Season announcements
- Admin/audit alerts

Default policy:

- Admins/owners receive action-required team setup notifications.
- Members receive only notifications about themselves or broad org announcements.
- Owners receive org-level alerts.

---

## Retention

Recommended defaults:

- Keep unread notifications indefinitely.
- Keep read notifications for at least 90 days.
- Do not physically delete in MVP unless there is a storage concern.
- Add an archive action later if the list gets noisy.

---

## Implementation Phases

### Phase 1 - Durable Notification Foundation

- Add notification enums and `Notification` table.
- Add contract schemas for list and mark-read endpoints.
- Add API helpers for idempotent notification creation.
- Add `POST /notifications/list`, `POST /notifications/mark-read`, and `POST /notifications/mark-all-read`.
- Add tests for organization scoping, recipient scoping, unread count, pagination, and mark-read ownership.

Status: implemented.

### Phase 2 - Invite Accepted Notification

- On invite join, create `MEMBER_NEEDS_HOUSE_ASSIGNMENT` notifications for admins/owners when the joined user has no house.
- Use a deterministic dedupe key per recipient and joined user.
- Keep existing invite audit behavior unchanged.
- Add API tests for notification creation, no regular-member recipients, no duplicate notifications, and no token leakage.

Status: implemented.

### Phase 3 - Account Menu Notification Center

- Replace the profile/settings icon with an account menu.
- Add unread badge/dot.
- Show latest notifications in the menu.
- Add explicit mark-read and mark-all-read flows.
- Link the action to Manage Team.
- Add component tests for unread badge, empty state, action link, and mark-read behavior.

Status: implemented.

### Phase 4 - Active Session Toasts

- Add a client-side notification poller for active dashboard sessions.
- Show toasts only for newly observed unread notifications.
- Avoid repeating the same toast in one browser session.
- Add tests around polling, dedupe, and action-required toast display.

Status: implemented.

### Phase 4A - Assignment Notification Resolution

- When a member is assigned to a house, mark matching `MEMBER_NEEDS_HOUSE_ASSIGNMENT` notifications read and archive them.
- Scope cleanup by organization, notification type, `entityType`, target user id, and unresolved archive state.
- Keep audit history unchanged.
- Add API tests for successful cleanup and no cleanup on forbidden or not-found assignment paths.

Status: implemented.

### Phase 5 - Additional Notification Types

Add more types only after the first workflow feels useful:

- Point award received
- Point deduction received
- Season started
- Role changed
- Org settings changed

Status: in progress. `SEASON_STARTED` is implemented as an org-wide `INFO` notification created inside the season-start transaction. It uses deterministic per-recipient dedupe keys and links to Overview. Org settings changes remain deferred.

`POINT_AWARD_RECEIVED` is implemented as a targeted `INFO` notification created inside the point-award transaction. It notifies the recipient, links to Activity, and skips self-awards to avoid echoing an action the current user just performed.

`POINT_DEDUCTION_RECEIVED` is implemented as a targeted `WARNING` notification created inside the point-deduction transaction. It notifies the deducted member, links to Activity, and stays durable without becoming an active-session action-required toast.

`ROLE_CHANGED` is implemented as an informational notification created inside the owner role-management transaction. It notifies the changed user plus other owners in the organization, excluding the owner who performed the change, and links to Manage Team.

---

## Open Questions

- Should owners receive all admin notifications, or only org-level notifications plus team setup alerts?
- Do admins need a dedicated full notification page, or is the account menu enough for expected volume?
- Should notification actions support deep links into Manage sections before dashboard query-param tab state exists?
- Should notification emails ever exist, or is in-app only enough for this product?

Answered:

- Assigning a member to a house should auto-archive the related action-required notifications. Implemented as mark-read plus archive inside the assignment transaction.

## Deferred

- Dedicated notification page with pagination beyond the account-menu preview.
- User-level notification preferences.
- Email delivery.
- Server-sent events or websocket delivery.
- Additional notification producers: org setting changes.
