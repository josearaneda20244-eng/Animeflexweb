import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

export function CornerBrackets({ color = "#FF3355", size = 14, thickness = 2, inset = 0 }: { color?: string; size?: number; thickness?: number; inset?: number }) {
  const s: CSSProperties = { position: "absolute", width: size, height: size, borderColor: color, borderStyle: "solid", borderWidth: 0, pointerEvents: "none", zIndex: 3 };
  return (
    <>
      <span style={{ ...s, top: inset, left: inset, borderTopWidth: thickness, borderLeftWidth: thickness }} />
      <span style={{ ...s, top: inset, right: inset, borderTopWidth: thickness, borderRightWidth: thickness }} />
      <span style={{ ...s, bottom: inset, left: inset, borderBottomWidth: thickness, borderLeftWidth: thickness }} />
      <span style={{ ...s, bottom: inset, right: inset, borderBottomWidth: thickness, borderRightWidth: thickness }} />
    </>
  );
}

export function SystemTag({ children, color = "#FF3355", glow = true }: { children: ReactNode; color?: string; glow?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'Courier New', ui-monospace, monospace", color, fontSize: 10, letterSpacing: 4, fontWeight: 900, textShadow: glow ? `0 0 10px ${color}80` : "none" }}>
      <motion.span
        animate={{ opacity: [1, 0.25, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ width: 8, height: 8, background: color, boxShadow: glow ? `0 0 10px ${color}` : "none" }}
      />
      {children}
    </span>
  );
}

export function ScanLines({ color = "rgba(244,63,94,0.04)" }: { color?: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(0deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 4px)`, pointerEvents: "none", zIndex: 2 }} />
  );
}

export function HexGrid({ color = "rgba(244,63,94,0.06)", size = 28, fade = true }: { color?: string; size?: number; fade?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: `${size}px ${size}px`, maskImage: fade ? "linear-gradient(180deg, black, transparent)" : undefined, pointerEvents: "none", zIndex: 1 }} />
  );
}
