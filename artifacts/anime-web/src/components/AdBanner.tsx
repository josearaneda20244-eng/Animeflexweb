import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { X, Crown } from "lucide-react";
import { useState } from "react";

interface AdBannerProps {
  variant?: "horizontal" | "square";
  className?: string;
}

export default function AdBanner({ variant = "horizontal", className }: AdBannerProps) {
  const { isMegaFan, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (isMegaFan || dismissed) return null;

  if (variant === "square") {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          border: "1px solid rgba(108,99,255,0.2)",
          padding: "24px 20px",
          textAlign: "center",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(255,255,255,0.08)", border: "none",
            borderRadius: 6, padding: 4, cursor: "pointer",
            display: "flex", color: "rgba(255,255,255,0.4)",
          }}
        >
          <X size={12} />
        </button>

        <div style={{ fontSize: 28 }}>📢</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
          Publicidad
        </div>
        <div style={{
          background: "rgba(108,99,255,0.15)", borderRadius: 12,
          padding: "16px", width: "100%",
        }}>
          <div style={{ color: "#A78BFA", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            ¿Cansado de los anuncios?
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 10 }}>
            Únete a MegaFan y disfruta sin interrupciones
          </div>
          <Link href="/membership">
            <button style={{
              background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
              border: "none", borderRadius: 8, padding: "8px 16px",
              color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, margin: "0 auto",
            }}>
              <Crown size={11} /> Ver planes
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        background: "linear-gradient(90deg, rgba(108,99,255,0.08) 0%, rgba(79,70,229,0.05) 100%)",
        border: "1px solid rgba(108,99,255,0.15)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute", top: 6, right: 6,
          background: "rgba(255,255,255,0.06)", border: "none",
          borderRadius: 5, padding: 3, cursor: "pointer",
          display: "flex", color: "rgba(255,255,255,0.3)",
        }}
      >
        <X size={11} />
      </button>

      <div style={{ fontSize: 22, flexShrink: 0 }}>📢</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>
          Publicidad
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          {user
            ? "¿Cansado de los anuncios? "
            : "¡Únete a AnimeFLEX! "}
          <Link href="/membership" style={{ color: "#A78BFA", fontWeight: 700, textDecoration: "none" }}>
            Hazte MegaFan por $4/mes →
          </Link>
        </div>
      </div>
    </div>
  );
}
