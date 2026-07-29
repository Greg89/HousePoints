import type { CSSProperties } from "react";
import type { HouseThemeVars } from "@housepoints/theme";

export {
  assessHouseThemeColor,
  resolveHouseThemeStyle,
} from "@housepoints/theme";
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
