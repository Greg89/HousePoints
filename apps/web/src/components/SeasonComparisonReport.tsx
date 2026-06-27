"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowsClockwise, ChartLineUp, TrendDown, TrendUp } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Season, SeasonComparison } from "@housepoints/contracts";
import { cn } from "@/lib/cn";

interface SeasonComparisonReportProps {
  seasons: Season[];
  initialComparison?: SeasonComparison | null;
  onCompare: (fromSeasonId: string, toSeasonId: string) => Promise<SeasonComparison>;
}

type ComparisonPair = {
  fromSeasonId: string;
  toSeasonId: string;
};

function defaultPair(seasons: Season[], initialComparison?: SeasonComparison | null): ComparisonPair | null {
  if (initialComparison) {
    return {
      fromSeasonId: initialComparison.fromSeason.id,
      toSeasonId: initialComparison.toSeason.id,
    };
  }

  if (seasons.length < 2) {
    return null;
  }

  const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0];
  const historicalSeason =
    seasons.find((season) => !season.isActive && season.id !== activeSeason.id) ??
    seasons.find((season) => season.id !== activeSeason.id);

  return historicalSeason
    ? {
        fromSeasonId: historicalSeason.id,
        toSeasonId: activeSeason.id,
      }
    : null;
}

function formatSignedNumber(value: number, suffix = "") {
  if (value > 0) {
    return `+${value.toLocaleString()}${suffix}`;
  }

  return `${value.toLocaleString()}${suffix}`;
}

function deltaTone(value: number) {
  if (value > 0) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value < 0) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-muted bg-muted/50 text-muted-foreground";
}

function deltaIcon(value: number) {
  if (value > 0) {
    return <TrendUp size={14} aria-hidden="true" />;
  }

  if (value < 0) {
    return <TrendDown size={14} aria-hidden="true" />;
  }

  return null;
}

export function SeasonComparisonReport({
  seasons,
  initialComparison = null,
  onCompare,
}: SeasonComparisonReportProps) {
  const initialPair = useMemo(
    () => defaultPair(seasons, initialComparison),
    [initialComparison, seasons],
  );
  const [selectedPair, setSelectedPair] = useState<ComparisonPair | null>(initialPair);
  const [comparison, setComparison] = useState<SeasonComparison | null>(initialComparison);
  const [isPending, startTransition] = useTransition();
  const canCompare = seasons.length > 1 && selectedPair !== null;
  const isSameSeason =
    selectedPair !== null && selectedPair.fromSeasonId === selectedPair.toSeasonId;
  const hasActivity = Boolean(
    comparison?.houses.some((house) => house.from.transactions > 0 || house.to.transactions > 0),
  );
  const biggestGain = comparison?.houses.reduce<SeasonComparison["houses"][number] | null>(
    (current, house) =>
      !current || house.delta.pointChange > current.delta.pointChange ? house : current,
    null,
  );
  const biggestClimb = comparison?.houses.reduce<SeasonComparison["houses"][number] | null>(
    (current, house) =>
      !current || house.delta.rankChange > current.delta.rankChange ? house : current,
    null,
  );

  function updateComparison(nextPair: ComparisonPair) {
    setSelectedPair(nextPair);

    if (nextPair.fromSeasonId === nextPair.toSeasonId) {
      return;
    }

    startTransition(async () => {
      try {
        const nextComparison = await onCompare(nextPair.fromSeasonId, nextPair.toSeasonId);
        setComparison(nextComparison);
      } catch (error) {
        toast.error("Failed to compare seasons", {
          description: error instanceof Error ? error.message : "Season comparison could not be loaded.",
        });
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card" aria-label="Season comparison report">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ChartLineUp size={18} className="text-primary" />
            Compare seasons
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare house momentum, rank movement, and top contributors across two seasons.
          </p>
        </div>

        {canCompare ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">
              From
              <select
                value={selectedPair.fromSeasonId}
                onChange={(event) =>
                  updateComparison({
                    fromSeasonId: event.target.value,
                    toSeasonId: selectedPair.toSeasonId,
                  })
                }
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                disabled={isPending}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.isActive ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              To
              <select
                value={selectedPair.toSeasonId}
                onChange={(event) =>
                  updateComparison({
                    fromSeasonId: selectedPair.fromSeasonId,
                    toSeasonId: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                disabled={isPending}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.isActive ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {!canCompare ? (
        <p className="p-6 text-sm text-muted-foreground">
          Season comparison becomes available after another season exists.
        </p>
      ) : isSameSeason ? (
        <p className="p-6 text-sm text-amber-700">
          Choose two different seasons to compare.
        </p>
      ) : !comparison ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <ArrowsClockwise size={16} className={isPending ? "animate-spin" : ""} />
          Select seasons to load a comparison.
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Biggest point gain
              </p>
              <p className="mt-2 text-sm font-semibold">
                {biggestGain ? biggestGain.houseName : "No house data"}
              </p>
              {biggestGain ? (
                <p className="font-number text-2xl font-bold text-emerald-700">
                  {formatSignedNumber(biggestGain.delta.pointChange)}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Biggest rank climb
              </p>
              <p className="mt-2 text-sm font-semibold">
                {biggestClimb ? biggestClimb.houseName : "No house data"}
              </p>
              {biggestClimb ? (
                <p className="font-number text-2xl font-bold text-emerald-700">
                  {formatSignedNumber(biggestClimb.delta.rankChange)}
                </p>
              ) : null}
            </div>
          </div>

          {!hasActivity ? (
            <p className="rounded-lg border bg-background/60 p-4 text-sm text-muted-foreground">
              No point activity was recorded in either selected season.
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border">
            <div className="hidden grid-cols-[1.4fr_repeat(4,1fr)] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span>House</span>
              <span>{comparison.fromSeason.name}</span>
              <span>{comparison.toSeason.name}</span>
              <span>Delta</span>
              <span>Top contributor</span>
            </div>
            <div className="divide-y">
              {comparison.houses.map((house) => (
                <article
                  key={house.houseId}
                  className="grid gap-3 p-4 md:grid-cols-[1.4fr_repeat(4,1fr)] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: house.houseColor }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{house.houseName}</p>
                      <p className="text-xs text-muted-foreground">
                        Rank {house.from.rank} to {house.to.rank}
                      </p>
                    </div>
                  </div>
                  <MetricBlock label={comparison.fromSeason.name} metric={house.from} />
                  <MetricBlock label={comparison.toSeason.name} metric={house.to} />
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-1 font-number text-xs font-bold",
                        deltaTone(house.delta.pointChange),
                      )}
                    >
                      {deltaIcon(house.delta.pointChange)}
                      {formatSignedNumber(house.delta.pointChange)}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rank {formatSignedNumber(house.delta.rankChange)}
                    </p>
                  </div>
                  <div className="text-sm">
                    {house.to.topContributor ? (
                      <>
                        <p className="font-semibold">{house.to.topContributor.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {house.to.topContributor.points.toLocaleString()} points
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">No contributor yet</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricBlock({
  label,
  metric,
}: {
  label: string;
  metric: SeasonComparison["houses"][number]["from"];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground md:hidden">{label}</p>
      <p className="font-number text-lg font-bold">{metric.points.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">
        {metric.transactions} transaction{metric.transactions === 1 ? "" : "s"} -{" "}
        {metric.averagePointsPerDay.toLocaleString()} pts/day
      </p>
    </div>
  );
}
