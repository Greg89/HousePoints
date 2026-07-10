import { describe, expect, it } from "vitest";
import { assessHouseThemeColor, resolveHouseThemeStyle } from "./house-theme";

const expectedThemeTokens = [
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--accent",
  "--accent-foreground",
  "--ring",
  "--house-page-wash",
  "--house-surface",
  "--house-surface-foreground",
  "--house-gradient-from",
  "--house-gradient-to",
  "--house-header-border",
  "--house-muted",
  "--house-muted-foreground",
];

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

  it.each([
    ["purple", "#7c3aed", "ready", "#ffffff"],
    ["green", "#22c55e", "ready", "#111827"],
    ["blue", "#1d4ed8", "ready", "#ffffff"],
    ["orange", "#f97316", "ready", "#111827"],
    ["red", "#dc2626", "ready", "#ffffff"],
    ["gray", "#777777", "subtle", "#111827"],
    ["near black", "#111827", "ready", "#ffffff"],
    ["near white", "#f8fafc", "subtle", "#111827"],
  ])("assesses representative %s themes", (_label, color, expectedStatus, expectedForeground) => {
    expect(assessHouseThemeColor(color)).toMatchObject({
      status: expectedStatus,
      normalizedColor: color,
      foreground: expectedForeground,
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
      "--secondary": "color-mix(in oklab, #7c3aed 72%, white)",
      "--secondary-foreground": "#111827",
      "--accent": "color-mix(in oklab, #7c3aed 28%, white)",
      "--accent-foreground": "#111827",
      "--ring": "color-mix(in oklab, #7c3aed 78%, white)",
      "--house-page-wash": "color-mix(in oklab, #7c3aed 8%, transparent)",
      "--house-surface": "color-mix(in oklab, #7c3aed 10%, white)",
      "--house-surface-foreground": "#111827",
      "--house-gradient-from": "color-mix(in oklab, #7c3aed 22%, transparent)",
      "--house-gradient-to": "color-mix(in oklab, #7c3aed 8%, transparent)",
      "--house-header-border": "color-mix(in oklab, #7c3aed 40%, transparent)",
      "--house-muted": "color-mix(in oklab, #7c3aed 14%, white)",
      "--house-muted-foreground": "color-mix(in oklab, #7c3aed 70%, #111827)",
    });
  });

  it("uses a dark foreground for bright house colors", () => {
    expect(resolveHouseThemeStyle({ enabled: true, houseColor: "#facc15" })).toMatchObject({
      "--primary-foreground": "#111827",
      "--accent-foreground": "#111827",
      "--secondary": "color-mix(in oklab, #facc15 72%, black)",
      "--secondary-foreground": "#ffffff",
    });
  });

  it.each([
    ["purple", "#7c3aed"],
    ["green", "#22c55e"],
    ["blue", "#1d4ed8"],
    ["orange", "#f97316"],
    ["red", "#dc2626"],
    ["gray", "#777777"],
    ["near black", "#111827"],
    ["near white", "#f8fafc"],
  ])("generates every semantic theme token for representative %s themes", (_label, color) => {
    const style = resolveHouseThemeStyle({ enabled: true, houseColor: color });

    expect(style).toBeDefined();
    expect(Object.keys(style ?? {}).sort()).toEqual([...expectedThemeTokens].sort());
    expect(style).toMatchObject({
      "--primary": color,
      "--accent-foreground": "#111827",
      "--house-surface-foreground": "#111827",
    });
  });
});
