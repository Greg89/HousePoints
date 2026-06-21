import type { ReactNode } from "react";
import {
  House,
  Trash,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";

interface ManageOverviewProps {
  memberCount: number;
  houseCount: number;
  unassignedCount: number;
  deletedPointCount: number;
}

export function ManageOverview({
  memberCount,
  houseCount,
  unassignedCount,
  deletedPointCount,
}: ManageOverviewProps) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Organization tools</p>
          <h3 className="font-display text-2xl font-semibold mt-1">Manage your team</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Invite teammates, tune the houses, and keep every member assigned without leaving the dashboard.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[28rem] lg:grid-cols-4">
          <MetricCard icon={<UsersThree size={14} />} label="Members" value={memberCount} />
          <MetricCard icon={<House size={14} />} label="Houses" value={houseCount} />
          <MetricCard icon={<UserSwitch size={14} />} label="Unassigned" value={unassignedCount} />
          <MetricCard icon={<Trash size={14} />} label="Deleted" value={deletedPointCount} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-number text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
