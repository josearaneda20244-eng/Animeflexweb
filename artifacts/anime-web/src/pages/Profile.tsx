import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Tv2, Heart, TrendingUp, Crown, Shield, Clock,
  Flame, CheckCircle2, BarChart2, BookOpen, Share2,
} from "lucide-react";
import { DAILY_LIMIT, getRemainingEpisodes, getEpisodesWatchedToday } from "@/lib/accessControl";
import { apiClient } from "@/lib/apiClient";
import { resolveAvatarUrl } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface UserStats {
  totalEpisodes: number;
  totalAnimes: number;
  completed: number;
  streak: number;
  episodesThisWeek: number;
  estimatedHours: number;
  favoriteGenre: string | null;
  weeklyActivity: { date: string; day: string; episodes: number }[];
  topAnime: { anime_id: string; anime_title: string; anime_image: string; ep_count: number }[];
}

interface AnimeItem {
  anime_id: string;
  anime_title: string;
  anime_image: string;
  anime_type: string;
  status?: string;
}

const DAY_ES: Record<string, string> = {
  Sun: "Do", Mon: "Lu", Tue: "Ma", Wed: "Mi", Thu: "Ju", Fri: "Vi", Sat: "Sá",
};

const COLORS_BAR = ["#6C63FF", "#7C73FF", "#8C83FF", "#9C93FF", "#A78BFA", "#B7A3FB", "#C7B3FC"];

