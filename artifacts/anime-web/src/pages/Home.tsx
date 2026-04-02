import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RefreshCw, Search, Bookmark, Clock, Play, Info, Star, ChevronLeft, ChevronRight, Tv } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useCallback, useState, useEffect, useRef } from "react";

function nav(navigate: (to: string) => void, anime: AnimeResult) {
  navigate(`/anime/${anime.id}`);
}

function NavBar() {
  const [, navigate] = useLocation();
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      paddingBottom: 14, paddingLeft: 16, paddingRight: 16, paddingTop: 14,
      background: "linear-gradient(to bottom, rgba(9,10,18,0.98) 0%, rgba(9,10,18,0) 100%)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #6C63FF, #4F46E5)",
          }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>▶</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>
            <span style={{ color: "#F1F1F5" }}>Anime</span>
            <span style={{ color: "#6C63FF" }}>FLEX</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[
            { icon: <Search size={18} color="rgba(255,255,255,0.65)" />, to: "/search" },
            { icon: <Bookmark size={18} color="rgba(255,255,255,0.65)" />, to: "/favorites" },
            { icon: <Clock size={18} color="rgba(255,255,255,0.65)" />, to: "/history" },
          ].map(({ icon, to }, i) => (
            <button key={i} onClick={() => navigate(to)} style={{
              padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.07)",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center",
            }}>
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroBanner({ animes, idx, onPrev, onNext }: { animes: AnimeResult[]; idx: number; onPrev: () => void; onNext: () => void }) {
  const [, navigate] = useLocation();
  const anime = animes[idx];
  if (!anime) return <div style={{ height: "70vw", maxHeight: 520, background: "#13131C" }} />;
  const title = resolveTitle(anime.title);

  return (
    <div style={{ position: "relative", height: "min(70vw, 520px)", overflow: "hidden" }}>
      <img src={anime.cover || anime.image} alt={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(9,10,18,0) 0%, rgba(9,10,18,0.35) 30%, rgba(9,10,18,0.88) 70%, #090A12 100%)" }} />
      <div style={{ position: "absolute", inset: 0, width: "55%", background: "linear-gradient(to right, rgba(9,10,18,0.6), transparent)" }} />

      <div style={{ position: "absolute", bottom: 32, left: 20, right: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ background: "#6C63FF", borderRadius: 5, padding: "3px 8px", color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>HD</span>
          {anime.type && (
            <span style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 5, padding: "3px 8px", color: "#fff", fontSize: 9, fontWeight: 700 }}>{anime.type}</span>
          )}
          {anime.status === "Ongoing" && (
            <span style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 5, padding: "3px 8px", color: "#22C55E", fontSize: 9, fontWeight: 900, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              EN EMISIÓN
            </span>
          )}
        </div>

        <div style={{ color: "#fff", fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.5, textShadow: "0 2px 8px rgba(0,0,0,0.9)", maxWidth: 480 }} className="line-clamp-2">
          {title}
        </div>

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

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={() => nav(navigate, anime)} style={{
            background: "linear-gradient(135deg, #6C63FF, #4F46E5)", border: "none", borderRadius: 12,
            padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Play size={16} fill="#fff" /> Ver Ahora
          </button>
          <button onClick={() => nav(navigate, anime)} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12,
            padding: "12px 16px", color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Info size={16} /> Detalles
          </button>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 14, right: 20, display: "flex", gap: 4 }}>
        {animes.slice(0, 6).map((_, i) => (
          <div key={i} style={{ height: 5, borderRadius: 3, background: i === idx ? "#6C63FF" : "rgba(255,255,255,0.25)", width: i === idx ? 18 : 5, transition: "width 0.3s" }} />
        ))}
      </div>

      <button onClick={onPrev} style={{
        position: "absolute", top: "55%", left: 12, transform: "translateY(-50%)",
        background: "rgba(9,10,18,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22,
        padding: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ChevronLeft size={22} color="rgba(255,255,255,0.85)" />
      </button>
      <button onClick={onNext} style={{
        position: "absolute", top: "55%", right: 12, transform: "translateY(-50%)",
        background: "rgba(9,10,18,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22,
        padding: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <ChevronRight size={22} color="rgba(255,255,255,0.85)" />
      </button>
    </div>
  );
}

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

function PortraitCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div className="p-card" onClick={() => nav(navigate, anime)}>
      <img src={anime.image} alt={title} />
      <div className="p-card-grad" />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: "#22C55E", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>SUB</span>
        {anime.totalEpisodes && (
          <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>{anime.totalEpisodes}</span>
        )}
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

function RecentCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div className="r-card" onClick={() => nav(navigate, anime)}>
      <img src={anime.cover || anime.image} alt={title} />
      <div className="r-card-grad" />
      <div className="r-play-circle">
        <Play size={18} color="#fff" fill="#fff" />
      </div>
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

function TopAnimeRow({ anime, rank }: { anime: AnimeResult; rank: number }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div
      onClick={() => nav(navigate, anime)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
        borderRadius: 4, transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#12121E")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: rank <= 3 ? "#6C63FF" : "rgba(255,255,255,0.35)", fontSize: 18, fontWeight: 900, width: 30, textAlign: "center" }}>
        {String(rank).padStart(2, "0")}
      </span>
      <img src={anime.image} alt={title} style={{ width: 46, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, lineHeight: 1.35 }} className="line-clamp-2">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {anime.type && (
            <span style={{ color: "#6C63FF", fontSize: 9, fontWeight: 700, background: "rgba(108,99,255,0.18)", padding: "1px 5px", borderRadius: 4 }}>{anime.type}</span>
          )}
          {anime.releaseDate && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{anime.releaseDate}</span>}
        </div>
        {anime.genres && anime.genres.length > 0 && (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }} className="line-clamp-1">{anime.genres.slice(0, 2).join(" · ")}</div>
        )}
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

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai", "Thriller", "Mystery"];

function GenresSection() {
  const [, navigate] = useLocation();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px" }}>
      {GENRES.map((g) => (
        <button
          key={g}
          onClick={() => navigate(`/search?q=${g}`)}
          style={{
            background: "#12121E", borderRadius: 20, padding: "8px 14px",
            border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.65)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(108,99,255,0.15)"; e.currentTarget.style.borderColor = "rgba(108,99,255,0.35)"; e.currentTarget.style.color = "#A78BFA"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#12121E"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

type WatchEntry = ReturnType<typeof useWatchProgress>["progress"][number];

function ContinueWatchingCard({ entry }: { entry: WatchEntry }) {
  const [, navigate] = useLocation();
  const pct = Math.min(1, entry.currentTime / Math.max(entry.duration, 1));
  return (
    <div className="cw-card" onClick={() => navigate(`/anime/${entry.animeId}`)}>
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

function SkeletonPortrait() {
  return <div style={{ width: 130, height: 197, borderRadius: 14, background: "#12121E", flexShrink: 0 }} />;
}
function SkeletonRecent() {
  return <div style={{ width: 220, height: 136, borderRadius: 14, background: "#12121E", flexShrink: 0 }} />;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [heroIdx, setHeroIdx] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const { progress: watchProgress } = useWatchProgress();

  const trending = useQuery({ queryKey: ["trending", refreshKey], queryFn: consumet.trending, staleTime: 1000 * 60 * 10 });
  const popular = useQuery({ queryKey: ["popular", refreshKey], queryFn: consumet.popular, staleTime: 1000 * 60 * 10 });
  const recent = useQuery({ queryKey: ["recent", refreshKey], queryFn: consumet.recentEpisodes, staleTime: 1000 * 60 * 5 });

  const trendList = trending.data?.results ?? [];
  const popularList = popular.data?.results ?? [];
  const recentList = recent.data?.results ?? [];

  const prevHero = useCallback(() => setHeroIdx(i => (i > 0 ? i - 1 : Math.max(0, trendList.length - 1))), [trendList.length]);
  const nextHero = useCallback(() => setHeroIdx(i => (i < trendList.length - 1 ? i + 1 : 0)), [trendList.length]);

  useEffect(() => {
    if (trendList.length === 0) return;
    const t = setInterval(nextHero, 5000);
    return () => clearInterval(t);
  }, [trendList.length, nextHero]);

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <NavBar />

      <div style={{ paddingBottom: 40 }}>
        {trendList.length > 0 ? (
          <HeroBanner animes={trendList} idx={heroIdx} onPrev={prevHero} onNext={nextHero} />
        ) : (
          <div style={{ height: "min(70vw, 520px)", background: "#13131C" }} />
        )}

        {watchProgress.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <SectionHeader title="▶ Continuar viendo" />
            <div className="carousel-scroll">
              {watchProgress.slice(0, 8).map((e) => <ContinueWatchingCard key={`cw-${e.episodeId}`} entry={e} />)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="🔥 Tendencias" />
          <div className="carousel-scroll">
            {trending.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonPortrait key={i} />)
              : trendList.slice(0, 12).map((a) => <PortraitCard key={`t-${a.id}`} anime={a} />)}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="⚡ Últimos Episodios" />
          <div className="carousel-scroll">
            {recent.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRecent key={i} />)
              : recentList.slice(0, 10).map((a) => <RecentCard key={`r-${a.id}`} anime={a} />)}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <SectionHeader title="⭐ Más Populares" />
          <div className="carousel-scroll">
            {popular.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonPortrait key={i} />)
              : popularList.slice(0, 12).map((a) => <PortraitCard key={`p-${a.id}`} anime={a} />)}
          </div>
        </div>

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
    </div>
  );
}
