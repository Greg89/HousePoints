/** Competition ranking: equal net scores share a place (1, 1, 3). */
export function rankScores<T extends { id: string; name: string; points: number }>(
  entries: readonly T[],
): Array<T & { rank: number }> {
  const sorted = [...entries].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry.points !== sorted[index - 1].points) rank = index + 1;
    return { ...entry, rank };
  });
}

/** A season without transactions has no winner, even when houses exist. */
export function scoreWinners<T extends { id: string; name: string; points: number }>(
  entries: readonly T[],
  transactionCount: number,
): Array<T & { rank: number }> {
  if (transactionCount === 0) return [];
  return rankScores(entries).filter((entry) => entry.rank === 1);
}
