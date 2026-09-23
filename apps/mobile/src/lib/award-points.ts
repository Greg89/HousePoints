export const AWARD_POINTS_MIN = 1;
export const AWARD_POINTS_MAX = 100;
export const AWARD_POINTS_DEFAULT = 5;

/** Keep empty and invalid edits out of the award request. */
export function parseAwardPoints(input: string): number | null {
  if (!/^\d+$/.test(input)) return null;
  const points = Number(input);
  return Number.isSafeInteger(points) &&
    points >= AWARD_POINTS_MIN && points <= AWARD_POINTS_MAX
    ? points
    : null;
}

export function stepAwardPoints(input: string, change: -1 | 1): string {
  const current = /^\d+$/.test(input) ? Number(input) : AWARD_POINTS_DEFAULT;
  return String(Math.max(AWARD_POINTS_MIN, Math.min(AWARD_POINTS_MAX, current + change)));
}
