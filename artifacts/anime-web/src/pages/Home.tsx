import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Play, Info, Star, ChevronLeft, ChevronRight, Tv } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { fetchAiringSchedule, fetchSeasonalAnime, getCurrentSeason, seasonLabel, type AiringEntry, type SeasonAnime } from "@/lib/anilist";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useAuth } from "@/context/AuthContext";
import AnimeRecommendations from "@/components/AnimeRecommendations";
import { useCallback, useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";

function nav(navigate: (to: string) => void, id: string | number) {
  navigate(`/anime/${id}`);
}

/* ── HERO BANNER ── */
function HeroBanner({ animes, idx, onPrev, onNext }: { animes: AnimeResult[]; idx: number; onPrev: () => void; onNext: () => void }) {
  const [, navigate] = useLocation();
  const anime = animes[idx];
  if (!anime) return <div style={{ height: "min(70vw, 520px)", background: "#13131C" }} />;
  const title = resolveTitle(anime.title);

  return (
    <div style={{ position: "relative", height: "min(70vw, 520px)", overflow: "hidden" }}>
      <img src={anime.cover || anime.image} alt={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(9,10,18,0) 0%, rgba(9,10,18,0.35) 30%, rgba(9,10,18,0.88) 70%, #090A12 100%)" }} />
      <div style={{ position: "absolute", inset: 0, width: "55%", background: "linear-gradient(to right, rgba(9,10,18,0.6), transparent)" }} />

      <div style={{ position: "absolute", bottom: 32, left: 20, right: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ background: "#6C63FF", borderRadius: 5, padding: "3px 8px", color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>HD</span>
          {anime.type && <span style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 5, padding: "3px 8px", color: "#fff", fontSize: 9, fontWeight: 700 }}>{anime.type}</span>}
          {anime.status === "Ongoing" && (
            <span style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 5, padding: "3px 8px", color: "#22C55E", fontSize: 9, fontWeight: 900, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} /> EN EMISIÓN
            </span>
          )}
        </div>
        <div style={{ color: "#fff", fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.5, textShadow: "0 2px 8px rgba(0,0,0,0.9)", maxWidth: 480 }} className="line-clamp-2">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {anime.rating != null && anime.rating > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <span style={{ color: "#F59E0B", fontSize: 13, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
            </span>
          )}
          {anime.releaseDate && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{anime.releaseDate}</span>}
          {anime.totalEpisodes && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{anime.totalEpisodes} EP</span>}
        </div>
        {anime.genres && anime.genres.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {anime.genres.slice(0, 3).map((g) => (
              <span key={g} style={{ background: "rgba(108,99,255,0.2)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 6, padding: "3px 8px", color: "#A78BFA", fontSize: 10, fontWeight: 600 }}>{g}</span>
            ))}
          </div>
        )}
        {anime.description && (
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.6, maxWidth: 440, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }} className="line-clamp-2 hidden md:block">
            {anime.description.replace(/<[^>]*>/g, "")}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={() => nav(navigate, anime.id)} style={{ background: "linear-gradient(135deg, #6C63FF, #4F46E5)", border: "none", borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <Play size={16} fill="#fff" /> Ver Ahora
          </button>
          <button onClick={() => nav(navigate, anime.id)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "12px 16px", color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <Info size={16} /> Detalles
          </button>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 14, right: 20, display: "flex", gap: 4 }}>
        {animes.slice(0, 6).map((_, i) => (
          <div key={i} style={{ height: 5, borderRadius: 3, background: i === idx ? "#6C63FF" : "rgba(255,255,255,0.25)", width: i === idx ? 18 : 5, transition: "width 0.3s" }} />
        ))}
      </div>

      <button onClick={onPrev} style={{ position: "absolute", top: "55%", left: 12, transform: "translateY(-50%)", background: "rgba(9,10,18,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: 10, cursor: "pointer", display: "flex" }}>
        <ChevronLeft size={22} color="rgba(255,255,255,0.85)" />
      </button>
      <button onClick={onNext} style={{ position: "absolute", top: "55%", right: 12, transform: "translateY(-50%)", background: "rgba(9,10,18,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: 10, cursor: "pointer", display: "flex" }}>
        <ChevronRight size={22} color="rgba(255,255,255,0.85)" />
      </button>
    </div>
  );
}

/* ── SECTION HEADER ── */
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: "#6C63FF" }} />
        <span style={{ color: "#F1F1F5", fontSize: 17, fontWeight: 800 }}>{title}</span>
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ color: "#6C63FF", fontSize: 13, fontWeight: 700 }}>Ver todo</span>
          <ChevronRight size={14} color="#6C63FF" />
        </button>
      )}
    </div>
  );
}

