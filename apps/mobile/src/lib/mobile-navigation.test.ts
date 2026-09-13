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

  it("uses icons matching the corresponding web destinations", () => {
    expect(
      mobilePrimaryNavigation(true).map(({ title, icon }) => ({ title, icon })),
    ).toEqual([
      { title: "Home", icon: "chart-bar" },
      { title: "Activity", icon: "clock-outline" },
      { title: "Leaderboard", icon: "trophy-outline" },
      { title: "Manage", icon: "wrench-outline" },
    ]);
  });
});
