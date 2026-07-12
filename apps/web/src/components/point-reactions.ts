import { POINT_REACTION_KEYS, type PointReactionKey } from "@housepoints/contracts";

export const REACTION_EMOJI: Record<PointReactionKey, string> = {
  clap: "👏",
  heart: "❤️",
  fire: "🔥",
  party: "🎉",
  star: "⭐",
  sparkles: "✨",
  trophy: "🏆",
};

export const VISIBLE_REACTION_KEYS = POINT_REACTION_KEYS;
