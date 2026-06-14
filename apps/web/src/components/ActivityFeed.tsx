"use client";

import { motion } from "framer-motion";
import { Clock, ArrowRight } from "@phosphor-icons/react";
import type { ActivityItem } from "@housepoints/contracts";

interface ActivityFeedProps {
  items: ActivityItem[];
}

function relativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Clock size={22} />
          Recent Activity
        </h2>
      </div>
      <div className="overflow-y-auto max-h-[500px] p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No activity yet. Award some points!
          </p>
        ) : (
          items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/20 transition-colors"
            >
              {/* Actor initial avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                {item.actorName[0]?.toUpperCase()}
              </div>
              <ArrowRight className="text-muted-foreground mt-2 flex-shrink-0" size={14} />
              {/* Target house colored badge */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: item.targetHouseColor }}
              >
                {item.targetHouseName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1 text-sm">
                  <span className="font-semibold">{item.actorName}</span>
                  <span className="text-muted-foreground">awarded</span>
                  <span
                    className="font-number font-bold px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${item.targetHouseColor}20`,
                      color: item.targetHouseColor,
                    }}
                  >
                    +{item.delta}
                  </span>
                  <span className="text-muted-foreground">to</span>
                  <span className="font-semibold">{item.targetUserName}</span>
                  <span className="text-muted-foreground text-xs">({item.targetHouseName})</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.reason}</p>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {relativeTime(item.createdAt)}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
