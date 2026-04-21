import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Tv2, Heart, TrendingUp, Crown, Shield, Clock,
  Flame, CheckCircle2, BarChart2, BookOpen, Share2,
  Star, Trophy, Zap, Lock, ChevronRight, Mail, AlertCircle,
  List, Users, Sparkles,
} from "lucide-react";
import { getEpisodesWatchedToday } from "@/lib/accessControl";
import { apiClient } from "@/lib/apiClient";
import { resolveAvatarUrl } from "@/lib/utils";
import { useLimitsConfig } from "@/hooks/use-limits-config";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function getAccess() {
  const STORAGE_KEY = "af_daily_access";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, date: new Date().toISOString().slice(0, 10), watchedIds: [] };
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return { count: 0, date: today, watchedIds: [] };
    return { ...parsed, watchedIds: parsed.watchedIds ?? [] };
  } catch {
    return { count: 0, date: new Date().toISOString().slice(0, 10), watchedIds: [] };
  }
}

interface UserStats {
  totalEpisodes: number;
  totalAnimes: number;
  completed: number;
  streak: number;
  episodesThisWeek: number;
  estimatedHours: number;
  favoriteGenre: string | null;
  topGenres?: { genre: string; count: number }[];
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
  Dom: "Do", Lun: "Lu", Mar: "Ma", "Mié": "Mi", Jue: "Ju", Vie: "Vi", "Sáb": "Sá",
};

const COLORS_BAR = ["#FF3355", "#7C73FF", "#8C83FF", "#9C93FF", "#FCA5B5", "#B7A3FB", "#C7B3FC"];

const GENRE_COLORS = [
  "#FF3355", "#EC4899", "#22C55E", "#F59E0B", "#FF3355",
];

function getLevelInfo(episodes: number) {
  const level = Math.min(50, Math.floor(Math.sqrt(episodes / 5)) + 1);
  const xpForLevel = (l: number) => (l - 1) * (l - 1) * 5;
  const currentXp = episodes - xpForLevel(level);
  const neededXp = xpForLevel(level + 1) - xpForLevel(level);
  const progress = Math.min(100, Math.round((currentXp / Math.max(1, neededXp)) * 100));
  return { level, currentXp, neededXp, progress };
}

type Achievement = {
  id: string;
  icon: string;
  label: string;
  desc: string;
  color: string;
  unlocked: boolean;
};

function getAchievements(stats: UserStats | null, isMegaFan: boolean): Achievement[] {
  const eps = stats?.totalEpisodes ?? 0;
  const animes = stats?.totalAnimes ?? 0;
  const streak = stats?.streak ?? 0;
  const completed = stats?.completed ?? 0;
  return [
    { id: "inicio", icon: "🎌", label: "Primer episodio", desc: "Viste tu primer episodio", color: "#FF3355", unlocked: eps >= 1 },
    { id: "dedicado", icon: "📺", label: "Dedicado", desc: "50 episodios vistos", color: "#22C55E", unlocked: eps >= 50 },
    { id: "maraton", icon: "🏃", label: "Maratonista", desc: "200 episodios vistos", color: "#F59E0B", unlocked: eps >= 200 },
    { id: "legend", icon: "⚡", label: "Leyenda", desc: "500 episodios vistos", color: "#EC4899", unlocked: eps >= 500 },
    { id: "colec", icon: "🗂️", label: "Coleccionista", desc: "10 animes distintos", color: "#FF3355", unlocked: animes >= 10 },
    { id: "racha", icon: "🔥", label: "Racha semanal", desc: "7 días consecutivos", color: "#EF4444", unlocked: streak >= 7 },
    { id: "finish", icon: "✅", label: "Completista", desc: "5 animes completados", color: "#10B981", unlocked: completed >= 5 },
    { id: "mega", icon: "👑", label: "MegaFan", desc: "Plan premium activo", color: "#F59E0B", unlocked: isMegaFan },
  ];
}

type Tab = "resumen" | "favoritos" | "lista";

