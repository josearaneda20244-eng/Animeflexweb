import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Crown } from "lucide-react";

interface AdBannerProps {
  variant?: "horizontal" | "square";
  className?: string;
  // Slot ID to use when connecting a real ad provider.
  // Google AdSense example: pass your data-ad-slot value here.
  slotId?: string;
}

/**
 * AdBanner — shows a banner ad for free users only.
 * MegaFan users see nothing (component returns null immediately).
 *
 * HOW TO CONNECT A REAL AD PROVIDER:
 * 1. Google AdSense: replace the placeholder <div> below with:
 *      <ins className="adsbygoogle" data-ad-client="ca-pub-XXXXXXXX" data-ad-slot={slotId} ... />
 *    and add the AdSense <script> to index.html.
 * 2. Adsterra / other: paste their banner <script> inside the container div.
 */
export default function AdBanner({ variant = "horizontal", className, slotId }: AdBannerProps) {
  const { isMegaFan } = useAuth();

  // MegaFan users NEVER see ads — hard stop here.
  if (isMegaFan) return null;

  if (variant === "square") {
    return (
      <div className={className} style={{
        position: "relative", borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(135deg,#13131C,#1a1a2e)",
        border: "1px solid rgba(108,99,255,0.15)",
        minHeight: 250, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
        padding: "24px 20px", textAlign: "center",
      }}>
        {/* ── REPLACE THIS BLOCK WITH YOUR AD CODE ── */}
        <div style={{
          width: "100%", minHeight: 200, borderRadius: 12,
          background: "rgba(108,99,255,0.07)",
          border: "1px dashed rgba(108,99,255,0.2)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
            Publicidad
          </div>
        </div>
        {/* ── END AD CODE ── */}

        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
          Sin anuncios con{" "}
          <Link href="/membership" style={{ color: "#A78BFA", fontWeight: 700, textDecoration: "none" }}>
            MegaFan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{
      borderRadius: 12, overflow: "hidden",
      background: "rgba(108,99,255,0.05)",
      border: "1px solid rgba(108,99,255,0.1)",
      padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* ── REPLACE THIS BLOCK WITH YOUR AD CODE ── */}
      <div style={{
        flex: 1, minHeight: 60, borderRadius: 8,
        background: "rgba(108,99,255,0.07)",
        border: "1px dashed rgba(108,99,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Publicidad
        </div>
      </div>
      {/* ── END AD CODE ── */}

      <Link href="/membership" style={{ textDecoration: "none", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
          borderRadius: 8, padding: "7px 11px",
          color: "#fff", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap",
        }}>
          <Crown size={10} /> Sin anuncios
        </div>
      </Link>
    </div>
  );
}
