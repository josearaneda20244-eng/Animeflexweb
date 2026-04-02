const primary = "#F97316";
const secondary = "#FB923C";
const accent = "#FBBF24";

export default {
  light: {
    text: "#FFFFFF",
    background: "#080A12",
    tint: primary,
    tabIconDefault: "#3A3F5C",
    tabIconSelected: primary,
  },
  dark: {
    text: "#FFFFFF",
    background: "#080A12",
    tint: primary,
    tabIconDefault: "#3A3F5C",
    tabIconSelected: primary,
  },
  primary,
  secondary,
  accent,
  bg: "#080A12",
  bgCard: "#0E1120",
  bgSurface: "#131726",
  bgElevated: "#1A2035",
  border: "#1E2540",
  borderLight: "#252D48",
  textPrimary: "#E8EAF6",
  textSecondary: "#7B87A8",
  textMuted: "#424C6A",
  success: "#22C55E",
  warning: "#F97316",
  error: "#EF4444",
  gradient: {
    orange: ["#F97316", "#C2410C"] as [string, string],
    dark: ["#131726", "#080A12"] as [string, string],
    card: ["#0E1120", "#080A12"] as [string, string],
  },
};
