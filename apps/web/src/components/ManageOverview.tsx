import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ClockCounterClockwise,
  House,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";
import type { AdminAuditAction, Season, UserRole } from "@housepoints/contracts";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";
import { ManageWorkspace } from "./ManageWorkspace";

interface ManageOverviewProps {
  users: AdminUser[];
  houses: AdminHouse[];
  activeSeason: Season;
  actorRole: UserRole;
  recentAdminActions: AdminAuditAction[];
  onNavigate: (
    section: "members" | "houses" | "seasons" | "audit",
    options?: { memberStatus?: "unassigned" },
  ) => void;
}

export function ManageOverview({
  users,
  houses,
  activeSeason,
  actorRole,
  recentAdminActions,
  onNavigate,
}: ManageOverviewProps) {
  const isOwner = actorRole === "OWNER";
  const unassignedCount = users.filter((user) => !user.houseId).length;
  const populatedHouseIds = new Set(users.flatMap((user) => user.houseId ? [user.houseId] : []));
  const emptyHouses = houses.filter((house) => !populatedHouseIds.has(house.id));
  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const attentionCount =
    (unassignedCount > 0 ? 1 : 0) +
    (houses.length === 0 ? 1 : 0) +
    (houses.length > 0 ? emptyHouses.length : 0);

  return (
    <ManageWorkspace
      id="overview"
      title="Organization overview"
      description="See what needs attention and the current operating state of your organization."
      ariaLabel="Manage overview"
    >
      <section aria-labelledby="manage-attention-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 id="manage-attention-heading" className="text-sm font-semibold">Needs attention</h5>
            <p className="mt-1 text-xs text-muted-foreground">
              Setup and membership items that have a clear next action.
            </p>
          </div>
          {attentionCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {attentionCount}
            </span>
          ) : null}
        </div>

        {attentionCount === 0 ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
            <CheckCircle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Everything looks ready</p>
              <p className="mt-1 text-xs text-green-800">
                Every member has a house and every house has at least one member.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 divide-y overflow-hidden rounded-xl border bg-card">
            {unassignedCount > 0 ? (
              <AttentionItem
                icon={<UserSwitch size={18} />}
                title={`${unassignedCount} ${unassignedCount === 1 ? "member needs" : "members need"} a house assignment`}
                description="Assign members so they can participate in house scoring."
                actionLabel="Review members"
                onAction={() => onNavigate("members", { memberStatus: "unassigned" })}
              />
            ) : null}
            {houses.length === 0 ? (
              <AttentionItem
                icon={<House size={18} />}
                title="Create the first house"
                description={isOwner
                  ? "Members need houses before they can participate in scoring."
                  : "An owner needs to create a house before members can be assigned."}
                actionLabel="Open Houses"
                disabled={!isOwner}
                onAction={() => onNavigate("houses")}
              />
            ) : null}
            {houses.length > 0 ? emptyHouses.map((house) => (
              <AttentionItem
                key={house.id}
                icon={<House size={18} />}
                title={`${house.name} has no members`}
                description="Assign a member to make this house part of the competition."
                actionLabel="Assign members"
                onAction={() => onNavigate("members")}
              />
            )) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="manage-status-heading">
        <h5 id="manage-status-heading" className="text-sm font-semibold">Organization status</h5>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            icon={<Calendar size={17} />}
            label="Current season"
            value={activeSeason.name}
            detail="Active now"
            onClick={isOwner ? () => onNavigate("seasons") : undefined}
          />
          <StatusCard
            icon={<UsersThree size={17} />}
            label="Members"
            value={String(users.length)}
            detail={`${unassignedCount} unassigned`}
            onClick={() => onNavigate("members")}
          />
          <StatusCard
            icon={<House size={17} />}
            label="Houses"
            value={String(houses.length)}
            detail={`${emptyHouses.length} empty`}
            onClick={isOwner ? () => onNavigate("houses") : undefined}
          />
          <StatusCard
            icon={<UsersThree size={17} />}
            label="Access"
            value={`${adminCount} admin${adminCount === 1 ? "" : "s"}`}
            detail="Plus 1 owner"
            onClick={() => onNavigate("members")}
          />
        </div>
      </section>

      <section aria-labelledby="manage-recent-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 id="manage-recent-heading" className="text-sm font-semibold">Recent administration</h5>
            <p className="mt-1 text-xs text-muted-foreground">
              The newest organization changes from the audit history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("audit")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View audit history
            <ArrowRight size={13} />
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border bg-card">
          {recentAdminActions.length > 0 ? (
            <div className="divide-y">
              {recentAdminActions.slice(0, 5).map((action) => (
                <article key={action.id} className="flex gap-3 px-4 py-3">
                  <ClockCounterClockwise size={17} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{action.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(action.occurredAt).toLocaleString()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No administrative changes have been recorded yet.
            </p>
          )}
        </div>
      </section>
    </ManageWorkspace>
  );
}

function AttentionItem({
  icon,
  title,
  description,
  actionLabel,
  disabled = false,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="mt-0.5 text-amber-700">{icon}</span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        aria-disabled={disabled}
        title={disabled ? "Owner only" : undefined}
        onClick={disabled ? undefined : onAction}
        className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted"
        }`}
      >
        {actionLabel}{disabled ? " · Owner only" : ""}
      </button>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="mt-3 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block truncate font-display text-lg font-semibold">{value}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      {content}
    </button>
  ) : (
    <div className="rounded-xl border bg-card p-4">{content}</div>
  );
}
