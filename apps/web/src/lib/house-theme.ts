import type { CSSProperties } from "react";
import { resolveHouseThemeStyle as resolveBaseHouseThemeStyle } from "@housepoints/theme";
import type { HouseThemeVars } from "@housepoints/theme";

export { assessHouseThemeColor } from "@housepoints/theme";
export type {
  HouseThemeColorAssessment,
  HouseThemeToken,
  HouseThemeVars,
} from "@housepoints/theme";

/**
 * React-typed convenience alias for the resolved house theme record, safe to
 * pass to `<div style={...} />`. The underlying record lives in
 * `@housepoints/theme` so mobile and other future consumers can share the
 * same math without a React dependency.
 */
export type HouseThemeStyle = CSSProperties & HouseThemeVars;

// React 19.3's CSSProperties no longer accepts a bare `Record<'--foo', string>`;
// cast at the boundary so callers get a React-friendly style object.
export function resolveHouseThemeStyle(
  input: Parameters<typeof resolveBaseHouseThemeStyle>[0],
): HouseThemeStyle | undefined {
  return resolveBaseHouseThemeStyle(input) as HouseThemeStyle | undefined;
}
