"use client";

import { motion } from "framer-motion";
import { Trophy, Crown, Medal } from "@phosphor-icons/react";
import type { OrgMember } from "@housepoints/contracts";

interface LeaderboardProps {
  /** Members enriched with house color */
  members: OrgMember[];
  /** Sorted by points desc — produced server-side */
  memberPoints: { memberId: string; points: number }[];
  seasonName?: string;
  isHistoricalSeason?: boolean;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown weight="fill" className="text-yellow-500" size={22} />;
  if (rank === 2) return <Trophy weight="fill" className="text-slate-400" size={20} />;
  if (rank === 3) return <Medal weight="fill" className="text-orange-600" size={20} />;
  return null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Leaderboard({
  members,
  memberPoints,
  seasonName,
  isHistoricalSeason = false,
}: LeaderboardProps) {
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const ranked = memberPoints
    .filter((mp) => mp.points > 0)
    .slice(0, 10)
    .map((mp, index) => ({
      member: memberMap.get(mp.memberId),
      points: mp.points,
      rank: index + 1,
    }))
    .filter((r) => r.member);

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <Trophy weight="fill" className="text-accent" size={22} />
              Top Contributors
            </h2>
            {seasonName ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Points received during {seasonName}.
              </p>
            ) : null}
          </div>
          {isHistoricalSeason ? (
            <span className="self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 sm:self-auto">
              Historical view
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-4 space-y-2">
        {ranked.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No points awarded yet — be the first!
          </p>
        ) : (
          ranked.map(({ member, points, rank }) => (
            <motion.div
              key={member!.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: rank * 0.04, duration: 0.25 }}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
            >
              <div className="w-7 flex justify-center flex-shrink-0">
                {getRankIcon(rank) ?? (
                  <span className="text-sm text-muted-foreground font-semibold">{rank}</span>
                )}
              </div>
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                style={{
                  backgroundColor: member!.houseColor ?? "var(--primary)",
                  border: member!.houseColor ? `2px solid ${member!.houseColor}` : undefined,
                }}
              >
                {initials(member!.displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{member!.displayName}</p>
                {member!.houseName && (
                  <p className="text-xs truncate" style={{ color: member!.houseColor ?? undefined }}>
                    {member!.houseName}
                  </p>
                )}
              </div>
              <span
                className="font-number font-bold text-sm px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: member!.houseColor ? `${member!.houseColor}20` : "var(--muted)",
                  color: member!.houseColor ?? "var(--foreground)",
                }}
              >
                {points.toLocaleString()}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
