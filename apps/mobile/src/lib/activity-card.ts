import {
  POINT_REACTION_LABELS,
  TRAIT_LABELS,
  type ActivityItem,
  type PointReactionKey,
} from "@housepoints/contracts";

export type ActivityCardPresentation = {
  attributionLabel: "Recognized by" | "Deducted by";
  deltaLabel: string;
  isDeduction: boolean;
  targetInitial: string;
  traitLabel: string | null;
  relativeTime: string;
  topReactions: Array<{
    reactionKey: PointReactionKey;
    label: string;
    count: number;
    mine: boolean;
  }>;
};

export function activityCardPresentation(
  item: ActivityItem,
  now = Date.now(),
): ActivityCardPresentation {
  const isDeduction = item.type === "DEDUCTION" || item.delta < 0;
  const topReactions = [...(item.reactions ?? [])]
    .filter((reaction) => reaction.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((reaction) => ({
      ...reaction,
      label: POINT_REACTION_LABELS[reaction.reactionKey],
      mine: item.myReactionKey === reaction.reactionKey,
    }));

  return {
    attributionLabel: isDeduction ? "Deducted by" : "Recognized by",
    deltaLabel: `${item.delta > 0 ? "+" : ""}${item.delta}`,
    isDeduction,
    targetInitial: item.targetUserName.charAt(0).toUpperCase(),
    traitLabel: item.trait ? TRAIT_LABELS[item.trait] : null,
    relativeTime: formatRelativeTime(item.createdAt, now),
    topReactions,
  };
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
