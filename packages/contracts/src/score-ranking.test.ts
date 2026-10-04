import { describe, expect, it } from "vitest";
import { rankScores, scoreWinners } from "./score-ranking.js";

const entries = [
  { id: "c", name: "C", points: -2 },
  { id: "b", name: "B", points: 0 },
  { id: "a", name: "A", points: 0 },
];

describe("score ranking", () => {
  it("uses competition ranks and stable name/ID ordering for ties", () => {
    expect(rankScores(entries).map(({ id, rank }) => [id, rank])).toEqual([
      ["a", 1], ["b", 1], ["c", 3],
    ]);
  });

  it("returns every co-winner, including zero or negative leaders, only when transactions exist", () => {
    expect(scoreWinners(entries, 1).map(({ id }) => id)).toEqual(["a", "b"]);
    expect(scoreWinners(entries, 0)).toEqual([]);
    expect(scoreWinners([{ id: "a", name: "A", points: -3 }], 1)).toHaveLength(1);
  });
});
