import {
  POINT_REACTION_KEYS,
  type ActivityItem,
  type PointReactionKey,
  type PointReactionResponse,
} from "@housepoints/contracts";

export const REACTION_EMOJI: Record<PointReactionKey, string> = {
  clap: "👏",
  heart: "❤️",
  star: "⭐",
  sparkles: "✨",
  raisedHands: "🙌",
  hundred: "💯",
  party: "🎉",
  fire: "🔥",
  rocket: "🚀",
  trophy: "🏆",
};

export const MOBILE_REACTION_KEYS = POINT_REACTION_KEYS;

export function nextReactionKey(
  current: PointReactionKey | null | undefined,
  selected: PointReactionKey,
): PointReactionKey | null {
  return current === selected ? null : selected;
}

export function optimisticReactionResponse(
  item: ActivityItem,
  nextKey: PointReactionKey | null,
): PointReactionResponse {
  const counts = new Map(
    (item.reactions ?? []).map((reaction) => [reaction.reactionKey, reaction.count]),
  );
  const previousKey = item.myReactionKey ?? null;
  if (previousKey) {
    counts.set(previousKey, Math.max(0, (counts.get(previousKey) ?? 0) - 1));
  }
  if (nextKey) {
    counts.set(nextKey, (counts.get(nextKey) ?? 0) + 1);
  }
  return {
    transactionId: item.id,
    myReactionKey: nextKey,
    reactions: MOBILE_REACTION_KEYS.flatMap((reactionKey) => {
      const count = counts.get(reactionKey) ?? 0;
      return count > 0 ? [{ reactionKey, count }] : [];
    }),
  };
}

