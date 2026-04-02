const primary = "#6C63FF";
const secondary = "#4F46E5";
const accent = "#A78BFA";
const cyan = "#06B6D4";
const pink = "#EC4899";

export default {
  light: {
    text: "#FFFFFF",
    background: "#090A12",
    tint: primary,
    tabIconDefault: "#3A3F5C",
    tabIconSelected: primary,
  },
  dark: {
    text: "#FFFFFF",
    background: "#090A12",
    tint: primary,
    tabIconDefault: "#3A3F5C",
    tabIconSelected: primary,
  },
  primary,
  secondary,
  accent,
  cyan,
  pink,
  bg: "#090A12",
  bgCard: "#13131C",
  bgSurface: "#1A1A27",
  bgElevated: "#222235",
  border: "#1E1E32",
  borderLight: "#2A2A42",
  textPrimary: "#F0F0FF",
  textSecondary: "#9090B0",
  textMuted: "#4A4A6A",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  sub: "#22C55E",
  dub: "#3B82F6",
  gold: "#F59E0B",
  gradient: {
    purple: ["#6C63FF", "#4F46E5"] as [string, string],
    purplePink: ["#6C63FF", "#EC4899"] as [string, string],
    dark: ["#1A1A27", "#090A12"] as [string, string],
    card: ["#13131C", "#090A12"] as [string, string],
    hero: ["rgba(9,10,18,0)", "rgba(9,10,18,0.5)", "rgba(9,10,18,0.92)", "#090A12"] as string[],
  },
};
