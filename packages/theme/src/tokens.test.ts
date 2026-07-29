import { describe, expect, it } from "vitest";
import {
  baseColorTokens,
  baseRadius,
  fontFamilies,
  houseThemeDefaultTokens,
  radiusScale,
} from "./tokens.js";

/**
 * These snapshots lock the token structure so that changes are intentional
 * and reviewable in a PR. When updating a value here, update the matching
 * CSS custom property in `apps/web/src/app/globals.css` in the same change.
 */

describe("design tokens", () => {
  it("exposes the base semantic color palette", () => {
    expect(baseColorTokens).toEqual({
      background: "oklch(0.97 0 0)",
      foreground: "oklch(0.15 0 0)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.15 0 0)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.15 0 0)",
      primary: "oklch(0.45 0.15 300)",
      "primary-foreground": "oklch(0.98 0 0)",
      secondary: "oklch(0.35 0.08 250)",
      "secondary-foreground": "oklch(0.98 0 0)",
      accent: "oklch(0.65 0.15 160)",
      "accent-foreground": "oklch(0.98 0 0)",
      muted: "oklch(0.95 0 0)",
      "muted-foreground": "oklch(0.45 0 0)",
      border: "oklch(0.90 0 0)",
      input: "oklch(0.90 0 0)",
      ring: "oklch(0.65 0.15 160)",
      destructive: "oklch(0.577 0.245 27.325)",
      "destructive-foreground": "oklch(0.98 0 0)",
    });
  });

  it("exposes house theme defaults that resolve to base tokens on web", () => {
    expect(houseThemeDefaultTokens).toEqual({
      "page-wash": "transparent",
      surface: "var(--card)",
      "surface-foreground": "var(--card-foreground)",
      "gradient-from": "transparent",
      "gradient-to": "transparent",
      "header-border": "var(--border)",
      muted: "var(--muted)",
      "muted-foreground": "var(--muted-foreground)",
    });
  });

  it("exposes the radius scale with base plus multipliers", () => {
    expect(baseRadius).toBe("0.5rem");
    expect(radiusScale).toEqual({
      sm: 0.5,
      md: 1,
      lg: 1.5,
      xl: 2,
      "2xl": 3,
    });
  });

  it("exposes font family stacks that mirror the web CSS", () => {
    expect(fontFamilies).toEqual({
      sans: "Inter, system-ui, sans-serif",
      display: '"Cinzel", Georgia, serif',
      mono: '"JetBrains Mono", "Courier New", monospace',
    });
  });
});
