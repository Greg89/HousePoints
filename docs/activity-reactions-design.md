# Activity Reactions Design

## Purpose

Activity reactions let members respond to point awards after the fact. The first version should make recognition feel more alive without turning the activity feed into a noisy chat surface or creating notification spam.

The MVP target is:

- users can react to an award activity card;
- each user has at most one active reaction per award;
- users can change or remove their reaction;
- the awarded member receives a durable notification;
- changing a reaction updates the existing notification instead of creating another one.

## Product Rules

### Eligible Activity

Reactions apply to point awards only.

Do not allow reactions on deductions in the MVP. Deductions are correction-oriented and already have Activity, Audit, and targeted notification visibility.

Do not allow reactions on deleted point transactions.

### Actor Rules

Any active member of the organization can react to an eligible award activity item.

The actor must belong to the same organization as the point transaction.

The awarded member can react to their own award if desired, but that should not create a notification for themselves.

### One Active Reaction Per User

MVP behavior is one active reaction per user per point transaction.

This should not be modeled as a one-to-one feature permanently. Use a reaction table that can later support multiple active reaction types from the same user by changing the uniqueness rule.

Recommended MVP uniqueness:

```text
one active reaction per organizationId + pointTransactionId + actorUserId
```

Possible future uniqueness:

```text
one active reaction per organizationId + pointTransactionId + actorUserId + reactionKey
```

### Changing A Reaction

Changing reactions updates the existing active reaction row.

Example:

1. Greg reacts with `clap`.
2. Greg changes to `fire`.
3. The same reaction row is updated to `fire`.

The UI should immediately show Greg's final selected reaction.

### Removing A Reaction

Clicking the selected reaction again may remove the reaction. If removal is included in the MVP, prefer soft deletion:

```text
deletedAt = now()
```

This keeps room for future analytics and avoids losing historical intent while still making the reaction inactive.

## Notification Rules

Notify the point recipient, not the point giver.

Example:

```text
Alex awarded +10 to Sam.
Greg reacts with clap.
Sam receives the reaction notification.
Alex does not.
```

Skip notification when the reactor is also the award recipient.

### Dedupe Key

Use one notification per reactor and point transaction:

```text
point-reaction-received:{organizationId}:{pointTransactionId}:{actorUserId}
```

This prevents reaction changes from creating multiple notifications.

### Notification Update Behavior

First reaction:

- create a notification for the award recipient;
- set `entityType = "PointReaction"`;
- set `entityId` to the reaction id;
- link to the Activity tab.

Reaction change:

- update the same deduped notification title/body to reflect the latest reaction;
- do not create another notification;
- do not reset `readAt` to unread for MVP.

Reaction removal:

- archive the deduped notification if it is still unread;
- if it has already been read, either archive it or leave it as historical read context. MVP recommendation: archive it so the notification tray reflects current state.

This gives the user the final accurate reaction without letting accidental changes produce notification bursts.

## Data Model

Recommended Prisma model:

```prisma
model PointReaction {
  id                 String   @id @default(cuid())
  organizationId     String
  pointTransactionId String
  actorUserId        String
  reactionKey        String
  deletedAt          DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  organization     Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  pointTransaction PointTransaction @relation(fields: [pointTransactionId], references: [id], onDelete: Cascade)
  actor            User             @relation(fields: [actorUserId], references: [id], onDelete: Cascade)

  @@index([organizationId, pointTransactionId])
  @@index([actorUserId, updatedAt])
}
```

PostgreSQL should enforce one active reaction per actor per transaction with a partial unique index:

```sql
CREATE UNIQUE INDEX "PointReaction_one_active_per_actor_transaction"
ON "PointReaction" ("organizationId", "pointTransactionId", "actorUserId")
WHERE "deletedAt" IS NULL;
```

Keep `reactionKey` as a controlled string, not arbitrary user input.

Recommended MVP keys:

| Key | Label |
|---|---|
| `clap` | Applause |
| `heart` | Love it |
| `fire` | On fire |
| `party` | Celebrate |
| `star` | Great work |

## API Contract

Recommended endpoint:

```text
POST /transactions/react
```

Request:

```json
{
  "transactionId": "tx_123",
  "reactionKey": "clap"
}
```

If removal is included:

```json
{
  "transactionId": "tx_123",
  "reactionKey": null
}
```

Response:

```json
{
  "transactionId": "tx_123",
  "myReactionKey": "clap",
  "reactions": [
    { "reactionKey": "clap", "count": 3 },
    { "reactionKey": "fire", "count": 1 }
  ]
}
```

Expected failure codes:

| Code | Meaning |
|---|---|
| `POINT_TRANSACTION_NOT_FOUND` | Transaction is missing, deleted, or outside the actor organization. |
| `POINT_REACTION_UNSUPPORTED_TRANSACTION_TYPE` | MVP only supports award reactions. |
| `POINT_REACTION_INVALID_REACTION` | Reaction key is not in the controlled allow-list. |
| `POINT_REACTION_TARGET_NOT_FOUND` | Award recipient can no longer be resolved. |

## Activity Feed Contract

Extend `ActivityItem` with reaction summary fields:

```ts
type ActivityReactionSummary = {
  reactionKey: string;
  count: number;
};

type ActivityItem = {
  // existing fields...
  myReactionKey: string | null;
  reactions: ActivityReactionSummary[];
};
```

The activity feed should return counts for the currently visible page. Avoid a per-card waterfall.

## UI Direction

Before adding reaction controls, split the Activity tab into smaller pieces:

- `ActivityFeed`: pagination, load-more state, delete state.
- `ActivityCard`: presentation for one transaction.
- future `ActivityReactionBar`: controlled reaction buttons and counts.

The card redesign should create a clear lower action row where reactions can live without crowding the recognition sentence.

Recommended first visual direction:

- make actor, action, recipient, points, trait, and timestamp easier to scan;
- keep season and card actions in predictable card corners;
- promote the point delta into a right-side summary rail on wider screens;
- move secondary metadata into a compact footer row;
- reserve the footer/right side for reactions.

### Card Actions Menu

The activity card should use a compact three-dot actions menu instead of exposing destructive actions directly on the card.

Current actions:

- `Delete point transaction`, shown only to admins and owners with delete permission.

Future actions:

- `View reactions`, available once reaction detail data exists.

The future reaction detail dialog should show:

- reaction label;
- member display name;
- reaction timestamp.

Keep the menu visible only when there is at least one real action for the current user. Avoid shipping a disabled placeholder for `View reactions` before reaction data exists.

## Rollout Plan

### Phase 1 - Card Boundary Refactor

Extract the current card markup into an `ActivityCard` component with no behavior change. This gives the UI a stable seam for visual redesign and reactions.

### Phase 1.5 - Card Actions Menu

Replace the floating delete control with a three-dot actions menu. Keep delete behavior unchanged and prepare the menu as the future home for reaction details.

### Phase 2 - Data And API

Add `PointReaction`, contracts, the reaction endpoint, and notification update logic.

### Phase 3 - Read Model

Add reaction summaries and `myReactionKey` to activity feed responses.

### Phase 4 - UI MVP

Add the reaction bar to award cards. Keep deductions reaction-free.

### Phase 5 - E2E Smoke

Add a staging E2E test where a second actor reacts to a point award and the recipient receives one accurate notification.

## Open Questions

- Should removal be in MVP, or should clicking the active reaction do nothing?
- Should reaction notifications appear as read history after a reaction is removed, or should they always archive?
- Should the point giver ever receive a summary notification later, such as "3 people reacted to your recognition"?
- Should owners be able to configure the allowed reaction set per organization?
