import { Buildings, Calendar, LinkSimple, ShieldCheck, TrendDown, Trash, UserPlus, UserSwitch } from "@phosphor-icons/react";
import { useMemo, useState, useTransition } from "react";
import type { AdminAuditAction, PagedAdminAuditActions } from "@housepoints/contracts";

interface RecentAdminActionsReportProps {
  actions: AdminAuditAction[];
  nextCursor: string | null;
  onLoadPage: (
    type?: AdminAuditAction["type"],
    cursor?: string,
  ) => Promise<PagedAdminAuditActions>;
}

type AuditFilter = "ALL" | AdminAuditAction["type"];

const actionLabels: Record<AdminAuditAction["type"], string> = {
  POINT_DELETED: "Point deleted",
  INVITE_CREATED: "Invite created",
  INVITE_USED: "Invite used",
  SEASON_STARTED: "Season started",
  ORG_SETTINGS_UPDATED: "Organization updated",
  POINTS_DEDUCTED: "Points deducted",
  USER_HOUSE_ASSIGNED: "House assigned",
  USER_ROLE_CHANGED: "Role changed",
};

const actionIcons: Record<AdminAuditAction["type"], typeof Trash> = {
  POINT_DELETED: Trash,
  INVITE_CREATED: LinkSimple,
  INVITE_USED: UserPlus,
  SEASON_STARTED: Calendar,
  ORG_SETTINGS_UPDATED: Buildings,
  POINTS_DEDUCTED: TrendDown,
  USER_HOUSE_ASSIGNED: UserSwitch,
  USER_ROLE_CHANGED: ShieldCheck,
};

const auditFilterOptions: Array<{ value: AuditFilter; label: string }> = [
  { value: "ALL", label: "All audit events" },
  { value: "POINT_DELETED", label: "Point deletions" },
  { value: "POINTS_DEDUCTED", label: "Point deductions" },
  { value: "USER_ROLE_CHANGED", label: "Role changes" },
  { value: "USER_HOUSE_ASSIGNED", label: "House assignments" },
  { value: "ORG_SETTINGS_UPDATED", label: "Organization updates" },
  { value: "INVITE_CREATED", label: "Invites created" },
  { value: "INVITE_USED", label: "Invites used" },
  { value: "SEASON_STARTED", label: "Season starts" },
];

export function RecentAdminActionsReport({
  actions,
  nextCursor,
  onLoadPage,
}: RecentAdminActionsReportProps) {
  const [selectedFilter, setSelectedFilter] = useState<AuditFilter>("ALL");
  const [visibleActions, setVisibleActions] = useState(actions);
  const [currentNextCursor, setCurrentNextCursor] = useState(nextCursor);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedType = selectedFilter === "ALL" ? undefined : selectedFilter;
  const actionCountLabel = useMemo(() => {
    const suffix = currentNextCursor ? "shown" : "total";
    return `${visibleActions.length} ${visibleActions.length === 1 ? "event" : "events"} ${suffix}`;
  }, [currentNextCursor, visibleActions.length]);

  function handleFilterChange(nextFilter: AuditFilter) {
    setSelectedFilter(nextFilter);
    setLoadError(null);
    startTransition(async () => {
      try {
        const page = await onLoadPage(nextFilter === "ALL" ? undefined : nextFilter);
        setVisibleActions(page.items);
        setCurrentNextCursor(page.nextCursor);
      } catch {
        setLoadError("Audit history could not be loaded. Please try again.");
      }
    });
  }

  function handleLoadMore() {
    if (!currentNextCursor) {
      return;
    }

    setLoadError(null);
    startTransition(async () => {
      try {
        const page = await onLoadPage(selectedType, currentNextCursor);
        setVisibleActions((currentActions) => {
          const existingIds = new Set(currentActions.map((action) => action.id));
          const newActions = page.items.filter((action) => !existingIds.has(action.id));
          return [...currentActions, ...newActions];
        });
        setCurrentNextCursor(page.nextCursor);
      } catch {
        setLoadError("More audit history could not be loaded. Please try again.");
      }
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Admin audit</p>
          <h4 className="font-display text-xl font-semibold mt-1">Audit history</h4>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Full history of important organization changes, including deleted point awards.
          </p>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Filter history
          <select
            value={selectedFilter}
            onChange={(event) => handleFilterChange(event.target.value as AuditFilter)}
            disabled={isPending}
            className="min-w-56 rounded-xl border bg-background px-3 py-2 text-sm font-normal"
          >
            {auditFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{actionCountLabel}</span>
        {loadError ? <span className="font-medium text-destructive">{loadError}</span> : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border">
        {visibleActions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No audit history matches this filter yet.
          </p>
        ) : (
          <div className="divide-y">
            {visibleActions.map((action) => {
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

      {currentNextCursor ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isPending}
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Loading audit history..." : "Load more audit history"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
