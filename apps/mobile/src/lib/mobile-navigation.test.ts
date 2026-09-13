import { describe, expect, it } from "vitest";

import { mobilePrimaryNavigation } from "./mobile-navigation";

describe("mobilePrimaryNavigation", () => {
  it("matches the web navigation order for members", () => {
    const visible = mobilePrimaryNavigation(false).filter((item) => item.visible);

    expect(visible.map((item) => item.title)).toEqual([
      "Home",
      "Activity",
      "Leaderboard",
    ]);
  });

  it("adds Manage last for admins and owners", () => {
    const visible = mobilePrimaryNavigation(true).filter((item) => item.visible);

    expect(visible.map((item) => item.title)).toEqual([
      "Home",
      "Activity",
      "Leaderboard",
      "Manage",
    ]);
    expect(visible.map((item) => item.route)).not.toContain("profile");
  });
});
