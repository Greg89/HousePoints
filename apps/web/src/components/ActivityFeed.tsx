"use client";

import { useState } from "react";
import { Clock } from "@phosphor-icons/react";
import type { ActivityFeedRequest, ActivityItem, PagedActivityFeed, PointTransactionType } from "@housepoints/contracts";
import type { DeletePointResult } from "@/lib/action-results";
import { ActivityCard } from "./ActivityCard";

type ActivityTypeFilter = "ALL" | PointTransactionType;

const FILTER_OPTIONS: Array<{ value: ActivityTypeFilter; label: string; description: string }> = [
  { value: "ALL", label: "All", description: "Recognition and deductions" },
  { value: "AWARD", label: "Recognition", description: "Points awarded by teammates" },
  { value: "DEDUCTION", label: "Deductions", description: "Admin point deductions" },
];

interface ActivityFeedProps {
  items: ActivityItem[];
  nextCursor: string | null;
  onLoadMore: (request: Pick<ActivityFeedRequest, "cursor" | "type">) => Promise<PagedActivityFeed>;
  canDelete?: boolean;
  onDelete?: (transactionId: string) => Promise<DeletePointResult>;
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
  const [activeFilter, setActiveFilter] = useState<ActivityTypeFilter>("ALL");

  const activeRequestType = activeFilter === "ALL" ? undefined : activeFilter;

  async function handleFilterChange(nextFilter: ActivityTypeFilter) {
    if (nextFilter === activeFilter || isLoadingMore) {
      return;
    }

    setActiveFilter(nextFilter);
    setIsLoadingMore(true);
    setLoadMoreError(null);
    setDeleteError(null);

    try {
      const page = await onLoadMore(nextFilter === "ALL" ? {} : { type: nextFilter });
      setVisibleItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      setLoadMoreError("Activity could not be filtered. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleLoadMore() {
    if (!cursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const page = await onLoadMore({ cursor, ...(activeRequestType ? { type: activeRequestType } : {}) });
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
      <div className="border-b p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Clock size={24} />
              Team Activity
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recognition, deductions, and teammate moments across the organization.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Activity filters">
            {FILTER_OPTIONS.map((option) => {
              const selected = option.value === activeFilter;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void handleFilterChange(option.value)}
                  aria-pressed={selected}
                  disabled={isLoadingMore}
                  title={option.description}
                  className={[
                    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    "disabled:cursor-wait disabled:opacity-60",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="overflow-y-auto max-h-[500px] p-4 space-y-3">
        {visibleItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {activeFilter === "ALL"
              ? "No team activity yet. Award some points!"
              : "No activity matches this filter yet."}
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
              {isLoadingMore ? "Loading..." : "Load more activity"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