/* ── PORTRAIT CARD ── */
function PortraitCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div className="p-card" onClick={() => nav(navigate, anime.id)}>
      <img src={anime.image} alt={title} />
      <div className="p-card-grad" />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: "#22C55E", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>SUB</span>
        {anime.totalEpisodes && <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>{anime.totalEpisodes}</span>}
      </div>
      {anime.rating != null && anime.rating > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
          <Star size={8} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
        </div>
      )}
      <div className="p-card-footer">
        <div className="p-card-title">{title}</div>
        {anime.type && <div className="p-card-type">{anime.type}</div>}
      </div>
    </div>
  );
}

/* ── RECENT CARD ── */
function RecentCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div className="r-card" onClick={() => nav(navigate, anime.id)}>
      <img src={anime.cover || anime.image} alt={title} />
      <div className="r-card-grad" />
      <div className="r-play-circle"><Play size={18} color="#fff" fill="#fff" /></div>
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 5 }}>
        <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 6, padding: "3px 6px", color: "#06B6D4", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", gap: 3 }}>
          <Tv size={9} color="#06B6D4" /> EP {anime.currentEpisode ?? "?"}
        </span>
        <span style={{ background: "#6C63FF", borderRadius: 5, padding: "2px 5px", color: "#fff", fontSize: 8, fontWeight: 900 }}>HD</span>
      </div>
      <div className="r-card-footer">
        <div className="r-card-title">{title}</div>
        {anime.type && <div className="r-card-type">{anime.type}</div>}
      </div>
    </div>
  );
}

/* ── SEASONAL CARD ── */
function SeasonalCard({ anime }: { anime: SeasonAnime }) {
  const [, navigate] = useLocation();
  const title = anime.title.english || anime.title.romaji;
  return (
    <div className="p-card" onClick={() => nav(navigate, anime.id)}>
      <img src={anime.coverImage.large} alt={title} />
      <div className="p-card-grad" />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: "#6C63FF", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900 }}>NEW</span>
        {anime.episodes && <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>{anime.episodes}</span>}
      </div>
      {anime.averageScore != null && anime.averageScore > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
          <Star size={8} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.averageScore / 10).toFixed(1)}</span>
        </div>
      )}
      <div className="p-card-footer">
        <div className="p-card-title">{title}</div>
        {anime.format && <div className="p-card-type">{anime.format}</div>}
      </div>
    </div>
  );
}

