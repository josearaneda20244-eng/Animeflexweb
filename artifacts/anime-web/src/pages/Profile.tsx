import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Tv2, Heart, TrendingUp, Crown, Shield, Clock,
  Flame, CheckCircle2, BarChart2, Share2,
  Trophy, Zap, Lock, AlertCircle,
  List, Users, Sparkles, Target, X, Download,
  PlayCircle, Activity, Calendar, ChevronRight, BarChart3,
} from "lucide-react";
import { getEpisodesWatchedToday } from "@/lib/accessControl";
import { apiClient } from "@/lib/apiClient";
import { resolveAvatarUrl } from "@/lib/utils";
import { useLimitsConfig } from "@/hooks/use-limits-config";
import { CornerBrackets } from "@/components/SystemUI";
import { ProfileBanner, getBannerMeta } from "@/components/BannerPreset";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const MONO = "'JetBrains Mono', ui-monospace, monospace";

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

interface ContinueItem {
  episode_id: string;
  anime_id: string;
  anime_title: string;
  anime_image: string;
  episode_num: number;
  watch_time: number;
  duration: number;
  progress_pct: number;
  updated_at: string;
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
  yearlyHeatmap?: { date: string; episodes: number }[];
  hourlyActivity?: { hour: number; episodes: number }[];
  percentile?: number;
  achievementDates?: Record<string, string | null>;
  continueWatching?: ContinueItem[];
  firstWatched?: string | null;
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
const GENRE_COLORS = ["#DC2626", "#F97316", "#22C55E", "#F59E0B", "#A855F7", "#38BDF8", "#FB923C"];

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
  current: number;
  target: number;
  unlockedAt?: string | null;
};

function getAchievements(stats: UserStats | null, isMegaFan: boolean): Achievement[] {
  const eps = stats?.totalEpisodes ?? 0;
  const animes = stats?.totalAnimes ?? 0;
  const streak = stats?.streak ?? 0;
  const completed = stats?.completed ?? 0;
  const dates = stats?.achievementDates ?? {};
  return [
    { id: "inicio",   icon: "🎌", label: "Primer episodio", desc: "Ver tu primer episodio en AnimeFlex.", color: "#DC2626", current: Math.min(eps,1), target: 1,   unlocked: eps >= 1,   unlockedAt: dates.inicio },
    { id: "dedicado", icon: "📺", label: "Dedicado",        desc: "Acumular 50 episodios vistos.",        color: "#22C55E", current: Math.min(eps,50), target: 50,  unlocked: eps >= 50,  unlockedAt: dates.dedicado },
    { id: "maraton",  icon: "🏃", label: "Maratonista",     desc: "Acumular 200 episodios vistos.",       color: "#F59E0B", current: Math.min(eps,200), target: 200, unlocked: eps >= 200, unlockedAt: dates.maraton },
    { id: "legend",   icon: "⚡", label: "Leyenda",         desc: "Acumular 500 episodios vistos.",       color: "#DC2626", current: Math.min(eps,500), target: 500, unlocked: eps >= 500, unlockedAt: dates.legend },
    { id: "colec",    icon: "🗂️", label: "Coleccionista",   desc: "Ver 10 animes distintos.",             color: "#A855F7", current: Math.min(animes,10), target: 10,  unlocked: animes >= 10 },
    { id: "racha",    icon: "🔥", label: "Racha semanal",   desc: "Ver anime 7 días consecutivos.",       color: "#EF4444", current: Math.min(streak,7), target: 7,   unlocked: streak >= 7 },
    { id: "finish",   icon: "✅", label: "Completista",     desc: "Marcar 5 animes como completados.",    color: "#10B981", current: Math.min(completed,5), target: 5,   unlocked: completed >= 5 },
    { id: "mega",     icon: "👑", label: "MegaFan",         desc: "Activar el plan premium MegaFan.",     color: "#F59E0B", current: isMegaFan ? 1 : 0, target: 1, unlocked: isMegaFan },
  ];
}

