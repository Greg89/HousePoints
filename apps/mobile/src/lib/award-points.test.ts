import { describe, expect, it } from "vitest";

import { parseAwardPoints, stepAwardPoints } from "./award-points";

describe("manual award points", () => {
  it.each([1, 5, 37, 99, 100])("accepts %i points", (points) => {
    expect(parseAwardPoints(String(points))).toBe(points);
  });

  it.each(["", "0", "101", "999", "-1", "1.5", "1e2", "abc", " 5 "])(
    "rejects an invalid edit %j before submission", (input) => {
      expect(parseAwardPoints(input)).toBeNull();
    },
  );

  it("lets the user clear and replace the amount with the maximum", () => {
    expect(["5", "", "1", "10", "100"].map(parseAwardPoints)).toEqual([
      5, null, 1, 10, 100,
    ]);
  });

  it("steps from a manually entered value and preserves the limits", () => {
    expect(stepAwardPoints("37", 1)).toBe("38");
    expect(stepAwardPoints("37", -1)).toBe("36");
    expect(stepAwardPoints("100", 1)).toBe("100");
    expect(stepAwardPoints("1", -1)).toBe("1");
  });

  it("recovers from empty and out-of-range edits with the stepper", () => {
    expect(stepAwardPoints("", 1)).toBe("6");
    expect(stepAwardPoints("0", -1)).toBe("1");
    expect(stepAwardPoints("999", -1)).toBe("100");
  });
});
