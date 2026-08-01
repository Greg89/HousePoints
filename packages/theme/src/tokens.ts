/**
 * Design tokens shared across the web app and (future) mobile app.
 *
 * These values mirror the CSS custom properties declared in
 * `apps/web/src/app/globals.css`. When updating a token here, update the CSS
 * side too — the web runtime still reads from `globals.css`. A future task
 * (mobile Phase 1) will consume these objects directly to compute native
 * StyleSheet values, and at that point we can generate the CSS block from
 * these tokens instead of duplicating.
 */

/** Base semantic colors (light mode). Values are OKLCH strings. */
export const baseColorTokens = {
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
} as const;

export type BaseColorToken = keyof typeof baseColorTokens;

/**
 * Default (no house theme active) values for the dynamic `--house-*`
 * CSS custom properties. `var(--...)` references are relative to the web CSS
 * runtime; native consumers must resolve these against `baseColorTokens`.
 */
export const houseThemeDefaultTokens = {
  "page-wash": "transparent",
  surface: "var(--card)",
  "surface-foreground": "var(--card-foreground)",
  "gradient-from": "transparent",
  "gradient-to": "transparent",
  "header-border": "var(--border)",
  muted: "var(--muted)",
  "muted-foreground": "var(--muted-foreground)",
} as const;

export type HouseThemeDefaultToken = keyof typeof houseThemeDefaultTokens;

/** Base radius token; the scale derives from it via multiplication. */
export const baseRadius = "0.5rem";

/**
 * Radius scale. Web declares these as `calc()` expressions against
 * `var(--radius)`; the scale values here are the numeric multipliers, safe for
 * either environment.
 */
export const radiusScale = {
  sm: 0.5,
  md: 1,
  lg: 1.5,
  xl: 2,
  "2xl": 3,
} as const;

export type RadiusScaleToken = keyof typeof radiusScale;

/** Font family stacks (mirrors globals.css). */
export const fontFamilies = {
  sans: "Inter, system-ui, sans-serif",
  display: '"Cinzel", Georgia, serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;