/* Animated counter — counts from current displayed value to target on change */
function useAnimatedCount(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const targetRef = useRef(target);
  useEffect(() => {
    if (target === targetRef.current && value === target) return;
    fromRef.current = value;
    targetRef.current = target;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

/* localStorage stale-while-revalidate cache for stats */
const CACHE_KEY = (uid: number) => `af_profile_v1_${uid}`;
const CACHE_TTL_MS = 5 * 60 * 1000;

function readCache(uid: number): { stats: UserStats; favorites: AnimeItem[]; watchlist: AnimeItem[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(uid: number, data: { stats: UserStats; favorites: AnimeItem[]; watchlist: AnimeItem[] }) {
  try {
    localStorage.setItem(CACHE_KEY(uid), JSON.stringify({ ...data, ts: Date.now() }));
  } catch { /* quota */ }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

/* Card style helpers */
const cardStyle: React.CSSProperties = {
  position: "relative",
  background: "linear-gradient(180deg, rgba(20,8,18,0.92), rgba(8,3,12,0.96))",
  border: "1px solid rgba(220,38,38,0.32)",
  padding: "20px",
  clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 20px rgba(220,38,38,0.15), inset 0 1px 0 rgba(255,255,255,0.04)",
};

/* ── Heatmap component (365-day Solo Leveling style) ── */
function YearHeatmap({ data, accent = "#DC2626" }: { data: { date: string; episodes: number }[]; accent?: string }) {
  if (!data || data.length === 0) return null;

  /* Determine first day-of-week alignment (0=Sun..6=Sat). Pad columns so each col is a Sun..Sat strip. */
  const cells = data;
  const firstDay = new Date(cells[0].date + "T12:00:00Z").getUTCDay();
  const padded = Array.from({ length: firstDay }, () => null as { date: string; episodes: number } | null).concat(cells as any);
  /* Group into 7-row weeks */
  const weeks: ({ date: string; episodes: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const max = Math.max(1, ...cells.map((c) => c.episodes));
  const intensity = (n: number) => {
    if (n <= 0) return 0;
    const r = n / max;
    if (r < 0.15) return 1;
    if (r < 0.35) return 2;
    if (r < 0.6)  return 3;
    return 4;
  };
  const color = (lvl: number) => {
    if (lvl === 0) return "rgba(255,255,255,0.05)";
    if (lvl === 1) return `${accent}33`;
    if (lvl === 2) return `${accent}66`;
    if (lvl === 3) return `${accent}AA`;
    return accent;
  };
  const total = cells.reduce((a, b) => a + b.episodes, 0);
  const activeDays = cells.filter((c) => c.episodes > 0).length;
  const bestDay = cells.reduce((best, c) => (c.episodes > (best?.episodes ?? 0) ? c : best), null as null | { date: string; episodes: number });

  /* Month labels — find first cell of each month */
  const monthLabels: { idx: number; label: string }[] = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week.find(Boolean);
    if (!first) return;
    const m = new Date(first.date + "T12:00:00Z").getUTCMonth();
    if (m !== prevMonth) {
      const mn = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m];
      monthLabels.push({ idx: wi, label: mn });
      prevMonth = m;
    }
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 14, color: "rgba(253,186,116,0.75)", fontSize: 10, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 10, flexWrap: "wrap" }}>
        <span>{">"} <strong style={{ color: "#FECACA" }}>{total}</strong> EP. EN 365 D.</span>
        <span>{">"} <strong style={{ color: "#FECACA" }}>{activeDays}</strong> DIAS ACTIVOS</span>
        {bestDay && bestDay.episodes > 0 && (
          <span>{">"} MAX. <strong style={{ color: "#FECACA" }}>{bestDay.episodes}</strong> EP. ({formatDate(bestDay.date)})</span>
        )}
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 6 }}>
        <div style={{ display: "inline-block", minWidth: "100%" }}>
          {/* Month labels row */}
          <div style={{ display: "flex", marginBottom: 4, paddingLeft: 18 }}>
            {weeks.map((_, wi) => {
              const ml = monthLabels.find((l) => l.idx === wi);
              return (
                <div key={wi} style={{ width: 11, fontSize: 8, color: "rgba(253,186,116,0.55)", fontFamily: MONO, fontWeight: 800, letterSpacing: 0.5, textAlign: "left" }}>
                  {ml ? ml.label : ""}
                </div>
              );
            })}
          </div>
          {/* Grid: rows = days, cols = weeks. */}
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 6, fontSize: 8, color: "rgba(253,186,116,0.45)", fontFamily: MONO, letterSpacing: 0.5 }}>
              {["Do","Lu","Ma","Mi","Ju","Vi","Sa"].map((d, i) => (
                <div key={d} style={{ height: 9, lineHeight: "9px", visibility: i % 2 === 1 ? "visible" : "hidden" }}>{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 2 }}>
                {Array.from({ length: 7 }).map((_, di) => {
                  const cell = week[di];
                  if (!cell) return <div key={di} style={{ width: 9, height: 9 }} />;
                  const lvl = intensity(cell.episodes);
                  return (
                    <div
                      key={di}
                      title={`${formatDate(cell.date)}: ${cell.episodes} ep.`}
                      style={{
                        width: 9, height: 9,
                        background: color(lvl),
                        border: lvl > 0 ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.04)",
                        boxShadow: lvl >= 3 ? `0 0 4px ${accent}66` : "none",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 9, color: "rgba(253,186,116,0.55)", fontFamily: MONO, letterSpacing: 0.5 }}>
        <span>MENOS</span>
        {[0,1,2,3,4].map((l) => (
          <div key={l} style={{ width: 9, height: 9, background: color(l), border: `1px solid ${accent}33` }} />
        ))}
        <span>MAS</span>
      </div>
    </div>
  );
}

/* ── Hourly distribution bars (24 buckets) ── */
function HourlyChart({ data }: { data: { hour: number; episodes: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.episodes));
  const peak = data.reduce((best, d) => (d.episodes > (best?.episodes ?? 0) ? d : best), null as null | { hour: number; episodes: number });
  return (
    <div>
      <div style={{ color: "rgba(253,186,116,0.75)", fontSize: 10, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 10 }}>
        {peak && peak.episodes > 0
          ? <>{">"} HORA PICO: <strong style={{ color: "#FECACA" }}>{String(peak.hour).padStart(2,"0")}:00 — {String((peak.hour+1)%24).padStart(2,"0")}:00</strong></>
          : <>{">"} SIN DATOS DE HORARIO TODAVIA</>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90, padding: "0 2px", borderBottom: "1px solid rgba(249,115,22,0.2)" }}>
        {data.map((d) => {
          const h = max > 0 ? Math.max(d.episodes > 0 ? 4 : 0, Math.round((d.episodes / max) * 84)) : 0;
          const isPeak = peak && d.hour === peak.hour && peak.episodes > 0;
          return (
            <div key={d.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative" }}>
              {isPeak && d.episodes > 0 && (
                <div style={{
                  position: "absolute", top: -16, fontSize: 8, color: "#FDBA74",
                  fontFamily: MONO, fontWeight: 800, textShadow: "0 0 6px rgba(249,115,22,0.6)",
                }}>{d.episodes}</div>
              )}
              <div title={`${String(d.hour).padStart(2,"0")}:00 — ${d.episodes} ep.`} style={{
                width: "100%", height: h,
                background: isPeak
                  ? "linear-gradient(180deg, #F97316, #DC2626)"
                  : d.episodes > 0
                    ? "linear-gradient(180deg, #DC2626, #991B1B)"
                    : "rgba(255,255,255,0.05)",
                boxShadow: isPeak ? "0 0 10px rgba(249,115,22,0.7)" : d.episodes > 0 ? "0 0 6px rgba(220,38,38,0.4)" : "none",
                transition: "height 0.4s",
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 6, padding: "0 2px" }}>
        {data.map((d) => (
          <div key={d.hour} style={{
            flex: 1, textAlign: "center", fontSize: 7,
            color: d.hour % 6 === 0 ? "rgba(253,186,116,0.7)" : "rgba(253,186,116,0.25)",
            fontFamily: MONO, fontWeight: 700,
          }}>
            {d.hour % 6 === 0 ? String(d.hour).padStart(2,"0") : "·"}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Achievement Modal with progress + share-as-PNG ── */
function AchievementModal({ ach, username, level, onClose }: { ach: Achievement; username: string; level: number; onClose: () => void }) {
  const [sharing, setSharing] = useState(false);
  const pct = Math.min(100, Math.round((ach.current / ach.target) * 100));

  const handleShare = async () => {
    setSharing(true);
    try {
      const W = 600, H = 800;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");

      /* background */
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0a0410"); bg.addColorStop(0.5, "#1a0410"); bg.addColorStop(1, "#040208");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      /* radial accent */
      const grad = ctx.createRadialGradient(W/2, 320, 30, W/2, 320, 320);
      grad.addColorStop(0, ach.color + "AA"); grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

      /* scanlines */
      ctx.fillStyle = "rgba(249,115,22,0.04)";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

      /* corner brackets */
      const drawBracket = (x: number, y: number, dx: number, dy: number) => {
        ctx.strokeStyle = "#F97316"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + dy * 30); ctx.lineTo(x, y); ctx.lineTo(x + dx * 30, y);
        ctx.stroke();
      };
      drawBracket(20, 20, 1, 1);
      drawBracket(W - 20, 20, -1, 1);
      drawBracket(20, H - 20, 1, -1);
      drawBracket(W - 20, H - 20, -1, -1);

      /* sys label */
      ctx.font = "bold 18px ui-monospace, monospace";
      ctx.fillStyle = "#F97316"; ctx.textAlign = "center";
      ctx.fillText("[ SISTEMA · LOGRO_DESBLOQUEADO ]", W/2, 90);

      /* icon background circle */
      ctx.beginPath();
      ctx.arc(W/2, 290, 110, 0, Math.PI * 2);
      ctx.fillStyle = ach.color + "22";
      ctx.fill();
      ctx.strokeStyle = ach.color; ctx.lineWidth = 2;
      ctx.stroke();

      /* icon */
      ctx.font = "120px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(ach.icon, W/2, 290);
      ctx.textBaseline = "alphabetic";

      /* title */
      ctx.font = "bold 44px ui-monospace, monospace";
      ctx.fillStyle = "#F1F1F5";
      ctx.fillText(ach.label.toUpperCase(), W/2, 480);

      /* desc */
      ctx.font = "16px ui-monospace, monospace";
      ctx.fillStyle = "rgba(253,186,116,0.85)";
      ctx.fillText(ach.desc, W/2, 520);

      /* divider */
      ctx.strokeStyle = "#DC2626"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W/2 - 120, 580); ctx.lineTo(W/2 + 120, 580);
      ctx.stroke();

      /* user info */
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.fillStyle = "#FECACA";
      ctx.fillText(username.toUpperCase(), W/2, 630);
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillStyle = "rgba(253,186,116,0.75)";
      ctx.fillText(`NV.${level} · CAZADOR · ANIMEFLEX`, W/2, 660);

      /* footer */
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.fillStyle = "#F97316";
      ctx.fillText(formatDate(ach.unlockedAt ?? new Date().toISOString()).toUpperCase(), W/2, 730);

      const dataUrl = canvas.toDataURL("image/png");

      /* try Web Share API with file */
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `logro-${ach.id}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `Logro ${ach.label}`, text: `${username} desbloqueó el logro "${ach.label}" en AnimeFlex!` });
          return;
        }
      } catch { /* fall back to download */ }

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `logro-${ach.id}-${username}.png`;
      a.click();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ach-title"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380,
          position: "relative",
          background: "linear-gradient(180deg, rgba(28,8,18,0.98), rgba(10,4,14,0.99))",
          border: `1px solid ${ach.color}AA`,
          clipPath: "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
          padding: "26px 24px 20px",
          boxShadow: `0 0 0 1px rgba(0,0,0,0.5), 0 0 60px ${ach.color}66`,
        }}
      >
        <CornerBrackets color={ach.color} size={18} thickness={2} inset={6} />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(8,4,18,0.85)", border: `1px solid ${ach.color}66`,
            color: "#FECACA", padding: 6, cursor: "pointer", clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
          }}
        >
          <X size={14} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <span className="sys-label" style={{ fontSize: 9.5, color: ach.color, letterSpacing: 2 }}>
            {ach.unlocked ? "[ DESBLOQUEADO ]" : "[ EN PROGRESO ]"}
          </span>
        </div>

        <div style={{
          width: 110, height: 110, margin: "0 auto 14px",
          background: `radial-gradient(circle, ${ach.color}44, ${ach.color}11 70%)`,
          border: `1px solid ${ach.color}88`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 60,
          filter: ach.unlocked ? `drop-shadow(0 0 18px ${ach.color})` : "grayscale(0.6) opacity(0.6)",
          clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
        }}>
          {ach.unlocked ? ach.icon : <Lock size={40} color="rgba(255,255,255,0.4)" />}
        </div>

        <h2 id="ach-title" style={{
          color: "#F1F1F5", fontSize: 22, fontWeight: 900, textAlign: "center",
          margin: "0 0 6px", letterSpacing: 0.5, fontFamily: MONO,
          textShadow: ach.unlocked ? `0 0 12px ${ach.color}88` : "none",
        }}>
          {ach.label}
        </h2>
        <p style={{ color: "rgba(253,186,116,0.8)", fontSize: 12.5, textAlign: "center", margin: "0 0 18px", lineHeight: 1.55, fontFamily: MONO, letterSpacing: 0.3 }}>
          {ach.desc}
        </p>

        {/* Progress */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#FDBA74", fontSize: 10, fontWeight: 800, fontFamily: MONO, letterSpacing: 1 }}>
              PROGRESO
            </span>
            <span style={{ color: "#FECACA", fontSize: 10, fontWeight: 900, fontFamily: MONO, textShadow: `0 0 6px ${ach.color}88` }}>
              [ {ach.current}/{ach.target} ]
            </span>
          </div>
          <div style={{
            height: 8, background: "rgba(4,3,10,0.85)",
            border: `1px solid ${ach.color}44`,
            clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: ach.unlocked
                ? `linear-gradient(90deg, ${ach.color}, ${ach.color}DD, #fff)`
                : `linear-gradient(90deg, ${ach.color}88, ${ach.color})`,
              boxShadow: `0 0 10px ${ach.color}AA`,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Date or hint */}
        {ach.unlocked && ach.unlockedAt && (
          <div style={{
            background: "rgba(8,4,18,0.7)", border: `1px solid ${ach.color}55`,
            padding: "9px 12px", marginBottom: 14,
            color: "#FECACA", fontSize: 11, fontFamily: MONO, letterSpacing: 0.5,
            textAlign: "center",
            clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
          }}>
            {">"} DESBLOQUEADO EL <strong style={{ color: ach.color }}>{formatDate(ach.unlockedAt).toUpperCase()}</strong>
          </div>
        )}

        {ach.unlocked ? (
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              width: "100%", padding: "11px 14px",
              background: `linear-gradient(135deg, ${ach.color}, ${ach.color}AA)`,
              border: `1px solid ${ach.color}`,
              color: "#fff", fontSize: 12, fontWeight: 900, letterSpacing: 1.5,
              fontFamily: MONO,
              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              cursor: sharing ? "wait" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 0 18px ${ach.color}99`,
            }}
          >
            {sharing ? <>GENERANDO IMAGEN...</> : <><Download size={13} /> COMPARTIR LOGRO</>}
          </button>
        ) : (
          <div style={{
            background: "rgba(8,4,18,0.6)", border: "1px dashed rgba(253,186,116,0.3)",
            padding: "10px 12px",
            color: "rgba(253,186,116,0.7)", fontSize: 11, fontFamily: MONO, letterSpacing: 0.5,
            textAlign: "center",
            clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
          }}>
            {">"} TE FALTAN <strong style={{ color: "#FDBA74" }}>{Math.max(0, ach.target - ach.current)}</strong> PARA COMPLETAR
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Profile (main) ── */
type Tab = "resumen" | "stats" | "favoritos" | "lista";

export default function Profile() {
  const { user, isMegaFan, isOwner } = useAuth();
  const [, navigate] = useLocation();
  const { config: limitsConfig } = useLimitsConfig();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [watchlist, setWatchlist] = useState<AnimeItem[]>([]);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [tab, setTab] = useState<Tab>("resumen");
  const [copied, setCopied] = useState(false);
  const [openAch, setOpenAch] = useState<Achievement | null>(null);

  const watchedToday = getEpisodesWatchedToday();
  const access = getAccess();
  const remaining = isMegaFan ? Infinity : Math.max(0, limitsConfig.dailyLimit - access.count);

  /* Read cache synchronously on mount, then refresh */
  useEffect(() => {
    if (!user) return;
    const cached = readCache(user.id);
    if (cached) {
      setStats(cached.stats);
      setFavorites(cached.favorites);
      setWatchlist(cached.watchlist);
    } else {
      setLoadingStats(true);
    }
    Promise.all([
      apiClient.get<UserStats>("/user/stats"),
      apiClient.get<AnimeItem[]>("/user/favorites"),
      apiClient.get<AnimeItem[]>("/user/watchlist"),
      apiClient.get<{ followerCount: number }>(`/users/${user.id}/followers`).catch(() => ({ followerCount: 0 })),
    ])
      .then(([s, f, w, fc]) => {
        setStats(s);
        const fSlice = f.slice(0, 24);
        const wSlice = w.slice(0, 24);
        setFavorites(fSlice);
        setWatchlist(wSlice);
        setFollowerCount(fc?.followerCount ?? 0);
        writeCache(user.id, { stats: s, favorites: fSlice, watchlist: wSlice });
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [user]);

  const levelInfo = getLevelInfo(stats?.totalEpisodes ?? 0);
  const achievements = useMemo(() => getAchievements(stats, isMegaFan), [stats, isMegaFan]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  /* Next milestone — pick the closest unlocked-with-progress achievement, prefer episode-based */
  const nextMilestone = useMemo(() => {
    const locked = achievements.filter((a) => !a.unlocked && a.target > 1);
    if (locked.length === 0) return null;
    /* Sort by remaining (asc) */
    locked.sort((a, b) => (a.target - a.current) - (b.target - b.current));
    return locked[0];
  }, [achievements]);

  const topGenres = stats?.topGenres ?? [];
  const maxGenreCount = topGenres[0]?.count ?? 1;

  const animatedEpisodes  = useAnimatedCount(stats?.totalEpisodes ?? 0);
  const animatedHours     = useAnimatedCount(Math.round((stats?.estimatedHours ?? 0) * 10));
  const animatedCompleted = useAnimatedCount(stats?.completed ?? 0);
  const animatedStreak    = useAnimatedCount(stats?.streak ?? 0);

  const handleCopyLink = () => {
    if (!user) return;
    const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/perfil/${user.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "resumen",   label: "Resumen",      icon: <BarChart2 size={14} /> },
    { key: "stats",     label: "Estadísticas", icon: <Activity size={14} /> },
    { key: "favoritos", label: "Favoritos",    icon: <Heart size={14} /> },
    { key: "lista",     label: "Mi lista",     icon: <List size={14} /> },
  ];

  /* Tab keyboard navigation */
  const handleTabKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight") {
      const next = TABS[(idx + 1) % TABS.length];
      setTab(next.key);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
      setTab(prev.key);
      e.preventDefault();
    }
  };

  const bannerMeta = getBannerMeta(user?.banner_preset);

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
          border: `1px solid ${bannerMeta.accent}80`,
          background: "linear-gradient(180deg, rgba(28,8,18,0.95), rgba(10,4,14,0.98))",
          position: "relative",
          clipPath: "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
          boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 0 32px ${bannerMeta.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
          overflow: "hidden",
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 18, right: 18, height: 1,
            background: `linear-gradient(90deg, transparent, ${bannerMeta.accent} 30%, ${bannerMeta.accent} 50%, ${bannerMeta.accent} 70%, transparent)`,
            boxShadow: `0 0 12px ${bannerMeta.accent}`,
            zIndex: 5,
          }} />
          <CornerBrackets color={bannerMeta.accent} size={18} thickness={2} inset={6} />

          {/* Dynamic banner */}
          <ProfileBanner presetKey={user?.banner_preset ?? null} height={110} showLabel={`CAZADOR · ${bannerMeta.label}_01`} />

          {/* Avatar — absolutely positioned so it always overlaps the banner correctly */}
          <div style={{
            position: "absolute", top: 64, left: 18,
            width: 76, height: 76,
            background: `linear-gradient(135deg, #FCA5A5, ${bannerMeta.accent} 50%, ${bannerMeta.accent}AA)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 900, color: "#fff", overflow: "hidden",
            boxShadow: `0 0 0 3px #0a040e, 0 0 0 4px ${bannerMeta.accent}, 0 0 28px ${bannerMeta.glow}`,
            zIndex: 4,
            clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
            fontFamily: MONO,
          }}>
            {resolveAvatarUrl(user?.avatar_url)
              ? <img src={resolveAvatarUrl(user?.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (user?.username?.charAt(0)?.toUpperCase() ?? "?")}
          </div>

          {/* Content */}
          <div style={{ padding: "44px 18px 20px", position: "relative", zIndex: 2 }}>
            {/* Name + badges + action buttons */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
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
                    background: `${bannerMeta.accent}1F`, border: `1px solid ${bannerMeta.accent}80`,
                    padding: "3px 8px", color: bannerMeta.accent, fontSize: 10, fontWeight: 800,
                    fontFamily: MONO, letterSpacing: 0.5,
                    clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
                    textShadow: `0 0 8px ${bannerMeta.glow}`,
                  }}>
                    <Zap size={9} /> NV.{levelInfo.level}
                  </span>
                  {followerCount > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "rgba(124,115,255,0.12)", border: "1px solid rgba(124,115,255,0.4)",
                      borderRadius: 20, padding: "3px 8px",
                      color: "#A8A0FF", fontSize: 10, fontWeight: 800,
                    }}>
                      <Users size={9} /> {followerCount}
                    </span>
                  )}
                </div>
              </div>
              {user && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  <button onClick={handleCopyLink} aria-label="Copiar enlace al perfil" style={{
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
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, marginBottom: 10 }}>{user?.email}</div>

            {/* Bio */}
            {user?.bio && (
              <div style={{
                background: "rgba(8,4,18,0.55)",
                border: `1px solid ${bannerMeta.accent}33`,
                padding: "10px 12px", marginBottom: 14,
                color: "#FECACA", fontSize: 12.5, lineHeight: 1.55,
                fontFamily: MONO, letterSpacing: 0.2,
                clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                <span style={{ color: bannerMeta.accent, fontWeight: 800, marginRight: 6 }}>// BIO</span>
                {user.bio}
              </div>
            )}

            {/* Level progress */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#FDBA74", fontSize: 10, fontWeight: 800, fontFamily: MONO, letterSpacing: 1.5 }}>
                  EXP · NV.{levelInfo.level} · {levelInfo.currentXp}/{levelInfo.neededXp}
                </span>
                <span style={{ color: "#FECACA", fontSize: 10, fontWeight: 900, fontFamily: MONO, textShadow: "0 0 8px rgba(220,38,38,0.6)" }}>
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

            {/* Quick stats row — animated */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[
                { label: "Episodios", value: loadingStats && !stats ? "–" : animatedEpisodes, color: "#DC2626", icon: <Tv2 size={13} />, bg: "rgba(220,38,38,0.1)" },
                { label: "Horas",     value: loadingStats && !stats ? "–" : `${(animatedHours / 10).toFixed(1)}h`, color: "#22C55E", icon: <Clock size={13} />, bg: "rgba(34,197,94,0.1)" },
                { label: "Completados", value: loadingStats && !stats ? "–" : animatedCompleted, color: "#DC2626", icon: <CheckCircle2 size={13} />, bg: "rgba(220,38,38,0.1)" },
                { label: "Racha",     value: loadingStats && !stats ? "–" : `${animatedStreak}d`, color: "#F59E0B", icon: <Flame size={13} />, bg: "rgba(245,158,11,0.1)" },
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
                    fontFamily: MONO,
                    textShadow: `0 0 10px ${color}aa`,
                  }}>{value}</div>
                  <div style={{
                    color: "rgba(255,255,255,0.5)", fontSize: 8.5, marginTop: 5,
                    fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                    fontFamily: MONO,
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

        {/* ── Tabs (a11y: tablist) ── */}
        <div role="tablist" aria-label="Secciones del perfil" style={{
          display: "flex", gap: 4, marginBottom: 14,
          background: "rgba(4,3,10,0.85)",
          padding: 4,
          border: "1px solid rgba(249,115,22,0.3)",
          clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
          overflowX: "auto",
        }}>
          {TABS.map(({ key, label, icon }, idx) => {
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                id={`tab-${key}`}
                aria-selected={active}
                aria-controls={`panel-${key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={(e) => handleTabKey(e, idx)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 8px", border: "none", cursor: "pointer",
                  fontFamily: MONO,
                  fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
                  transition: "all 0.18s",
                  background: active
                    ? "linear-gradient(180deg, rgba(220,38,38,0.85), rgba(153,27,27,0.85))"
                    : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.4)",
                  textShadow: active ? "0 0 10px rgba(255,255,255,0.5)" : "none",
                  boxShadow: active ? "0 0 18px rgba(220,38,38,0.55)" : "none",
                  clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                  whiteSpace: "nowrap",
                }}
              >
                {icon} {label}
              </button>
            );
          })}
        </div>

        {/* ══ TAB: RESUMEN ══ */}
        {tab === "resumen" && (
          <div role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen" tabIndex={0}>
            {/* Continúa viendo */}
            {stats?.continueWatching && stats.continueWatching.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <PlayCircle size={12} style={{ marginRight: 2 }} /> CONTINUAR · ULT_SESION
                  </span>
                  <button onClick={() => navigate("/history")} style={{
                    marginLeft: "auto", background: "none", border: "none",
                    color: "#FDBA74", fontSize: 10, fontWeight: 800, cursor: "pointer",
                    fontFamily: MONO, letterSpacing: 0.5,
                  }}>HISTORIAL →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                  {stats.continueWatching.map((c) => (
                    <button
                      key={c.episode_id}
                      onClick={() => navigate(`/watch?ep=${encodeURIComponent(c.episode_id)}&anime=${encodeURIComponent(c.anime_id)}`)}
                      style={{
                        position: "relative", padding: 0, border: "1px solid rgba(220,38,38,0.3)",
                        background: "rgba(8,4,18,0.6)", cursor: "pointer", overflow: "hidden",
                        clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: "#000" }}>
                        {c.anime_image && <img src={c.anime_image} alt={c.anime_title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85))" }} />
                        <div style={{
                          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                          width: 36, height: 36, borderRadius: "50%",
                          background: "rgba(220,38,38,0.85)", border: "1px solid #fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 0 16px rgba(220,38,38,0.7)",
                        }}>
                          <PlayCircle size={20} color="#fff" />
                        </div>
                        {/* Progress bar */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.6)" }}>
                          <div style={{ height: "100%", width: `${c.progress_pct}%`, background: "linear-gradient(90deg, #DC2626, #F97316)", boxShadow: "0 0 6px rgba(220,38,38,0.7)" }} />
                        </div>
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ color: "#F1F1F5", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.anime_title}
                        </div>
                        <div style={{ color: "rgba(253,186,116,0.7)", fontSize: 10, marginTop: 2, fontFamily: MONO, letterSpacing: 0.5 }}>
                          EP. {c.episode_num || "?"} · {c.progress_pct}%
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Próximo objetivo */}
            {nextMilestone && (
              <div style={{
                position: "relative",
                background: `linear-gradient(135deg, ${nextMilestone.color}1A, rgba(8,4,18,0.95))`,
                border: `1px solid ${nextMilestone.color}66`,
                padding: "14px 16px", marginBottom: 14,
                clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                boxShadow: `0 0 18px ${nextMilestone.color}33`,
                cursor: "pointer",
              }}
              onClick={() => setOpenAch(nextMilestone)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setOpenAch(nextMilestone); }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 30, filter: `drop-shadow(0 0 8px ${nextMilestone.color})` }}>{nextMilestone.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: nextMilestone.color, fontSize: 9, fontWeight: 900, letterSpacing: 2, fontFamily: MONO, marginBottom: 2 }}>
                      [ PROXIMO RANGO ]
                    </div>
                    <div style={{ color: "#FECACA", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                      {nextMilestone.label} <span style={{ color: "rgba(253,186,116,0.7)", fontWeight: 600 }}>— faltan {nextMilestone.target - nextMilestone.current}</span>
                    </div>
                    <div style={{
                      height: 5, background: "rgba(4,3,10,0.85)",
                      border: `1px solid ${nextMilestone.color}33`,
                      clipPath: "polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.round((nextMilestone.current / nextMilestone.target) * 100)}%`,
                        background: `linear-gradient(90deg, ${nextMilestone.color}, ${nextMilestone.color}AA)`,
                        boxShadow: `0 0 8px ${nextMilestone.color}AA`,
                      }} />
                    </div>
                  </div>
                  <Target size={16} color={nextMilestone.color} />
                </div>
              </div>
            )}

            {/* Achievements */}
            <div style={{ ...cardStyle, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span className="sys-label" style={{ fontSize: 11 }}>
                  <Trophy size={12} style={{ marginRight: 2 }} /> LOGROS · CAZADOR
                </span>
                <span style={{
                  color: "#FDBA74", fontSize: 11, fontWeight: 900,
                  fontFamily: MONO,
                  textShadow: "0 0 8px rgba(249,115,22,0.6)",
                }}>[ {unlockedCount}/{achievements.length} ]</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {achievements.map((a) => (
                  <button key={a.id}
                    onClick={() => setOpenAch(a)}
                    aria-label={`Logro ${a.label}, ${a.unlocked ? "desbloqueado" : "bloqueado"}`}
                    style={{
                      position: "relative", textAlign: "center",
                      background: a.unlocked ? `rgba(${hexToRgb(a.color)},0.12)` : "rgba(8,3,12,0.6)",
                      border: `1px solid ${a.unlocked ? `rgba(${hexToRgb(a.color)},0.5)` : "rgba(255,255,255,0.07)"}`,
                      padding: "12px 6px", cursor: "pointer",
                      opacity: a.unlocked ? 1 : 0.55,
                      transition: "opacity 0.2s, transform 0.2s, box-shadow 0.2s",
                      clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                      boxShadow: a.unlocked ? `0 0 12px ${a.color}33` : "none",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4, filter: a.unlocked ? `drop-shadow(0 0 6px ${a.color})` : "grayscale(1)" }}>{a.icon}</div>
                    <div style={{
                      color: a.unlocked ? "#F1F1F5" : "rgba(255,255,255,0.35)",
                      fontSize: 9.5, fontWeight: 800, lineHeight: 1.3,
                      fontFamily: MONO,
                      letterSpacing: 0.3,
                    }}>{a.label}</div>
                    {!a.unlocked && (
                      <div style={{ position: "absolute", top: 5, right: 5 }}>
                        <Lock size={9} color="rgba(255,255,255,0.25)" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ color: "rgba(253,186,116,0.4)", fontSize: 9.5, marginTop: 10, textAlign: "center", fontFamily: MONO, letterSpacing: 0.5 }}>
                {">"} TOCA UN LOGRO PARA VER DETALLES Y COMPARTIR
              </div>
            </div>

            {/* Comparativa social */}
            {stats && stats.percentile != null && stats.totalEpisodes > 0 && (
              <div style={{
                position: "relative",
                background: "linear-gradient(135deg, rgba(124,115,255,0.12), rgba(8,4,18,0.95))",
                border: "1px solid rgba(124,115,255,0.45)",
                padding: "14px 16px", marginBottom: 14,
                clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                boxShadow: "0 0 16px rgba(124,115,255,0.2)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Users size={22} color="#A8A0FF" style={{ filter: "drop-shadow(0 0 6px #7C73FF)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#A8A0FF", fontSize: 9, fontWeight: 900, letterSpacing: 2, fontFamily: MONO, marginBottom: 2 }}>
                      [ COMPARATIVA · CAZADORES ]
                    </div>
                    <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>
                      Has visto más que el <span style={{ color: "#A8A0FF", fontWeight: 900, fontFamily: MONO, textShadow: "0 0 8px rgba(124,115,255,0.6)" }}>{stats.percentile}%</span> de los cazadores activos.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly activity */}
            {stats && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <BarChart2 size={12} style={{ marginRight: 2 }} /> ACTIVIDAD · 7D
                  </span>
                  <span style={{ marginLeft: "auto", color: "rgba(253,186,116,0.55)", fontSize: 10, fontFamily: MONO, letterSpacing: 1 }}>// LOG</span>
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

            {/* Top genres (top 5) */}
            {topGenres.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <Sparkles size={12} style={{ marginRight: 2 }} /> GÉNEROS · TOP
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topGenres.slice(0, 5).map(({ genre, count }, i) => {
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
                            opacity: 0.9,
                            boxShadow: `0 0 8px ${GENRE_COLORS[i % GENRE_COLORS.length]}77`,
                            transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top anime (top 3) */}
            {stats && stats.topAnime.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <TrendingUp size={12} style={{ marginRight: 2 }} /> RANKING · MÁS VISTOS
                  </span>
                </div>
                {stats.topAnime.slice(0, 3).map((a, i) => (
                  <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "9px 0", cursor: "pointer",
                    borderBottom: i < Math.min(stats.topAnime.length, 3) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
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
                    fontFamily: MONO,
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
                  fontFamily: MONO, letterSpacing: 0.5,
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

        {/* ══ TAB: ESTADISTICAS ══ */}
        {tab === "stats" && (
          <div role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" tabIndex={0}>
            {/* Heatmap anual */}
            <div style={{ ...cardStyle, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span className="sys-label" style={{ fontSize: 11 }}>
                  <Calendar size={12} style={{ marginRight: 2 }} /> CALENDARIO · 365D
                </span>
                {stats?.firstWatched && (
                  <span style={{ marginLeft: "auto", color: "rgba(253,186,116,0.55)", fontSize: 10, fontFamily: MONO, letterSpacing: 1 }}>
                    DESDE {formatDate(stats.firstWatched).toUpperCase()}
                  </span>
                )}
              </div>
              {stats?.yearlyHeatmap && stats.yearlyHeatmap.length > 0 ? (
                <YearHeatmap data={stats.yearlyHeatmap} accent={bannerMeta.accent} />
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  Sin actividad registrada todavía.
                </div>
              )}
            </div>

            {/* Distribución horaria */}
            <div style={{ ...cardStyle, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span className="sys-label" style={{ fontSize: 11 }}>
                  <Clock size={12} style={{ marginRight: 2 }} /> DISTRIBUCION · 24H
                </span>
              </div>
              {stats?.hourlyActivity ? (
                <HourlyChart data={stats.hourlyActivity} />
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  Sin datos de horario aún.
                </div>
              )}
            </div>

            {/* Top géneros completos */}
            {topGenres.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <Sparkles size={12} style={{ marginRight: 2 }} /> GÉNEROS · COMPLETO
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topGenres.map(({ genre, count }, i) => {
                    const pct = Math.round((count / maxGenreCount) * 100);
                    return (
                      <div key={genre}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: "#F1F1F5", fontSize: 12, fontWeight: 700 }}>
                            <span style={{ color: GENRE_COLORS[i % GENRE_COLORS.length], marginRight: 6, fontFamily: MONO }}>#{String(i+1).padStart(2,"0")}</span>
                            {genre}
                          </span>
                          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: MONO }}>{count}</span>
                        </div>
                        <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            width: `${pct}%`,
                            background: GENRE_COLORS[i % GENRE_COLORS.length],
                            opacity: 0.9, transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top anime extendido */}
            {stats && stats.topAnime.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span className="sys-label" style={{ fontSize: 11 }}>
                    <BarChart3 size={12} style={{ marginRight: 2 }} /> RANKING · TOP_10
                  </span>
                </div>
                {stats.topAnime.slice(0, 10).map((a, i) => (
                  <div key={a.anime_id} onClick={() => navigate(`/anime/${a.anime_id}`)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "9px 0", cursor: "pointer",
                    borderBottom: i < Math.min(stats.topAnime.length, 10) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <span style={{ color: i < 3 ? "#F59E0B" : "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 900, width: 22, textAlign: "center", flexShrink: 0, fontFamily: MONO }}>
                      #{String(i+1).padStart(2,"0")}
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

            {/* Sistema social — link a Feed */}
            <div style={{
              background: "linear-gradient(135deg, rgba(124,115,255,0.10), rgba(8,4,18,0.95))",
              border: "1px solid rgba(124,115,255,0.4)",
              padding: "14px 16px", marginBottom: 14,
              clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
              boxShadow: "0 0 16px rgba(124,115,255,0.18)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Users size={20} color="#A8A0FF" style={{ filter: "drop-shadow(0 0 6px #7C73FF)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#A8A0FF", fontSize: 9, fontWeight: 900, letterSpacing: 2, fontFamily: MONO, marginBottom: 3 }}>
                    [ RED · CAZADORES ]
                  </div>
                  <div style={{ color: "#F1F1F5", fontSize: 12.5, fontWeight: 700 }}>
                    {followerCount} {followerCount === 1 ? "seguidor" : "seguidores"} · sigue a otros para ver su actividad
                  </div>
                </div>
                <button onClick={() => navigate("/feed")} style={{
                  background: "rgba(124,115,255,0.18)", border: "1px solid rgba(124,115,255,0.5)",
                  color: "#A8A0FF", fontSize: 10.5, fontWeight: 900, fontFamily: MONO, letterSpacing: 1,
                  padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap",
                  clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
                  boxShadow: "0 0 10px rgba(124,115,255,0.4)",
                }}>
                  FEED →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: FAVORITOS ══ */}
        {tab === "favoritos" && (
          <div role="tabpanel" id="panel-favoritos" aria-labelledby="tab-favoritos" tabIndex={0} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span className="sys-label" style={{ fontSize: 11 }}>
                <Heart size={12} style={{ marginRight: 2 }} /> FAVORITOS
              </span>
              <span style={{ marginLeft: "auto", color: "#FDBA74", fontSize: 11, fontFamily: MONO, fontWeight: 800, textShadow: "0 0 8px rgba(249,115,22,0.5)" }}>[ {favorites.length} ]</span>
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
          <div role="tabpanel" id="panel-lista" aria-labelledby="tab-lista" tabIndex={0} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span className="sys-label" style={{ fontSize: 11 }}>
                <List size={12} style={{ marginRight: 2 }} /> MI LISTA
              </span>
              <button onClick={() => navigate("/watchlist")} style={{
                marginLeft: "auto", background: "none", border: "none",
                color: "#FDBA74", fontSize: 11, fontWeight: 800, cursor: "pointer",
                fontFamily: MONO, letterSpacing: 0.5,
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

      {openAch && user && (
        <AchievementModal
          ach={openAch}
          username={user.username}
          level={levelInfo.level}
          onClose={() => setOpenAch(null)}
        />
      )}

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
