import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export function CornerBrackets({ color = "#F97316", size = 14, thickness = 2, inset = 0 }: { color?: string; size?: number; thickness?: number; inset?: number }) {
  const s: CSSProperties = { position: "absolute", width: size, height: size, borderColor: color, borderStyle: "solid", borderWidth: 0, pointerEvents: "none", zIndex: 3, filter: `drop-shadow(0 0 4px ${color}aa)` };
  return (
    <>
      <span style={{ ...s, top: inset, left: inset, borderTopWidth: thickness, borderLeftWidth: thickness }} />
      <span style={{ ...s, top: inset, right: inset, borderTopWidth: thickness, borderRightWidth: thickness }} />
      <span style={{ ...s, bottom: inset, left: inset, borderBottomWidth: thickness, borderLeftWidth: thickness }} />
      <span style={{ ...s, bottom: inset, right: inset, borderBottomWidth: thickness, borderRightWidth: thickness }} />
    </>
  );
}

export function SystemTag({ children, color = "#F97316", glow = true }: { children: ReactNode; color?: string; glow?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', 'Courier New', ui-monospace, monospace", color, fontSize: 10, letterSpacing: 4, fontWeight: 900, textShadow: glow ? `0 0 12px ${color}` : "none", textTransform: "uppercase" }}>
      <motion.span
        animate={{ opacity: [1, 0.25, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ width: 8, height: 8, background: color, boxShadow: glow ? `0 0 12px ${color}` : "none" }}
      />
      {children}
    </span>
  );
}

export function ScanLines({ color = "rgba(249,115,22,0.05)" }: { color?: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(0deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 4px)`, pointerEvents: "none", zIndex: 2 }} />
  );
}

export function HexGrid({ color = "rgba(220,38,38,0.08)", size = 28, fade = true }: { color?: string; size?: number; fade?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: `${size}px ${size}px`, maskImage: fade ? "linear-gradient(180deg, black, transparent)" : undefined, pointerEvents: "none", zIndex: 1 }} />
  );
}

/* ── Solo-Leveling style "system" panel: angular clipped border with cyan glow ── */
export function SystemPanel({
  children,
  className = "",
  style,
  glow = true,
  accent = "#F97316",
}: { children: ReactNode; className?: string; style?: CSSProperties; glow?: boolean; accent?: string }) {
  return (
    <div
      className={`system-panel ${className}`}
      style={{
        position: "relative",
        background: "linear-gradient(180deg, rgba(17,8,35,0.92), rgba(8,4,18,0.96))",
        border: `1px solid ${accent}55`,
        boxShadow: glow
          ? `0 0 0 1px rgba(0,0,0,0.4), 0 0 24px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        clipPath:
          "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Floating magic circle (decorative SVG) ── */
export function MagicCircle({ size = 220, color = "#DC2626", opacity = 0.5 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ position: "absolute", pointerEvents: "none", opacity, filter: `drop-shadow(0 0 24px ${color})` }}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
    >
      <circle cx="100" cy="100" r="96" fill="none" stroke={color} strokeWidth="0.6" strokeDasharray="2 6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={color} strokeWidth="1" />
      <circle cx="100" cy="100" r="62" fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="4 4" />
      <circle cx="100" cy="100" r="44" fill="none" stroke={color} strokeWidth="0.4" />
      <polygon points="100,28 162,134 38,134" fill="none" stroke={color} strokeWidth="0.7" />
      <polygon points="100,172 38,66 162,66" fill="none" stroke={color} strokeWidth="0.7" opacity="0.7" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x1 = 100 + Math.cos(a) * 80;
        const y1 = 100 + Math.sin(a) * 80;
        const x2 = 100 + Math.cos(a) * 96;
        const y2 = 100 + Math.sin(a) * 96;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.6" />;
      })}
    </motion.svg>
  );
}