/* ── TOP ANIME ROW ── */
function TopAnimeRow({ anime, rank }: { anime: AnimeResult; rank: number }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#12121E")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ color: rank <= 3 ? "#6C63FF" : "rgba(255,255,255,0.35)", fontSize: 18, fontWeight: 900, width: 30, textAlign: "center" }}>{String(rank).padStart(2, "0")}</span>
      <img src={anime.image} alt={title} style={{ width: 46, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, lineHeight: 1.35 }} className="line-clamp-2">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {anime.type && <span style={{ color: "#6C63FF", fontSize: 9, fontWeight: 700, background: "rgba(108,99,255,0.18)", padding: "1px 5px", borderRadius: 4 }}>{anime.type}</span>}
          {anime.releaseDate && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{anime.releaseDate}</span>}
        </div>
        {anime.genres && anime.genres.length > 0 && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }} className="line-clamp-1">{anime.genres.slice(0, 2).join(" · ")}</div>}
      </div>
      {anime.rating != null && anime.rating > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <Star size={11} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 12, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

/* ── SCHEDULE SECTION ── */
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function ScheduleSection() {
  const [, navigate] = useLocation();
  const todayIdx = new Date().getDay();
  const [activeDay, setActiveDay] = useState(todayIdx);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ["airingSchedule"],
    queryFn: fetchAiringSchedule,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const grouped = DAY_NAMES.map((_, i) => {
    const entries = schedule.filter((e) => new Date(e.airingAt * 1000).getDay() === i);
    return entries;
  });

  const dayEntries = grouped[activeDay] ?? [];

  return (
    <div style={{ marginTop: 28 }}>
      <SectionHeader title="📅 Calendario de Emisión" />

      <div style={{ display: "flex", gap: 6, paddingLeft: 16, paddingRight: 16, marginBottom: 14, overflowX: "auto" }}>
        {DAY_NAMES.map((d, i) => {
          const isToday = i === todayIdx;
          const isActive = i === activeDay;
          return (
            <button key={i} onClick={() => setActiveDay(i)} style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 20, border: `1px solid ${isActive ? "#6C63FF" : "rgba(255,255,255,0.1)"}`, background: isActive ? "rgba(108,99,255,0.2)" : "rgba(255,255,255,0.04)", color: isActive ? "#A78BFA" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, cursor: "pointer", position: "relative" }}>
              {d}
              {isToday && <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: "#22C55E", border: "1.5px solid #090A12" }} />}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="carousel-scroll">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ width: 130, height: 197, borderRadius: 14, background: "#12121E", flexShrink: 0 }} />)}
        </div>
      )}

      {!isLoading && dayEntries.length === 0 && (
        <div style={{ padding: "20px 16px", color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center" }}>
          Sin episodios programados para {DAY_NAMES_FULL[activeDay]}
        </div>
      )}

      {dayEntries.length > 0 && (
        <div className="carousel-scroll">
          {dayEntries.slice(0, 15).map((entry) => {
            const title = entry.media.title.english || entry.media.title.romaji;
            const time = new Date(entry.airingAt * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={`${entry.media.id}-${entry.episode}`} onClick={() => nav(navigate, entry.media.id)}
                style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#13131C", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", width: 130, height: 197, flexShrink: 0, transition: "transform 0.18s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}>
                <img src={entry.media.coverImage.large} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 45%, rgba(9,10,18,0.97) 100%)" }} />
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.8)", borderRadius: 6, padding: "3px 7px", color: "#06B6D4", fontSize: 9, fontWeight: 800, border: "1px solid rgba(6,182,212,0.3)" }}>
                  EP {entry.episode}
                </div>
                <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 6, padding: "3px 7px", color: "#F59E0B", fontSize: 9, fontWeight: 800 }}>
                  {time}
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 }}>
                  <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>{title}</div>
                  {entry.media.format && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, marginTop: 2 }}>{entry.media.format}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── GENRES ── */
const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai", "Thriller", "Mystery"];

function GenresSection() {
  const [, navigate] = useLocation();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px" }}>
      {GENRES.map((g) => (
        <button key={g} onClick={() => navigate(`/search?q=${g}`)} style={{ background: "#12121E", borderRadius: 20, padding: "8px 14px", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(108,99,255,0.15)"; e.currentTarget.style.borderColor = "rgba(108,99,255,0.35)"; e.currentTarget.style.color = "#A78BFA"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#12121E"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
          {g}
        </button>
      ))}
    </div>
  );
}

/* ── CONTINUE WATCHING ── */
type WatchEntry = ReturnType<typeof useWatchProgress>["progress"][number];
function ContinueWatchingCard({ entry }: { entry: WatchEntry }) {
  const [, navigate] = useLocation();
  const pct = Math.min(1, entry.currentTime / Math.max(entry.duration, 1));

  const handleClick = () => {
    const p = new URLSearchParams({
      episodeId: entry.episodeId,
      episodeNum: String(entry.episodeNum),
      animeTitle: entry.animeTitle,
      animeId: entry.animeId,
      animeImage: entry.animeImage,
    });
    navigate(`/watch?${p.toString()}`);
  };

  return (
    <div className="cw-card" onClick={handleClick}>
      <img src={entry.animeImage} alt={entry.animeTitle} />
      <div className="cw-card-grad" />
      <div className="cw-card-info">
        <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }} className="line-clamp-1">{entry.animeTitle}</div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>Episodio {entry.episodeNum}</div>
        <div className="cw-bar"><div className="cw-fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      </div>
    </div>
  );
}

function SkeletonP() { return <div style={{ width: 130, height: 197, borderRadius: 14, background: "#12121E", flexShrink: 0 }} />; }
function SkeletonR() { return <div style={{ width: 220, height: 136, borderRadius: 14, background: "#12121E", flexShrink: 0 }} />; }

