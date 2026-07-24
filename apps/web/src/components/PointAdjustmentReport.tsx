"use client";

import { useState, useTransition } from "react";
import { TrendDown } from "@phosphor-icons/react";
import type { PointAdjustmentStats, Season } from "@housepoints/contracts";
import { ManageEmptyState } from "./ManageEmptyState";

interface PointAdjustmentReportProps {
  pointAdjustmentStats: PointAdjustmentStats;
  seasons: Season[];
  onLoadPointAdjustmentStats: (seasonId?: string) => Promise<PointAdjustmentStats>;
}

export function PointAdjustmentReport({
  pointAdjustmentStats,
  seasons,
  onLoadPointAdjustmentStats,
}: PointAdjustmentReportProps) {
  const [selectedStats, setSelectedStats] = useState(pointAdjustmentStats);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const housesWithDeductions = selectedStats.byHouse.filter(
    (house) => house.deductionCount > 0,
  );

  function handleSeasonChange(seasonId: string) {
    startTransition(async () => {
      setErrorMessage(null);
      try {
        setSelectedStats(await onLoadPointAdjustmentStats(seasonId || undefined));
      } catch {
        setErrorMessage("Point adjustment reporting could not be loaded. Please try again.");
      }
    });
  }

  return (
    <section aria-label="Point adjustment activity" className="rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Admin reporting</p>
          <h4 className="mt-1 font-display text-xl font-semibold">Point adjustments</h4>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Deduction activity by target house for the selected season.
          </p>
        </div>
        <label className="grid gap-2 text-sm font-medium sm:min-w-64">
          Reporting season
          <select
            value={selectedStats.seasonId ?? ""}
            disabled={isPending}
            onChange={(event) => handleSeasonChange(event.target.value)}
            className="rounded-xl border bg-background px-3 py-2 text-sm font-normal"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}{season.isActive ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Metric label="Points deducted" value={selectedStats.totalDeductedPoints} />
        <Metric label="Deduction events" value={selectedStats.totalDeductionCount} />
      </div>
      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {selectedStats.seasonName ? `Season: ${selectedStats.seasonName}` : "No active season"}
        {isPending ? " · Loading report..." : ""}
      </p>

      {housesWithDeductions.length > 0 ? (
        <div className="mt-3 divide-y overflow-hidden rounded-xl border">
          {selectedStats.byHouse.map((house) => (
            <div key={house.houseId} className="flex items-center justify-between gap-3 bg-background p-4">
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
          ))}
        </div>
      ) : (
        <ManageEmptyState
          title="No point deductions"
          description="No point deductions have been recorded for this season."
          icon={<TrendDown size={24} />}
          compact
          className="mt-3 bg-background"
        />
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendDown size={14} />
        {label}
      </div>
      <p className="mt-1 font-number text-2xl font-bold">{value}</p>
    </div>
  );
}
