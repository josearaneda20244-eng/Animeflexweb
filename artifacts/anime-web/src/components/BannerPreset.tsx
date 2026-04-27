import { MagicCircle, HexGrid } from "@/components/SystemUI";

export type BannerPresetKey =
  | "default" | "monarca" | "cazador" | "akatsuki" | "hokage"
  | "espiral" | "rasengan" | "sukuna" | "frieren" | "sello" | "dragon" | "void";

export interface BannerPresetMeta {
  key: BannerPresetKey;
  label: string;
  accent: string;
  glow: string;
  bg: string;
}

export const BANNER_PRESETS: BannerPresetMeta[] = [
  { key: "default",  label: "DEFECTO",  accent: "#F97316", glow: "rgba(220,38,38,0.6)", bg: "linear-gradient(135deg,#200810,#350a18 50%,#15040c)" },
  { key: "monarca",  label: "MONARCA",  accent: "#A855F7", glow: "rgba(168,85,247,0.55)", bg: "linear-gradient(135deg,#0b0418,#1a0a2a 50%,#040108)" },
  { key: "cazador",  label: "CAZADOR",  accent: "#F97316", glow: "rgba(249,115,22,0.55)", bg: "linear-gradient(135deg,#200810,#3b0c12 55%,#150410)" },
  { key: "akatsuki", label: "AKATSUKI", accent: "#DC2626", glow: "rgba(220,38,38,0.6)", bg: "linear-gradient(135deg,#0a0204,#1a0204 50%,#000)" },
  { key: "hokage",   label: "HOKAGE",   accent: "#F59E0B", glow: "rgba(245,158,11,0.55)", bg: "linear-gradient(135deg,#3b0a04,#1c0700 60%,#0a0300)" },
  { key: "espiral",  label: "ESPIRAL",  accent: "#FB923C", glow: "rgba(251,146,60,0.55)", bg: "linear-gradient(135deg,#1c0a02,#3b1a04 55%,#0a0300)" },
  { key: "rasengan", label: "RASENGAN", accent: "#38BDF8", glow: "rgba(56,189,248,0.6)", bg: "linear-gradient(135deg,#021a2c,#012845 55%,#000812)" },
  { key: "sukuna",   label: "SUKUNA",   accent: "#EF4444", glow: "rgba(239,68,68,0.6)", bg: "linear-gradient(135deg,#0a0204,#220406 50%,#040000)" },
  { key: "frieren",  label: "FRIEREN",  accent: "#86EFAC", glow: "rgba(134,239,172,0.45)", bg: "linear-gradient(135deg,#04140a,#0a2418 55%,#020c08)" },
  { key: "sello",    label: "SELLO",    accent: "#FBBF24", glow: "rgba(251,191,36,0.55)", bg: "linear-gradient(135deg,#180a02,#2c1408 55%,#0a0500)" },
  { key: "dragon",   label: "DRAGON",   accent: "#F97316", glow: "rgba(249,115,22,0.6)", bg: "linear-gradient(135deg,#1a0a02,#3b1a02 60%,#0a0500)" },
  { key: "void",     label: "VOID",     accent: "#7C73FF", glow: "rgba(124,115,255,0.55)", bg: "linear-gradient(135deg,#04041a,#0a0428 55%,#000010)" },
];

export function getBannerMeta(key: string | null | undefined): BannerPresetMeta {
  return BANNER_PRESETS.find((b) => b.key === key) ?? BANNER_PRESETS[0];
}

interface BannerProps {
  presetKey?: string | null;
  height?: number;
  showLabel?: string;
}

export function ProfileBanner({ presetKey, height = 110, showLabel }: BannerProps) {
  const meta = getBannerMeta(presetKey);
  const isAkatsuki = meta.key === "akatsuki";
  const isFrieren  = meta.key === "frieren";
  const isRasengan = meta.key === "rasengan";

  return (
    <div style={{ height, position: "relative", overflow: "hidden", background: meta.bg }}>
      <HexGrid color={`${meta.accent}1A`} size={22} fade={false} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 25% 60%, ${meta.glow}, transparent 55%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 80% 30%, ${meta.accent}55, transparent 55%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(0deg, ${meta.accent}0A 0px, ${meta.accent}0A 1px, transparent 1px, transparent 4px)` }} />

      {/* Magic circle (always present, color varies) */}
      <div style={{ position: "absolute", top: -50, right: -50 }}>
        <MagicCircle size={180} color={meta.accent} opacity={0.55} />
      </div>

      {/* Variant flair */}
      {isAkatsuki && (
        <>
          <div style={{ position: "absolute", left: 60, top: 16, width: 26, height: 26, background: "radial-gradient(circle, #DC2626 0%, #DC2626 38%, transparent 40%), radial-gradient(circle at 50% 50%, transparent 0, transparent 60%, #DC2626 62%, #DC2626 100%)", filter: "drop-shadow(0 0 8px #DC2626)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", left: 96, top: 50, width: 16, height: 16, background: "#DC2626", filter: "blur(2px) drop-shadow(0 0 6px #DC2626)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", left: 130, top: 26, width: 10, height: 10, background: "#DC2626", filter: "blur(1px) drop-shadow(0 0 4px #DC2626)", borderRadius: "50%" }} />
        </>
      )}
      {isFrieren && (
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 100%, rgba(255,255,255,0.08) 0, transparent 55%)" }} />
      )}
      {isRasengan && (
        <>
          <div style={{ position: "absolute", left: 70, top: 28, width: 56, height: 56, borderRadius: "50%", background: "radial-gradient(circle, #FFFFFF 0%, #38BDF8 30%, #0EA5E9 55%, transparent 75%)", filter: "blur(0.5px) drop-shadow(0 0 12px #38BDF8)" }} />
          <div style={{ position: "absolute", left: 82, top: 40, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)" }} />
        </>
      )}

      {showLabel && (
        <div style={{ position: "absolute", top: 12, left: 18, zIndex: 3 }}>
          <span className="sys-label" style={{ fontSize: 9.5, letterSpacing: 2.5, color: meta.accent }}>
            {showLabel}
          </span>
        </div>
      )}
    </div>
  );
}
