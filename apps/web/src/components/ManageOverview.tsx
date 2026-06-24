"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  House,
  Trash,
  TrendDown,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";
import type { PointAdjustmentStats, Season } from "@housepoints/contracts";

interface ManageOverviewProps {
  memberCount: number;
  houseCount: number;
  unassignedCount: number;
  deletedPointCount: number;
  pointAdjustmentStats: PointAdjustmentStats;
  seasons: Season[];
  onLoadPointAdjustmentStats: (seasonId?: string) => Promise<PointAdjustmentStats>;
}

export function ManageOverview({
  memberCount,
  houseCount,
  unassignedCount,
  deletedPointCount,
  pointAdjustmentStats,
  seasons,
  onLoadPointAdjustmentStats,
}: ManageOverviewProps) {
  const [selectedStats, setSelectedStats] = useState(pointAdjustmentStats);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const housesWithDeductions = selectedStats.byHouse.filter(
    (house) => house.deductionCount > 0,
  );
  const selectedSeasonId = selectedStats.seasonId ?? "";

  function handleSeasonChange(nextSeasonId: string) {
    startTransition(async () => {
      setErrorMessage(null);

      try {
        const stats = await onLoadPointAdjustmentStats(nextSeasonId || undefined);
        setSelectedStats(stats);
      } catch {
        setErrorMessage("Point adjustment reporting could not be loaded. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Organization tools</p>
          <h3 className="font-display text-2xl font-semibold mt-1">Manage your team</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Invite teammates, tune the houses, and keep every member assigned without leaving the dashboard.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[28rem] lg:grid-cols-5">
          <MetricCard icon={<UsersThree size={14} />} label="Members" value={memberCount} />
          <MetricCard icon={<House size={14} />} label="Houses" value={houseCount} />
          <MetricCard icon={<UserSwitch size={14} />} label="Unassigned" value={unassignedCount} />
          <MetricCard icon={<Trash size={14} />} label="Deleted" value={deletedPointCount} />
          <MetricCard
            icon={<TrendDown size={14} />}
            label="Deductions"
            value={selectedStats.totalDeductionCount}
          />
        </div>
      </div>

      <section
        aria-label="Point adjustment activity"
        className="rounded-2xl border bg-background/60 p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Point adjustment activity</p>
            <p className="text-sm text-muted-foreground mt-1">
              Deduction activity by target house for the selected season.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:min-w-[20rem]">
            <div>
              <label
                htmlFor="point-adjustment-season"
                className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Reporting season
              </label>
              <select
                id="point-adjustment-season"
                value={selectedSeasonId}
                disabled={isPending}
                onChange={(event) => handleSeasonChange(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-sm"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}{season.isActive ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                icon={<TrendDown size={14} />}
                label="Points deducted"
                value={selectedStats.totalDeductedPoints}
              />
              <MetricCard
                icon={<TrendDown size={14} />}
                label="Deduction events"
                value={selectedStats.totalDeductionCount}
              />
            </div>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {selectedStats.seasonName
            ? `Season: ${selectedStats.seasonName}`
            : "No active season"}
          {isPending ? " - Loading report..." : ""}
        </p>

        {housesWithDeductions.length > 0 ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {selectedStats.byHouse.map((house) => (
              <div
                key={house.houseId}
                className="rounded-xl border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: house.houseColor }}
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-semibold">{house.houseName}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {house.deductionCount} deduction{house.deductionCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-number text-lg font-bold">
                    {house.deductedPoints}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            No point deductions have been recorded for this season.
          </div>
        )}
      </section>
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