export default function Profile() {
  const { user, isMegaFan, isOwner } = useAuth();
  const [, navigate] = useLocation();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [watchlist, setWatchlist] = useState<AnimeItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const watchedToday = getEpisodesWatchedToday();
  const remaining = getRemainingEpisodes(isMegaFan);

  useEffect(() => {
    if (!user) return;
    setLoadingStats(true);
    Promise.all([
      apiClient.get<UserStats>("/user/stats"),
      apiClient.get<AnimeItem[]>("/user/favorites"),
      apiClient.get<AnimeItem[]>("/user/watchlist"),
    ])
      .then(([s, f, w]) => {
        setStats(s);
        setFavorites(f.slice(0, 12));
        setWatchlist(w.filter(i => i.status === "watching" || i.status === "completed").slice(0, 12));
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [user]);

  const STAT_CARDS = stats
    ? [
        { icon: <Tv2 size={20} color="#6C63FF" />, label: "Episodios vistos", value: stats.totalEpisodes, sub: `${stats.episodesThisWeek} esta semana` },
        { icon: <Clock size={20} color="#22C55E" />, label: "Horas de anime", value: `${stats.estimatedHours}h`, sub: `${stats.totalAnimes} animes distintos` },
        { icon: <CheckCircle2 size={20} color="#EC4899" />, label: "Completados", value: stats.completed, sub: "animes terminados" },
        { icon: <Flame size={20} color="#F59E0B" />, label: "Racha activa", value: `${stats.streak}d`, sub: stats.streak === 1 ? "día seguido" : "días seguidos" },
      ]
    : [
        { icon: <Tv2 size={20} color="#6C63FF" />, label: "Episodios vistos", value: "–", sub: "cargando..." },
        { icon: <Clock size={20} color="#22C55E" />, label: "Horas de anime", value: "–", sub: "" },
        { icon: <CheckCircle2 size={20} color="#EC4899" />, label: "Completados", value: "–", sub: "" },
        { icon: <Flame size={20} color="#F59E0B" />, label: "Racha activa", value: "–", sub: "" },
      ];

  const cardStyle = {
    background: "#13131C",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: "18px 16px",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "72px 16px 48px" }}>

        {/* Profile header */}
        <div style={{
          background: "linear-gradient(135deg,#13131C,#1a1a2e)",
          border: "1px solid rgba(108,99,255,0.15)", borderRadius: 20,
          padding: "24px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 18,
        }}>
          <div style={{
            width: 70, height: 70, borderRadius: 18, flexShrink: 0,
            background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 900, color: "#fff", overflow: "hidden",
            boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
          }}>
            {resolveAvatarUrl(user?.avatar_url)
              ? <img src={resolveAvatarUrl(user?.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (user?.username?.charAt(0)?.toUpperCase() ?? "?")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900 }}>{user?.username ?? "Invitado"}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "3px 0 8px" }}>{user?.email ?? "No has iniciado sesión"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                    padding: "5px 12px", color: "#A78BFA", cursor: "pointer",
                    fontSize: 12, fontWeight: 800,
                  }}
                >
                  <Shield size={12} /> Admin
                </button>
              )}
              {user && (
                <>
                  <button
                    onClick={() => navigate("/settings")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10, padding: "5px 12px", color: "rgba(255,255,255,0.5)",
                      cursor: "pointer", fontSize: 12, fontWeight: 700,
                    }}
                  >
                    Editar perfil
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/perfil/${user.id}`;
                      navigator.clipboard?.writeText(url).catch(() => {});
                    }}
                    title="Copiar enlace de perfil público"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.25)",
                      borderRadius: 10, padding: "5px 10px", color: "#A78BFA",
                      cursor: "pointer", fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <Share2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
          {!isMegaFan && user && (
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
          {STAT_CARDS.map(({ icon, label, value, sub }) => (
            <div key={label} style={cardStyle}>
              <div style={{ marginBottom: 10 }}>{icon}</div>
              <div style={{ color: loadingStats ? "rgba(255,255,255,0.25)" : "#F1F1F5", fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{value}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{label}</div>
              <div style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Weekly activity chart */}
        {stats && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <BarChart2 size={15} color="#6C63FF" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Actividad esta semana</span>
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>últimos 7 días</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stats.weeklyActivity} margin={{ top: 0, right: 0, left: -30, bottom: 0 }} barCategoryGap="25%">
                <XAxis
                  dataKey="day"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v) => DAY_ES[v] ?? v}
                />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: "#A78BFA", fontWeight: 700 }}
                  itemStyle={{ color: "#F1F1F5" }}
                  formatter={(v: number) => [`${v} ep.`, "Episodios"]}
                  labelFormatter={(label: string) => DAY_ES[label] ?? label}
                />
                <Bar dataKey="episodes" radius={[6, 6, 0, 0]}>
                  {stats.weeklyActivity.map((_, i) => (
                    <Cell key={i} fill={COLORS_BAR[i % COLORS_BAR.length]} fillOpacity={stats.weeklyActivity[i].episodes > 0 ? 1 : 0.25} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily usage bar (free users) */}
        {!isMegaFan && user && (
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
        {stats && stats.topAnime.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingUp size={15} color="#6C63FF" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Top animes vistos</span>
            </div>
            {stats.topAnime.map((a, i) => (
              <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 0", cursor: "pointer",
                borderBottom: i < stats.topAnime.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 900, width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                {a.anime_image && <img src={a.anime_image} alt={a.anime_title} style={{ width: 34, height: 48, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.anime_title}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{a.ep_count} {Number(a.ep_count) !== 1 ? "episodios" : "episodio"}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Watchlist section */}
        {watchlist.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <BookOpen size={15} color="#6C63FF" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Viendo / Completados</span>
              <button
                onClick={() => navigate("/watchlist")}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "#6C63FF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Ver lista →
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
              {watchlist.map((a) => (
                <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{ cursor: "pointer", position: "relative" }}>
                  <img src={a.anime_image} alt={a.anime_title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 8, display: "block" }} />
                  {a.status === "completed" && (
                    <div style={{ position: "absolute", top: 3, right: 3, background: "rgba(34,197,94,0.9)", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={10} color="#fff" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorites section */}
        {favorites.length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Heart size={15} color="#EC4899" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Favoritos</span>
              <button
                onClick={() => navigate("/favorites")}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "#6C63FF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Ver todos →
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
              {favorites.map((a) => (
                <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{ cursor: "pointer" }}>
                  <img src={a.anime_image} alt={a.anime_title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 8, display: "block" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            Inicia sesión para ver tus estadísticas
          </div>
        )}
        {user && !loadingStats && !stats && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            Empieza a ver anime para que aparezcan tus estadísticas aquí
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
