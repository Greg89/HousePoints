import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";

type HouseRanking = DashboardSummary["houseMemberRankings"][number];

export type TopContributor = HouseRanking["members"][number] & {
  houseName: string;
  houseColor: string;
  rank: number;
};

export function topContributors(
  rankings: DashboardSummary["houseMemberRankings"],
  houses: LeaderboardEntry[],
  limit = 10,
): TopContributor[] {
  const housesById = new Map(houses.map((house) => [house.id, house]));

  return rankings
    .flatMap((ranking) => {
      const house = housesById.get(ranking.houseId);
      if (!house) return [];

      return ranking.members.map((member) => ({
        ...member,
        houseName: house.name,
        houseColor: house.color,
      }));
    })
    .filter((member) => member.points > 0)
    .sort(
      (a, b) =>
        b.points - a.points || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, limit)
    .map((member, index) => ({ ...member, rank: index + 1 }));
}

export function contributorInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
