"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, ArrowRight, DotsThreeVertical, Trash } from "@phosphor-icons/react";
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
          visibleItems.map((item, index) => (
            <ActivityCard
              key={item.id}
              item={item}
              index={index}
              canDelete={canDelete && Boolean(onDelete)}
              isDeleting={deletingIds.has(item.id)}
              onDelete={() => handleDelete(item)}
            />
          ))
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

interface ActivityCardProps {
  item: ActivityItem;
  index: number;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}

function ActivityCard({
  item,
  index,
  canDelete,
  isDeleting,
  onDelete,
}: ActivityCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const isDeduction = item.type === "DEDUCTION";
  const deltaLabel = `${item.delta > 0 ? "+" : ""}${item.delta}`;
  const actionsMenuId = `activity-actions-${item.id}`;
  const hasActions = canDelete;

  useEffect(() => {
    if (!actionsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="rounded-xl border bg-card/70 p-4 transition-colors hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
            {item.actorName[0]?.toUpperCase()}
          </div>
          <ArrowRight className="text-muted-foreground mt-2.5 flex-shrink-0" size={14} />
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: item.targetHouseColor }}
          >
            {item.targetHouseName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <span className="font-semibold">{item.actorName}</span>
              <span className="text-muted-foreground">{isDeduction ? "deducted" : "awarded"}</span>
              {isDeduction ? (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  Deducted
                </span>
              ) : null}
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
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.reason}</p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-start gap-2">
          {item.season ? (
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-medium",
                item.season.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              ].join(" ")}
            >
              {item.season.name}
            </span>
          ) : null}
          {hasActions ? (
            <div ref={actionsRef} className="relative">
              <button
                type="button"
                onClick={() => setActionsOpen((current) => !current)}
                aria-label={`Activity actions for ${item.targetUserName}`}
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                aria-controls={actionsMenuId}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <DotsThreeVertical size={18} weight="bold" />
              </button>
              {actionsOpen ? (
                <div
                  id={actionsMenuId}
                  role="menu"
                  aria-label={`Activity actions for ${item.targetUserName}`}
                  className="absolute right-0 z-20 mt-2 w-52 rounded-xl border bg-card p-1 shadow-lg"
                >
                  {canDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActionsOpen(false);
                        onDelete();
                      }}
                      disabled={isDeleting}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50"
                    >
                      <Trash size={16} />
                      Delete point transaction
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {item.trait ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {TRAIT_LABELS[item.trait]}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {relativeTime(item.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}
