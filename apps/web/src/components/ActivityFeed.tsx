"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Clock } from "@phosphor-icons/react";
import type {
  ActivityFeedRequest,
  ActivityItem,
  OrgMember,
  PagedActivityFeed,
  PointReactionDetailsResponse,
  PointReactionKey,
  PointReactionResponse,
  PointTransactionType,
} from "@housepoints/contracts";
import { POINT_REACTION_LABELS } from "@housepoints/contracts";
import type { DeletePointResult, PointReactionDetailsResult, PointReactionResult } from "@/lib/action-results";
import { ActivityCard } from "./ActivityCard";
import { REACTION_EMOJI } from "./point-reactions";

type ActivityTypeFilter = "ALL" | PointTransactionType;

const FILTER_OPTIONS: Array<{ value: ActivityTypeFilter; label: string; description: string }> = [
  { value: "ALL", label: "All", description: "Recognition and deductions" },
  { value: "AWARD", label: "Recognition", description: "Points awarded by teammates" },
  { value: "DEDUCTION", label: "Deductions", description: "Admin point deductions" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

interface ActivityFeedProps {
  items: ActivityItem[];
  members: OrgMember[];
  nextCursor: string | null;
  onLoadMore: (request: Pick<ActivityFeedRequest, "cursor" | "type" | "targetUserId">) => Promise<PagedActivityFeed>;
  canDelete?: boolean;
  onDelete?: (transactionId: string) => Promise<DeletePointResult>;
  onReact?: (
    transactionId: string,
    reactionKey: PointReactionKey | null,
  ) => Promise<PointReactionResult<PointReactionResponse>>;
  onReadReactions?: (
    transactionId: string,
  ) => Promise<PointReactionDetailsResult<PointReactionDetailsResponse>>;
}

export function ActivityFeed({
  items,
  members,
  nextCursor,
  onLoadMore,
  canDelete = false,
  onDelete,
  onReact,
  onReadReactions,
}: ActivityFeedProps) {
  const [visibleItems, setVisibleItems] = useState(items);
  const [cursor, setCursor] = useState(nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reactingIds, setReactingIds] = useState<Set<string>>(() => new Set());
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [reactionDetailsContext, setReactionDetailsContext] = useState<{
    transactionId: string;
    targetUserName: string;
    reason: string;
  } | null>(null);
  const [reactionDetails, setReactionDetails] = useState<PointReactionDetailsResponse | null>(null);
  const [reactionDetailsError, setReactionDetailsError] = useState<string | null>(null);
  const [loadingReactionDetailsId, setLoadingReactionDetailsId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActivityTypeFilter>("ALL");
  const [activeMemberId, setActiveMemberId] = useState("ALL");

  function buildActivityRequest(options: {
    cursor?: string;
    type?: ActivityTypeFilter;
    targetUserId?: string;
  } = {}): Pick<ActivityFeedRequest, "cursor" | "type" | "targetUserId"> {
    const typeFilter = options.type ?? activeFilter;
    const memberId = options.targetUserId ?? activeMemberId;

    return {
      ...(options.cursor ? { cursor: options.cursor } : {}),
      ...(typeFilter === "ALL" ? {} : { type: typeFilter }),
      ...(memberId === "ALL" ? {} : { targetUserId: memberId }),
    };
  }

  async function handleFilterChange(nextFilter: ActivityTypeFilter) {
    if (nextFilter === activeFilter || isLoadingMore) {
      return;
    }

    setActiveFilter(nextFilter);
    setIsLoadingMore(true);
    setLoadMoreError(null);
    setDeleteError(null);

    try {
      const page = await onLoadMore(buildActivityRequest({ type: nextFilter }));
      setVisibleItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      setLoadMoreError("Activity could not be filtered. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleMemberChange(nextMemberId: string) {
    if (nextMemberId === activeMemberId || isLoadingMore) {
      return;
    }

    setActiveMemberId(nextMemberId);
    setIsLoadingMore(true);
    setLoadMoreError(null);
    setDeleteError(null);

    try {
      const page = await onLoadMore(buildActivityRequest({ targetUserId: nextMemberId }));
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
      const page = await onLoadMore(buildActivityRequest({ cursor }));
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

  async function handleReact(item: ActivityItem, reactionKey: PointReactionKey) {
    if (!onReact || reactingIds.has(item.id) || item.type !== "AWARD") {
      return;
    }

    const nextReactionKey = item.myReactionKey === reactionKey ? null : reactionKey;
    setReactionError(null);
    setReactingIds((current) => new Set(current).add(item.id));

    try {
      const result = await onReact(item.id, nextReactionKey);

      if (!result.ok) {
        setReactionError(result.message);
        return;
      }

      setVisibleItems((current) =>
        current.map((visibleItem) =>
          visibleItem.id === item.id
            ? {
                ...visibleItem,
                myReactionKey: result.reaction.myReactionKey,
                reactions: result.reaction.reactions,
              }
            : visibleItem,
        ),
      );
    } catch {
      setReactionError("Reaction could not be saved. Please try again.");
    } finally {
      setReactingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleViewReactions(item: ActivityItem) {
    if (!onReadReactions || loadingReactionDetailsId === item.id) {
      return;
    }

    setReactionDetailsContext({
      transactionId: item.id,
      targetUserName: item.targetUserName,
      reason: item.reason,
    });
    setReactionDetails(null);
    setReactionDetailsError(null);
    setLoadingReactionDetailsId(item.id);

    try {
      const result = await onReadReactions(item.id);

      if (!result.ok) {
        setReactionDetailsError(result.message);
        return;
      }

      setReactionDetails(result.details);
    } catch {
      setReactionDetailsError("Reactions could not be loaded. Please try again.");
    } finally {
      setLoadingReactionDetailsId(null);
    }
  }

  const hasActiveFilters = activeFilter !== "ALL" || activeMemberId !== "ALL";
  const reactionDetailsOpen = Boolean(reactionDetailsContext);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Clock size={24} />
            Team Activity
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recognition, deductions, and teammate moments across the organization.
          </p>
        </div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-xl border bg-background/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filters
          </p>
          <div className="mt-2 grid gap-2" aria-label="Activity filters">
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
                    "w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors",
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
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Member
            <select
              value={activeMemberId}
              onChange={(event) => void handleMemberChange(event.target.value)}
              disabled={isLoadingMore}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:cursor-wait disabled:opacity-60"
            >
              <option value="ALL">All members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
        </aside>

        <div className="overflow-y-auto max-h-[540px] space-y-3 pr-1">
          {visibleItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {!hasActiveFilters
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
                canReact={Boolean(onReact)}
                isReacting={reactingIds.has(item.id)}
                onReact={(reactionKey) => handleReact(item, reactionKey)}
                canViewReactions={
                  Boolean(onReadReactions)
                  && item.type === "AWARD"
                  && (item.reactions ?? []).some((reaction) => reaction.count > 0)
                }
                isLoadingReactions={loadingReactionDetailsId === item.id}
                onViewReactions={() => void handleViewReactions(item)}
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
          {reactionError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {reactionError}
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
      <Dialog.Root
        open={reactionDetailsOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReactionDetailsContext(null);
            setReactionDetails(null);
            setReactionDetailsError(null);
            setLoadingReactionDetailsId(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="shrink-0 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-2xl font-semibold">
                  Reactions
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {reactionDetailsContext
                    ? `People who reacted to ${reactionDetailsContext.targetUserName}'s recognition.`
                    : "People who reacted to this recognition."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close reaction details"
                >
                  x
                </button>
              </Dialog.Close>
            </div>

            {reactionDetailsContext ? (
              <div className="mt-4 shrink-0 rounded-xl border bg-muted/20 p-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {reactionDetailsContext.reason}
                </p>
              </div>
            ) : null}

            <div
              className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
              role="region"
              aria-label="Reaction details list"
            >
              {loadingReactionDetailsId ? (
                <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Loading reactions...
                </p>
              ) : null}

              {reactionDetailsError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {reactionDetailsError}
                </p>
              ) : null}

              {!loadingReactionDetailsId && !reactionDetailsError && reactionDetails?.reactions.length === 0 ? (
                <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No active reactions yet.
                </p>
              ) : null}

              {reactionDetails?.reactions.map((reaction) => (
                <div
                  key={reaction.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="shrink-0 text-lg leading-none"
                      title={POINT_REACTION_LABELS[reaction.reactionKey]}
                      role="img"
                      aria-label={POINT_REACTION_LABELS[reaction.reactionKey]}
                    >
                      {REACTION_EMOJI[reaction.reactionKey]}
                    </span>
                    <p className="truncate font-semibold">{reaction.actorName}</p>
                  </div>
                  <time
                    dateTime={reaction.updatedAt}
                    className="shrink-0 text-right text-xs text-muted-foreground"
                  >
                    {dateTimeFormatter.format(new Date(reaction.updatedAt))}
                  </time>
                </div>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