/* ── MAIN ── */
export default function Home() {
  const [, navigate] = useLocation();
  const [heroIdx, setHeroIdx] = useState(0);
  const { progress: watchProgress } = useWatchProgress();
  const { user } = useAuth();

  const trending = useQuery({ queryKey: ["trending"], queryFn: consumet.trending, staleTime: 1000 * 60 * 10 });
  const popular = useQuery({ queryKey: ["popular"], queryFn: consumet.popular, staleTime: 1000 * 60 * 10 });
  const recent = useQuery({ queryKey: ["recent"], queryFn: consumet.recentEpisodes, staleTime: 1000 * 60 * 5 });
  const { season, year } = getCurrentSeason();
  const seasonal = useQuery({ queryKey: ["seasonal", season, year], queryFn: fetchSeasonalAnime, staleTime: 1000 * 60 * 60, retry: 1 });

  const trendList = trending.data?.results ?? [];
  const popularList = popular.data?.results ?? [];
  const recentList = recent.data?.results ?? [];
  const seasonalList = seasonal.data ?? [];

  const prevHero = useCallback(() => setHeroIdx(i => (i > 0 ? i - 1 : Math.max(0, trendList.length - 1))), [trendList.length]);
  const nextHero = useCallback(() => setHeroIdx(i => (i < trendList.length - 1 ? i + 1 : 0)), [trendList.length]);

  useEffect(() => {
    if (trendList.length === 0) return;
    const t = setInterval(nextHero, 5000);
    return () => clearInterval(t);
  }, [trendList.length, nextHero]);

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />

      <div style={{ paddingTop: 56 }}>
        {trendList.length > 0
          ? <HeroBanner animes={trendList} idx={heroIdx} onPrev={prevHero} onNext={nextHero} />
          : <div style={{ height: "min(70vw, 520px)", background: "#13131C" }} />}

        {watchProgress.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <SectionHeader title="▶ Continuar viendo" onSeeAll={() => navigate("/history")} />
            <div className="carousel-scroll">
              {watchProgress
                .filter((e, idx, arr) => arr.findIndex((x) => x.animeId === e.animeId) === idx)
                .slice(0, 8)
                .map((e) => <ContinueWatchingCard key={`cw-${e.episodeId}`} entry={e} />)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="🔥 Tendencias" />
          <div className="carousel-scroll">
            {trending.isLoading ? Array.from({ length: 6 }).map((_, i) => <SkeletonP key={i} />) : trendList.slice(0, 12).map((a) => <PortraitCard key={`t-${a.id}`} anime={a} />)}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionHeader title={`🌸 Temporada actual — ${seasonLabel(season)} ${year}`} />
          <div className="carousel-scroll">
            {seasonal.isLoading ? Array.from({ length: 6 }).map((_, i) => <SkeletonP key={i} />) : seasonalList.map((a) => <SeasonalCard key={`s-${a.id}`} anime={a} />)}
          </div>
        </div>

        <div style={{ padding: "0 16px", marginTop: 16 }}>
          <AdBanner variant="horizontal" />
        </div>

        <div style={{ marginTop: 12 }}>
          <SectionHeader title="⚡ Últimos Episodios" />
          <div className="carousel-scroll">
            {recent.isLoading ? Array.from({ length: 4 }).map((_, i) => <SkeletonR key={i} />) : recentList.slice(0, 10).map((a) => <RecentCard key={`r-${a.id}`} anime={a} />)}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="⭐ Más Populares" />
          <div className="carousel-scroll">
            {popular.isLoading ? Array.from({ length: 6 }).map((_, i) => <SkeletonP key={i} />) : popularList.slice(0, 12).map((a) => <PortraitCard key={`p-${a.id}`} anime={a} />)}
          </div>
        </div>

        {/* Recomendaciones personalizadas */}
        {user && (
          <div style={{ marginTop: 28 }}>
            <AnimeRecommendations
              userId={user.id}
              type="personal"
              limit={12}
            />
          </div>
        )}

        {/* Recomendaciones trending para usuarios no autenticados */}
        {!user && (
          <div style={{ marginTop: 28 }}>
            <AnimeRecommendations
              type="trending"
              title="Tendencias Populares"
              limit={12}
            />
          </div>
        )}

        <ScheduleSection />

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="🏆 Top Anime" />
          <div style={{ padding: "0 16px" }}>
            {popular.isLoading
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 70, background: "#12121E", borderRadius: 10, marginBottom: 4, opacity: 0.5 }} />)
              : popularList.slice(0, 10).map((a, i) => <TopAnimeRow key={`top-${a.id}`} anime={a} rank={i + 1} />)}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="🎭 Géneros" />
          <GenresSection />
        </div>
      </div>
      <Footer />
    </div>
  );
}
