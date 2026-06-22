import type { CSSProperties } from "react";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

type RgbColor = {
  r: number;
  g: number;
  b: number;
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

function foregroundFor(color: RgbColor) {
  const luminance = relativeLuminance(color);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;

  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#111827";
}

export function resolveHouseThemeStyle(options: {
  enabled: boolean;
  houseColor?: string | null;
}): HouseThemeStyle | undefined {
  if (!options.enabled || !options.houseColor) {
    return undefined;
  }

  const normalizedHouseColor = options.houseColor.trim();
  const rgb = parseHexColor(normalizedHouseColor);

  if (!rgb) {
    return undefined;
  }

  return {
    "--primary": normalizedHouseColor,
    "--primary-foreground": foregroundFor(rgb),
    "--accent": `color-mix(in oklab, ${normalizedHouseColor} 68%, white)`,
    "--accent-foreground": foregroundFor(rgb),
    "--ring": `color-mix(in oklab, ${normalizedHouseColor} 78%, white)`,
  };
}
