import { rankScores } from "./score-ranking.js";
import type { DashboardSummary, LeaderboardEntry } from "./dashboard-schemas.js";

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


/** Member projection shared by native and future web performance views. */
export function selectMemberOverview(summary: Pick<DashboardSummary, "houseMemberRankings">, houses: LeaderboardEntry[], memberId: string) {
  const contributor = topContributors(summary.houseMemberRankings, houses, Number.MAX_SAFE_INTEGER)
    .find((member) => member.memberId === memberId);
  const contributions = summary.houseMemberRankings.flatMap((ranking) => {
    const member = ranking.members.find((entry) => entry.memberId === memberId);
    const house = houses.find((entry) => entry.id === ranking.houseId);
    return member && house ? [{ houseId: house.id, houseName: house.name, houseColor: house.color, points: member.points }] : [];
  });
  return { rank: contributor?.rank ?? null, contributions };
}
