import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Clock, Tv2, Heart, Star, TrendingUp, Crown, Shield } from "lucide-react";
import { getRemainingEpisodes, getEpisodesWatchedToday } from "@/lib/accessControl";

const DAILY_LIMIT = 5;

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
}

const LABELS: Record<number, string> = { 1: "Malo", 2: "Regular", 3: "Bueno", 4: "Muy bueno", 5: "Excelente" };

export default function Profile() {
  const { user, isMegaFan, isOwner } = useAuth();
  const { progress } = useWatchProgress();
  const { favorites } = useFavorites();
  const [, navigate] = useLocation();

  const totalEps = progress.length;
  const totalTime = progress.reduce((acc, p) => acc + p.currentTime, 0);
  const watchedToday = getEpisodesWatchedToday();
  const remaining = getRemainingEpisodes(isMegaFan);

  const animeCounts = progress.reduce<Record<string, { title: string; image: string; animeId: string; count: number }>>(
    (acc, p) => {
      if (!acc[p.animeId]) acc[p.animeId] = { title: p.animeTitle, image: p.animeImage, animeId: p.animeId, count: 0 };
      acc[p.animeId].count++;
      return acc;
    }, {}
  );
  const topAnime = Object.values(animeCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  const recent = [...progress].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);

  let ratings: Record<string, number> = {};
  try { ratings = JSON.parse(localStorage.getItem("af_user_ratings") || "{}"); } catch {}
  const ratedCount = Object.keys(ratings).length;
  const avgRating = ratedCount > 0
    ? (Object.values(ratings).reduce((a, b) => a + b, 0) / ratedCount).toFixed(1)
    : null;

  const STATS = [
    { icon: <Tv2 size={22} color="#6C63FF" />, label: "Episodios vistos", value: totalEps, sub: `${watchedToday} hoy` },
    { icon: <Clock size={22} color="#22C55E" />, label: "Tiempo total", value: formatTime(totalTime), sub: "en AnimeFlex" },
    { icon: <Heart size={22} color="#EC4899" />, label: "Favoritos", value: favorites.length, sub: "animes guardados" },
    { icon: <Star size={22} color="#F59E0B" />, label: "Valoraciones", value: ratedCount, sub: avgRating ? `Media: ${avgRating}★` : "Ninguna aún" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />
      <div style={{ paddingTop: 72, maxWidth: 700, margin: "0 auto", padding: "72px 16px 48px" }}>

        {/* Profile header */}
        <div style={{
          background: "linear-gradient(135deg,#13131C,#1a1a2e)",
          border: "1px solid rgba(108,99,255,0.15)", borderRadius: 20,
          padding: "24px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 18,
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18, flexShrink: 0,
            background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 900, color: "#fff", overflow: "hidden",
          }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (user?.username?.charAt(0)?.toUpperCase() ?? "?")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900 }}>{user?.username ?? "Invitado"}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "3px 0 8px" }}>{user?.email ?? "No has iniciado sesión"}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: isMegaFan ? "rgba(245,158,11,0.15)" : "rgba(108,99,255,0.1)",
              border: `1px solid ${isMegaFan ? "rgba(245,158,11,0.35)" : "rgba(108,99,255,0.25)"}`,
              borderRadius: 20, padding: "4px 12px",
              color: isMegaFan ? "#F59E0B" : "#A78BFA", fontSize: 12, fontWeight: 800,
            }}>
              {isMegaFan ? <><Crown size={11} /> MegaFan</> : "✦ Gratuito"}
            </div>
            {isOwner && (
              <button
                onClick={() => navigate("/admin")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: "linear-gradient(135deg,rgba(108,99,255,0.2),rgba(79,70,229,0.1))",
                  border: "1px solid rgba(108,99,255,0.35)", borderRadius: 10,
                  padding: "7px 14px", color: "#A78BFA", cursor: "pointer",
                  fontSize: 12, fontWeight: 800, marginTop: 8,
                }}
              >
                <Shield size={13} /> ⚙️ Panel Admin
              </button>
            )}
          </div>
          {!isMegaFan && (
            <button onClick={() => navigate("/membership")} style={{
              background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none",
              borderRadius: 12, padding: "9px 16px", color: "#fff",
              fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0,
            }}>
              Hazte MegaFan
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {STATS.map(({ icon, label, value, sub }) => (
            <div key={label} style={{
              background: "#13131C", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: "18px 16px",
            }}>
              <div style={{ marginBottom: 10 }}>{icon}</div>
              <div style={{ color: "#F1F1F5", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{value}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{label}</div>
              <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Daily usage bar (free users) */}
        {!isMegaFan && (
          <div style={{
            background: "rgba(108,99,255,0.07)", border: "1px solid rgba(108,99,255,0.18)",
            borderRadius: 16, padding: "16px 20px", marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>Episodios gratis hoy</div>
              <div style={{ color: "#A78BFA", fontSize: 16, fontWeight: 900 }}>{watchedToday}/{DAILY_LIMIT}</div>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${Math.min(100, (watchedToday / DAILY_LIMIT) * 100)}%`,
                background: watchedToday >= DAILY_LIMIT
                  ? "linear-gradient(90deg,#EF4444,#F87171)"
                  : "linear-gradient(90deg,#6C63FF,#A78BFA)",
                transition: "width 0.4s",
              }} />
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 6 }}>
              {remaining > 0 ? `${remaining} episodios restantes hoy` : "Límite diario alcanzado — se reinicia mañana"}
            </div>
          </div>
        )}

        {/* Top anime */}
        {topAnime.length > 0 && (
          <div style={{
            background: "#13131C", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16, padding: "20px", marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingUp size={15} color="#6C63FF" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Anime más visto</span>
            </div>
            {topAnime.map((a, i) => (
              <div key={a.animeId} onClick={() => navigate(`/anime/${a.animeId}`)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 0", cursor: "pointer",
                borderBottom: i < topAnime.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 900, width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                <img src={a.image} alt={a.title} style={{ width: 34, height: 48, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{a.count} ep. {a.count !== 1 ? "vistos" : "visto"}</div>
                </div>
                {ratings[a.animeId] && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#F59E0B", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    <Star size={11} fill="#F59E0B" color="#F59E0B" /> {ratings[a.animeId]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recent activity */}
        {recent.length > 0 && (
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Clock size={15} color="#6C63FF" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Actividad reciente</span>
            </div>
            {recent.map((p, i) => {
              const pct = Math.min(1, p.currentTime / Math.max(p.duration, 1));
              return (
                <div key={p.episodeId} onClick={() => navigate(`/anime/${p.animeId}`)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "8px 0", cursor: "pointer",
                  borderBottom: i < recent.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img src={p.animeImage} alt={p.animeTitle} style={{ width: 36, height: 50, borderRadius: 7, objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.5)", borderRadius: "0 0 7px 7px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.round(pct * 100)}%`, background: "#6C63FF" }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#F1F1F5", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.animeTitle}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Episodio {p.episodeNum} · {Math.round(pct * 100)}% visto</div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, flexShrink: 0 }}>
                    {new Date(p.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {progress.length === 0 && favorites.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            Empieza a ver anime para ver tus estadísticas aquí
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
