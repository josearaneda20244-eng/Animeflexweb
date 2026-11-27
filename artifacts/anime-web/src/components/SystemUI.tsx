import type { CSSProperties, ReactNode } from "react";

export function CornerBrackets(_props: { color?: string; size?: number; thickness?: number; inset?: number }) {
  // Purged: Clean Seanime Pure Black aesthetic uses smooth rounded-2xl geometry with subtle border-white/10
  return null;
}

export function SystemTag({ children }: { children: ReactNode; color?: string; glow?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono-code font-semibold uppercase tracking-wider bg-white/5 text-zinc-300 border border-white/10 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
      {children}
    </span>
  );
}

export function ScanLines(_props: { color?: string }) {
  return null;
}

export function HexGrid(_props: { color?: string; size?: number; fade?: boolean }) {
  return null;
}

export function SystemPanel({
  children,
  className = "",
  style,
}: { children: ReactNode; className?: string; style?: CSSProperties; glow?: boolean; accent?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#0a0a0a]/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all duration-300 hover:border-white/20 hover:bg-[#141414] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function MagicCircle(_props: { size?: number; color?: string; opacity?: number }) {
  return null;
}
