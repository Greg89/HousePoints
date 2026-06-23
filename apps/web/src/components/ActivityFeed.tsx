"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, ArrowRight, X } from "@phosphor-icons/react";
import type { ActivityItem, PagedActivityFeed } from "@housepoints/contracts";
import { TRAIT_LABELS } from "@housepoints/contracts";
import type { DeletePointResult } from "@/lib/action-results";

interface ActivityFeedProps {
  items: ActivityItem[];
  nextCursor: string | null;
  onLoadMore: (cursor: string) => Promise<PagedActivityFeed>;
  canDelete?: boolean;
  onDelete?: (transactionId: string) => Promise<DeletePointResult>;
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

export function ActivityFeed({
  items,
  nextCursor,
  onLoadMore,
  canDelete = false,
  onDelete,
}: ActivityFeedProps) {
  const [visibleItems, setVisibleItems] = useState(items);
  const [cursor, setCursor] = useState(nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLoadMore() {
    if (!cursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const page = await onLoadMore(cursor);
      setVisibleItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setLoadMoreError("More activity could not be loaded. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleDelete(item: ActivityItem) {
    if (!canDelete || !onDelete || deletingIds.has(item.id)) {
      return;
    }

    const transactionLabel = item.type === "DEDUCTION" ? "deduction" : "award";
    const confirmed = window.confirm(
      `Delete this ${item.delta}-point ${transactionLabel} to ${item.targetUserName}? Scores will be recalculated without it.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingIds((current) => new Set(current).add(item.id));

    try {
      const result = await onDelete(item.id);

      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }

      setVisibleItems((current) => current.filter((visibleItem) => visibleItem.id !== item.id));
    } catch {
      setDeleteError("The point award could not be deleted. Please try again.");
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Clock size={22} />
          Recent Activity
        </h2>
      </div>
      <div className="overflow-y-auto max-h-[500px] p-4 space-y-3">
        {visibleItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No activity yet. Award some points!
          </p>
        ) : (
          visibleItems.map((item, index) => {
            const isDeduction = item.type === "DEDUCTION";
            const deltaLabel = `${item.delta > 0 ? "+" : ""}${item.delta}`;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, duration: 0.2 }}
                className="relative flex items-start gap-3 rounded-lg border p-3 pr-28 transition-colors hover:bg-muted/20 sm:pr-36"
              >
              {item.season ? (
                <span
                  className={[
                    "absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-medium",
                    item.season.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700",
                  ].join(" ")}
                >
                  {item.season.name}
                </span>
              ) : null}
              {canDelete && onDelete ? (
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={deletingIds.has(item.id)}
                  aria-label={`Delete point transaction for ${item.targetUserName}`}
                  title="Delete point transaction"
                  className="absolute right-3 bottom-3 inline-flex h-7 w-7 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-wait disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              ) : null}
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
                  <span className="text-muted-foreground">{isDeduction ? "deducted" : "awarded"}</span>
                  <span
                    className="font-number font-bold px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: isDeduction ? "rgb(254 226 226)" : `${item.targetHouseColor}20`,
                      color: isDeduction ? "rgb(185 28 28)" : item.targetHouseColor,
                    }}
                  >
                    {deltaLabel}
                  </span>
                  <span className="text-muted-foreground">to</span>
                  <span className="font-semibold">{item.targetUserName}</span>
                  <span className="text-muted-foreground text-xs">({item.targetHouseName})</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.reason}</p>
                {item.trait && (
                  <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {TRAIT_LABELS[item.trait]}
                  </span>
                )}
                <span className="text-xs text-muted-foreground mt-1 block">
                  {relativeTime(item.createdAt)}
                </span>
              </div>
              </motion.div>
            );
          })
        )}
        {loadMoreError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadMoreError}
          </p>
        ) : null}
        {deleteError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {deleteError}
          </p>
        ) : null}
        {cursor ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
