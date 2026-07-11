export const houseThemeQaCases = [
  { label: "purple", color: "#7c3aed", expectedStatus: "ready", expectedForeground: "#ffffff" },
  { label: "green", color: "#22c55e", expectedStatus: "ready", expectedForeground: "#111827" },
  { label: "blue", color: "#1d4ed8", expectedStatus: "ready", expectedForeground: "#ffffff" },
  { label: "orange", color: "#f97316", expectedStatus: "ready", expectedForeground: "#111827" },
  { label: "yellow", color: "#facc15", expectedStatus: "ready", expectedForeground: "#111827" },
  { label: "red", color: "#dc2626", expectedStatus: "ready", expectedForeground: "#ffffff" },
  { label: "gray", color: "#777777", expectedStatus: "subtle", expectedForeground: "#111827" },
  { label: "near black", color: "#111827", expectedStatus: "ready", expectedForeground: "#ffffff" },
  { label: "near white", color: "#f8fafc", expectedStatus: "subtle", expectedForeground: "#111827" },
] as const;

export type HouseThemeQaCase = (typeof houseThemeQaCases)[number];
