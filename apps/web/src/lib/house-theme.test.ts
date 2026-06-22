import { describe, expect, it } from "vitest";
import { assessHouseThemeColor, resolveHouseThemeStyle } from "./house-theme";

describe("assessHouseThemeColor", () => {
  it("rejects colors that cannot produce a safe theme", () => {
    expect(assessHouseThemeColor("purple")).toMatchObject({
      status: "invalid",
      normalizedColor: null,
      foreground: null,
      contrastRatio: null,
    });
  });

  it("marks distinct house colors as theme ready", () => {
    expect(assessHouseThemeColor("#7c3aed")).toMatchObject({
      status: "ready",
      normalizedColor: "#7c3aed",
      foreground: "#ffffff",
    });
  });

  it("marks neutral colors as readable but subtle", () => {
    expect(assessHouseThemeColor("#777777")).toMatchObject({
      status: "subtle",
      normalizedColor: "#777777",
    });
  });
});

describe("resolveHouseThemeStyle", () => {
  it("returns no theme when the preference is disabled", () => {
    expect(resolveHouseThemeStyle({ enabled: false, houseColor: "#7c3aed" })).toBeUndefined();
  });

  it("returns no theme for missing or invalid colors", () => {
    expect(resolveHouseThemeStyle({ enabled: true, houseColor: null })).toBeUndefined();
    expect(resolveHouseThemeStyle({ enabled: true, houseColor: "purple" })).toBeUndefined();
    expect(resolveHouseThemeStyle({ enabled: true, houseColor: "#123" })).toBeUndefined();
  });

  it("generates semantic theme variables from a valid house color", () => {
    expect(resolveHouseThemeStyle({ enabled: true, houseColor: "#7c3aed" })).toEqual({
      "--primary": "#7c3aed",
      "--primary-foreground": "#ffffff",
      "--accent": "color-mix(in oklab, #7c3aed 68%, white)",
      "--accent-foreground": "#ffffff",
      "--ring": "color-mix(in oklab, #7c3aed 78%, white)",
    });
  });

  it("uses a dark foreground for bright house colors", () => {
    expect(resolveHouseThemeStyle({ enabled: true, houseColor: "#facc15" })).toMatchObject({
      "--primary-foreground": "#111827",
      "--accent-foreground": "#111827",
    });
  });
});
