import type { CSSProperties } from "react";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MIN_THEME_CONTRAST_RATIO = 4.5;
const MIN_DISTINCT_SATURATION = 0.18;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HouseThemeColorAssessment = {
  status: "invalid" | "ready" | "subtle";
  normalizedColor: string | null;
  foreground: string | null;
  contrastRatio: number | null;
  message: string;
};

export type HouseThemeStyle = CSSProperties & Record<
  "--primary" | "--primary-foreground" | "--accent" | "--accent-foreground" | "--ring",
  string
>;

function parseHexColor(value: string): RgbColor | null {
  if (!HEX_COLOR_PATTERN.test(value)) {
    return null;
  }

  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

function toLinearChannel(value: number) {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RgbColor) {
  return (
    0.2126 * toLinearChannel(color.r)
    + 0.7152 * toLinearChannel(color.g)
    + 0.0722 * toLinearChannel(color.b)
  );
}

function contrastRatio(first: RgbColor, second: RgbColor) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function saturationFor(color: RgbColor) {
  const red = color.r / 255;
  const green = color.g / 255;
  const blue = color.b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);

  if (max === min) {
    return 0;
  }

  const lightness = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function foregroundFor(color: RgbColor) {
  const luminance = relativeLuminance(color);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;

  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#111827";
}

export function assessHouseThemeColor(houseColor?: string | null): HouseThemeColorAssessment {
  const normalizedColor = houseColor?.trim().toLowerCase() ?? "";
  const rgb = parseHexColor(normalizedColor);

  if (!rgb) {
    return {
      status: "invalid",
      normalizedColor: null,
      foreground: null,
      contrastRatio: null,
      message: "Use a six-digit hex color so house themes can be generated safely.",
    };
  }

  const foreground = foregroundFor(rgb);
  const foregroundRgb = parseHexColor(foreground);
  const computedContrastRatio = foregroundRgb ? contrastRatio(rgb, foregroundRgb) : 0;

  if (computedContrastRatio < MIN_THEME_CONTRAST_RATIO || saturationFor(rgb) < MIN_DISTINCT_SATURATION) {
    return {
      status: "subtle",
      normalizedColor,
      foreground,
      contrastRatio: computedContrastRatio,
      message: "This color is readable, but it may feel muted as an app theme.",
    };
  }

  return {
    status: "ready",
    normalizedColor,
    foreground,
    contrastRatio: computedContrastRatio,
    message: "This color is ready for readable house themes.",
  };
}

export function resolveHouseThemeStyle(options: {
  enabled: boolean;
  houseColor?: string | null;
}): HouseThemeStyle | undefined {
  if (!options.enabled || !options.houseColor) {
    return undefined;
  }

  const assessment = assessHouseThemeColor(options.houseColor);

  if (!assessment.normalizedColor || !assessment.foreground) {
    return undefined;
  }

  return {
    "--primary": assessment.normalizedColor,
    "--primary-foreground": assessment.foreground,
    "--accent": `color-mix(in oklab, ${assessment.normalizedColor} 68%, white)`,
    "--accent-foreground": assessment.foreground,
    "--ring": `color-mix(in oklab, ${assessment.normalizedColor} 78%, white)`,
  };
}
