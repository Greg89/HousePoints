import { Calendar, LinkSimple, Trash, UserPlus } from "@phosphor-icons/react";
import type { AdminAuditAction } from "@housepoints/contracts";

interface RecentAdminActionsReportProps {
  actions: AdminAuditAction[];
}

const actionLabels: Record<AdminAuditAction["type"], string> = {
  POINT_DELETED: "Point deleted",
  INVITE_CREATED: "Invite created",
  INVITE_USED: "Invite used",
  SEASON_STARTED: "Season started",
};

const actionIcons: Record<AdminAuditAction["type"], typeof Trash> = {
  POINT_DELETED: Trash,
  INVITE_CREATED: LinkSimple,
  INVITE_USED: UserPlus,
  SEASON_STARTED: Calendar,
};

export function RecentAdminActionsReport({ actions }: RecentAdminActionsReportProps) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin audit</p>
        <h4 className="font-display text-xl font-semibold mt-1">Recent admin actions</h4>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          A compact timeline of important organization changes backed by app data.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border">
        {actions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No recent admin actions have been recorded yet.
          </p>
        ) : (
          <div className="divide-y">
            {actions.map((action) => {
              const Icon = actionIcons[action.type];

              return (
                <article key={action.id} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-background text-primary">
                    <Icon size={17} aria-hidden />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                        {actionLabels[action.type]}
                      </span>
                      {action.actorName ? (
                        <span className="text-xs text-muted-foreground">by {action.actorName}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold">{action.summary}</p>
                  </div>
                  <time
                    dateTime={action.occurredAt}
                    className="text-xs font-medium text-muted-foreground sm:text-right"
                  >
                    {new Date(action.occurredAt).toLocaleString()}
                  </time>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
