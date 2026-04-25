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
import { CornerBrackets, MagicCircle, HexGrid } from "@/components/SystemUI";
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

const COLORS_BAR = ["#DC2626", "#7C73FF", "#8C83FF", "#9C93FF", "#FECACA", "#B7A3FB", "#C7B3FC"];

const GENRE_COLORS = [
  "#DC2626", "#DC2626", "#22C55E", "#F59E0B", "#DC2626",
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
    { id: "inicio", icon: "🎌", label: "Primer episodio", desc: "Viste tu primer episodio", color: "#DC2626", unlocked: eps >= 1 },
    { id: "dedicado", icon: "📺", label: "Dedicado", desc: "50 episodios vistos", color: "#22C55E", unlocked: eps >= 50 },
    { id: "maraton", icon: "🏃", label: "Maratonista", desc: "200 episodios vistos", color: "#F59E0B", unlocked: eps >= 200 },
    { id: "legend", icon: "⚡", label: "Leyenda", desc: "500 episodios vistos", color: "#DC2626", unlocked: eps >= 500 },
    { id: "colec", icon: "🗂️", label: "Coleccionista", desc: "10 animes distintos", color: "#DC2626", unlocked: animes >= 10 },
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

  const card: React.CSSProperties = {
    position: "relative",
    background: "linear-gradient(180deg, rgba(20,8,18,0.92), rgba(8,3,12,0.96))",
    border: "1px solid rgba(220,38,38,0.32)",
    padding: "20px",
    clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 20px rgba(220,38,38,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
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

        {/* ── Hero card (System) ── */}
        <div style={{
          marginBottom: 14,
          border: "1px solid rgba(220,38,38,0.5)",
          background: "linear-gradient(180deg, rgba(28,8,18,0.95), rgba(10,4,14,0.98))",
          position: "relative",
          clipPath: "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 32px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 18, right: 18, height: 1,
            background: "linear-gradient(90deg, transparent, #F97316 30%, #DC2626 50%, #F97316 70%, transparent)",
            boxShadow: "0 0 12px #F97316",
            zIndex: 5,
          }} />
          <CornerBrackets color="#F97316" size={18} thickness={2} inset={6} />

          {/* Banner */}
          <div style={{ height: 110, position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #200810, #350a18 50%, #15040c)" }}>
            <HexGrid color="rgba(249,115,22,0.10)" size={22} fade={false} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 25% 60%,rgba(220,38,38,0.6),transparent 55%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 30%,rgba(249,115,22,0.35),transparent 55%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.04) 0px, rgba(249,115,22,0.04) 1px, transparent 1px, transparent 4px)" }} />

            {/* Magic circle */}
            <div style={{ position: "absolute", top: -50, right: -50 }}>
              <MagicCircle size={180} color="#DC2626" opacity={0.55} />
            </div>

            {/* Sys label top */}
            <div style={{ position: "absolute", top: 12, left: 18, zIndex: 3 }}>
              <span className="sys-label" style={{ fontSize: 9.5, letterSpacing: 2.5 }}>
                CAZADOR · PERFIL_01
              </span>
            </div>
          </div>

          {/* Avatar — absolutely positioned so it always overlaps the banner correctly */}
          <div style={{
            position: "absolute", top: 64, left: 18,
            width: 76, height: 76,
            background: "linear-gradient(135deg,#FCA5A5,#DC2626 50%,#991B1B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 900, color: "#fff", overflow: "hidden",
            boxShadow: "0 0 0 3px #0a040e, 0 0 0 4px #F97316, 0 0 28px rgba(249,115,22,0.7)",
            zIndex: 4,
            clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}>
            {resolveAvatarUrl(user?.avatar_url)
              ? <img src={resolveAvatarUrl(user?.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (user?.username?.charAt(0)?.toUpperCase() ?? "?")}
          </div>

          {/* Content — paddingTop clears the avatar (banner 110 + avatar overflow 30) */}
          <div style={{ padding: "44px 18px 20px", position: "relative", zIndex: 2 }}>
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
                    background: isMegaFan ? "rgba(245,158,11,0.15)" : "rgba(220,38,38,0.1)",
                    border: `1px solid ${isMegaFan ? "rgba(245,158,11,0.4)" : "rgba(220,38,38,0.3)"}`,
                    borderRadius: 20, padding: "3px 8px",
                    color: isMegaFan ? "#FCD34D" : "#FECACA", fontSize: 10, fontWeight: 800,
                  }}>
                    {isMegaFan ? <><Crown size={9} /> MegaFan</> : "✦ Gratuito"}
                  </span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.45)",
                    padding: "3px 8px", color: "#FDBA74", fontSize: 10, fontWeight: 800,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 0.5,
                    clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
                    textShadow: "0 0 8px rgba(249,115,22,0.6)",
                  }}>
                    <Zap size={9} /> NV.{levelInfo.level}
                  </span>
                </div>
              </div>
              {/* Right: action buttons */}
              {user && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  <button onClick={handleCopyLink} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: copied ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.1)",
                    border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(220,38,38,0.3)"}`,
                    borderRadius: 10, padding: "6px 10px",
                    color: copied ? "#22C55E" : "#FECACA",
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
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#FDBA74", fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1.5 }}>
                  EXP · NV.{levelInfo.level} · {levelInfo.currentXp}/{levelInfo.neededXp}
                </span>
                <span style={{ color: "#FECACA", fontSize: 10, fontWeight: 900, fontFamily: "'JetBrains Mono', ui-monospace, monospace", textShadow: "0 0 8px rgba(220,38,38,0.6)" }}>
                  [ {levelInfo.progress}% ]
                </span>
              </div>
              <div style={{
                height: 8, background: "rgba(4,3,10,0.85)", overflow: "hidden",
                border: "1px solid rgba(249,115,22,0.3)",
                clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
              }}>
                <div style={{
                  height: "100%",
                  width: `${levelInfo.progress}%`,
                  background: "linear-gradient(90deg,#991B1B,#DC2626,#F97316,#FDBA74)",
                  transition: "width 0.6s ease",
                  boxShadow: "0 0 14px rgba(249,115,22,0.7), inset 0 0 8px rgba(255,255,255,0.2)",
                }} />
              </div>
            </div>

            {/* Quick stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { label: "Episodios", value: loadingStats ? "–" : stats?.totalEpisodes ?? 0, color: "#DC2626", icon: <Tv2 size={13} />, bg: "rgba(220,38,38,0.1)" },
                { label: "Horas", value: loadingStats ? "–" : `${stats?.estimatedHours ?? 0}h`, color: "#22C55E", icon: <Clock size={13} />, bg: "rgba(34,197,94,0.1)" },
                { label: "Completados", value: loadingStats ? "–" : stats?.completed ?? 0, color: "#DC2626", icon: <CheckCircle2 size={13} />, bg: "rgba(220,38,38,0.1)" },
                { label: "Racha", value: loadingStats ? "–" : `${stats?.streak ?? 0}d`, color: "#F59E0B", icon: <Flame size={13} />, bg: "rgba(245,158,11,0.1)" },
              ].map(({ label, value, color, icon, bg }) => (
                <div key={label} style={{
                  textAlign: "center", background: bg,
                  padding: "12px 6px",
                  border: `1px solid ${color}66`,
                  position: "relative", overflow: "hidden",
                  clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  boxShadow: `0 0 12px ${color}22, inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}>
                  <div style={{ color, fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85 }}>{icon}</div>
                  <div style={{
                    color, fontSize: 18, fontWeight: 900, lineHeight: 1,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    textShadow: `0 0 10px ${color}aa`,
                  }}>{value}</div>
                  <div style={{
                    color: "rgba(255,255,255,0.5)", fontSize: 8.5, marginTop: 5,
                    fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  }}>{label}</div>
                </div>
              ))}
            </div>

            {/* MegaFan CTA */}
            {!isMegaFan && user && (
              <button
                onClick={() => navigate("/membership")}
                className="sys-btn primary"
                style={{
                  marginTop: 14, width: "100%",
                  padding: "12px 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 12,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Crown size={14} /> {">>"} HAZTE MEGAFAN · SIN LÍMITES
                </span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs (System) ── */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 14,
          background: "rgba(4,3,10,0.85)",
          padding: 4,
          border: "1px solid rgba(249,115,22,0.3)",
          clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
        }}>
          {TABS.map(({ key, label, icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 8px", border: "none", cursor: "pointer",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
                  transition: "all 0.18s",
                  background: active
                    ? "linear-gradient(180deg, rgba(220,38,38,0.85), rgba(153,27,27,0.85))"
                    : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.4)",
                  textShadow: active ? "0 0 10px rgba(255,255,255,0.5)" : "none",
                  boxShadow: active ? "0 0 18px rgba(220,38,38,0.55)" : "none",
                  clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                }}
              >
                {icon} {label}
              </button>
            );
          })}
        </div>

        {/* ══ TAB: RESUMEN ══ */}
        {tab === "resumen" && (
          <div>
            {/* Achievements */}
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span className="sys-label" style={{ fontSize: 11 }}>
                  <Trophy size={12} style={{ marginRight: 2 }} /> LOGROS · CAZADOR
                </span>
                <span style={{
                  color: "#FDBA74", fontSize: 11, fontWeight: 900,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  textShadow: "0 0 8px rgba(249,115,22,0.6)",
                }}>[ {unlockedCount}/{achievements.length} ]</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {achievements.map((a) => (
                  <div key={a.id} style={{
                    position: "relative", textAlign: "center",
                    background: a.unlocked ? `rgba(${hexToRgb(a.color)},0.12)` : "rgba(8,3,12,0.6)",
                    border: `1px solid ${a.unlocked ? `rgba(${hexToRgb(a.color)},0.5)` : "rgba(255,255,255,0.07)"}`,
                    padding: "12px 6px",
                    opacity: a.unlocked ? 1 : 0.45,
                    transition: "opacity 0.2s, transform 0.2s",
                    clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                    boxShadow: a.unlocked ? `0 0 12px ${a.color}33` : "none",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 4, filter: a.unlocked ? `drop-shadow(0 0 6px ${a.color})` : "grayscale(1)" }}>{a.icon}</div>
                    <div style={{
                      color: a.unlocked ? "#F1F1F5" : "rgba(255,255,255,0.35)",
                      fontSize: 9.5, fontWeight: 800, lineHeight: 1.3,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      letterSpacing: 0.3,
                    }}>{a.label}</div>
                    {!a.unlocked && (
                      <div style={{ position: "absolute", top: 5, right: 5 }}>
                        <Lock size={9} color="rgba(255,255,255,0.25)" />
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
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <BarChart2 size={12} style={{ marginRight: 2 }} /> ACTIVIDAD · 7D
                  </span>
                  <span style={{ marginLeft: "auto", color: "rgba(253,186,116,0.55)", fontSize: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1 }}>// LOG</span>
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
                      contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: "#FECACA", fontWeight: 700 }}
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
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <Sparkles size={12} style={{ marginRight: 2 }} /> GÉNEROS · TOP
                  </span>
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
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <TrendingUp size={12} style={{ marginRight: 2 }} /> RANKING · MÁS VISTOS
                  </span>
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
                position: "relative",
                background: "linear-gradient(180deg, rgba(28,8,18,0.92), rgba(8,3,12,0.96))",
                border: "1px solid rgba(220,38,38,0.45)",
                padding: "16px 18px", marginBottom: 14,
                clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                boxShadow: "0 0 16px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span className="sys-label" style={{ fontSize: 10.5 }}>CUOTA · EPISODIOS_HOY</span>
                  <div style={{
                    color: "#FDBA74", fontSize: 15, fontWeight: 900,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    textShadow: "0 0 10px rgba(249,115,22,0.6)",
                  }}>[ {watchedToday}/{limitsConfig.dailyLimit} ]</div>
                </div>
                <div style={{
                  height: 8, background: "rgba(4,3,10,0.85)", overflow: "hidden",
                  border: "1px solid rgba(249,115,22,0.3)",
                  clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, (watchedToday / limitsConfig.dailyLimit) * 100)}%`,
                    background: watchedToday >= limitsConfig.dailyLimit
                      ? "linear-gradient(90deg,#EF4444,#F87171,#FECACA)"
                      : "linear-gradient(90deg,#991B1B,#DC2626,#F97316)",
                    boxShadow: "0 0 12px rgba(249,115,22,0.6)",
                    transition: "width 0.4s",
                  }} />
                </div>
                <div style={{
                  color: "rgba(253,186,116,0.7)", fontSize: 10.5, marginTop: 8,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 0.5,
                }}>
                  {">"} {remaining > 0 ? `${remaining} episodios restantes hoy` : "LÍMITE ALCANZADO · reinicio en 24h"}
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
              <span className="sys-label" style={{ fontSize: 11 }}>
                <Heart size={12} style={{ marginRight: 2 }} /> FAVORITOS
              </span>
              <span style={{ marginLeft: "auto", color: "#FDBA74", fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 800, textShadow: "0 0 8px rgba(249,115,22,0.5)" }}>[ {favorites.length} ]</span>
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
              <span className="sys-label" style={{ fontSize: 11 }}>
                <List size={12} style={{ marginRight: 2 }} /> MI LISTA
              </span>
              <button onClick={() => navigate("/watchlist")} style={{
                marginLeft: "auto", background: "none", border: "none",
                color: "#FDBA74", fontSize: 11, fontWeight: 800, cursor: "pointer",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 0.5,
                textShadow: "0 0 8px rgba(249,115,22,0.5)",
              }}>
                VER COMPLETA →
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
                      <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(220,38,38,0.9)", borderRadius: 5, padding: "2px 5px" }}>
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