export default function Profile() {
  const { user, isMegaFan, isOwner } = useAuth();
  const [, navigate] = useLocation();
  const { config: limitsConfig } = useLimitsConfig();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [watchlist, setWatchlist] = useState<AnimeItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [tab, setTab] = useState<Tab>("resumen");
  const [copied, setCopied] = useState(false);

  const watchedToday = getEpisodesWatchedToday();
  const access = getAccess();
  const remaining = isMegaFan ? Infinity : Math.max(0, limitsConfig.dailyLimit - access.count);

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
        setFavorites(f.slice(0, 24));
        setWatchlist(w.slice(0, 24));
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [user]);

  const levelInfo = getLevelInfo(stats?.totalEpisodes ?? 0);
  const achievements = getAchievements(stats, isMegaFan);
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const topGenres = stats?.topGenres ?? [];
  const maxGenreCount = topGenres[0]?.count ?? 1;

  const handleCopyLink = () => {
    if (!user) return;
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/perfil/${user.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const card = {
    background: "#0d0b1e",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 20,
    padding: "20px",
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "resumen", label: "Resumen", icon: <BarChart2 size={14} /> },
    { key: "favoritos", label: "Favoritos", icon: <Heart size={14} /> },
    { key: "lista", label: "Mi lista", icon: <List size={14} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060611" }}>
      <Navbar />
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "68px 14px 56px" }}>

        {/* ── Email verification banner ── */}
        {user && !user.email_verified && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 14, padding: "12px 16px",
          }}>
            <AlertCircle size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: "#FCD34D", fontSize: 13, fontWeight: 700 }}>Correo sin verificar</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}> · Verifica tu cuenta para acceso completo</span>
            </div>
            <button
              onClick={() => navigate("/settings")}
              style={{
                flexShrink: 0, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)",
                borderRadius: 9, padding: "6px 12px", color: "#FCD34D", fontSize: 12,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Verificar →
            </button>
          </div>
        )}

        {/* ── Hero card ── */}
        <div style={{
          borderRadius: 22, marginBottom: 14,
          border: "1px solid rgba(244,63,94,0.2)",
          background: "linear-gradient(180deg,#13112b,#0d0b1e)",
          position: "relative",
        }}>
          {/* Banner */}
          <div style={{ height: 90, borderRadius: "20px 20px 0 0", position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#1a1250,#2d1569,#130f2e)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 25% 60%,rgba(244,63,94,0.5),transparent 60%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 30%,rgba(236,72,153,0.25),transparent 55%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 55% 90%,rgba(244,63,94,0.15),transparent 50%)" }} />
            <div style={{ position: "absolute", top: 12, right: 55, width: 36, height: 36, borderRadius: "50%", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.2)" }} />
            <div style={{ position: "absolute", top: 28, right: 95, width: 18, height: 18, borderRadius: "50%", background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)" }} />
          </div>

          {/* Avatar — absolutely positioned so it always overlaps the banner correctly */}
          <div style={{
            position: "absolute", top: 52, left: 18,
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg,#FF3355,#E11D48)",
            border: "4px solid #13112b",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 900, color: "#fff", overflow: "hidden",
            boxShadow: "0 0 24px rgba(244,63,94,0.5)",
            zIndex: 2,
          }}>
            {resolveAvatarUrl(user?.avatar_url)
              ? <img src={resolveAvatarUrl(user?.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (user?.username?.charAt(0)?.toUpperCase() ?? "?")}
          </div>

          {/* Content — paddingTop clears the avatar (90px banner + 34px overflow = 124px total, minus 90 = 34 + buffer) */}
          <div style={{ padding: "42px 18px 20px" }}>
            {/* Name + badges + action buttons */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              {/* Left: name + badges */}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900, letterSpacing: -0.3, lineHeight: 1.2, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.username ?? "Invitado"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  {isOwner && (
                    <button onClick={() => navigate("/admin")} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                      borderRadius: 20, padding: "3px 8px", color: "#FCA5A5",
                      fontSize: 10, fontWeight: 900, cursor: "pointer",
                    }}>
                      <Shield size={9} /> DUEÑO
                    </button>
                  )}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: isMegaFan ? "rgba(245,158,11,0.15)" : "rgba(244,63,94,0.1)",
                    border: `1px solid ${isMegaFan ? "rgba(245,158,11,0.4)" : "rgba(244,63,94,0.3)"}`,
                    borderRadius: 20, padding: "3px 8px",
                    color: isMegaFan ? "#FCD34D" : "#FCA5B5", fontSize: 10, fontWeight: 800,
                  }}>
                    {isMegaFan ? <><Crown size={9} /> MegaFan</> : "✦ Gratuito"}
                  </span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.25)",
                    borderRadius: 20, padding: "3px 8px", color: "#9D8FFF", fontSize: 10, fontWeight: 700,
                  }}>
                    <Zap size={9} /> Nv. {levelInfo.level}
                  </span>
                </div>
              </div>
              {/* Right: action buttons */}
              {user && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  <button onClick={handleCopyLink} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: copied ? "rgba(34,197,94,0.15)" : "rgba(244,63,94,0.1)",
                    border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(244,63,94,0.3)"}`,
                    borderRadius: 10, padding: "6px 10px",
                    color: copied ? "#22C55E" : "#FCA5B5",
                    cursor: "pointer", fontSize: 11, fontWeight: 700,
                  }}>
                    <Share2 size={11} /> {copied ? "✓" : ""}
                  </button>
                  <button onClick={() => navigate("/settings")} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10, padding: "6px 10px",
                    color: "rgba(255,255,255,0.55)",
                    cursor: "pointer", fontSize: 11, fontWeight: 700,
                  }}>
                    Editar
                  </button>
                </div>
              )}
            </div>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, marginBottom: 14 }}>{user?.email}</div>

            {/* Level progress */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }}>
                  Nivel {levelInfo.level} · {levelInfo.currentXp}/{levelInfo.neededXp} ep.
                </span>
                <span style={{ color: "#FCA5B5", fontSize: 11, fontWeight: 700 }}>{levelInfo.progress}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  width: `${levelInfo.progress}%`,
                  background: "linear-gradient(90deg,#E11D48,#FF3355,#FCA5B5)",
                  transition: "width 0.6s ease",
                  boxShadow: "0 0 8px rgba(244,63,94,0.5)",
                }} />
              </div>
            </div>

            {/* Quick stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { label: "Episodios", value: loadingStats ? "–" : stats?.totalEpisodes ?? 0, color: "#FF3355", icon: <Tv2 size={13} />, bg: "rgba(244,63,94,0.1)" },
                { label: "Horas", value: loadingStats ? "–" : `${stats?.estimatedHours ?? 0}h`, color: "#22C55E", icon: <Clock size={13} />, bg: "rgba(34,197,94,0.1)" },
                { label: "Completados", value: loadingStats ? "–" : stats?.completed ?? 0, color: "#EC4899", icon: <CheckCircle2 size={13} />, bg: "rgba(236,72,153,0.1)" },
                { label: "Racha", value: loadingStats ? "–" : `${stats?.streak ?? 0}d`, color: "#F59E0B", icon: <Flame size={13} />, bg: "rgba(245,158,11,0.1)" },
              ].map(({ label, value, color, icon, bg }) => (
                <div key={label} style={{ textAlign: "center", background: bg, borderRadius: 14, padding: "12px 6px", border: `1px solid ${color}22`, position: "relative", overflow: "hidden" }}>
                  <div style={{ color, fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>{icon}</div>
                  <div style={{ color, fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{value}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, marginTop: 4, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* MegaFan CTA */}
            {!isMegaFan && user && (
              <button onClick={() => navigate("/membership")} style={{
                marginTop: 14, width: "100%",
                background: "linear-gradient(135deg,rgba(244,63,94,0.2),rgba(236,72,153,0.12))",
                border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: 12, padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Crown size={14} color="#F59E0B" />
                  <span style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 800 }}>Hazte MegaFan · Sin límites</span>
                </div>
                <ChevronRight size={14} color="#FCA5B5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 10px", borderRadius: 12, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                background: tab === key ? "rgba(244,63,94,0.25)" : "transparent",
                color: tab === key ? "#FCA5B5" : "rgba(255,255,255,0.35)",
                boxShadow: tab === key ? "0 0 0 1px rgba(244,63,94,0.3)" : "none",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ══ TAB: RESUMEN ══ */}
        {tab === "resumen" && (
          <div>
            {/* Achievements */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={14} color="#F59E0B" />
                  <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Logros</span>
                </div>
                <span style={{ color: "#FCA5B5", fontSize: 12, fontWeight: 700 }}>{unlockedCount}/{achievements.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {achievements.map((a) => (
                  <div key={a.id} style={{
                    position: "relative", textAlign: "center",
                    background: a.unlocked ? `rgba(${hexToRgb(a.color)},0.1)` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${a.unlocked ? `rgba(${hexToRgb(a.color)},0.3)` : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 14, padding: "12px 8px",
                    opacity: a.unlocked ? 1 : 0.45,
                    transition: "opacity 0.2s",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 4, filter: a.unlocked ? "none" : "grayscale(1)" }}>{a.icon}</div>
                    <div style={{ color: a.unlocked ? "#F1F1F5" : "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>{a.label}</div>
                    {!a.unlocked && (
                      <div style={{ position: "absolute", top: 6, right: 6 }}>
                        <Lock size={9} color="rgba(255,255,255,0.2)" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly activity */}
            {stats && (
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <BarChart2 size={14} color="#FF3355" />
                  <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Actividad esta semana</span>
                  <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>últimos 7 días</span>
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={stats.weeklyActivity} margin={{ top: 0, right: 0, left: -32, bottom: 0 }} barCategoryGap="30%">
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      tickLine={false} axisLine={false}
                      tickFormatter={(v) => DAY_ES[v] ?? v}
                    />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: "#FCA5B5", fontWeight: 700 }}
                      itemStyle={{ color: "#F1F1F5" }}
                      formatter={(v: number) => [`${v} ep.`, "Episodios"]}
                      labelFormatter={(label: string) => DAY_ES[label] ?? label}
                    />
                    <Bar dataKey="episodes" radius={[5, 5, 0, 0]}>
                      {stats.weeklyActivity.map((_, i) => (
                        <Cell key={i} fill={COLORS_BAR[i % COLORS_BAR.length]} fillOpacity={stats.weeklyActivity[i].episodes > 0 ? 1 : 0.2} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top genres */}
            {topGenres.length > 0 && (
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Sparkles size={14} color="#EC4899" />
                  <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Géneros favoritos</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topGenres.map(({ genre, count }, i) => {
                    const pct = Math.round((count / maxGenreCount) * 100);
                    return (
                      <div key={genre}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: "#F1F1F5", fontSize: 12, fontWeight: 700 }}>{genre}</span>
                          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{count} interacciones</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            width: `${pct}%`,
                            background: GENRE_COLORS[i % GENRE_COLORS.length],
                            opacity: 0.85,
                            transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top anime */}
            {stats && stats.topAnime.length > 0 && (
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <TrendingUp size={14} color="#FF3355" />
                  <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Más vistos</span>
                </div>
                {stats.topAnime.map((a, i) => (
                  <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "9px 0", cursor: "pointer",
                    borderBottom: i < stats.topAnime.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <span style={{ color: i === 0 ? "#F59E0B" : i === 1 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 900, width: 18, textAlign: "center", flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </span>
                    {a.anime_image && <img src={a.anime_image} alt={a.anime_title} style={{ width: 34, height: 48, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.anime_title}</div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{a.ep_count} {Number(a.ep_count) !== 1 ? "episodios" : "episodio"}</div>
                    </div>
                    <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
                  </div>
                ))}
              </div>
            )}

            {/* Daily limit for free users */}
            {!isMegaFan && user && (
              <div style={{
                background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.18)",
                borderRadius: 16, padding: "16px 18px", marginBottom: 14,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>Episodios gratis hoy</div>
                  <div style={{ color: "#FCA5B5", fontSize: 16, fontWeight: 900 }}>{watchedToday}/{limitsConfig.dailyLimit}</div>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${Math.min(100, (watchedToday / limitsConfig.dailyLimit) * 100)}%`,
                    background: watchedToday >= limitsConfig.dailyLimit
                      ? "linear-gradient(90deg,#EF4444,#F87171)"
                      : "linear-gradient(90deg,#FF3355,#FCA5B5)",
                    transition: "width 0.4s",
                  }} />
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 6 }}>
                  {remaining > 0 ? `${remaining} episodios restantes hoy` : "Límite diario alcanzado — se reinicia mañana"}
                </div>
              </div>
            )}

            {user && !loadingStats && !stats && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                Empieza a ver anime para que aparezcan tus estadísticas aquí
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: FAVORITOS ══ */}
        {tab === "favoritos" && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Heart size={14} color="#EC4899" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Favoritos</span>
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{favorites.length} animes</span>
            </div>
            {favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                {loadingStats ? "Cargando..." : "Aún no tienes favoritos"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 8 }}>
                {favorites.map((a) => (
                  <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{ cursor: "pointer", position: "relative" }}>
                    <img src={a.anime_image} alt={a.anime_title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 10, display: "block" }} />
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: 10,
                      background: "linear-gradient(to top,rgba(0,0,0,0.8) 0%,transparent 50%)",
                      opacity: 0, transition: "opacity 0.2s",
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                    >
                      <div style={{ position: "absolute", bottom: 5, left: 5, right: 5, color: "#fff", fontSize: 9, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                        {a.anime_title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: MI LISTA ══ */}
        {tab === "lista" && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <List size={14} color="#FF3355" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Mi lista</span>
              <button onClick={() => navigate("/watchlist")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#FF3355", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Ver lista completa →
              </button>
            </div>
            {watchlist.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                {loadingStats ? "Cargando..." : "Tu lista está vacía"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 8 }}>
                {watchlist.map((a) => (
                  <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{ cursor: "pointer", position: "relative" }}>
                    <img src={a.anime_image} alt={a.anime_title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 10, display: "block" }} />
                    {a.status === "completed" && (
                      <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(34,197,94,0.9)", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CheckCircle2 size={11} color="#fff" />
                      </div>
                    )}
                    {a.status === "watching" && (
                      <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(244,63,94,0.9)", borderRadius: 5, padding: "2px 5px" }}>
                        <span style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>▶</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!user && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            Inicia sesión para ver tus estadísticas
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

/* Helper: convert hex color to RGB string for rgba() */
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
