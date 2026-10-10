import type { DashboardSummary, LeaderboardEntry } from "./dashboard-schemas.js";
import { TRAIT_LABELS } from "./point-schemas.js";

/** Shared web/native dashboard projection; totals and rankings remain server-owned. */
export function selectOverviewReport(
  summary: DashboardSummary,
  house?: Pick<LeaderboardEntry, "id" | "name"> | null,
  categoryMode = false,
) {
  const leaders = (categoryMode
    ? summary.categoryLeaders.map((entry) => ({ ...entry, name: entry.category?.name ?? null }))
    : summary.traitLeaders.map((entry) => ({ ...entry, name: entry.trait ? TRAIT_LABELS[entry.trait] : null })))
    .filter((entry) => !house || entry.houseId === house.id);
  const velocity = summary.pointsVelocity.filter((entry) => !house || entry.houseId === house.id);

  return {
    standout: house
      ? summary.seasonStandoutsByHouse.find((entry) => entry.houseId === house.id)?.standout ?? null
      : summary.seasonStandout,
    leaders,
    // The activity contract currently identifies a recipient's house by name.
    // This is a subset of the dashboard snapshot, not a complete house ledger.
    recentActivity: summary.recentActivity
      .filter((item) => !house || item.targetHouseName === house.name)
      .slice(0, 8),
    velocity,
    maxVelocityPoints: Math.max(1, ...velocity.flatMap((entry) => entry.days.map((day) => day.points))),
    rankedMembers: house
      ? summary.houseMemberRankings.find((entry) => entry.houseId === house.id)?.members ?? []
      : [],
  };
}
