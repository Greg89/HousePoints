"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, DotsThreeVertical, Eye, Trash } from "@phosphor-icons/react";
import type { ActivityItem, PointReactionKey } from "@housepoints/contracts";
import { POINT_REACTION_KEYS, POINT_REACTION_LABELS, TRAIT_LABELS } from "@housepoints/contracts";

interface ActivityCardProps {
  item: ActivityItem;
  index: number;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  canReact?: boolean;
  isReacting?: boolean;
  onReact?: (reactionKey: PointReactionKey) => void;
  canViewReactions?: boolean;
  isLoadingReactions?: boolean;
  onViewReactions?: () => void;
}

const REACTION_EMOJI: Record<PointReactionKey, string> = {
  clap: "👏",
  heart: "❤️",
  fire: "🔥",
  party: "🎉",
  star: "⭐",
};

const VISIBLE_REACTION_KEYS = POINT_REACTION_KEYS.filter(
  (reactionKey) => reactionKey !== "star",
);

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

export function ActivityCard({
  item,
  index,
  canDelete,
  isDeleting,
  onDelete,
  canReact = false,
  isReacting = false,
  onReact,
  canViewReactions = false,
  isLoadingReactions = false,
  onViewReactions,
}: ActivityCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const isDeduction = item.type === "DEDUCTION";
  const deltaLabel = `${item.delta > 0 ? "+" : ""}${item.delta}`;
  const actionLabel = isDeduction ? "deducted" : "recognized";
  const actionsMenuId = `activity-actions-${item.id}`;
  const hasActions = canDelete || canViewReactions;
  const canShowReactions = canReact && !isDeduction && Boolean(onReact);
  const reactionCounts = new Map(
    (item.reactions ?? []).map((reaction) => [reaction.reactionKey, reaction.count]),
  );
  const pointTone = isDeduction
    ? {
        badge: "border-destructive/20 bg-destructive/10 text-destructive",
        label: "text-destructive",
      }
    : {
        badge: "border-primary/20 bg-primary/10 text-primary",
        label: "text-primary",
      };

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
      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_7rem_9rem] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex flex-shrink-0 flex-col items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                {item.actorName[0]?.toUpperCase()}
              </div>
              <ArrowRight className="text-muted-foreground" size={13} />
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: item.targetHouseColor }}
              >
                {item.targetHouseName[0]?.toUpperCase()}
              </div>
            </div>
            {item.season ? (
              <span
                className={[
                  "max-w-24 truncate rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
                  item.season.isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700",
                ].join(" ")}
                title={item.season.name}
              >
                {item.season.name}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{item.actorName}</p>
            <p
              className={["text-xs font-semibold uppercase tracking-wide", pointTone.label].join(" ")}
            >
              {actionLabel}
            </p>
            <p className="truncate text-sm font-semibold">{item.targetUserName}</p>
            <p className="truncate text-xs text-muted-foreground">{item.targetHouseName}</p>
          </div>
        </div>

        <div className="min-w-0 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.reason}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {item.trait ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {TRAIT_LABELS[item.trait]}
              </span>
            ) : null}
            {isDeduction ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                Deducted
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {relativeTime(item.createdAt)}
            </span>
          </div>
        </div>

        <div
          className={[
            "flex items-center justify-between rounded-2xl border px-3 py-2 lg:min-h-20 lg:flex-col lg:justify-center lg:text-center",
            pointTone.badge,
          ].join(" ")}
        >
          <div className="font-number text-2xl font-bold leading-none">{deltaLabel}</div>
          <div
            className={[
              "text-[0.65rem] font-semibold uppercase tracking-wide lg:mt-1",
              pointTone.label,
            ].join(" ")}
          >
            points
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          {canShowReactions ? (
            <div
              className="grid min-w-0 grid-cols-2 gap-1.5"
              aria-label={`Reactions for ${item.targetUserName}`}
            >
              {VISIBLE_REACTION_KEYS.map((reactionKey) => {
                const selected = item.myReactionKey === reactionKey;
                const count = reactionCounts.get(reactionKey) ?? 0;
                const label = selected
                  ? `Remove ${POINT_REACTION_LABELS[reactionKey]} reaction`
                  : `React with ${POINT_REACTION_LABELS[reactionKey]}`;

                return (
                  <button
                    key={reactionKey}
                    type="button"
                    aria-label={label}
                    aria-pressed={selected}
                    disabled={isReacting}
                    onClick={() => onReact?.(reactionKey)}
                    className={[
                      "inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-full border px-2 text-xs font-semibold transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
                      "disabled:cursor-wait disabled:opacity-60",
                    ].join(" ")}
                  >
                    <span aria-hidden="true">{REACTION_EMOJI[reactionKey]}</span>
                    {count > 0 ? <span>{count}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="min-w-0" />
          )}
          <div className="flex flex-shrink-0 items-start">
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
                    {canViewReactions ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActionsOpen(false);
                          onViewReactions?.();
                        }}
                        disabled={isLoadingReactions}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-50"
                      >
                        <Eye size={16} />
                        View reactions
                      </button>
                    ) : null}
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
      </div>
    </motion.div>
  );
}
