import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Crown, Tv2 } from "lucide-react";
import { getRemainingEpisodes, canWatchEpisodeSync, getCurrentDailyLimit } from "@/lib/accessControl";
import { useLimitsConfig } from "@/hooks/use-limits-config";

interface EpisodeCounterProps {
  variant?: "horizontal" | "square";
  className?: string;
  /** @deprecated slotId ya no se usa — los anuncios han sido eliminados */
  slotId?: string;
}

/**
 * EpisodeCounter (anteriormente AdBanner)
 * Reemplaza los anuncios con un contador de episodios diarios.
 * Los usuarios MegaFan no ven nada. Los usuarios gratuitos ven cuántos
 * episodios les quedan hoy y un CTA para convertirse a MegaFan.
 */
export default function AdBanner({ variant = "horizontal", className }: EpisodeCounterProps) {
  const { isMegaFan } = useAuth();
  const { config: limitsConfig } = useLimitsConfig();

  // MegaFan no ve nada — experiencia limpia total
  if (isMegaFan) return null;

  const remaining = getRemainingEpisodes(false);
  const currentLimit = getCurrentDailyLimit();
  const canWatch = canWatchEpisodeSync(false);

  if (!canWatch) {
    // Límite alcanzado — CTA de conversión
    return (
      <div className={className} style={{
        borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(135deg, rgba(108,99,255,0.12), rgba(79,70,229,0.06))",
        border: "1px solid rgba(108,99,255,0.25)",
        padding: "18px 20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Crown size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800, marginBottom: 3 }}>
            {limitsConfig.limitMessage.split('.')[0] || "Límite diario alcanzado"} 😢
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            {limitsConfig.megafanMessage}
          </div>
        </div>
        <Link href="/membership" style={{ textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
            borderRadius: 10, padding: "9px 14px",
            color: "#fff", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap",
          }}>
            <Crown size={12} /> {limitsConfig.megafanMessage.split(' ')[0] || "Hazte MegaFan"}
          </div>
        </Link>
      </div>
    );
  }

  // Episodios restantes — contador informativo
  return (
    <div className={className} style={{
      borderRadius: 12, overflow: "hidden",
      background: "rgba(108,99,255,0.05)",
      border: "1px solid rgba(108,99,255,0.1)",
      padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        <Tv2 size={15} color="#A78BFA" />
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          Te {remaining === 1 ? "queda" : "quedan"}{" "}
          <span style={{ color: "#A78BFA", fontWeight: 800 }}>{remaining} episodio{remaining !== 1 ? "s" : ""}</span>{" "}
          gratis hoy (de {currentLimit})
        </span>
      </div>
      <Link href="/membership" style={{ textDecoration: "none", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
          borderRadius: 8, padding: "7px 11px",
          color: "#fff", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap",
        }}>
          <Crown size={10} /> Sin límites
        </div>
      </Link>
    </div>
  );
}
