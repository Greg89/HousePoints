"use client";

import { motion } from "framer-motion";
import { Users } from "@phosphor-icons/react";
import type { LeaderboardEntry } from "@housepoints/contracts";
import { cn } from "@/lib/cn";

interface HouseCardProps {
  house: LeaderboardEntry;
  rank: number;
  selected?: boolean;
  onSelect?: () => void;
}

export function HouseCard({ house, rank, selected = false, onSelect }: HouseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.05 }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "relative block h-full w-full overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
        )}
        style={{ borderTop: `4px solid ${house.color}` }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: `linear-gradient(135deg, ${house.color} 0%, transparent 100%)` }}
        />
        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-2xl font-semibold text-foreground">
                {house.name}
              </h3>
              {house.description && (
                <p className="mt-1 text-sm text-muted-foreground">{house.description}</p>
              )}
            </div>
            <span
              className="rounded-full px-3 py-1 text-sm font-display font-semibold border"
              style={{
                backgroundColor: `${house.color}20`,
                color: house.color,
                borderColor: `${house.color}60`,
              }}
            >
              #{rank}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users size={18} />
              <span className="text-sm">
                {house.memberCount} {house.memberCount === 1 ? "member" : "members"}
              </span>
            </div>
            <div className="text-right">
              <div
                className="font-number text-3xl font-bold"
                style={{ color: house.color }}
              >
                {house.score.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">points</div>
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            {selected ? "Showing house report" : "Open house report"}
          </p>
        </div>
      </button>
    </motion.div>
  );
}
