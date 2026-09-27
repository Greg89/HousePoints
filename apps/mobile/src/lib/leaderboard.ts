import { rankScores, type DashboardSummary, type LeaderboardEntry } from "@housepoints/contracts";

type HouseRanking = DashboardSummary["houseMemberRankings"][number];

export type TopContributor = HouseRanking["members"][number] & {
  memberId: string;
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

  const byMember = new Map<string, Omit<TopContributor, "rank">>();
  for (const ranking of rankings) {
      const house = housesById.get(ranking.houseId);
      if (!house) continue;
      for (const member of ranking.members) {
        if (!member.memberId || member.isCurrentMember === false) continue;
        const existing = byMember.get(member.memberId);
        const currentHouse = member.currentHouseId ? housesById.get(member.currentHouseId) : null;
        byMember.set(member.memberId, {
          ...member,
          memberId: member.memberId,
          houseName: currentHouse?.name ?? existing?.houseName ?? house.name,
          houseColor: currentHouse?.color ?? existing?.houseColor ?? house.color,
          points: (existing?.points ?? 0) + member.points,
        });
      }
  }

  return rankScores([...byMember.values()]
    .filter((member) => member.points > 0)
    .map((member) => ({ ...member, id: member.memberId, name: member.displayName })))
    .slice(0, limit)
    .map((member) => ({
      memberId: member.memberId, displayName: member.displayName, role: member.role,
      points: member.points, rank: member.rank, isCurrentMember: member.isCurrentMember,
      currentHouseId: member.currentHouseId,
      houseName: member.houseName, houseColor: member.houseColor,
    }));
}

export function contributorInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
